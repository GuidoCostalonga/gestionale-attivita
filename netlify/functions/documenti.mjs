/* =====================================================================
   DOCUMENTI ALLEGATI ALLE ATTIVITÀ
   I file stanno nel deposito del sito, così li vedono tutti i membri
   del gruppo. L'archivio conserva soltanto il riferimento (id, nome,
   tipo, dimensione).

     PUT    /documenti/:id   corpo = i byte del file, intestazioni Content-Type e X-Nome-File
     GET    /documenti/:id   → il file
     DELETE /documenti/:id
   ===================================================================== */
import { controllaAccesso, intestazioniCors, rispondi, negozio } from '../lib/comune.mjs';

export const config = { path: '/documenti/:id' };

const DIMENSIONE_MASSIMA = 4 * 1024 * 1024;

export default async (richiesta, contesto) => {
  const cors = intestazioniCors(richiesta.headers.get('origin') ?? '');
  const fermo = controllaAccesso(richiesta, cors);
  if (fermo) return fermo;

  const id = String(contesto?.params?.id ?? new URL(richiesta.url).pathname.split('/').pop() ?? '');
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) return rispondi({ ok: false, errore: 'Identificativo del documento non valido.' }, 400, cors);
  const chiave = `documento/${id}`;
  const deposito = await negozio();

  if (richiesta.method === 'GET') {
    const trovato = await deposito.leggiBinario(chiave);
    if (!trovato) return rispondi({ ok: false, errore: 'Documento non trovato.' }, 404, cors);
    const nome = String(trovato.metadati.nome ?? 'documento');
    return new Response(trovato.dati, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': String(trovato.metadati.tipo || 'application/octet-stream'),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nome)}`,
        'X-Nome-File': encodeURIComponent(nome),
        'Cache-Control': 'private, max-age=3600'
      }
    });
  }

  if (richiesta.method === 'PUT') {
    const dati = await richiesta.arrayBuffer();
    if (!dati.byteLength) return rispondi({ ok: false, errore: 'File vuoto.' }, 400, cors);
    if (dati.byteLength > DIMENSIONE_MASSIMA) return rispondi({ ok: false, errore: 'Il file supera la dimensione massima di 4 MB.' }, 413, cors);
    let nome = 'documento';
    try { nome = decodeURIComponent(richiesta.headers.get('x-nome-file') ?? '') || nome; } catch { /* nome non decodificabile */ }
    const tipo = (richiesta.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
    await deposito.scriviBinario(chiave, dati, { nome: nome.slice(0, 200), tipo, dimensione: dati.byteLength, caricato_il: new Date().toISOString() });
    return rispondi({ ok: true, id, nome, tipo, dimensione: dati.byteLength }, 200, cors);
  }

  if (richiesta.method === 'DELETE') {
    await deposito.elimina(chiave);
    return rispondi({ ok: true }, 200, cors);
  }

  return rispondi({ ok: false, errore: 'Metodo non ammesso.' }, 405, cors);
};
