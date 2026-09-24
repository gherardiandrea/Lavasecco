# Lavasecco

Applicazione desktop Electron per la gestione ordini, clienti e listino di una lavanderia.

## Stato Attuale

- Backend dati: SQLite (non vengono più usati file JSON in runtime).
- Frontend: jQuery + Bootstrap + DataTables + Select2.
- Avvio locale: Electron diretto.

## Requisiti

- Node.js 16+ (consigliato LTS).
- NPM.
- Windows, Linux o macOS.

Nota: in ambiente Windows, l'avvio usa electron diretto per evitare rebuild nativi non necessari durante lo sviluppo.

## Installazione

1. Installa le dipendenze:

```
npm install
```

2. Avvia l'app:

```
npm start
```

3. Crea un backup manuale del DB (opzionale):

```
npm run backup-db
```

## Percorso Database SQLite

Il database viene creato automaticamente nella cartella del progetto:

```
str/extraResources/lavasecco.sqlite3
```

Il percorso può essere personalizzato tramite la variabile d'ambiente `LAVASECCO_DATA_DIR`.

Riferimento codice: [app.config.js](app.config.js), [database.js](database.js).

## Migrazione Dati Legacy

Al primo avvio con la versione SQLite:

1. I dati legacy JSON vengono migrati automaticamente nel database SQLite.
2. I file JSON legacy vengono rimossi dalla cartella dati.
3. Viene registrato un flag interno per non ripetere la migrazione.

Riferimento codice: [database.js](database.js).

## Struttura Principale

- Main process Electron: [main.js](main.js)
- Bridge API preload: [preload.js](preload.js)
- Inizializzazione e migrazione DB: [database.js](database.js)
- Configurazione percorsi: [app.config.js](app.config.js)
- Avvio e stato globale renderer: [app.js](app.js)
- Tabelle DataTables: [funzioni_tabelle.js](funzioni_tabelle.js)
- Interazioni/modali: [function.js](function.js), [function_modals.js](function_modals.js)
- Layout pagina: [index.html](index.html)
- Tema grafico: [styles.css](styles.css)

## Packaging

Sono disponibili gli script Electron Forge:

```
npm run package
npm run make
```

## Troubleshooting Rapido

### Warning display_layout su Windows

Messaggio tipico:

```
PlacementList must be sorted by first 8 bits of display_id
```

È un warning Chromium legato al display manager e non blocca l'applicazione.

### Errore preload / binding SQLite

Se compare un errore di binding nativo di `better-sqlite3`:

1. Elimina `node_modules` e `package-lock.json`.
2. Reinstalla con `npm install`.
3. Riavvia con `npm start`.

Nota: il comando `npm run backup-db` usa solo filesystem (non carica `better-sqlite3`) per evitare mismatch ABI tra Node ed Electron.

## Sicurezza Renderer

È presente una Content Security Policy in [index.html](index.html).
Se aggiungi font o risorse esterne, aggiorna la CSP in modo esplicito.

## Licenza

Questo progetto è rilasciato sotto licenza [CC0 1.0 Universal](LICENSE.md) (dominio pubblico).