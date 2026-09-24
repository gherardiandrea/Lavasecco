# Lavasecco

[![Test](https://github.com/gherardiandrea/Lavasecco/actions/workflows/test.yml/badge.svg)](https://github.com/gherardiandrea/Lavasecco/actions/workflows/test.yml)

Applicazione desktop Electron per la gestione ordini, clienti e listino di una lavanderia.

## Stato attuale

- Dati: SQLite integrato in Electron (`node:sqlite`), nessun modulo nativo da compilare.
- Il database è accessibile solo dal main process; la finestra gira in sandbox e comunica via IPC.
- Frontend: jQuery + Bootstrap 5 (modali) + DataTables, tutte le risorse in locale (funziona offline).

## Requisiti

- Node.js 22.12 o superiore (consigliato l'LTS corrente) con npm 10+.
- Windows, Linux o macOS.

## Installazione e avvio

```
npm install
npm start
```

## Test

```
npm test            # test unitari (circa 1 secondo)
npm run test:e2e    # test end-to-end sull'app vera (circa 25 secondi)
npm run test:tutti  # entrambi
```

| Cosa | Dove | Come |
|------|------|------|
| Database e migrazioni, backup e pulizia dei backup vecchi | [test/database.test.js](test/database.test.js) | `node:test` su database temporanei |
| Regole di business (ordini, consegne e "Annulla", clienti, listino, pagina "Oggi") | [test/repository.test.js](test/repository.test.js) | `node:test` |
| Canale IPC (metodi ammessi, mittente, formato degli errori) | [test/ipc.test.js](test/ipc.test.js) | `node:test`, senza Electron |
| Funzioni del renderer (escape dell'HTML, date, prezzi, celle delle tabelle, filtri) | [test/renderer.test.js](test/renderer.test.js) | gli script di `renderer/formato.js` e `renderer/celle.js` caricati in Node con l'orologio fissato |
| Flussi dell'interfaccia (pagina "Oggi", nuovo ordine, consegne e "Annulla", modifica ed eliminazione, clienti, listino) | [test/e2e/](test/e2e/) | Playwright avvia l'app Electron su un database di prova in una cartella temporanea |

I test end-to-end non toccano mai i dati reali: ogni file crea un database di prova
(con date relative al giorno in cui si eseguono) e usa un profilo Electron separato.
In caso di errore, screenshot e traccia finiscono in `test-results/`
(`npx playwright show-trace test-results/<test>/trace.zip` per rivederla passo passo).

Le funzioni di `renderer/formato.js` e `renderer/celle.js` non devono usare jQuery né il DOM,
così restano testabili in Node.

### Integrazione continua

A ogni push su `main` e a ogni pull request GitHub Actions ([.github/workflows/test.yml](.github/workflows/test.yml))
esegue i test unitari su Windows e Linux e, se passano, i test end-to-end su Windows.
Se un test end-to-end fallisce, screenshot e tracce sono scaricabili dalla pagina dell'esecuzione
(artefatto `risultati-e2e`). Si può anche lanciare a mano da **Actions → Test → Run workflow**.

### Nota su npm 12

npm 12 blocca le dipendenze prese da git e gli script di installazione non approvati:
- `overrides` in `package.json` fa prendere `@electron/node-gyp` (usato da Electron Forge) dal registro npm invece che da git;
- `allowScripts` approva lo script di `electron-winstaller`, che serve a `npm run make`;
- Electron scarica il suo binario al primo avvio (oppure subito con `npx install-electron`).

## Dove sono i dati

Il database si trova nella cartella dati dell'utente:

| Sistema  | Percorso                                                  |
|----------|-----------------------------------------------------------|
| Windows  | `%APPDATA%\Lavasecco\dati\lavasecco.sqlite3`               |
| macOS    | `~/Library/Application Support/Lavasecco/dati/`            |
| Linux    | `~/.config/Lavasecco/dati/`                                |

Dal menu **File → Apri cartella dati** si apre direttamente la cartella.

Variabili d'ambiente per personalizzare i percorsi: `LAVASECCO_DATA_DIR`, `LAVASECCO_DB_FILE`,
`LAVASECCO_BACKUP_DIR`, `LAVASECCO_BACKUP_RETENTION_DAYS` (vedi [app.config.js](app.config.js)).

## Backup

- **Automatico**: al primo avvio di ogni giorno viene creato un backup in `dati/backups/`;
  quelli più vecchi di 30 giorni vengono eliminati.
- **Esporta backup…** (riquadro "Backup" in fondo alla barra laterale, oppure menu File, `Ctrl+Shift+S`):
  salva una copia dove vuoi, ad esempio su una chiavetta. Il riquadro mostra anche quando è stato fatto l'ultimo backup.
- **Da riga di comando**: `npm run backup-db` (oppure `npm run backup-db -- D:\Backup` per scegliere la cartella).

Tutti i backup usano l'API di backup di SQLite: la copia è coerente anche con l'app aperta.
Per ripristinare un backup: chiudere l'app e sostituire `lavasecco.sqlite3` con il file di backup
(eliminando eventuali `lavasecco.sqlite3-wal` / `-shm` accanto).

## Uso

- **Oggi**: ritiri previsti per oggi (per posizione in negozio), ordini in ritardo, incasso del giorno
  e consegne della settimana. I riquadri aprono l'elenco già filtrato.
- **Da consegnare**: tutti gli ordini ancora da consegnare (anche in parte), di qualsiasi anno, con filtri
  rapidi "Ritiro oggi", "In ritardo", "Consegnati in parte". Eliminare un ordine: dalla modale di modifica.
- **Consegnati**: ordini consegnati dell'anno scelto (anno di registrazione dell'ordine).
- **Consegna**: un clic per gli ordini da un capo; con più capi si sceglie quanti ne ritira il cliente.
  Dopo ogni consegna (o annullamento di consegna) compare un messaggio con **Annulla**, che riporta
  l'ordine esattamente com'era.
- **Nuovo ordine**: il cliente si cerca per nome o telefono (anche creandolo al volo), più capi nello stesso
  ordine, anteprima della ricevuta con il totale aggiornato mentre si compila.
- La ricerca in alto filtra la tabella della pagina aperta.

Scorciatoie: <kbd>N</kbd> nuovo ordine, <kbd>/</kbd> cerca, <kbd>Ctrl</kbd>+<kbd>Invio</kbd> registra l'ordine,
<kbd>Esc</kbd> chiude.

Le tabelle ricevono i dati e disegnano solo le righe visibili; dopo un'azione si aggiorna solo la riga
interessata, mantenendo ricerca, filtri e pagina.

## Prezzi e listino

Ogni ordine salva il prezzo unitario del listino nel momento in cui viene inserito: modificare il prezzo
di un articolo (pagina **Listino → Modifica**) vale solo per i nuovi ordini, i totali di quelli esistenti
non cambiano. Se in un ordine si cambia il prodotto, l'ordine prende il prezzo di listino del nuovo prodotto.

Un articolo si può eliminare solo se non è mai stato usato in un ordine.

## Schema del database e aggiornamenti

Lo schema è versionato con `PRAGMA user_version`; le migrazioni sono in `MIGRAZIONI` in [database.js](database.js)
e vengono applicate automaticamente all'avvio. Prima di aggiornare un database esistente viene salvato
un backup completo in `dati/backups/pre-migrazione-v<versione>-<data>.sqlite3`.

| Versione | Contenuto |
|----------|-----------|
| 1 | Tabella `ordini` unica (versione 2.0 dell'app) |
| 2 | Prezzo salvato nell'ordine (`prezzo_unitario_cent`, `nota_prezzo`) e indici su cliente/prodotto |

I database delle versioni 1.x dell'app (tabelle `ordini_<anno>`) non vengono più convertiti:
vanno aperti prima con la versione 2.0.

## Struttura

| File | Ruolo |
|------|-------|
| [main.js](main.js) | Main process: finestra, IPC, menu, backup giornaliero |
| [database.js](database.js) | Apertura DB, schema versionato, migrazioni, backup |
| [repository.js](repository.js) | Operazioni e regole di business (validazioni, consegne) |
| [ipc.js](ipc.js) | Gestori delle richieste dal renderer (metodi ammessi, controllo del mittente, errori) |
| [preload.js](preload.js) | Ponte IPC minimale verso il renderer |
| [app.config.js](app.config.js) | Percorsi dati e backup |
| [renderer/formato.js](renderer/formato.js) | Formattazione, date, escape dell'HTML (funzioni pure) |
| [renderer/celle.js](renderer/celle.js) | HTML delle celle e delle righe, filtri rapidi (funzioni pure) |
| [renderer/base.js](renderer/base.js) | Stato, chiamate al main process, messaggi (toast) |
| [renderer/tabelle.js](renderer/tabelle.js) | Tabelle (DataTables) e aggiornamento delle singole righe |
| [renderer/pagine.js](renderer/pagine.js) | Navigazione, pagina "Oggi", ricerca, backup, scorciatoie |
| [renderer/modali.js](renderer/modali.js) | Ordine (nuovo/modifica), consegna, clienti, listino, conferme |
| [renderer/avvio.js](renderer/avvio.js) | Avvio della finestra |
| [index.html](index.html), [modali.html](modali.html), [styles.css](styles.css) | Layout e tema grafico |

## Packaging

```
npm run package   # app pronta da avviare in out/Lavasecco-win32-x64/
npm run make      # installer in out/make/ (su Windows: Squirrel, Setup.exe)
```

L'icona (`img/icon.ico`, `img/icon.png`) si rigenera con `npx electron scripts/crea-icona.js`.

## Sicurezza

- Content Security Policy in [index.html](index.html): solo risorse locali, nessuno script inline.
  Se aggiungi risorse esterne, aggiorna la CSP in modo esplicito.
- Tutto il testo inserito dagli utenti viene fatto passare da `escapeHtml` prima di finire nell'HTML.
- Il renderer non ha accesso a Node: può solo chiamare i metodi del repository elencati in `METODI_PUBBLICI`.

## Troubleshooting

### Warning display_layout su Windows

```
PlacementList must be sorted by first 8 bits of display_id
```

È un warning Chromium legato al display manager e non blocca l'applicazione.

### `npm start` da un terminale di VS Code non apre la finestra

Se la variabile `ELECTRON_RUN_AS_NODE` è impostata, Electron parte come Node e non apre la finestra.
Avvia da un terminale normale oppure rimuovi la variabile.

## Licenza

Questo progetto è rilasciato sotto licenza [CC0 1.0 Universal](LICENSE.md) (dominio pubblico).
