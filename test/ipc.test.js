const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { creaGestoreDb, creaGestoreAzione, mittenteAutorizzato } = require('../ipc');
const { createRepository, ErroreValidazione, METODI_PUBBLICI } = require('../repository');
const { apriDatabase } = require('../database');

const DALL_APP = { senderFrame: { url: 'file:///C:/Programmi/Lavasecco/index.html' } };
const DA_FUORI = { senderFrame: { url: 'https://esempio.com/pagina' } };

function repositoryFinto() {
    const chiamate = [];
    return {
        chiamate,
        somma: (a, b) => { chiamate.push([a, b]); return a + b; },
        rifiuta: () => { throw new ErroreValidazione('duplicato', 'Esiste già', 'nome'); },
        esplode: () => { throw new Error('disco pieno'); },
        nonPubblico: () => 'segreto'
    };
}

function gestore(repo = repositoryFinto(), log = () => {}) {
    return creaGestoreDb(repo, ['somma', 'rifiuta', 'esplode', 'inesistente'], { log });
}

test('mittente: solo la pagina locale dell\'app', () => {
    assert.equal(mittenteAutorizzato(DALL_APP), true);
    assert.equal(mittenteAutorizzato(DA_FUORI), false);
    assert.equal(mittenteAutorizzato({ senderFrame: null }), false);
    assert.equal(mittenteAutorizzato({}), false);
    assert.equal(mittenteAutorizzato(undefined), false);
});

test('canale db: esegue il metodo con gli argomenti e ritorna { ok, dati }', () => {
    const repo = repositoryFinto();
    assert.deepEqual(gestore(repo)(DALL_APP, 'somma', 2, 3), { ok: true, dati: 5 });
    assert.deepEqual(repo.chiamate, [[2, 3]]);
});

test('canale db: richieste da fuori rifiutate senza eseguire nulla', () => {
    const repo = repositoryFinto();
    assert.equal(gestore(repo)(DA_FUORI, 'somma', 1, 1).errore.codice, 'non_autorizzato');
    assert.deepEqual(repo.chiamate, []);
});

test('canale db: solo i metodi della lista, niente proprietà ereditate', () => {
    const g = gestore();
    for (const metodo of ['nonPubblico', 'inesistente', 'constructor', '__proto__', 'toString', 'hasOwnProperty']) {
        assert.equal(g(DALL_APP, metodo).errore.codice, 'metodo_sconosciuto', metodo);
    }
});

test('canale db: errori di validazione con codice e campo, errori interni registrati nel log', () => {
    const log = [];
    const g = gestore(repositoryFinto(), (...args) => log.push(args));
    assert.deepEqual(g(DALL_APP, 'rifiuta'), { ok: false, errore: { codice: 'duplicato', messaggio: 'Esiste già', campo: 'nome' } });
    assert.equal(log.length, 0);
    assert.deepEqual(g(DALL_APP, 'esplode'), { ok: false, errore: { codice: 'interno', messaggio: 'disco pieno' } });
    assert.equal(log.length, 1);
});

test('azione asincrona: esito, rifiuto da fuori, errore', async () => {
    const log = [];
    const ok = creaGestoreAzione('prova', async () => ({ esportato: true }), { log: (...a) => log.push(a) });
    assert.deepEqual(await ok(DALL_APP), { ok: true, dati: { esportato: true } });
    assert.equal((await ok(DA_FUORI)).errore.codice, 'non_autorizzato');

    const ko = creaGestoreAzione('prova', async () => { throw new Error('permesso negato'); }, { log: (...a) => log.push(a) });
    assert.deepEqual(await ko(DALL_APP), { ok: false, errore: { codice: 'interno', messaggio: 'permesso negato' } });
    assert.equal(log.length, 1);
});

test('ogni metodo pubblico esiste davvero nel repository (niente errori di battitura)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lavasecco-ipc-'));
    const { db } = await apriDatabase({ dbPath: path.join(dir, 'x.sqlite3'), backupDir: path.join(dir, 'b') });
    const repo = createRepository(db);
    for (const metodo of METODI_PUBBLICI) {
        assert.equal(typeof repo[metodo], 'function', metodo);
    }
    // E il gestore reale risponde
    assert.deepEqual(creaGestoreDb(repo, METODI_PUBBLICI)(DALL_APP, 'getClienti'), { ok: true, dati: [] });
    db.close();
});
