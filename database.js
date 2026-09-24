const fs = require('fs');
const path = require('path');
const { DatabaseSync, backup } = require('node:sqlite');

const STATO = Object.freeze({ APERTO: 0, CONSEGNATO: 1, PARZIALE: 2 });

// Migrazioni dello schema, in ordine: la chiave è la versione (PRAGMA user_version) raggiunta dopo il passo.
// Un database nuovo le esegue tutte; uno esistente solo quelle mancanti.
const MIGRAZIONI = {
    // v1: tabella ordini unica (introdotta con la versione 2.0 dell'app)
    1: `
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE clienti (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            telefono TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE prodotti (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descrizione TEXT NOT NULL,
            -- NULL = prezzo non fisso: in quel caso nota_prezzo spiega (es. "a vista", "a peso")
            prezzo_cent INTEGER CHECK (prezzo_cent IS NULL OR prezzo_cent >= 0),
            nota_prezzo TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE ordini (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            -- Anno di registrazione: è il filtro "anno" della UI
            anno INTEGER NOT NULL,
            cliente_id INTEGER NOT NULL REFERENCES clienti(id),
            prodotto_id INTEGER NOT NULL REFERENCES prodotti(id),
            quantita INTEGER NOT NULL CHECK (quantita >= 0),
            quantita_consegnata INTEGER NOT NULL DEFAULT 0 CHECK (quantita_consegnata BETWEEN 0 AND quantita),
            -- 0 = aperto, 1 = consegnato, 2 = consegnato in parte
            stato INTEGER NOT NULL DEFAULT 0 CHECK (stato IN (0, 1, 2)),
            descrizione TEXT NOT NULL DEFAULT '',
            posizione TEXT NOT NULL DEFAULT '',
            -- Date in formato ISO YYYY-MM-DD
            data_consegna TEXT,
            data_ritiro_prevista TEXT,
            data_ritiro_effettiva TEXT,
            -- Tabella e id di provenienza per gli ordini migrati dalle versioni 1.x
            rif_legacy TEXT
        );
        CREATE INDEX idx_ordini_anno_stato ON ordini (anno, stato);
    `,
    // v2: prezzo salvato nell'ordine al momento della registrazione, così cambiare il listino
    // non modifica i totali degli ordini esistenti. Gli ordini già presenti prendono il prezzo di listino attuale.
    2: `
        ALTER TABLE ordini ADD COLUMN prezzo_unitario_cent INTEGER CHECK (prezzo_unitario_cent IS NULL OR prezzo_unitario_cent >= 0);
        ALTER TABLE ordini ADD COLUMN nota_prezzo TEXT NOT NULL DEFAULT '';
        UPDATE ordini SET
            prezzo_unitario_cent = (SELECT p.prezzo_cent FROM prodotti p WHERE p.id = ordini.prodotto_id),
            nota_prezzo = (SELECT p.nota_prezzo FROM prodotti p WHERE p.id = ordini.prodotto_id);
        CREATE INDEX idx_ordini_prodotto ON ordini (prodotto_id);
        CREATE INDEX idx_ordini_cliente ON ordini (cliente_id);
    `
};

const SCHEMA_VERSION = Math.max(...Object.keys(MIGRAZIONI).map(Number));

