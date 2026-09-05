# Servizio di posta del gestionale

Worker Cloudflare che spedisce gli avvisi del gestionale dalla casella del gruppo (SMTP Hostinger).

- `wrangler.jsonc`: server, porta, casella mittente e origini ammesse.
- Segreti da impostare una volta: `SMTP_PASSWORD` (password della casella) e `CHIAVE_SERVIZIO` (parola d'ordine che il gestionale manda in ogni richiesta).

```bash
npx wrangler secret put SMTP_PASSWORD
npx wrangler secret put CHIAVE_SERVIZIO
npx wrangler deploy
```

Richiesta: `POST /` con `Authorization: Bearer <CHIAVE_SERVIZIO>` e corpo JSON `{ "a": ["…"], "oggetto": "…", "testo": "…", "rispondiA": "…" }`.
`GET /` con la stessa intestazione riporta lo stato della configurazione.
