const { STATO, transaction, parsePrezzo, oggiIso } = require('./database');

// Errore "previsto" (dati non validi): arriva alla UI con codice e campo, senza stack trace.
class ErroreValidazione extends Error {
    constructor(codice, messaggio, campo = null) {
        super(messaggio);
        this.name = 'ErroreValidazione';
        this.codice = codice;
        this.campo = campo;
    }
}

// Nomi dei campi come li vede l'utente, per i messaggi d'errore
const ETICHETTE = {
    id: 'identificativo',
    anno: 'anno',
    quantita: 'quantità (numero intero maggiore di zero)',
    cliente_id: 'cliente',
    prodotto_id: 'prodotto',
    data_consegna: 'di consegna',
    data_ritiro_prevista: 'di ritiro prevista',
    data_ritiro_effettiva: 'di ritiro effettiva'
};

function etichetta(campo) {
    return ETICHETTE[campo] || campo;
}

function testo(valore) {
    return String(valore ?? '').trim();
}

function intero(valore, campo, minimo) {
    const n = typeof valore === 'number' ? valore : Number(testo(valore));
    if (testo(valore) === '' || !Number.isInteger(n) || n < minimo) {
        throw new ErroreValidazione('valore_non_valido', `Valore non valido: ${etichetta(campo)}`, campo);
    }
    return n;
}

function idValido(valore, campo = 'id') {
    return intero(valore, campo, 1);
}

