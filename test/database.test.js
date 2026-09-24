const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const { apriDatabase, parsePrezzo, SCHEMA_VERSION, MIGRAZIONI, backupGiornaliero } = require('../database');

function tmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'lavasecco-test-'));
}

function colonne(db, tabella) {
    return db.prepare(`PRAGMA table_info(${tabella})`).all().map((c) => c.name);
}

test('parsePrezzo gestisce i formati usati nel listino', () => {
    assert.deepEqual(parsePrezzo('9.00'), { prezzo_cent: 900, nota_prezzo: '' });
    assert.deepEqual(parsePrezzo('3,00 '), { prezzo_cent: 300, nota_prezzo: '' });
    assert.deepEqual(parsePrezzo('7,5'), { prezzo_cent: 750, nota_prezzo: '' });
    assert.deepEqual(parsePrezzo('15€'), { prezzo_cent: 1500, nota_prezzo: '' });
    assert.deepEqual(parsePrezzo('a vista'), { prezzo_cent: null, nota_prezzo: 'a vista' });
    assert.deepEqual(parsePrezzo(''), { prezzo_cent: null, nota_prezzo: '' });
});

test('database nuovo: applica tutte le migrazioni senza backup', async () => {
    const dir = tmpDir();
    const { db, migrazioni, backupPreMigrazione } = await apriDatabase({ dbPath: path.join(dir, 'x.sqlite3'), backupDir: path.join(dir, 'b') });
    assert.deepEqual(migrazioni, Object.keys(MIGRAZIONI).map(Number));
    assert.equal(backupPreMigrazione, null);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
    assert.ok(colonne(db, 'ordini').includes('prezzo_unitario_cent'));
    db.close();
});

test('migrazione v1 -> v2: gli ordini esistenti prendono il prezzo di listino, con backup preventivo', async () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'lavasecco.sqlite3');
    const backupDir = path.join(dir, 'backups');

    // Database nello schema v1
    const v1 = new DatabaseSync(dbPath);
    v1.exec(MIGRAZIONI[1]);
    v1.exec(`
        PRAGMA user_version = 1;
        INSERT INTO clienti (id, nome, telefono) VALUES (1, 'Mario', '333');
        INSERT INTO prodotti (id, descrizione, prezzo_cent, nota_prezzo) VALUES (10, 'Giacca', 750, ''), (11, 'Tappeto', NULL, 'a peso');
        INSERT INTO ordini (anno, cliente_id, prodotto_id, quantita, stato, data_consegna) VALUES
            (2022, 1, 10, 2, 0, '2022-10-01'), (2022, 1, 11, 1, 1, '2022-10-02');
    `);
    v1.close();

    const { db, migrazioni, backupPreMigrazione } = await apriDatabase({ dbPath, backupDir });
    assert.deepEqual(migrazioni, [2]);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);

    // Il backup è la copia esatta del database v1
    assert.ok(fs.existsSync(backupPreMigrazione));
    const copia = new DatabaseSync(backupPreMigrazione, { readOnly: true });
    assert.equal(copia.prepare('PRAGMA user_version').get().user_version, 1);
    assert.equal(copia.prepare('SELECT COUNT(*) n FROM ordini').get().n, 2);
    copia.close();

    const ordini = db.prepare('SELECT prodotto_id, prezzo_unitario_cent, nota_prezzo FROM ordini ORDER BY id').all().map((o) => ({ ...o }));
    assert.deepEqual(ordini, [
        { prodotto_id: 10, prezzo_unitario_cent: 750, nota_prezzo: '' },
        { prodotto_id: 11, prezzo_unitario_cent: null, nota_prezzo: 'a peso' }
    ]);
    const indici = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'ordini'").all().map((r) => r.name).sort();
    assert.deepEqual(indici, ['idx_ordini_anno_stato', 'idx_ordini_cliente', 'idx_ordini_prodotto']);
    db.close();

    // Riaprendo non si rimigra e non si rifà il backup
    const riaperto = await apriDatabase({ dbPath, backupDir });
    assert.deepEqual(riaperto.migrazioni, []);
    assert.equal(riaperto.backupPreMigrazione, null);
    riaperto.db.close();
});

