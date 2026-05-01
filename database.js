const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const {
    DATA_DIR,
    DB_PATH,
    BACKUP_DIR,
    BACKUP_RETENTION_DAYS
} = require('./app.config');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

function getMeta(key) {
    const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key);
    return row ? row.value : null;
}

function setMeta(key, value) {
    db.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

function toYear(year) {
    const parsed = parseInt(year, 10);
    if (Number.isFinite(parsed) && parsed >= 2019 && parsed <= 2100) {
        return parsed;
    }

    return new Date().getFullYear();
}

function ensureOrderTable(tableName) {
    if (!/^(ordini|ordini_chiusi)_\d{4}$/.test(tableName)) {
        throw new Error(`Nome tabella non valido: ${tableName}`);
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente INTEGER,
            prodotto INTEGER,
            quantita INTEGER,
            descrizione TEXT,
            data_di_ritiro_prevista TEXT,
            data_di_consegna TEXT,
            data_di_consegna_effettiva TEXT,
            stato TEXT,
            posizione TEXT,
            quantita_consegnata INTEGER
        );
    `);

    return tableName;
}

function resolveOrderTableName(year, isClosed) {
    const y = toYear(year);
    const tableName = `${isClosed ? 'ordini_chiusi' : 'ordini'}_${y}`;
    return ensureOrderTable(tableName);
}

function initDB() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS clienti (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT,
            telefono TEXT
        );
        CREATE TABLE IF NOT EXISTS prodotti (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descrizione TEXT NOT NULL,
            prezzo TEXT
        );
    `);

    const currentYear = new Date().getFullYear();
    resolveOrderTableName(currentYear, false);
    resolveOrderTableName(currentYear, true);
}

function extractArrayFromLegacyJson(filePath) {
    if (!fs.existsSync(filePath)) {
        return [];
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw || !raw.trim()) {
        return [];
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
        return [];
    }

    for (const value of Object.values(parsed)) {
        if (Array.isArray(value)) {
            return value;
        }
    }

    return [];
}

function migrateLegacyJsonData() {
    const alreadyMigrated = getMeta('legacy_json_migrated');
    if (alreadyMigrated === '1') {
        return;
    }

    const migrate = db.transaction(() => {
        const clienti = extractArrayFromLegacyJson(path.join(DATA_DIR, 'clienti.json'));
        const insertCliente = db.prepare(`
            INSERT INTO clienti (id, nome, email, telefono)
            VALUES (@id, @nome, @email, @telefono)
            ON CONFLICT(id) DO UPDATE SET
                nome = excluded.nome,
                email = excluded.email,
                telefono = excluded.telefono;
        `);

        clienti.forEach((c) => {
            if (!c || c.id == null) {
                return;
            }
            insertCliente.run({
                id: parseInt(c.id, 10),
                nome: c.nome || '',
                email: c.email || '',
                telefono: c.telefono || ''
            });
        });

        const prodotti = extractArrayFromLegacyJson(path.join(DATA_DIR, 'prodotti.json'));
        const insertProdotto = db.prepare(`
            INSERT INTO prodotti (id, descrizione, prezzo)
            VALUES (@id, @descrizione, @prezzo)
            ON CONFLICT(id) DO UPDATE SET
                descrizione = excluded.descrizione,
                prezzo = excluded.prezzo;
        `);

        prodotti.forEach((p) => {
            if (!p || p.id == null) {
                return;
            }
            insertProdotto.run({
                id: parseInt(p.id, 10),
                descrizione: p.descrizione || '',
                prezzo: p.prezzo == null ? '' : String(p.prezzo)
            });
        });

        const files = fs.readdirSync(DATA_DIR, { withFileTypes: true });
        const orderFiles = files
            .filter((entry) => entry.isFile() && /^ordini_\d{4}\.json$/.test(entry.name))
            .map((entry) => entry.name);
        const closedOrderFiles = files
            .filter((entry) => entry.isFile() && /^ordini_chiusi_\d{4}\.json$/.test(entry.name))
            .map((entry) => entry.name);

        const insertOrder = (tableName, ordine) => {
            db.prepare(`
                INSERT INTO "${tableName}" (
                    id,
                    cliente,
                    prodotto,
                    quantita,
                    descrizione,
                    data_di_ritiro_prevista,
                    data_di_consegna,
                    data_di_consegna_effettiva,
                    stato,
                    posizione,
                    quantita_consegnata
                ) VALUES (
                    @id,
                    @cliente,
                    @prodotto,
                    @quantita,
                    @descrizione,
                    @data_di_ritiro_prevista,
                    @data_di_consegna,
                    @data_di_consegna_effettiva,
                    @stato,
                    @posizione,
                    @quantita_consegnata
                )
                ON CONFLICT(id) DO UPDATE SET
                    cliente = excluded.cliente,
                    prodotto = excluded.prodotto,
                    quantita = excluded.quantita,
                    descrizione = excluded.descrizione,
                    data_di_ritiro_prevista = excluded.data_di_ritiro_prevista,
                    data_di_consegna = excluded.data_di_consegna,
                    data_di_consegna_effettiva = excluded.data_di_consegna_effettiva,
                    stato = excluded.stato,
                    posizione = excluded.posizione,
                    quantita_consegnata = excluded.quantita_consegnata;
            `).run({
                id: parseInt(ordine.id, 10),
                cliente: ordine.cliente == null ? null : parseInt(ordine.cliente, 10),
                prodotto: ordine.prodotto == null ? null : parseInt(ordine.prodotto, 10),
                quantita: ordine.quantita == null ? 0 : parseInt(ordine.quantita, 10),
                descrizione: ordine.descrizione || '',
                data_di_ritiro_prevista: ordine.data_di_ritiro_prevista || '',
                data_di_consegna: ordine.data_di_consegna || '',
                data_di_consegna_effettiva: ordine.data_di_consegna_effettiva || '',
                stato: ordine.stato == null ? '0' : String(ordine.stato),
                posizione: ordine.posizione || '',
                quantita_consegnata: ordine.quantita_consegnata == null ? 0 : parseInt(ordine.quantita_consegnata, 10)
            });
        };

        orderFiles.forEach((fileName) => {
            const year = parseInt(fileName.match(/^(?:ordini_)(\d{4})\.json$/)[1], 10);
            const tableName = resolveOrderTableName(year, false);
            const ordini = extractArrayFromLegacyJson(path.join(DATA_DIR, fileName));
            ordini.forEach((ordine) => {
                if (!ordine || ordine.id == null) {
                    return;
                }
                insertOrder(tableName, ordine);
            });
        });

        closedOrderFiles.forEach((fileName) => {
            const year = parseInt(fileName.match(/^(?:ordini_chiusi_)(\d{4})\.json$/)[1], 10);
            const tableName = resolveOrderTableName(year, true);
            const ordini = extractArrayFromLegacyJson(path.join(DATA_DIR, fileName));
            ordini.forEach((ordine) => {
                if (!ordine || ordine.id == null) {
                    return;
                }
                insertOrder(tableName, ordine);
            });
        });

        setMeta('legacy_json_migrated', '1');
    });

    migrate();
}

