/* =====================================================================
   ARCHIVIO CONDIVISO DEL GRUPPO
   Un solo oggetto JSON con tutte le tabelle del gestionale, custodito
   nel deposito del sito. Ogni salvataggio porta un numero di versione:
   chi salva deve dichiarare la versione che aveva letto, così due
   persone non si sovrascrivono a vicenda senza accorgersene.

     GET  /archivio            → { ok, versione, archivio|null }
     GET  /archivio?dopo=N     → 204 se la versione è ancora N
     PUT  /archivio            { versioneAttesa, archivio } → { ok, versione }
                               409 { conflitto:true, versione, archivio } se qualcuno ha salvato prima
   ===================================================================== */
import { controllaAccesso, intestazioniCors, rispondi, negozio } from '../lib/comune.mjs';

export const config = { path: '/archivio' };

const CHIAVE = 'archivio';
const DIMENSIONE_MASSIMA = 5 * 1024 * 1024;

function archivioValido(o) {
  return o && typeof o === 'object'
    && ['profili', 'contatti', 'attivita', 'partecipanti', 'commenti', 'allegati', 'registro_eventi'].every((t) => Array.isArray(o[t]));
}

export default async (richiesta) => {
  const cors = intestazioniCors(richiesta.headers.get('origin') ?? '');
  const fermo = controllaAccesso(richiesta, cors);
  if (fermo) return fermo;

  const deposito = await negozio();

  if (richiesta.method === 'GET') {
    const salvato = await deposito.leggiJson(CHIAVE);
    const versione = salvato?.versione ?? 0;
    const dopo = new URL(richiesta.url).searchParams.get('dopo');
    if (dopo !== null && Number(dopo) === versione) return new Response(null, { status: 204, headers: cors });
    return rispondi({ ok: true, versione, archivio: salvato?.archivio ?? null, salvato_il: salvato?.salvato_il ?? null, da: salvato?.da ?? null }, 200, cors);
  }

  if (richiesta.method !== 'PUT') return rispondi({ ok: false, errore: 'Metodo non ammesso.' }, 405, cors);

  let corpo;
  try { corpo = await richiesta.json(); }
  catch { return rispondi({ ok: false, errore: 'Corpo della richiesta non leggibile.' }, 400, cors); }
  if (!archivioValido(corpo.archivio)) return rispondi({ ok: false, errore: 'Archivio non valido.' }, 400, cors);
  const testo = JSON.stringify(corpo.archivio);
  if (testo.length > DIMENSIONE_MASSIMA) return rispondi({ ok: false, errore: 'L’archivio supera i 5 MB: sposta i file grandi fra i documenti.' }, 413, cors);

  const salvato = await deposito.leggiJson(CHIAVE);
  const versioneAttuale = salvato?.versione ?? 0;
  const attesa = Number(corpo.versioneAttesa ?? 0);
  if (attesa !== versioneAttuale) {
    return rispondi({ ok: false, conflitto: true, versione: versioneAttuale, archivio: salvato?.archivio ?? null }, 409, cors);
  }
  const nuova = versioneAttuale + 1;
  await deposito.scriviJson(CHIAVE, { versione: nuova, archivio: corpo.archivio, salvato_il: new Date().toISOString(), da: String(corpo.da ?? '').slice(0, 120) });
  return rispondi({ ok: true, versione: nuova }, 200, cors);
};
