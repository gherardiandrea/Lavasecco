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
    assert.deepEqual(repo.getProdotti().map((p) => [p.descrizione, p.prezzo_cent, p.nota_prezzo, p.ordini]), [
        ['Borsa', null, '', 0], ['Giacca', 750, '', 0], ['Tappeto', null, 'a peso', 0]
    ]);
});

test('modifica articolo: descrizione e prezzo, duplicati rifiutati, se stesso ammesso', () => {
    const giacca = repo.salvaProdotto({ descrizione: 'Giacca', prezzo: '7,50' });
    repo.salvaProdotto({ descrizione: 'Borsa', prezzo: '' });
    assert.throws(() => repo.salvaProdotto({ id: giacca, descrizione: 'borsa', prezzo: '1' }), erroreCon('duplicato', 'descrizione'));
    assert.throws(() => repo.salvaProdotto({ id: 999, descrizione: 'X', prezzo: '1' }), erroreCon('non_trovato'));
    assert.equal(repo.salvaProdotto({ id: giacca, descrizione: 'Giacca', prezzo: '8' }), giacca);
    assert.equal(repo.salvaProdotto({ id: giacca, descrizione: 'Giacca lunga', prezzo: 'a vista' }), giacca);
    const modificata = repo.getProdotti().find((p) => p.id === giacca);
    assert.deepEqual([modificata.descrizione, modificata.prezzo_cent, modificata.nota_prezzo], ['Giacca lunga', null, 'a vista']);
});

test('il prezzo resta quello registrato nell\'ordine anche se cambia il listino', () => {
    const { id, cliente_id, prodotto_id } = nuovoOrdine(2);
    assert.equal(repo.getOrdine(id).prezzo_unitario_cent, 750);

    repo.salvaProdotto({ id: prodotto_id, descrizione: 'Giacca', prezzo: '9,00' });
    assert.equal(repo.getOrdine(id).prezzo_unitario_cent, 750);

    // Modificando l'ordine senza cambiare prodotto il prezzo non cambia...
    const campi = { cliente_id, prodotto_id, quantita: 3, data_consegna: '2026-09-24' };
    assert.equal(repo.modificaOrdine(id, campi).prezzo_unitario_cent, 750);

    // ...cambiando prodotto prende il prezzo di listino del nuovo prodotto
    const tappeto = repo.salvaProdotto({ descrizione: 'Tappeto', prezzo: 'a peso' });
    const conTappeto = repo.modificaOrdine(id, { ...campi, prodotto_id: tappeto });
    assert.equal(conTappeto.prezzo_unitario_cent, null);
    assert.equal(conTappeto.nota_prezzo, 'a peso');

    // I nuovi ordini usano il listino attuale
    const [nuovo] = repo.creaOrdini([{ cliente_id, prodotto_id, quantita: 1, data_consegna: '2026-09-24' }]);
    assert.equal(repo.getOrdine(nuovo).prezzo_unitario_cent, 900);
});

