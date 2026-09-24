const fs = require('fs');
const path = require('path');
const { DatabaseSync, backup } = require('node:sqlite');

// Versione corrente dello schema (PRAGMA user_version).
// 0 = schema legacy (una tabella ordini per anno/stato), 1 = tabella ordini unica.
const SCHEMA_VERSION = 1;

const STATO = Object.freeze({ APERTO: 0, CONSEGNATO: 1, PARZIALE: 2 });

const SCHEMA_V1 = `
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
        -- Anno di registrazione: è il filtro "anno" della UI (prima era il nome della tabella)
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
        -- Tabella e id di provenienza per gli ordini migrati dallo schema legacy
        rif_legacy TEXT
    );
    CREATE INDEX idx_ordini_anno_stato ON ordini (anno, stato);
`;

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

// "dd-mm-yyyy" -> "yyyy-mm-dd"; '' -> null; data non valida -> undefined.
function parseDataLegacy(valore) {
    const testo = String(valore ?? '').trim();
    if (testo === '') {
        return null;
    }
    const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(testo);
    if (!m) {
        return undefined;
    }
    const [giorno, mese, anno] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const d = new Date(Date.UTC(anno, mese - 1, giorno));
    if (d.getUTCFullYear() !== anno || d.getUTCMonth() !== mese - 1 || d.getUTCDate() !== giorno) {
        return undefined;
    }
    return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

// Migrazione dallo schema legacy (ordini_YYYY / ordini_chiusi_YYYY, telefono nella colonna email,
// date dd-mm-yyyy, prezzi testuali) alla tabella ordini unica. Ritorna un report di cosa è stato corretto.
function migraDaLegacy(db) {
    const report = {
        clienti: 0,
        prodotti: 0,
        ordini: 0,
        prezziNonNumerici: [],
        quantitaMancanti: 0,
        consegnatiConStatoErrato: 0,
        consegnatiQuantitaAllineata: 0,
        dateNonValide: []
    };

    db.exec('ALTER TABLE clienti RENAME TO legacy_clienti; ALTER TABLE prodotti RENAME TO legacy_prodotti;');
    db.exec(SCHEMA_V1);

    report.clienti = Number(db.prepare(`
        INSERT INTO clienti (id, nome, telefono)
        SELECT id, TRIM(COALESCE(nome, '')), TRIM(COALESCE(NULLIF(telefono, ''), email, ''))
        FROM legacy_clienti
    `).run().changes);

    const insertProdotto = db.prepare('INSERT INTO prodotti (id, descrizione, prezzo_cent, nota_prezzo) VALUES (?, ?, ?, ?)');
    for (const p of db.prepare('SELECT id, descrizione, prezzo FROM legacy_prodotti').all()) {
        const { prezzo_cent, nota_prezzo } = parsePrezzo(p.prezzo);
        if (prezzo_cent === null && nota_prezzo !== '') {
            report.prezziNonNumerici.push(`${p.descrizione}: ${nota_prezzo}`);
        }
        insertProdotto.run(p.id, p.descrizione || '', prezzo_cent, nota_prezzo);
        report.prodotti++;
    }

    const tabelleOrdini = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB 'ordini_*'").all()
        .map((r) => r.name)
        .filter((name) => /^ordini_(chiusi_)?\d{4}$/.test(name));

    const righe = [];
    for (const tabella of tabelleOrdini) {
        for (const r of db.prepare(`SELECT * FROM "${tabella}"`).all()) {
            righe.push({ tabella, ...r });
        }
    }
    // Gli id legacy sono timestamp: inserendo in quell'ordine i nuovi id restano cronologici.
    righe.sort((a, b) => Number(a.id) - Number(b.id));

    const insertOrdine = db.prepare(`
        INSERT INTO ordini (anno, cliente_id, prodotto_id, quantita, quantita_consegnata, stato, descrizione, posizione,
                            data_consegna, data_ritiro_prevista, data_ritiro_effettiva, rif_legacy)
        VALUES (@anno, @cliente_id, @prodotto_id, @quantita, @quantita_consegnata, @stato, @descrizione, @posizione,
                @data_consegna, @data_ritiro_prevista, @data_ritiro_effettiva, @rif_legacy)
    `);

    for (const r of righe) {
        const chiuso = r.tabella.startsWith('ordini_chiusi_');
        const rif = `${r.tabella}#${r.id}`;

        let quantita = r.quantita == null ? NaN : Number(r.quantita);
        if (!Number.isInteger(quantita) || quantita < 0) {
            quantita = 0;
            report.quantitaMancanti++;
        }

        let stato;
        let quantita_consegnata = Math.min(Math.max(Number(r.quantita_consegnata) || 0, 0), quantita);
        if (chiuso) {
            // Tutto ciò che sta tra i consegnati è consegnato per intero
            if (String(r.stato) !== '1') report.consegnatiConStatoErrato++;
            if (quantita_consegnata !== quantita) report.consegnatiQuantitaAllineata++;
            stato = STATO.CONSEGNATO;
            quantita_consegnata = quantita;
        } else {
            stato = String(r.stato) === '2' ? STATO.PARZIALE : STATO.APERTO;
        }

        const date = {};
        for (const [colonnaLegacy, colonna] of [
            ['data_di_consegna', 'data_consegna'],
            ['data_di_ritiro_prevista', 'data_ritiro_prevista'],
            ['data_di_consegna_effettiva', 'data_ritiro_effettiva']
        ]) {
            const iso = parseDataLegacy(r[colonnaLegacy]);
            if (iso === undefined) {
                report.dateNonValide.push(`${rif} ${colonnaLegacy}=${r[colonnaLegacy]}`);
            }
            date[colonna] = iso ?? null;
        }

        insertOrdine.run({
            anno: Number(r.tabella.slice(-4)),
            cliente_id: r.cliente,
            prodotto_id: r.prodotto,
            quantita,
            quantita_consegnata,
            stato,
            descrizione: r.descrizione || '',
            posizione: r.posizione || '',
            ...date,
            rif_legacy: rif
        });
        report.ordini++;
    }

    for (const tabella of [...tabelleOrdini, 'legacy_clienti', 'legacy_prodotti']) {
        db.exec(`DROP TABLE "${tabella}"`);
    }
    db.prepare("DELETE FROM app_meta WHERE key = 'legacy_json_migrated'").run();

    return report;
}

function migra(db) {
    const versione = getUserVersion(db);
    if (versione >= SCHEMA_VERSION) {
        return null;
    }

    let report = null;
    // Le foreign key vanno disattivate fuori dalla transazione durante la ricostruzione delle tabelle
    db.exec('PRAGMA foreign_keys = OFF');
    try {
        transaction(db, () => {
            if (tableExists(db, 'clienti')) {
                report = migraDaLegacy(db);
                setMeta(db, 'migrazione_v1', JSON.stringify({ data: new Date().toISOString(), ...report }));
            } else {
                db.exec(SCHEMA_V1);
            }
            db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
        });
    } finally {
        db.exec('PRAGMA foreign_keys = ON');
    }

    const violazioni = db.prepare('PRAGMA foreign_key_check').all();
    if (violazioni.length) {
        throw new Error(`Migrazione completata ma con ${violazioni.length} riferimenti non validi`);
    }
    return report;
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
    pruneOldBackups(backupDir, retentionDays);
    return dest;
}

// Se esiste solo il database nella vecchia posizione (cartella del progetto), lo copia nella nuova
// e rinomina l'originale, così non restano due copie che divergono.
async function importaDatabaseLegacy(legacyDbPath, dbPath) {
    if (!legacyDbPath || fs.existsSync(dbPath) || !fs.existsSync(legacyDbPath)) {
        return false;
    }
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    const legacy = new DatabaseSync(legacyDbPath);
    try {
        await backup(legacy, dbPath);
    } finally {
        legacy.close();
    }

    const spostato = `${legacyDbPath}.spostato-${timestamp()}`;
    try {
        fs.renameSync(legacyDbPath, spostato);
        for (const suffisso of ['-wal', '-shm']) {
            if (fs.existsSync(legacyDbPath + suffisso)) fs.unlinkSync(legacyDbPath + suffisso);
        }
    } catch (error) {
        console.warn(`Database copiato in ${dbPath}, ma non è stato possibile rinominare l'originale:`, error.message);
    }
    return true;
}

async function apriDatabase({ dbPath, backupDir, legacyDbPath = null }) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const importato = await importaDatabaseLegacy(legacyDbPath, dbPath);

    const db = new DatabaseSync(dbPath, { enableForeignKeyConstraints: true });
    db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');

    const daMigrare = getUserVersion(db) < SCHEMA_VERSION && tableExists(db, 'clienti');
    let backupPreMigrazione = null;
    if (daMigrare) {
        backupPreMigrazione = await creaBackup(db, path.join(backupDir, `pre-migrazione-v${SCHEMA_VERSION}-${timestamp()}.sqlite3`));
    }
    const reportMigrazione = migra(db);

    return { db, importato, backupPreMigrazione, reportMigrazione };
}

module.exports = {
    SCHEMA_VERSION,
    STATO,
    apriDatabase,
    migra,
    transaction,
    getMeta,
    setMeta,
    parsePrezzo,
    parseDataLegacy,
    oggiIso,
    timestamp,
    creaBackup,
    backupGiornaliero,
    pruneOldBackups
};
