window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) {
            element.innerText = text;
        }
    };

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type]);
    }
});

const { contextBridge } = require('electron');
const { db, initDB, toYear, ensureOrderTable, resolveOrderTableName } = require('./database');

initDB();

function toInt(value) {
    return parseInt(value, 10);
}

function getOrdiniTableByTab(tab, year) {
    const y = toYear(year);
    const isClosed = String(tab || 'ordini_').startsWith('ordini_chiusi_');
    return resolveOrderTableName(y, isClosed);
}

function upsertOrdine(tableName, ordine) {
    ensureOrderTable(tableName);

    const payload = {
        id: ordine.id ? toInt(ordine.id) : null,
        cliente: ordine.cliente ? toInt(ordine.cliente) : null,
        prodotto: ordine.prodotto ? toInt(ordine.prodotto) : null,
        quantita: ordine.quantita ? toInt(ordine.quantita) : 0,
        descrizione: ordine.descrizione || '',
        data_di_ritiro_prevista: ordine.data_di_ritiro_prevista || '',
        data_di_consegna: ordine.data_di_consegna || '',
        data_di_consegna_effettiva: ordine.data_di_consegna_effettiva || '',
        stato: String(ordine.stato ?? '0'),
        posizione: ordine.posizione || '',
        quantita_consegnata: ordine.quantita_consegnata ? toInt(ordine.quantita_consegnata) : 0
    };

    if (payload.id) {
        const stmt = db.prepare(`
            INSERT INTO "${tableName}"
            (id, cliente, prodotto, quantita, descrizione, data_di_ritiro_prevista, data_di_consegna, data_di_consegna_effettiva, stato, posizione, quantita_consegnata)
            VALUES (@id, @cliente, @prodotto, @quantita, @descrizione, @data_di_ritiro_prevista, @data_di_consegna, @data_di_consegna_effettiva, @stato, @posizione, @quantita_consegnata)
            ON CONFLICT(id) DO UPDATE SET
                cliente=excluded.cliente,
                prodotto=excluded.prodotto,
                quantita=excluded.quantita,
                descrizione=excluded.descrizione,
                data_di_ritiro_prevista=excluded.data_di_ritiro_prevista,
                data_di_consegna=excluded.data_di_consegna,
                data_di_consegna_effettiva=excluded.data_di_consegna_effettiva,
                stato=excluded.stato,
                posizione=excluded.posizione,
                quantita_consegnata=excluded.quantita_consegnata;
        `);
        stmt.run(payload);
        return;
    }

    const stmt = db.prepare(`
        INSERT INTO "${tableName}"
        (cliente, prodotto, quantita, descrizione, data_di_ritiro_prevista, data_di_consegna, data_di_consegna_effettiva, stato, posizione, quantita_consegnata)
        VALUES (@cliente, @prodotto, @quantita, @descrizione, @data_di_ritiro_prevista, @data_di_consegna, @data_di_consegna_effettiva, @stato, @posizione, @quantita_consegnata);
    `);
    stmt.run(payload);
}

function updateById(tableName, id, set, allowedColumns) {
    const keys = Object.keys(set || {}).filter((key) => allowedColumns.includes(key));
    if (!keys.length) {
        return;
    }

    const setClause = keys.map((key) => `${key} = @${key}`).join(', ');
    const params = { id: toInt(id) };

    keys.forEach((key) => {
        params[key] = set[key] ?? '';
    });

    db.prepare(`UPDATE "${tableName}" SET ${setClause} WHERE id = @id`).run(params);
}

