const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const { apriDatabase, parsePrezzo, parseDataLegacy, SCHEMA_VERSION, backupGiornaliero } = require('../database');

function tmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'lavasecco-test-'));
}

// Crea un database con lo schema delle versioni 1.x (una tabella per anno e stato).
function creaDbLegacy(dbPath) {
    const db = new DatabaseSync(dbPath);
    const colonne = `id INTEGER PRIMARY KEY AUTOINCREMENT, cliente INTEGER, prodotto INTEGER, quantita INTEGER,
        descrizione TEXT, data_di_ritiro_prevista TEXT, data_di_consegna TEXT, data_di_consegna_effettiva TEXT,
        stato TEXT, posizione TEXT, quantita_consegnata INTEGER`;
    db.exec(`
        CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT);
        INSERT INTO app_meta VALUES ('legacy_json_migrated', '1');
        CREATE TABLE clienti (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT, telefono TEXT);
        CREATE TABLE prodotti (id INTEGER PRIMARY KEY AUTOINCREMENT, descrizione TEXT NOT NULL, prezzo TEXT);
        CREATE TABLE ordini_2021 (${colonne});
        CREATE TABLE ordini_chiusi_2021 (${colonne});
        CREATE TABLE ordini_2022 (${colonne});

        INSERT INTO clienti VALUES (1573640000001, 'Mario Rossi', '3331234567', ''), (1573640000002, 'Anna Bianchi', '', '');
        INSERT INTO prodotti VALUES
            (1573640440591, 'Abito donna', '9.00'), (1573640440811, 'Stiro', '3,00 '),
            (1573640440816, 'Tappeti', 'a peso'), (1648206564296, 'Pelliccia', '15€'), (1648029943912, 'Camice', '');
    `);
    const ins = (tabella, r) => db.prepare(`INSERT INTO ${tabella} VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        r.id, r.cliente, r.prodotto, r.quantita, r.descrizione ?? '', r.ritiro ?? '', r.consegna, r.effettiva ?? '', r.stato, r.posizione ?? '', r.qc ?? 0
    );
    // Stesso id in tabelle diverse: nel nuovo schema devono diventare due ordini distinti
    ins('ordini_2021', { id: 1600000000001, cliente: 1573640000001, prodotto: 1573640440591, quantita: 2, consegna: '10-01-2021', ritiro: '13-01-2021', stato: '0', posizione: 'A1' });
    ins('ordini_chiusi_2021', { id: 1600000000001, cliente: 1573640000002, prodotto: 1573640440811, quantita: 3, consegna: '05-01-2021', effettiva: '08-01-2021', stato: '1', qc: 3 });
    // Parziale
    ins('ordini_2021', { id: 1600000000002, cliente: 1573640000001, prodotto: 1573640440816, quantita: 3, consegna: '02-03-2021', effettiva: '04-03-2021', stato: '2', qc: 1 });
    // Consegnato "vecchio stile": quantita_consegnata non valorizzata
    ins('ordini_chiusi_2021', { id: 1600000000003, cliente: 1573640000002, prodotto: 1648206564296, quantita: 2, consegna: '02-02-2021', effettiva: '09-02-2021', stato: '1', qc: 0 });
    // Anomalia reale: tra i consegnati ma con stato 0 e quantità mancante
    ins('ordini_chiusi_2021', { id: 1600000000004, cliente: 1573640000002, prodotto: 1573640440591, quantita: null, consegna: '12-05-2021', effettiva: '10-06-2021', stato: '0', qc: 0 });
    // Data impossibile
    ins('ordini_2022', { id: 1600000000005, cliente: 1573640000001, prodotto: 1648029943912, quantita: 1, consegna: '31-02-2022', stato: '0', descrizione: 'Macchia "ostinata" <b>' });
    db.close();
}

test('parsePrezzo gestisce i formati trovati nei dati reali', () => {
    assert.deepEqual(parsePrezzo('9.00'), { prezzo_cent: 900, nota_prezzo: '' });
    assert.deepEqual(parsePrezzo('3,00 '), { prezzo_cent: 300, nota_prezzo: '' });
    assert.deepEqual(parsePrezzo('7,5'), { prezzo_cent: 750, nota_prezzo: '' });
    assert.deepEqual(parsePrezzo('15€'), { prezzo_cent: 1500, nota_prezzo: '' });
    assert.deepEqual(parsePrezzo('a vista'), { prezzo_cent: null, nota_prezzo: 'a vista' });
    assert.deepEqual(parsePrezzo(''), { prezzo_cent: null, nota_prezzo: '' });
});

test('parseDataLegacy converte in ISO e riconosce date non valide', () => {
    assert.equal(parseDataLegacy('05-01-2021'), '2021-01-05');
    assert.equal(parseDataLegacy('5-1-2021'), '2021-01-05');
    assert.equal(parseDataLegacy(''), null);
    assert.equal(parseDataLegacy('31-02-2022'), undefined);
    assert.equal(parseDataLegacy('2021/01/05'), undefined);
});

test('migrazione dallo schema legacy', async () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'lavasecco.sqlite3');
    const backupDir = path.join(dir, 'backups');
    creaDbLegacy(dbPath);

    const { db, reportMigrazione, backupPreMigrazione } = await apriDatabase({ dbPath, backupDir });

    // Backup completo del database legacy prima della migrazione
    assert.ok(fs.existsSync(backupPreMigrazione));
    const copia = new DatabaseSync(backupPreMigrazione, { readOnly: true });
    assert.equal(copia.prepare('SELECT COUNT(*) n FROM ordini_chiusi_2021').get().n, 3);
    copia.close();

    assert.equal(db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
    const tabelle = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
    assert.deepEqual(tabelle, ['app_meta', 'clienti', 'ordini', 'prodotti']);

    // Telefono spostato dalla colonna email
    assert.deepEqual(
        db.prepare('SELECT id, nome, telefono FROM clienti ORDER BY id').all().map((r) => ({ ...r })),
        [{ id: 1573640000001, nome: 'Mario Rossi', telefono: '3331234567' }, { id: 1573640000002, nome: 'Anna Bianchi', telefono: '' }]
    );

    const prodotti = Object.fromEntries(db.prepare('SELECT descrizione, prezzo_cent, nota_prezzo FROM prodotti').all().map((p) => [p.descrizione, [p.prezzo_cent, p.nota_prezzo]]));
    assert.deepEqual(prodotti, {
        'Abito donna': [900, ''], Stiro: [300, ''], Tappeti: [null, 'a peso'], Pelliccia: [1500, ''], Camice: [null, '']
    });

    const ordini = db.prepare('SELECT * FROM ordini ORDER BY id').all();
    assert.equal(ordini.length, 6);
    const perRif = Object.fromEntries(ordini.map((o) => [o.rif_legacy, o]));

    const aperto = perRif['ordini_2021#1600000000001'];
    assert.equal(aperto.anno, 2021);
    assert.equal(aperto.stato, 0);
    assert.equal(aperto.data_consegna, '2021-01-10');
    assert.equal(aperto.data_ritiro_prevista, '2021-01-13');
    assert.equal(aperto.data_ritiro_effettiva, null);
    assert.equal(aperto.posizione, 'A1');

    const chiusoStessoId = perRif['ordini_chiusi_2021#1600000000001'];
    assert.notEqual(chiusoStessoId.id, aperto.id);
    assert.equal(chiusoStessoId.stato, 1);

    const parziale = perRif['ordini_2021#1600000000002'];
    assert.equal(parziale.stato, 2);
    assert.equal(parziale.quantita_consegnata, 1);

    assert.equal(perRif['ordini_chiusi_2021#1600000000003'].quantita_consegnata, 2);

    const anomalo = perRif['ordini_chiusi_2021#1600000000004'];
    assert.equal(anomalo.stato, 1);
    assert.equal(anomalo.quantita, 0);

    const dataErrata = perRif['ordini_2022#1600000000005'];
    assert.equal(dataErrata.data_consegna, null);
    assert.equal(dataErrata.descrizione, 'Macchia "ostinata" <b>');

    assert.equal(reportMigrazione.ordini, 6);
    assert.equal(reportMigrazione.quantitaMancanti, 1);
    assert.equal(reportMigrazione.consegnatiConStatoErrato, 1);
    assert.equal(reportMigrazione.consegnatiQuantitaAllineata, 1);
    assert.deepEqual(reportMigrazione.dateNonValide, ['ordini_2022#1600000000005 data_di_consegna=31-02-2022']);
    assert.deepEqual(reportMigrazione.prezziNonNumerici, ['Tappeti: a peso']);
    assert.equal(db.prepare("SELECT value FROM app_meta WHERE key = 'legacy_json_migrated'").get(), undefined);
    db.close();

    // Riaprendo non si rimigra
    const riaperto = await apriDatabase({ dbPath, backupDir });
    assert.equal(riaperto.reportMigrazione, null);
    assert.equal(riaperto.backupPreMigrazione, null);
    riaperto.db.close();
});

test('database nuovo: crea direttamente lo schema corrente', async () => {
    const dir = tmpDir();
    const { db, reportMigrazione, backupPreMigrazione } = await apriDatabase({ dbPath: path.join(dir, 'x.sqlite3'), backupDir: path.join(dir, 'b') });
    assert.equal(reportMigrazione, null);
    assert.equal(backupPreMigrazione, null);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM ordini').get().n, 0);
    db.close();
});

test('importa il database dalla vecchia posizione e rinomina l\'originale', async () => {
    const dir = tmpDir();
    const legacyDbPath = path.join(dir, 'progetto', 'lavasecco.sqlite3');
    fs.mkdirSync(path.dirname(legacyDbPath));
    creaDbLegacy(legacyDbPath);
    const dbPath = path.join(dir, 'userdata', 'dati', 'lavasecco.sqlite3');

    const { db, importato } = await apriDatabase({ dbPath, backupDir: path.join(dir, 'userdata', 'dati', 'backups'), legacyDbPath });
    assert.equal(importato, true);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM ordini').get().n, 6);
    assert.equal(fs.existsSync(legacyDbPath), false);
    assert.equal(fs.readdirSync(path.dirname(legacyDbPath)).filter((f) => f.startsWith('lavasecco.sqlite3.spostato-')).length, 1);
    db.close();
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
