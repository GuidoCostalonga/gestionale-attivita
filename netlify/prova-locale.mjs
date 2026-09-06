/* Server di prova: monta le tre funzioni su http://localhost:8194 con un
   deposito su cartella, per provare l'app in locale senza Netlify.
     node netlify/prova-locale.mjs
   Chiave del servizio: CHIAVE_SERVIZIO (predefinita «prova»). */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const qui = path.dirname(fileURLToPath(import.meta.url));
process.env.NEGOZIO_LOCALE ??= path.join(qui, '..', '.netlify', 'deposito-prova');
process.env.CHIAVE_SERVIZIO ??= 'prova';

const funzioni = [];
for (const nome of ['archivio', 'documenti', 'invia']) {
  const modulo = await import(`./functions/${nome}.mjs`);
  const schema = modulo.config.path;
  const espressione = new RegExp('^' + schema.replace(/:([a-z]+)/gi, '(?<$1>[^/]+)') + '/?$');
  funzioni.push({ nome, espressione, gestore: modulo.default });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8194');
  const trovata = funzioni.map((f) => ({ f, m: url.pathname.match(f.espressione) })).find((x) => x.m);
  if (!trovata) { res.writeHead(404); res.end('nessuna funzione'); return; }
  const pezzi = [];
  for await (const p of req) pezzi.push(p);
  const corpo = Buffer.concat(pezzi);
  const richiesta = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : corpo,
    duplex: 'half'
  });
  try {
    const risposta = await trovata.f.gestore(richiesta, { params: trovata.m.groups ?? {} });
    res.writeHead(risposta.status, Object.fromEntries(risposta.headers));
    res.end(Buffer.from(await risposta.arrayBuffer()));
  } catch (errore) {
    console.error(errore);
    res.writeHead(500); res.end(String(errore));
  }
}).listen(8194, () => console.log('servizio di prova su http://localhost:8194 (deposito:', process.env.NEGOZIO_LOCALE + ')'));
