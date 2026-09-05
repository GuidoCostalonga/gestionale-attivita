/* =====================================================================
   SERVIZIO DI POSTA DEL GESTIONALE
   Piccolo Worker Cloudflare che riceve dal gestionale (pagina statica)
   la richiesta di avviso e la spedisce via SMTP dalla casella del gruppo.

   Segreti (wrangler secret put …):
     SMTP_PASSWORD     password della casella
     CHIAVE_SERVIZIO   parola d'ordine condivisa con il gestionale
   Variabili (wrangler.jsonc):
     SMTP_HOST, SMTP_PORT, SMTP_UTENTE, MITTENTE_NOME, ORIGINI_AMMESSE
   ===================================================================== */
import { WorkerMailer } from 'worker-mailer';

const LIMITI = { destinatari: 25, oggetto: 200, testo: 20000 };

export default {
  async fetch(richiesta, env) {
    const origine = richiesta.headers.get('Origin') ?? '';
    const cors = intestazioniCors(origine, env);

    if (richiesta.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // Stato del servizio: senza chiave dice solo che è vivo, con la chiave conferma la configurazione
    if (richiesta.method === 'GET') {
      const autorizzato = chiaveValida(richiesta, env);
      return rispondi({
        ok: true, servizio: 'gestionale-posta',
        chiave: autorizzato ? 'valida' : 'assente o errata',
        mittente: autorizzato ? env.SMTP_UTENTE : undefined,
        passwordImpostata: autorizzato ? Boolean(env.SMTP_PASSWORD) : undefined
      }, 200, cors);
    }

    if (richiesta.method !== 'POST') return rispondi({ ok: false, errore: 'Metodo non ammesso.' }, 405, cors);
    if (!origineAmmessa(origine, env)) return rispondi({ ok: false, errore: 'Origine non ammessa.' }, 403, cors);
    if (!chiaveValida(richiesta, env)) return rispondi({ ok: false, errore: 'Chiave del servizio assente o errata.' }, 401, cors);
    if (!env.SMTP_PASSWORD) return rispondi({ ok: false, errore: 'Password della casella non ancora impostata sul servizio.' }, 503, cors);

    let corpo;
    try { corpo = await richiesta.json(); }
    catch { return rispondi({ ok: false, errore: 'Corpo della richiesta non leggibile.' }, 400, cors); }

    const destinatari = [...new Set((Array.isArray(corpo.a) ? corpo.a : [corpo.a])
      .map((d) => String(d ?? '').trim().toLowerCase()).filter(indirizzoValido))];
    const oggetto = String(corpo.oggetto ?? '').trim().slice(0, LIMITI.oggetto);
    const testo = String(corpo.testo ?? '').trim().slice(0, LIMITI.testo);
    const rispondiA = String(corpo.rispondiA ?? '').trim().toLowerCase();

    if (!destinatari.length) return rispondi({ ok: false, errore: 'Nessun destinatario valido.' }, 400, cors);
    if (destinatari.length > LIMITI.destinatari) return rispondi({ ok: false, errore: `Troppi destinatari (massimo ${LIMITI.destinatari}).` }, 400, cors);
    if (!oggetto || !testo) return rispondi({ ok: false, errore: 'Oggetto e testo sono obbligatori.' }, 400, cors);

    try {
      await WorkerMailer.send({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT) || 465,
        secure: (Number(env.SMTP_PORT) || 465) === 465,
        startTls: (Number(env.SMTP_PORT) || 465) !== 465,
        credentials: { username: env.SMTP_UTENTE, password: env.SMTP_PASSWORD },
        authType: ['plain', 'login'],
        socketTimeoutMs: 20000,
        responseTimeoutMs: 20000
      }, {
        from: { name: env.MITTENTE_NOME || 'Gestionale', email: env.SMTP_UTENTE },
        to: destinatari.map((email) => ({ email })),
        reply: indirizzoValido(rispondiA) ? { email: rispondiA } : undefined,
        subject: oggetto,
        text: testo
      });
      return rispondi({ ok: true, inviati: destinatari.length }, 200, cors);
    } catch (errore) {
      console.error('Invio fallito:', errore?.message ?? errore);
      return rispondi({ ok: false, errore: spiega(errore) }, 502, cors);
    }
  }
};

function indirizzoValido(valore) {
  return /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(valore);
}

function chiaveValida(richiesta, env) {
  const auth = richiesta.headers.get('Authorization') ?? '';
  const chiave = auth.replace(/^Bearer\s+/i, '').trim();
  return Boolean(env.CHIAVE_SERVIZIO) && chiave.length > 0 && confrontoCostante(chiave, env.CHIAVE_SERVIZIO);
}

// Confronto che non rivela la lunghezza o i caratteri giusti dai tempi di risposta
function confrontoCostante(a, b) {
  const ca = new TextEncoder().encode(a), cb = new TextEncoder().encode(b);
  let diverso = ca.length ^ cb.length;
  for (let i = 0; i < Math.max(ca.length, cb.length); i++) diverso |= (ca[i] ?? 0) ^ (cb[i] ?? 0);
  return diverso === 0;
}

function origineAmmessa(origine, env) {
  const ammesse = String(env.ORIGINI_AMMESSE ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  return ammesse.includes(origine) || (origine === '' && ammesse.includes('*senza-origine*'));
}

function intestazioniCors(origine, env) {
  const base = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (origineAmmessa(origine, env) && origine) base['Access-Control-Allow-Origin'] = origine;
  return base;
}

function rispondi(oggetto, stato, cors) {
  return new Response(JSON.stringify(oggetto), {
    status: stato, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function spiega(errore) {
  const testo = String(errore?.message ?? errore ?? '');
  if (/535|auth|credential|password/i.test(testo)) return 'Il server di posta ha rifiutato le credenziali: controlla utente e password della casella.';
  if (/timeout|ETIMEDOUT|connect/i.test(testo)) return 'Il server di posta non risponde.';
  if (/550|551|553|recipient|rejected/i.test(testo)) return 'Il server di posta ha rifiutato uno dei destinatari.';
  return `Invio non riuscito: ${testo.slice(0, 200)}`;
}
