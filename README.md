# Gestionale attività e contatti

Piccolo gestionale per un gruppo di lavoro: attività con scadenze, priorità, partecipanti, commenti, allegati e cronologia; anagrafica dei contatti collegabile alle attività; cruscotto con le urgenze del giorno.

È un **unico file HTML** senza dipendenze esterne. I dati restano nel browser (archivio locale) e si possono salvare e ripristinare come copia di sicurezza in formato JSON. Alla prima apertura si crea l'amministratore del gruppo, che poi aggiunge gli altri utenti.

**Avvisi per posta elettronica.** Quando si registra un utente o cambia qualcosa in un'attività (stato, scadenza, commenti, partecipanti, allegati), l'app prepara un messaggio per le persone interessate e lo apre nel programma di posta del dispositivo, già compilato: a premere «Invia» è la persona. Dal Profilo si sceglie se aprirlo subito, mostrare un pulsante o non avvisare. In alternativa l'amministratore può collegare il **servizio di posta del gruppo** (cartella `servizio-posta/`, un Worker Cloudflare che spedisce via SMTP dalla casella del gruppo): in quel caso gli avvisi partono da soli.

Online: https://costalonga.org/gestionale-attivita/

Autore: @ginopizza. Licenza MIT.