// Data ISO YYYY-MM-DD; '' / null -> null (o errore se obbligatoria).
function dataIso(valore, campo, obbligatoria = false) {
    const t = testo(valore);
    if (t === '') {
        if (obbligatoria) throw new ErroreValidazione('valore_mancante', `La data ${etichetta(campo)} è obbligatoria`, campo);
        return null;
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    const d = m && new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (!m || d.toISOString().slice(0, 10) !== t) {
        throw new ErroreValidazione('valore_non_valido', `Data ${etichetta(campo)} non valida`, campo);
    }
    return t;
}

// Il prezzo di un ordine (prezzo_unitario_cent / nota_prezzo) è quello salvato nell'ordine, non il listino attuale
const SELECT_ORDINE = `
    SELECT o.*, c.nome AS cliente_nome, p.descrizione AS prodotto_descrizione
    FROM ordini o
    JOIN clienti c ON c.id = o.cliente_id
    JOIN prodotti p ON p.id = o.prodotto_id
`;

function createRepository(db, { oggi = oggiIso, annoCorrente = () => new Date().getFullYear() } = {}) {
    const q = {
        clienti: db.prepare('SELECT id, nome, telefono FROM clienti ORDER BY nome COLLATE NOCASE'),
        clienteDuplicato: db.prepare('SELECT id FROM clienti WHERE nome = ? COLLATE NOCASE AND telefono = ? AND id != ? LIMIT 1'),
        clienteEsiste: db.prepare('SELECT 1 FROM clienti WHERE id = ?'),
        inserisciCliente: db.prepare('INSERT INTO clienti (nome, telefono) VALUES (?, ?)'),
        aggiornaCliente: db.prepare('UPDATE clienti SET nome = ?, telefono = ? WHERE id = ?'),

        // ordini = quanti ordini usano l'articolo (se > 0 non si può eliminare)
        prodotti: db.prepare(`
            SELECT p.id, p.descrizione, p.prezzo_cent, p.nota_prezzo,
                   (SELECT COUNT(*) FROM ordini o WHERE o.prodotto_id = p.id) AS ordini
            FROM prodotti p ORDER BY p.descrizione COLLATE NOCASE
        `),
        prodottoDuplicato: db.prepare('SELECT id FROM prodotti WHERE descrizione = ? COLLATE NOCASE AND id != ? LIMIT 1'),
        prodotto: db.prepare('SELECT id, descrizione, prezzo_cent, nota_prezzo FROM prodotti WHERE id = ?'),
        inserisciProdotto: db.prepare('INSERT INTO prodotti (descrizione, prezzo_cent, nota_prezzo) VALUES (?, ?, ?)'),
        aggiornaProdotto: db.prepare('UPDATE prodotti SET descrizione = ?, prezzo_cent = ?, nota_prezzo = ? WHERE id = ?'),
        ordiniConProdotto: db.prepare('SELECT COUNT(*) AS n FROM ordini WHERE prodotto_id = ?'),
        eliminaProdotto: db.prepare('DELETE FROM prodotti WHERE id = ?'),

        ordine: db.prepare(`${SELECT_ORDINE} WHERE o.id = ?`),
        ordiniAperti: db.prepare(`${SELECT_ORDINE} WHERE o.anno = ? AND o.stato IN (0, 2) ORDER BY o.id DESC`),
        ordiniConsegnati: db.prepare(`${SELECT_ORDINE} WHERE o.anno = ? AND o.stato = 1 ORDER BY o.id DESC`),
        inserisciOrdine: db.prepare(`
            INSERT INTO ordini (anno, cliente_id, prodotto_id, prezzo_unitario_cent, nota_prezzo, quantita, descrizione, posizione, data_consegna, data_ritiro_prevista)
            VALUES (@anno, @cliente_id, @prodotto_id, @prezzo_unitario_cent, @nota_prezzo, @quantita, @descrizione, @posizione, @data_consegna, @data_ritiro_prevista)
        `),
        aggiornaOrdine: db.prepare(`
            UPDATE ordini SET cliente_id = @cliente_id, prodotto_id = @prodotto_id,
                prezzo_unitario_cent = @prezzo_unitario_cent, nota_prezzo = @nota_prezzo, quantita = @quantita,
                descrizione = @descrizione, posizione = @posizione, data_consegna = @data_consegna,
                data_ritiro_prevista = @data_ritiro_prevista, data_ritiro_effettiva = @data_ritiro_effettiva
            WHERE id = @id
        `),
        aggiornaConsegna: db.prepare(`
            UPDATE ordini SET stato = @stato, quantita_consegnata = @quantita_consegnata, data_ritiro_effettiva = @data_ritiro_effettiva
            WHERE id = @id
        `),
        eliminaOrdine: db.prepare('DELETE FROM ordini WHERE id = ?')
    };

    function caricaOrdine(id) {
        const ordine = q.ordine.get(idValido(id));
        if (!ordine) {
            throw new ErroreValidazione('non_trovato', 'Ordine non trovato');
        }
        return ordine;
    }

    function caricaProdotto(id, campo = 'prodotto_id') {
        const prodotto = q.prodotto.get(idValido(id, campo));
        if (!prodotto) {
            throw new ErroreValidazione('non_trovato', 'Prodotto non trovato', campo);
        }
        return prodotto;
    }

    // Cliente e prodotto dell'ordine; il prezzo viene copiato dal listino del prodotto scelto.
    function riferimentiOrdine(dati) {
        const cliente_id = idValido(dati.cliente_id, 'cliente_id');
        if (!q.clienteEsiste.get(cliente_id)) throw new ErroreValidazione('non_trovato', 'Cliente non trovato', 'cliente_id');
        const prodotto = caricaProdotto(dati.prodotto_id);
        return {
            cliente_id,
            prodotto_id: prodotto.id,
            prezzo_unitario_cent: prodotto.prezzo_cent,
            nota_prezzo: prodotto.nota_prezzo
        };
    }

    return {
        getClienti() {
            return q.clienti.all();
        },

        // Crea (senza id) o modifica (con id) un cliente. Nome + telefono devono essere univoci.
        salvaCliente({ id = null, nome, telefono }) {
            nome = testo(nome);
            telefono = testo(telefono);
            if (nome === '') {
                throw new ErroreValidazione('valore_mancante', 'Il nome è obbligatorio', 'nome');
            }
            const idCliente = id == null ? null : idValido(id);
            if (q.clienteDuplicato.get(nome, telefono, idCliente ?? -1)) {
                throw new ErroreValidazione('duplicato', 'Esiste già un cliente con questo nome e numero di telefono', 'nome');
            }
            if (idCliente == null) {
                return Number(q.inserisciCliente.run(nome, telefono).lastInsertRowid);
            }
            if (q.aggiornaCliente.run(nome, telefono, idCliente).changes === 0) {
                throw new ErroreValidazione('non_trovato', 'Cliente non trovato');
            }
            return idCliente;
        },

        getProdotti() {
            return q.prodotti.all();
        },

        // Crea (senza id) o modifica (con id) un articolo del listino.
        // prezzo: testo come inserito ("7,50", "15 €"); vuoto o non numerico = prezzo non fisso (es. "a vista").
        // Cambiare il prezzo vale per i nuovi ordini: quelli esistenti tengono il prezzo con cui sono stati registrati.
        salvaProdotto({ id = null, descrizione, prezzo }) {
            descrizione = testo(descrizione);
            if (descrizione === '') {
                throw new ErroreValidazione('valore_mancante', 'La descrizione è obbligatoria', 'descrizione');
            }
            const idProdotto = id == null ? null : caricaProdotto(id, 'id').id;
            if (q.prodottoDuplicato.get(descrizione, idProdotto ?? -1)) {
                throw new ErroreValidazione('duplicato', 'Esiste già un articolo con questa descrizione', 'descrizione');
            }
            const { prezzo_cent, nota_prezzo } = parsePrezzo(prezzo);
            if (idProdotto == null) {
                return Number(q.inserisciProdotto.run(descrizione, prezzo_cent, nota_prezzo).lastInsertRowid);
            }
            q.aggiornaProdotto.run(descrizione, prezzo_cent, nota_prezzo, idProdotto);
            return idProdotto;
        },

        // Si possono eliminare solo articoli mai usati in un ordine (lo storico deve restare completo).
        eliminaProdotto(id) {
            const prodotto = caricaProdotto(id, 'id');
            const { n } = q.ordiniConProdotto.get(prodotto.id);
            if (n > 0) {
                throw new ErroreValidazione('in_uso', `"${prodotto.descrizione}" è usato in ${n} ${n === 1 ? 'ordine' : 'ordini'} e non può essere eliminato`);
            }
            q.eliminaProdotto.run(prodotto.id);
            return true;
        },

        // vista: 'aperti' (da consegnare, anche in parte) oppure 'consegnati'
        getOrdini({ vista, anno }) {
            const a = intero(anno, 'anno', 2000);
            return vista === 'consegnati' ? q.ordiniConsegnati.all(a) : q.ordiniAperti.all(a);
        },

        getOrdine(id) {
            return caricaOrdine(id);
        },

        // Più righe dello stesso ordine (stesso cliente e date, prodotti diversi): tutte o nessuna.
        creaOrdini(righe) {
            if (!Array.isArray(righe) || righe.length === 0) {
                throw new ErroreValidazione('valore_mancante', 'Nessun ordine da inserire');
            }
            return transaction(db, () => righe.map((riga) => {
                const valori = {
                    anno: annoCorrente(),
                    ...riferimentiOrdine(riga),
                    quantita: intero(riga.quantita, 'quantita', 1),
                    descrizione: testo(riga.descrizione),
                    posizione: testo(riga.posizione),
                    data_consegna: dataIso(riga.data_consegna, 'data_consegna', true),
                    data_ritiro_prevista: dataIso(riga.data_ritiro_prevista, 'data_ritiro_prevista')
                };
                return Number(q.inserisciOrdine.run(valori).lastInsertRowid);
            }));
        },

        modificaOrdine(id, campi) {
            return transaction(db, () => {
                const ordine = caricaOrdine(id);
                if (ordine.stato === STATO.CONSEGNATO) {
                    throw new ErroreValidazione('non_modificabile', "Un ordine consegnato non si può modificare: annulla prima la consegna");
                }
                const quantita = intero(campi.quantita, 'quantita', 1);
                if (quantita < ordine.quantita_consegnata) {
                    throw new ErroreValidazione('valore_non_valido', `La quantità non può essere inferiore a quella già consegnata (${ordine.quantita_consegnata})`, 'quantita');
                }
                // Il prezzo salvato resta quello originale; si aggiorna al listino solo se cambia il prodotto
                const riferimenti = riferimentiOrdine(campi);
                if (riferimenti.prodotto_id === ordine.prodotto_id) {
                    riferimenti.prezzo_unitario_cent = ordine.prezzo_unitario_cent;
                    riferimenti.nota_prezzo = ordine.nota_prezzo;
                }
                q.aggiornaOrdine.run({
                    id: ordine.id,
                    ...riferimenti,
                    quantita,
                    descrizione: testo(campi.descrizione),
                    posizione: testo(campi.posizione),
                    data_consegna: dataIso(campi.data_consegna, 'data_consegna', true),
                    data_ritiro_prevista: dataIso(campi.data_ritiro_prevista, 'data_ritiro_prevista'),
                    data_ritiro_effettiva: dataIso(campi.data_ritiro_effettiva, 'data_ritiro_effettiva')
                });
                return caricaOrdine(ordine.id);
            });
        },

        // Registra la consegna di `quantita` pezzi: parziale (stato 2) o completa (stato 1).
        consegnaOrdine(id, quantita) {
            return transaction(db, () => {
                const ordine = caricaOrdine(id);
                if (ordine.stato === STATO.CONSEGNATO) {
                    throw new ErroreValidazione('gia_consegnato', "L'ordine è già stato consegnato");
                }
                const pezzi = intero(quantita, 'quantita', 1);
                const totale = ordine.quantita_consegnata + pezzi;
                if (totale > ordine.quantita) {
                    throw new ErroreValidazione('valore_non_valido', `Restano da consegnare solo ${ordine.quantita - ordine.quantita_consegnata} pezzi`, 'quantita');
                }
                q.aggiornaConsegna.run({
                    id: ordine.id,
                    stato: totale === ordine.quantita ? STATO.CONSEGNATO : STATO.PARZIALE,
                    quantita_consegnata: totale,
                    data_ritiro_effettiva: oggi()
                });
                return caricaOrdine(ordine.id);
            });
        },

        // Riporta un ordine consegnato tra quelli da consegnare (come prima: consegnato = 0).
        annullaConsegna(id) {
            return transaction(db, () => {
                const ordine = caricaOrdine(id);
                if (ordine.stato !== STATO.CONSEGNATO) {
                    throw new ErroreValidazione('non_consegnato', "L'ordine non risulta consegnato");
                }
                q.aggiornaConsegna.run({ id: ordine.id, stato: STATO.APERTO, quantita_consegnata: 0, data_ritiro_effettiva: null });
                return caricaOrdine(ordine.id);
            });
        },

        eliminaOrdine(id) {
            if (q.eliminaOrdine.run(idValido(id)).changes === 0) {
                throw new ErroreValidazione('non_trovato', 'Ordine non trovato');
            }
            return true;
        }
    };
}

// Metodi invocabili dal renderer via IPC (whitelist).
const METODI_PUBBLICI = [
    'getClienti', 'salvaCliente',
    'getProdotti', 'salvaProdotto', 'eliminaProdotto',
    'getOrdini', 'getOrdine', 'creaOrdini', 'modificaOrdine', 'consegnaOrdine', 'annullaConsegna', 'eliminaOrdine'
];

module.exports = { createRepository, ErroreValidazione, METODI_PUBBLICI };
