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

## Aggiornamento dalle versioni 1.x

Al primo avvio della versione 2:

1. Se il database esiste solo nella vecchia posizione (`str/extraResources/lavasecco.sqlite3`, nella
   cartella del progetto) viene copiato nella cartella dati dell'utente; l'originale viene rinominato
   in `lavasecco.sqlite3.spostato-<data>` e non viene cancellato.
2. Prima di modificare lo schema viene salvato un backup completo in `dati/backups/pre-migrazione-v1-<data>.sqlite3`.
3. Le tabelle `ordini_<anno>` e `ordini_chiusi_<anno>` vengono unite in un'unica tabella `ordini`
   (ogni ordine mantiene il suo id anche quando viene consegnato), le date passano al formato ISO,
   i prezzi in centesimi e il telefono dei clienti nella colonna `telefono`.
   Il riepilogo della migrazione è salvato in `app_meta` (chiave `migrazione_v1`).

L'importazione dei vecchi file JSON (versioni precedenti a SQLite) non è più supportata:
per dati così vecchi passare prima da una versione 1.x.

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
npm run package
npm run make
```

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
