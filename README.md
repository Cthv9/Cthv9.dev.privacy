# Informative privacy

Le informative privacy delle app, scritte in Markdown e pubblicate come siti statici da GitHub Actions. Ogni app ha la sua cartella e il suo indirizzo, tutte nello stesso repository.

| App | Informativa |
|---|---|
| Portale Commissioning | [`apps/portale-commissioning/privacy.md`](apps/portale-commissioning/privacy.md) |

Dopo la pubblicazione, l'indirizzo di ogni app è `<indirizzo del sito>/<cartella dell'app>/` e l'elenco di tutte è nella pagina iniziale. L'indirizzo esatto lo mostra il job *deploy* di Actions e *Settings → Pages*.

## Come funziona

```
apps/
  <app>/
    app.json       titolo, descrizione e lingua (it, en, …)
    privacy.md     l'informativa → <sito>/<app>/
    altro.md       pagine aggiuntive, per esempio privacy.en.md → <sito>/<app>/privacy.en.html
templates/page.html  grafica comune a tutte le pagine
scripts/build.mjs    Markdown → HTML
.github/workflows/pages.yml
```

A ogni modifica su `main` il workflow **Pubblica le informative** genera il sito e lo pubblica. Si può lanciare anche a mano: *Actions → Pubblica le informative → Run workflow*. Sulle pull request genera il sito senza pubblicarlo, per vedere se la build passa.

## Impostazioni da fare una volta

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables** (la scheda *Variables*, non *Secrets*): crea le variabili usate dai testi.

| Variabile | Contenuto |
|---|---|
| `PRIVACY_EDITORE` | Nome di chi pubblica l'app (persona o società) |
| `PRIVACY_CONTATTO` | Email per le domande sulla privacy (meglio una casella dedicata) |

Il repository è pubblico: nome e contatto **non vanno scritti nei file**. Stanno nelle variabili e compaiono solo nella pagina pubblicata, che li deve mostrare.

Un segnaposto `{{NOME}}` in un testo si sostituisce con la variabile `PRIVACY_NOME`. Se una variabile manca o è vuota, la build **fallisce** e non pubblica nulla, così non esce mai una pagina con i segnaposto in vista. Se un'app ha un editore o un contatto diverso, usa nomi propri, per esempio `{{ALTRAAPP_EDITORE}}` con la variabile `PRIVACY_ALTRAAPP_EDITORE`.

## Aggiungere un'app

1. Crea `apps/<nome-app>/` (solo minuscole, numeri e trattini: diventa parte dell'indirizzo).
2. Aggiungi `app.json`:
   ```json
   { "title": "Nome dell'app", "description": "Una riga", "lang": "it" }
   ```
3. Scrivi `privacy.md` (si può partire da quella di `portale-commissioning`).
4. Se usi segnaposto nuovi, crea le variabili `PRIVACY_…`.
5. Fai commit su `main`: la pagina compare da sola.

## Provare in locale

Servono Node 22 o successivo.

```bash
npm ci
npm run preview      # segnaposto lasciati in vista, solo per vedere la grafica
PRIVACY_EDITORE="…" PRIVACY_CONTATTO="…" npm run build   # come su Actions
```

Il sito generato è in `_site/`.

## Dominio proprio

Con un dominio personalizzato (*Settings → Pages → Custom domain*) gli indirizzi diventano `https://<dominio>/<app>/`. I link nelle pagine sono relativi, quindi non cambia nulla nei file.
