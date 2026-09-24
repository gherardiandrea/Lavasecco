const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { apriDatabase } = require('../database');
const { createRepository, ErroreValidazione } = require('../repository');

let db;
let repo;

beforeEach(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lavasecco-repo-'));
    ({ db } = await apriDatabase({ dbPath: path.join(dir, 'x.sqlite3'), backupDir: path.join(dir, 'b') }));
    repo = createRepository(db, { oggi: () => '2026-09-24', annoCorrente: () => 2026 });
});

function erroreCon(codice, campo) {
    return (error) => {
        assert.ok(error instanceof ErroreValidazione, `atteso ErroreValidazione, ricevuto ${error}`);
        assert.equal(error.codice, codice);
        if (campo !== undefined) assert.equal(error.campo, campo);
        return true;
    };
}

function nuovoOrdine(quantita = 3) {
    const cliente_id = repo.salvaCliente({ nome: 'Mario', telefono: '333' });
    const prodotto_id = repo.salvaProdotto({ descrizione: 'Giacca', prezzo: '7,50' });
    const [id] = repo.creaOrdini([{ cliente_id, prodotto_id, quantita, data_consegna: '2026-09-24', data_ritiro_prevista: '2026-09-27' }]);
    return { id, cliente_id, prodotto_id };
}

test('clienti: nome obbligatorio, duplicati rifiutati, modifica senza cambiare nulla consentita', () => {
    assert.throws(() => repo.salvaCliente({ nome: '  ', telefono: '1' }), erroreCon('valore_mancante', 'nome'));
    const id = repo.salvaCliente({ nome: 'Mario Rossi', telefono: '333' });
    assert.throws(() => repo.salvaCliente({ nome: 'mario rossi', telefono: '333' }), erroreCon('duplicato', 'nome'));
    assert.equal(repo.salvaCliente({ nome: 'Mario Rossi', telefono: '444' }) > id, true);
    assert.equal(repo.salvaCliente({ id, nome: 'Mario Rossi', telefono: '333' }), id);
    assert.deepEqual(repo.getClienti().map((c) => c.telefono).sort(), ['333', '444']);
});

test('prodotti: prezzo in centesimi, "a vista" come nota, descrizione univoca', () => {
    repo.salvaProdotto({ descrizione: 'Giacca', prezzo: '7,50' });
    repo.salvaProdotto({ descrizione: 'Tappeto', prezzo: 'a peso' });
    repo.salvaProdotto({ descrizione: 'Borsa', prezzo: '' });
    assert.throws(() => repo.salvaProdotto({ descrizione: 'giacca', prezzo: '1' }), erroreCon('duplicato'));
    assert.deepEqual(repo.getProdotti().map((p) => [p.descrizione, p.prezzo_cent, p.nota_prezzo]), [
        ['Borsa', null, ''], ['Giacca', 750, ''], ['Tappeto', null, 'a peso']
    ]);
});

test('creaOrdini è atomico: se una riga non è valida non viene inserito nulla', () => {
    const { cliente_id, prodotto_id } = nuovoOrdine();
    const base = { cliente_id, prodotto_id, data_consegna: '2026-09-24' };
    assert.throws(() => repo.creaOrdini([{ ...base, quantita: 2 }, { ...base, quantita: 0 }]), erroreCon('valore_non_valido', 'quantita'));
    assert.throws(() => repo.creaOrdini([{ ...base, quantita: '' }]), erroreCon('valore_non_valido', 'quantita'));
    assert.throws(() => repo.creaOrdini([{ ...base, quantita: -1 }]), erroreCon('valore_non_valido', 'quantita'));
    assert.throws(() => repo.creaOrdini([{ ...base, quantita: 1, data_consegna: '' }]), erroreCon('valore_mancante', 'data_consegna'));
    assert.throws(() => repo.creaOrdini([{ ...base, quantita: 1, cliente_id: 999 }]), erroreCon('non_trovato', 'cliente_id'));
    assert.equal(repo.getOrdini({ vista: 'aperti', anno: 2026 }).length, 1);
});

