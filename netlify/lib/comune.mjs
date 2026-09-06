/* =====================================================================
   Strumenti comuni alle funzioni del servizio del gruppo
   (posta, archivio condiviso, documenti).
   ===================================================================== */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const PREDEFINITI = {
  SMTP_HOST: 'smtp.hostinger.com',
  SMTP_PORT: '465',
  SMTP_UTENTE: 'info@costalonga.org',
  MITTENTE_NOME: 'Gestionale attività e contatti',
  ORIGINI_AMMESSE: 'https://costalonga.org,https://www.costalonga.org,https://guidocostalonga.github.io,http://localhost:8193'
};
export const env = (nome) => process.env[nome] || PREDEFINITI[nome] || '';

export function indirizzoValido(valore) {
  return /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(valore);
}

export function chiaveValida(richiesta) {
  const attesa = process.env.CHIAVE_SERVIZIO ?? '';
  const chiave = (richiesta.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return attesa.length > 0 && chiave.length > 0 && confrontoCostante(chiave, attesa);
}

// Confronto che non rivela lunghezza o caratteri giusti dai tempi di risposta
function confrontoCostante(a, b) {
  const ca = new TextEncoder().encode(a), cb = new TextEncoder().encode(b);
  let diverso = ca.length ^ cb.length;
  for (let i = 0; i < Math.max(ca.length, cb.length); i++) diverso |= (ca[i] ?? 0) ^ (cb[i] ?? 0);
  return diverso === 0;
}

export function origineAmmessa(origine) {
  const ammesse = env('ORIGINI_AMMESSE').split(',').map((o) => o.trim()).filter(Boolean);
  return ammesse.includes(origine);
}

export function intestazioniCors(origine) {
  const base = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Nome-File',
    'Access-Control-Expose-Headers': 'Content-Disposition, X-Nome-File',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (origine && origineAmmessa(origine)) base['Access-Control-Allow-Origin'] = origine;
  return base;
}

export function rispondi(oggetto, stato, cors) {
  return new Response(JSON.stringify(oggetto), {
    status: stato, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

// Controlli comuni in testa a ogni funzione: CORS, origine e chiave.
// Restituisce una Response se la richiesta va fermata, altrimenti null.
export function controllaAccesso(richiesta, cors, { origineObbligatoria = true } = {}) {
  const origine = richiesta.headers.get('origin') ?? '';
  if (richiesta.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (origineObbligatoria && !origineAmmessa(origine)) return rispondi({ ok: false, errore: 'Origine non ammessa.' }, 403, cors);
  if (!chiaveValida(richiesta)) return rispondi({ ok: false, errore: 'Chiave del servizio assente o errata.' }, 401, cors);
  return null;
}

/* --- Deposito dei dati: Netlify Blobs in produzione, cartella locale nelle prove --- */
export async function negozio() {
  const cartella = process.env.NEGOZIO_LOCALE;
  if (cartella) return negozioSuCartella(cartella);
  const { getStore } = await import('@netlify/blobs');
  const store = getStore({ name: 'gestionale', consistency: 'strong' });
  return {
    leggiJson: (chiave) => store.get(chiave, { type: 'json' }),
    scriviJson: (chiave, dati) => store.setJSON(chiave, dati),
    leggiBinario: async (chiave) => {
      const r = await store.getWithMetadata(chiave, { type: 'arrayBuffer' });
      return r ? { dati: r.data, metadati: r.metadata ?? {} } : null;
    },
    scriviBinario: (chiave, dati, metadati) => store.set(chiave, dati, { metadata: metadati }),
    elimina: (chiave) => store.delete(chiave)
  };
}

function negozioSuCartella(cartella) {
  const percorso = (chiave) => path.join(cartella, chiave.replace(/[^A-Za-z0-9_.-]/g, '_'));
  const leggiFile = async (p) => { try { return await fs.readFile(p); } catch { return null; } };
  return {
    leggiJson: async (chiave) => { const b = await leggiFile(percorso(chiave) + '.json'); return b ? JSON.parse(b.toString('utf8')) : null; },
    scriviJson: async (chiave, dati) => { await fs.mkdir(cartella, { recursive: true }); await fs.writeFile(percorso(chiave) + '.json', JSON.stringify(dati)); },
    leggiBinario: async (chiave) => {
      const dati = await leggiFile(percorso(chiave) + '.bin');
      if (!dati) return null;
      const meta = await leggiFile(percorso(chiave) + '.meta.json');
      return { dati: dati.buffer.slice(dati.byteOffset, dati.byteOffset + dati.byteLength), metadati: meta ? JSON.parse(meta.toString('utf8')) : {} };
    },
    scriviBinario: async (chiave, dati, metadati) => {
      await fs.mkdir(cartella, { recursive: true });
      await fs.writeFile(percorso(chiave) + '.bin', Buffer.from(dati));
      await fs.writeFile(percorso(chiave) + '.meta.json', JSON.stringify(metadati ?? {}));
    },
    elimina: async (chiave) => { for (const s of ['.bin', '.meta.json', '.json']) { try { await fs.unlink(percorso(chiave) + s); } catch { /* già assente */ } } }
  };
}