function cleanupLegacyJsonFiles() {
    const files = fs.readdirSync(DATA_DIR, { withFileTypes: true });
    files
        .filter((entry) => entry.isFile() && /^(clienti|prodotti|ordini_\d{4}|ordini_chiusi_\d{4}|clienti_old|prodotti_old)\.json$/.test(entry.name))
        .forEach((entry) => {
            const fullPath = path.join(DATA_DIR, entry.name);
            try {
                fs.unlinkSync(fullPath);
            } catch (error) {
                console.warn('Impossibile eliminare file legacy:', fullPath, error.message);
            }
        });
}

function pruneOldBackups() {
    if (!fs.existsSync(BACKUP_DIR)) {
        return;
    }

    const now = Date.now();
    const maxAgeMs = Math.max(1, BACKUP_RETENTION_DAYS) * 24 * 60 * 60 * 1000;

    fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
        .filter((entry) => entry.isFile() && /^lavasecco-backup-\d{8}-\d{6}\.sqlite3$/.test(entry.name))
        .forEach((entry) => {
            const fullPath = path.join(BACKUP_DIR, entry.name);
            try {
                const stats = fs.statSync(fullPath);
                if (now - stats.mtimeMs > maxAgeMs) {
                    fs.unlinkSync(fullPath);
                }
            } catch (error) {
                console.warn('Impossibile pulire backup vecchio:', fullPath, error.message);
            }
        });
}

function backupDatabase(force = false) {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const today = new Date().toISOString().slice(0, 10);
    const lastBackupDate = getMeta('last_backup_date');

    if (!force && lastBackupDate === today) {
        return null;
    }

    const now = new Date();
    const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const backupFileName = `lavasecco-backup-${stamp}.sqlite3`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // Flush pages to main DB file, then create a consistent copy.
    db.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(DB_PATH, backupPath);

    setMeta('last_backup_date', today);
    pruneOldBackups();

    return backupPath;
}

initDB();
migrateLegacyJsonData();
cleanupLegacyJsonFiles();
backupDatabase();

module.exports = {
    db,
    DB_PATH,
    DATA_DIR,
    BACKUP_DIR,
    initDB,
    toYear,
    ensureOrderTable,
    resolveOrderTableName,
    migrateLegacyJsonData,
    cleanupLegacyJsonFiles,
    backupDatabase,
    pruneOldBackups
};
