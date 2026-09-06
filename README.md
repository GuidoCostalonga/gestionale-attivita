# Gestionale attività e contatti

Piccolo gestionale per un gruppo di lavoro: attività con scadenze, priorità, partecipanti, commenti, allegati e cronologia; anagrafica dei contatti collegabile alle attività; cruscotto con le urgenze del giorno.

È un **unico file HTML** senza dipendenze esterne. Può lavorare da solo, con l'archivio nel browser, oppure collegarsi al **servizio del gruppo** (le funzioni Netlify nella cartella `netlify/`): in quel caso l'archivio è condiviso fra tutte le persone, i documenti allegati stanno in un deposito comune e gli avvisi partono da soli per posta. In entrambi i casi l'archivio si salva e si ripristina come copia di sicurezza JSON.

Ogni persona coinvolta in un'attività può segnare **la propria parte come eseguita** senza chiudere l'attività: l'elenco mostra quante parti sono state fatte (per esempio «Eseguito 2/3») e quando tutti hanno finito l'app suggerisce di completarla. Alla prima apertura si crea l'amministratore del gruppo, che poi aggiunge gli altri utenti.

**Avvisi per posta elettronica.** Quando si registra un utente o cambia qualcosa in un'attività (stato, scadenza, commenti, partecipanti, allegati), l'app prepara un messaggio per le persone interessate e lo apre nel programma di posta del dispositivo, già compilato: a premere «Invia» è la persona. Dal Profilo si sceglie se aprirlo subito, mostrare un pulsante o non avvisare. In alternativa l'amministratore può collegare il **servizio di posta del gruppo** (la funzione Netlify in `netlify/functions/invia.mjs`, che spedisce via SMTP dalla casella del gruppo): in quel caso gli avvisi partono da soli.

Online: https://costalonga.org/gestionale-attivita/

Autore: @ginopizza. Licenza MIT.

## Servizio del gruppo (Netlify)

Il repo si pubblica anche su Netlify: la pagina resta la stessa, in più ci sono tre funzioni: `/invia` spedisce gli avvisi via SMTP, `/archivio` custodisce l'archivio condiviso (con numero di versione, per non sovrascriversi a vicenda), `/documenti/:id` custodisce i file allegati (fino a 4 MB). I dati stanno in Netlify Blobs. Per provare in locale: `node netlify/prova-locale.mjs` (chiave `prova`, porta 8194).

1. Su Netlify: *Add new site → Import an existing project → GitHub → gestionale-attivita*, impostazioni predefinite (le legge da `netlify.toml`).
2. *Site configuration → Environment variables*: aggiungere `SMTP_PASSWORD` (password della casella) e `CHIAVE_SERVIZIO` (parola d'ordine a piacere), poi rifare il deploy.
3. Nel gestionale, alla prima apertura su ogni dispositivo (o da Profilo → *Servizio del gruppo*): indirizzo `https://<nome-sito>.netlify.app` e la stessa chiave, poi *Collega*. Il primo dispositivo carica il proprio archivio sul servizio; gli altri lo scaricano.

Server, porta e casella mittente hanno valori predefiniti nel codice (smtp.hostinger.com, 465, info@costalonga.org) e si possono cambiare con le variabili `SMTP_HOST`, `SMTP_PORT`, `SMTP_UTENTE`, `MITTENTE_NOME`, `ORIGINI_AMMESSE`.