test('consegna parziale e poi completa: stesso id, stato e date corretti', () => {
    const { id } = nuovoOrdine(3);

    assert.throws(() => repo.consegnaOrdine(id, ''), erroreCon('valore_non_valido', 'quantita'));
    assert.throws(() => repo.consegnaOrdine(id, 0), erroreCon('valore_non_valido', 'quantita'));
    assert.throws(() => repo.consegnaOrdine(id, -1), erroreCon('valore_non_valido', 'quantita'));
    assert.throws(() => repo.consegnaOrdine(id, 4), erroreCon('valore_non_valido', 'quantita'));

    let ordine = repo.consegnaOrdine(id, 1);
    assert.equal(ordine.id, id);
    assert.equal(ordine.stato, 2);
    assert.equal(ordine.quantita_consegnata, 1);
    assert.equal(ordine.data_ritiro_effettiva, '2026-09-24');
    assert.equal(repo.getOrdini({ vista: 'aperti', anno: 2026 }).length, 1);

    assert.throws(() => repo.consegnaOrdine(id, 3), erroreCon('valore_non_valido', 'quantita'));
    ordine = repo.consegnaOrdine(id, 2);
    assert.equal(ordine.id, id);
    assert.equal(ordine.stato, 1);
    assert.equal(ordine.quantita_consegnata, 3);
    assert.equal(repo.getOrdini({ vista: 'aperti', anno: 2026 }).length, 0);
    assert.equal(repo.getOrdini({ vista: 'consegnati', anno: 2026 }).length, 1);
    assert.throws(() => repo.consegnaOrdine(id, 1), erroreCon('gia_consegnato'));
});

test('annulla consegna riporta l\'ordine tra gli aperti con lo stesso id', () => {
    const { id } = nuovoOrdine(2);
    assert.throws(() => repo.annullaConsegna(id), erroreCon('non_consegnato'));
    repo.consegnaOrdine(id, 2);
    const ordine = repo.annullaConsegna(id);
    assert.equal(ordine.id, id);
    assert.equal(ordine.stato, 0);
    assert.equal(ordine.quantita_consegnata, 0);
    assert.equal(ordine.data_ritiro_effettiva, null);
});

test('modifica ordine: quantità non sotto il consegnato, consegnati non modificabili', () => {
    const { id, cliente_id, prodotto_id } = nuovoOrdine(3);
    repo.consegnaOrdine(id, 2);
    const campi = { cliente_id, prodotto_id, quantita: 1, descrizione: 'x', posizione: 'B2', data_consegna: '2026-09-20' };
    assert.throws(() => repo.modificaOrdine(id, campi), erroreCon('valore_non_valido', 'quantita'));
    assert.throws(() => repo.modificaOrdine(id, { ...campi, quantita: 4, data_consegna: '2026-13-01' }), erroreCon('valore_non_valido', 'data_consegna'));

    const modificato = repo.modificaOrdine(id, { ...campi, quantita: 4 });
    assert.equal(modificato.quantita, 4);
    assert.equal(modificato.posizione, 'B2');
    assert.equal(modificato.data_consegna, '2026-09-20');

    repo.consegnaOrdine(id, 2);
    assert.throws(() => repo.modificaOrdine(id, { ...campi, quantita: 4 }), erroreCon('non_modificabile'));
});

test('getOrdini filtra per anno e include nome cliente e prodotto', () => {
    const { id } = nuovoOrdine(1);
    assert.equal(repo.getOrdini({ vista: 'aperti', anno: 2025 }).length, 0);
    const [riga] = repo.getOrdini({ vista: 'aperti', anno: 2026 });
    assert.equal(riga.id, id);
    assert.equal(riga.cliente_nome, 'Mario');
    assert.equal(riga.prodotto_descrizione, 'Giacca');
    assert.equal(riga.prezzo_cent, 750);
});

test('eliminaOrdine', () => {
    const { id } = nuovoOrdine(1);
    assert.equal(repo.eliminaOrdine(id), true);
    assert.throws(() => repo.eliminaOrdine(id), erroreCon('non_trovato'));
    assert.throws(() => repo.getOrdine(id), erroreCon('non_trovato'));
});