// Esegue fn in una transazione; se c'è già una transazione aperta la riusa.
function transaction(db, fn) {
    if (db.isTransaction) {
        return fn();
    }
    db.exec('BEGIN IMMEDIATE');
    try {
        const result = fn();
        db.exec('COMMIT');
        return result;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

function getMeta(db, key) {
    const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key);
    return row ? row.value : null;
}

function setMeta(db, key, value) {
    db.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

function tableExists(db, name) {
    return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

function getUserVersion(db) {
    return db.prepare('PRAGMA user_version').get().user_version;
}

// "7,50" / "7.50" / "15€" / " 3,00 " -> centesimi; testo non numerico ("a vista") -> nota.
function parsePrezzo(valore) {
    const testo = String(valore ?? '').trim();
    const numerico = testo.replace(/€/g, '').replace(/\s/g, '').replace(',', '.');
    if (/^\d+(\.\d{1,2})?$/.test(numerico)) {
        return { prezzo_cent: Math.round(Number(numerico) * 100), nota_prezzo: '' };
    }
    return { prezzo_cent: null, nota_prezzo: testo };
}

// Applica le migrazioni mancanti in un'unica transazione. Ritorna le versioni applicate.
function migra(db) {
    const versione = getUserVersion(db);
    if (versione === 0 && tableExists(db, 'clienti')) {
        throw new Error('Questo database è di una versione 1.x dell\'app: va aperto prima con la versione 2.0, che lo converte al formato attuale.');
    }
    if (versione > SCHEMA_VERSION) {
        throw new Error(`Il database è stato creato da una versione più recente dell'app (schema ${versione}, supportato fino a ${SCHEMA_VERSION}).`);
    }

    const applicate = [];
    transaction(db, () => {
        for (let v = versione + 1; v <= SCHEMA_VERSION; v++) {
            db.exec(MIGRAZIONI[v]);
            applicate.push(v);
        }
        db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    });
    return applicate;
}

function timestamp(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function oggiIso(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Copia coerente del database (anche con WAL e con l'app in uso) tramite l'API di backup di SQLite.
async function creaBackup(db, destPath) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    await backup(db, destPath);
    return destPath;
}

const BACKUP_GIORNALIERO_RE = /^lavasecco-backup-\d{8}-\d{6}\.sqlite3$/;

function pruneOldBackups(backupDir, retentionDays) {
    if (!fs.existsSync(backupDir)) {
        return;
    }
    const maxAgeMs = Math.max(1, retentionDays) * 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const entry of fs.readdirSync(backupDir, { withFileTypes: true })) {
        if (!entry.isFile() || !BACKUP_GIORNALIERO_RE.test(entry.name)) {
            continue;
        }
        const fullPath = path.join(backupDir, entry.name);
        try {
            if (now - fs.statSync(fullPath).mtimeMs > maxAgeMs) {
                fs.unlinkSync(fullPath);
            }
        } catch (error) {
            console.warn('Impossibile pulire backup vecchio:', fullPath, error.message);
        }
    }
}

// Un backup al giorno (al primo avvio della giornata); i backup più vecchi della retention vengono rimossi.
async function backupGiornaliero(db, backupDir, retentionDays) {
    const oggi = oggiIso();
    if (getMeta(db, 'last_backup_date') === oggi) {
        return null;
    }
    const dest = await creaBackup(db, path.join(backupDir, `lavasecco-backup-${timestamp()}.sqlite3`));
    setMeta(db, 'last_backup_date', oggi);
    setMeta(db, 'last_backup_at', new Date().toISOString());
    pruneOldBackups(backupDir, retentionDays);
    return dest;
}

async function apriDatabase({ dbPath, backupDir }) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    const db = new DatabaseSync(dbPath, { enableForeignKeyConstraints: true });
    db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');

    // Prima di aggiornare lo schema di un database con dati, ne salvo una copia completa
    const versione = getUserVersion(db);
    let backupPreMigrazione = null;
    if (versione >= 1 && versione < SCHEMA_VERSION) {
        backupPreMigrazione = await creaBackup(db, path.join(backupDir, `pre-migrazione-v${SCHEMA_VERSION}-${timestamp()}.sqlite3`));
    }
    const migrazioni = migra(db);

    return { db, backupPreMigrazione, migrazioni };
}

module.exports = {
    SCHEMA_VERSION,
    MIGRAZIONI,
    STATO,
    apriDatabase,
    migra,
    transaction,
    getMeta,
    setMeta,
    parsePrezzo,
    oggiIso,
    timestamp,
    creaBackup,
    backupGiornaliero,
    pruneOldBackups
};
