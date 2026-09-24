# Lavasecco

Applicazione desktop Electron per la gestione ordini, clienti e listino di una lavanderia.

## Stato attuale

- Dati: SQLite integrato in Electron (`node:sqlite`), nessun modulo nativo da compilare.
- Il database è accessibile solo dal main process; la finestra gira in sandbox e comunica via IPC.
- Frontend: jQuery + Bootstrap 5 + DataTables + Select2, tutte le risorse in locale (funziona offline).

## Requisiti

- Node.js 22.12 o superiore (consigliato l'LTS corrente) con npm 10+.
- Windows, Linux o macOS.

## Installazione e avvio

```
npm install
npm start
```

Test del livello dati (migrazione, regole su ordini/consegne/clienti/prodotti):

```
npm test
```

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
- **Esporta backup…** (menu File, `Ctrl+Shift+S`): salva una copia dove vuoi, ad esempio su una chiavetta.
- **Da riga di comando**: `npm run backup-db` (oppure `npm run backup-db -- D:\Backup` per scegliere la cartella).

Tutti i backup usano l'API di backup di SQLite: la copia è coerente anche con l'app aperta.
Per ripristinare un backup: chiudere l'app e sostituire `lavasecco.sqlite3` con il file di backup
(eliminando eventuali `lavasecco.sqlite3-wal` / `-shm` accanto).

## Prezzi e listino

Ogni ordine salva il prezzo unitario del listino nel momento in cui viene inserito: modificare il prezzo
di un articolo (pagina **Prezzi → Modifica**) vale solo per i nuovi ordini, i totali di quelli esistenti
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
| [preload.js](preload.js) | Ponte IPC minimale verso il renderer |
| [app.config.js](app.config.js) | Percorsi dati e backup |
| [app.js](app.js) | Avvio e stato globale del renderer |
| [function.js](function.js) | Helper, righe delle tabelle, select, navigazione |
| [funzioni_tabelle.js](funzioni_tabelle.js) | Tabelle DataTables |
| [function_modals.js](function_modals.js) | Modali (ordini, consegne, clienti, prodotti) |
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