contextBridge.exposeInMainWorld('myAPI', {
    desktop: true,

    getElencoClienti: () => {
        return db.prepare('SELECT * FROM clienti ORDER BY nome COLLATE NOCASE').all();
    },

    getClienteById: (id_cliente) => {
        const cliente = db.prepare('SELECT * FROM clienti WHERE id = ?').get(toInt(id_cliente));
        return cliente ? cliente.nome : '';
    },

    getElencoProdotti: () => {
        return db.prepare('SELECT * FROM prodotti ORDER BY descrizione COLLATE NOCASE').all();
    },

    getProdottoById: (id_prodotto) => {
        return db.prepare('SELECT * FROM prodotti WHERE id = ?').get(toInt(id_prodotto)) || {};
    },

    getElencoOrdini: (stato_da_cercare, year) => {
        const tableName = resolveOrderTableName(year, String(stato_da_cercare) === '1');
        return db
            .prepare(`SELECT * FROM "${tableName}" WHERE stato = ? ORDER BY id DESC`)
            .all(String(stato_da_cercare));
    },

    putOrdine: (ordine, year) => {
        const tableName = resolveOrderTableName(year, false);
        upsertOrdine(tableName, ordine);
    },

    putOrdineChiuso: (ordine, year) => {
        const tableName = resolveOrderTableName(year, true);
        upsertOrdine(tableName, ordine);
    },

    getClienteByNomeEEmail: (nome, num_telefono) => {
        const row = db
            .prepare('SELECT id FROM clienti WHERE nome = ? AND (email = ? OR telefono = ?) LIMIT 1')
            .get(nome, num_telefono, num_telefono);
        return row ? 0 : 1;
    },

    putCliente: (cliente) => {
        db.prepare('INSERT INTO clienti (nome, email, telefono) VALUES (?, ?, ?)').run(
            cliente.nome || '',
            cliente.email || '',
            cliente.telefono || ''
        );
    },

    getProdottoByDescrizione: (descrizione) => {
        const row = db.prepare('SELECT id FROM prodotti WHERE descrizione = ? LIMIT 1').get(descrizione);
        return row ? 0 : 1;
    },

    putProdotto: (prodotto) => {
        db.prepare('INSERT INTO prodotti (descrizione, prezzo) VALUES (?, ?)').run(
            prodotto.descrizione || '',
            prodotto.prezzo || ''
        );
    },

    eliminaOrdine: (id_ordine, year) => {
        const tableName = resolveOrderTableName(year, false);
        db.prepare(`DELETE FROM "${tableName}" WHERE id = ?`).run(toInt(id_ordine));
    },

    getOrdineById: (id_ordine, year) => {
        const tableName = resolveOrderTableName(year, false);
        return db.prepare(`SELECT * FROM "${tableName}" WHERE id = ?`).get(toInt(id_ordine)) || '';
    },

    modificaOrdine: (where, set, year) => {
        const tableName = resolveOrderTableName(year, false);
        updateById(tableName, where.id, set, [
            'cliente',
            'prodotto',
            'quantita',
            'descrizione',
            'data_di_ritiro_prevista',
            'data_di_consegna',
            'data_di_consegna_effettiva',
            'stato',
            'posizione',
            'quantita_consegnata'
        ]);
    },

    getOrdineChiusoById: (id_ordine, year) => {
        const tableName = resolveOrderTableName(year, true);
        return db.prepare(`SELECT * FROM "${tableName}" WHERE id = ?`).get(toInt(id_ordine)) || '';
    },

    eliminaOrdineChiuso: (id_ordine, year) => {
        const tableName = resolveOrderTableName(year, true);
        db.prepare(`DELETE FROM "${tableName}" WHERE id = ?`).run(toInt(id_ordine));
    },

    cambiaOrdini: (anno_da_controllare, stato_da_cercare, tab = 'ordini_') => {
        const tableName = getOrdiniTableByTab(tab, anno_da_controllare);
        return db
            .prepare(`SELECT * FROM "${tableName}" WHERE stato = ? ORDER BY id DESC`)
            .all(String(stato_da_cercare));
    },

    modificaCliente: (where, set) => {
        updateById('clienti', where.id, set, ['nome', 'email', 'telefono']);
    }
});