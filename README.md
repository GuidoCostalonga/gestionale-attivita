# Gestionale attività e contatti

Piccolo gestionale per un gruppo di lavoro: attività con scadenze, priorità, partecipanti, commenti, allegati e cronologia; anagrafica dei contatti collegabile alle attività; cruscotto con le urgenze del giorno.

È un **unico file HTML** senza dipendenze esterne. I dati restano nel browser (archivio locale) e si possono salvare e ripristinare come copia di sicurezza in formato JSON. Alla prima apertura si crea l'amministratore del gruppo, che poi aggiunge gli altri utenti.

**Avvisi per posta elettronica.** Quando si registra un utente o cambia qualcosa in un'attività (stato, scadenza, commenti, partecipanti, allegati), l'app prepara un messaggio per le persone interessate e lo apre nel programma di posta del dispositivo, già compilato: a premere «Invia» è la persona. Dal Profilo si sceglie se aprirlo subito, mostrare un pulsante o non avvisare. In alternativa l'amministratore può collegare il **servizio di posta del gruppo** (la funzione Netlify in `netlify/functions/invia.mjs`, che spedisce via SMTP dalla casella del gruppo): in quel caso gli avvisi partono da soli.

Online: https://costalonga.org/gestionale-attivita/

Autore: @ginopizza. Licenza MIT.

## Servizio di posta (Netlify)

Il repo si pubblica anche su Netlify: la pagina resta la stessa, in più c'è la funzione `/invia` che spedisce gli avvisi via SMTP.

1. Su Netlify: *Add new site → Import an existing project → GitHub → gestionale-attivita*, impostazioni predefinite (le legge da `netlify.toml`).
2. *Site configuration → Environment variables*: aggiungere `SMTP_PASSWORD` (password della casella) e `CHIAVE_SERVIZIO` (parola d'ordine a piacere), poi rifare il deploy.
3. Nel gestionale, Profilo → *Servizio di posta del gruppo*: indirizzo `https://<nome-sito>.netlify.app/invia` e la stessa chiave, poi *Salva e prova*.

Server, porta e casella mittente hanno valori predefiniti nel codice (smtp.hostinger.com, 465, info@costalonga.org) e si possono cambiare con le variabili `SMTP_HOST`, `SMTP_PORT`, `SMTP_UTENTE`, `MITTENTE_NOME`, `ORIGINI_AMMESSE`.