test('un database delle versioni 1.x viene rifiutato con un messaggio chiaro', async () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'vecchio.sqlite3');
    const vecchio = new DatabaseSync(dbPath);
    vecchio.exec('CREATE TABLE clienti (id INTEGER PRIMARY KEY, nome TEXT, email TEXT, telefono TEXT); CREATE TABLE ordini_2022 (id INTEGER PRIMARY KEY);');
    vecchio.close();

    await assert.rejects(apriDatabase({ dbPath, backupDir: path.join(dir, 'b') }), /versione 1\.x/);
    // Il database non è stato toccato
    const ricontrollo = new DatabaseSync(dbPath, { readOnly: true });
    assert.equal(ricontrollo.prepare('PRAGMA user_version').get().user_version, 0);
    ricontrollo.close();
});

test('un database di una versione più recente viene rifiutato', async () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'futuro.sqlite3');
    const futuro = new DatabaseSync(dbPath);
    futuro.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    futuro.close();
    await assert.rejects(apriDatabase({ dbPath, backupDir: path.join(dir, 'b') }), /versione più recente/);
});

test('backup giornaliero: uno al giorno', async () => {
    const dir = tmpDir();
    const backupDir = path.join(dir, 'b');
    const { db } = await apriDatabase({ dbPath: path.join(dir, 'x.sqlite3'), backupDir });
    const primo = await backupGiornaliero(db, backupDir, 30);
    assert.ok(fs.existsSync(primo));
    assert.equal(await backupGiornaliero(db, backupDir, 30), null);
    db.close();
});

test('pulizia dei backup: elimina solo i backup giornalieri più vecchi della retention', () => {
    const { pruneOldBackups } = require('../database');
    const dir = tmpDir();
    const giorniFa = (n) => (Date.now() - n * 24 * 60 * 60 * 1000) / 1000;
    const crea = (nome, eta) => {
        const p = path.join(dir, nome);
        fs.writeFileSync(p, 'x');
        fs.utimesSync(p, giorniFa(eta), giorniFa(eta));
        return nome;
    };
    const vecchio = crea('lavasecco-backup-20260801-090000.sqlite3', 40);
    const recente = crea('lavasecco-backup-20260920-090000.sqlite3', 4);
    const preMigrazione = crea('pre-migrazione-v2-20260101-090000.sqlite3', 200);
    const esportato = crea('copia-per-chiavetta.sqlite3', 200);
    const simile = crea('lavasecco-backup-20260101.sqlite3', 200);
    fs.mkdirSync(path.join(dir, 'lavasecco-backup-20260101-090000.sqlite3')); // una cartella con lo stesso nome non va toccata

    pruneOldBackups(dir, 30);
    const rimasti = fs.readdirSync(dir).sort();
    assert.equal(rimasti.includes(vecchio), false);
    for (const nome of [recente, preMigrazione, esportato, simile, 'lavasecco-backup-20260101-090000.sqlite3']) {
        assert.ok(rimasti.includes(nome), nome);
    }

    // Retention minima 1 giorno anche se configurata a 0; cartella mancante: nessun errore
    pruneOldBackups(dir, 0);
    assert.equal(fs.readdirSync(dir).includes(recente), false);
    pruneOldBackups(path.join(dir, 'non-esiste'), 30);
});

test('transazioni annidate: la transazione interna riusa quella esterna', async () => {
    const { transaction } = require('../database');
    const dir = tmpDir();
    const { db } = await apriDatabase({ dbPath: path.join(dir, 'x.sqlite3'), backupDir: path.join(dir, 'b') });
    db.exec('CREATE TABLE t (v INTEGER)');
    assert.throws(() => transaction(db, () => {
        db.prepare('INSERT INTO t VALUES (1)').run();
        transaction(db, () => db.prepare('INSERT INTO t VALUES (2)').run());
        throw new Error('annulla tutto');
    }), /annulla tutto/);
    // Il rollback esterno annulla anche quanto fatto dentro la transazione interna
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM t').get().n, 0);
    assert.equal(db.isTransaction, false);
    db.close();
});
