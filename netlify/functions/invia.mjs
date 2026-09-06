/* =====================================================================
   SERVIZIO DI POSTA DEL GESTIONALE (funzione Netlify)
   Riceve dal gestionale la richiesta di avviso e la spedisce via SMTP
   dalla casella del gruppo. Risponde su /invia.

   Variabili d'ambiente da impostare su Netlify (Site configuration →
   Environment variables):
     SMTP_PASSWORD     password della casella (segreto)
     CHIAVE_SERVIZIO   parola d'ordine condivisa con il gestionale (segreto)
   Facoltative, con questi valori predefiniti:
     SMTP_HOST=smtp.hostinger.com  SMTP_PORT=465  SMTP_UTENTE=info@costalonga.org
     MITTENTE_NOME="Gestionale attività e contatti"
     ORIGINI_AMMESSE=https://costalonga.org,https://www.costalonga.org,https://guidocostalonga.github.io
   ===================================================================== */
import nodemailer from 'nodemailer';
import { env, indirizzoValido, chiaveValida, origineAmmessa, intestazioniCors, rispondi } from '../lib/comune.mjs';

export const config = { path: '/invia' };

const LIMITI = { destinatari: 25, oggetto: 200, testo: 20000 };

export default async (richiesta) => {
  const origine = richiesta.headers.get('origin') ?? '';
  const cors = intestazioniCors(origine);

  if (richiesta.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  // Stato: senza chiave dice solo che è vivo; con la chiave conferma la configurazione
  if (richiesta.method === 'GET') {
    const autorizzato = chiaveValida(richiesta);
    return rispondi({
      ok: true, servizio: 'gestionale-posta',
      chiave: autorizzato ? 'valida' : 'assente o errata',
      mittente: autorizzato ? env('SMTP_UTENTE') : undefined,
      passwordImpostata: autorizzato ? Boolean(process.env.SMTP_PASSWORD) : undefined,
      archivioCondiviso: true
    }, 200, cors);
  }

  if (richiesta.method !== 'POST') return rispondi({ ok: false, errore: 'Metodo non ammesso.' }, 405, cors);
  if (!origineAmmessa(origine)) return rispondi({ ok: false, errore: 'Origine non ammessa.' }, 403, cors);
  if (!chiaveValida(richiesta)) return rispondi({ ok: false, errore: 'Chiave del servizio assente o errata.' }, 401, cors);
  if (!process.env.SMTP_PASSWORD) return rispondi({ ok: false, errore: 'Password della casella non ancora impostata sul servizio.' }, 503, cors);

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

  const porta = Number(env('SMTP_PORT')) || 465;
  const trasporto = nodemailer.createTransport({
    host: env('SMTP_HOST'),
    port: porta,
    secure: porta === 465,             // 465: TLS diretto; 587: STARTTLS
    requireTLS: porta !== 465,
    auth: { user: env('SMTP_UTENTE'), pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });

  try {
    const esito = await trasporto.sendMail({
      from: { name: env('MITTENTE_NOME'), address: env('SMTP_UTENTE') },
      to: destinatari,
      replyTo: indirizzoValido(rispondiA) ? rispondiA : undefined,
      subject: oggetto,
      text: testo
    });
    return rispondi({ ok: true, inviati: (esito.accepted ?? []).length, rifiutati: esito.rejected ?? [] }, 200, cors);
  } catch (errore) {
    console.error('Invio fallito:', errore?.message ?? errore);
    return rispondi({ ok: false, errore: spiega(errore), dettaglio: String(errore?.message ?? errore).slice(0, 300) }, 502, cors);
  }
};

function spiega(errore) {
  const testo = String(errore?.message ?? errore ?? '');
  if (/535|auth|credential|password/i.test(testo)) return 'Il server di posta ha rifiutato le credenziali: controlla utente e password della casella.';
  if (/timeout|ETIMEDOUT|ECONNREFUSED|connect/i.test(testo)) return 'Il server di posta non risponde.';
  if (/550|551|553|recipient|rejected/i.test(testo)) return 'Il server di posta ha rifiutato uno dei destinatari.';
  return `Invio non riuscito: ${testo.slice(0, 200)}`;
}