test('elimina articolo: solo se non usato in nessun ordine', () => {
    const { id, prodotto_id } = nuovoOrdine(1);
    const libero = repo.salvaProdotto({ descrizione: 'Borsa', prezzo: '' });

    assert.equal(repo.getProdotti().find((p) => p.id === prodotto_id).ordini, 1);
    assert.throws(() => repo.eliminaProdotto(prodotto_id), erroreCon('in_uso'));
    assert.equal(repo.eliminaProdotto(libero), true);
    assert.throws(() => repo.eliminaProdotto(libero), erroreCon('non_trovato'));

    repo.eliminaOrdine(id);
    assert.equal(repo.eliminaProdotto(prodotto_id), true);
    assert.deepEqual(repo.getProdotti(), []);
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

test('getOrdini: aperti di tutti gli anni, consegnati filtrati per anno, con nome cliente e prodotto', () => {
    const { id, cliente_id, prodotto_id } = nuovoOrdine(1);
    // Un ordine registrato l'anno prima
    const repo2025 = createRepository(db, { oggi: () => '2025-12-20', annoCorrente: () => 2025 });
    const [vecchio] = repo2025.creaOrdini([{ cliente_id, prodotto_id, quantita: 1, data_consegna: '2025-12-20' }]);

    assert.deepEqual(repo.getOrdini({ vista: 'aperti' }).map((o) => o.id).sort(), [id, vecchio].sort());

    repo2025.consegnaOrdine(vecchio, 1);
    assert.deepEqual(repo.getOrdini({ vista: 'aperti' }).map((o) => o.id), [id]);
    assert.deepEqual(repo.getOrdini({ vista: 'consegnati', anno: 2025 }).map((o) => o.id), [vecchio]);
    assert.equal(repo.getOrdini({ vista: 'consegnati', anno: 2026 }).length, 0);

    const [riga] = repo.getOrdini({ vista: 'aperti' });
    assert.equal(riga.cliente_nome, 'Mario');
    assert.equal(riga.prodotto_descrizione, 'Giacca');
    assert.equal(riga.prezzo_unitario_cent, 750);
    assert.equal(riga.rif_legacy, undefined, "l'elenco contiene solo le colonne della tabella");
});

test('cercaClienti: per nome o telefono, prima chi inizia col testo, caratteri speciali come testo', () => {
    repo.salvaCliente({ nome: 'Anna Rossi', telefono: '333 111' });
    repo.salvaCliente({ nome: 'Rossi Mario', telefono: '' });
    repo.salvaCliente({ nome: 'Luca Bianchi', telefono: '347 999' });
    repo.salvaCliente({ nome: 'Sconto 100%', telefono: '' });

    assert.deepEqual(repo.cercaClienti('rossi').map((c) => c.nome), ['Rossi Mario', 'Anna Rossi']);
    assert.deepEqual(repo.cercaClienti('347').map((c) => c.nome), ['Luca Bianchi']);
    assert.deepEqual(repo.cercaClienti('%').map((c) => c.nome), ['Sconto 100%']);
    assert.equal(repo.cercaClienti('').length, 4);
    assert.deepEqual(repo.cercaClienti('nessuno'), []);
});

test('eliminaOrdine', () => {
    const { id } = nuovoOrdine(1);
    assert.equal(repo.eliminaOrdine(id), true);
    assert.throws(() => repo.eliminaOrdine(id), erroreCon('non_trovato'));
    assert.throws(() => repo.getOrdine(id), erroreCon('non_trovato'));
});

test('ripristinaConsegna: "Annulla" riporta esattamente lo stato precedente, anche parziale', () => {
    const { id } = nuovoOrdine(3);
    const statoDi = (o) => ({ stato: o.stato, quantita_consegnata: o.quantita_consegnata, data_ritiro_effettiva: o.data_ritiro_effettiva });

    const iniziale = statoDi(repo.getOrdine(id));
    const parziale = statoDi(repo.consegnaOrdine(id, 1));
    repo.consegnaOrdine(id, 2);

    assert.deepEqual(statoDi(repo.ripristinaConsegna(id, parziale)), { stato: 2, quantita_consegnata: 1, data_ritiro_effettiva: '2026-09-24' });
    assert.deepEqual(statoDi(repo.ripristinaConsegna(id, iniziale)), { stato: 0, quantita_consegnata: 0, data_ritiro_effettiva: null });

    // Annullare un "annulla consegna" riporta l'ordine tra i consegnati
    const consegnato = statoDi(repo.consegnaOrdine(id, 3));
    repo.annullaConsegna(id);
    assert.equal(repo.ripristinaConsegna(id, consegnato).stato, 1);

    assert.throws(() => repo.ripristinaConsegna(id, { stato: 1, quantita_consegnata: 1 }), erroreCon('valore_non_valido'));
    assert.throws(() => repo.ripristinaConsegna(id, { stato: 2, quantita_consegnata: 3 }), erroreCon('valore_non_valido'));
    assert.throws(() => repo.ripristinaConsegna(id, { stato: 0, quantita_consegnata: 2 }), erroreCon('valore_non_valido'));
});

test('riepilogoOggi: ritiri di oggi, ritardi, consegne del giorno e della settimana', () => {
    const cliente_id = repo.salvaCliente({ nome: 'Mario', telefono: '333' });
    const prodotto_id = repo.salvaProdotto({ descrizione: 'Giacca', prezzo: '7,50' });
    const ordine = (ritiro, quantita, posizione = '') => repo.creaOrdini([{ cliente_id, prodotto_id, quantita, posizione, data_consegna: '2026-09-01', data_ritiro_prevista: ritiro }])[0];

    ordine('2026-09-24', 2, 'B2');                 // ritiro oggi
    ordine('2026-09-24', 1, 'A1');                 // ritiro oggi, posizione prima
    const recente = ordine('2026-09-20', 1);       // in ritardo di 4 giorni
    const vecchio = ordine('2026-09-10', 1);       // in ritardo di 14 giorni
    ordine('2026-09-30', 1);                       // futuro
    repo.consegnaOrdine(ordine('2026-09-24', 2), 2); // consegnato oggi: 2 x 7,50

    const r = repo.riepilogoOggi();
    assert.equal(r.oggi, '2026-09-24');
    assert.deepEqual(r.daRitirare, { ordini: 2, capi: 3 });
    assert.deepEqual(r.inRitardo, { ordini: 2, piu_vecchio: '2026-09-10' });
    assert.equal(r.aperti, 5);
    assert.deepEqual(r.consegnatiOggi, { ordini: 1, cent: 1500 });
    assert.deepEqual(r.consegnatiIeri, { ordini: 0, cent: 0 });
    assert.deepEqual(r.settimana.map((g) => g.data), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
    assert.deepEqual(r.settimana.map((g) => g.ordini), [0, 0, 0, 1, 0, 0, 0]);
    assert.deepEqual(r.ritiriOggi.map((o) => o.posizione), ['A1', 'B2']);
    assert.deepEqual(r.ritardiRecenti.map((o) => o.id), [recente, vecchio]);
    assert.equal(r.ritiriOggi[0].cliente_telefono, '333');
});

test('clienti con il numero di ordini aperti', () => {
    const { cliente_id, prodotto_id } = nuovoOrdine(1);
    repo.creaOrdini([{ cliente_id, prodotto_id, quantita: 1, data_consegna: '2026-09-24' }]);
    repo.salvaCliente({ nome: 'Senza ordini', telefono: '' });
    assert.deepEqual(repo.getClienti().map((c) => [c.nome, c.ordini_aperti]), [['Mario', 2], ['Senza ordini', 0]]);
    assert.equal(repo.cercaClienti('mar')[0].ordini_aperti, 2);
});

test('casi limite: cliente inesistente, ordine senza righe, stato del backup', () => {
    assert.throws(() => repo.salvaCliente({ id: 999, nome: 'Nessuno', telefono: '' }), erroreCon('non_trovato'));
    assert.throws(() => repo.creaOrdini([]), erroreCon('valore_mancante'));
    assert.throws(() => repo.creaOrdini(null), erroreCon('valore_mancante'));

    const { setMeta } = require('../database');
    assert.deepEqual(repo.getInfoBackup(), { ultimo: null });
    setMeta(db, 'last_backup_date', '2026-09-23');
    assert.deepEqual(repo.getInfoBackup(), { ultimo: '2026-09-23' });
    setMeta(db, 'last_backup_at', '2026-09-24T07:12:00.000Z');
    assert.deepEqual(repo.getInfoBackup(), { ultimo: '2026-09-24T07:12:00.000Z' });
});
