// Tabelle (DataTables): i dati arrivano come array e vengono create solo le righe visibili,
// così anche migliaia di ordini si aprono subito. Dopo un'azione si aggiorna solo la riga interessata.

const DT_LANGUAGE = {
    thousands: '.',
    decimal: ',',
    zeroRecords: 'Nessun risultato per questa ricerca',
    emptyTable: 'Nessun elemento da mostrare',
    info: '_TOTAL_ elementi · pagina _PAGE_ di _PAGES_',
    infoEmpty: 'Nessun elemento',
    infoFiltered: '(su _MAX_)',
    paginate: { first: 'Primo', previous: '‹', next: '›', last: 'Ultimo' },
    aria: { sortAscending: ': ordina in modo crescente', sortDescending: ': ordina in modo decrescente' }
};

const OPZIONI_DATATABLE = {
    language: DT_LANGUAGE,
    pageLength: 15,
    lengthChange: false,
    autoWidth: false,
    deferRender: true,
    // Solo tabella + piede (conteggio e pagine): la ricerca è quella della barra in alto
    dom: 't<"piede-tabella"ip>'
};

// Tabella attualmente mostrata: 'aperti' | 'consegnati' | 'clienti' | 'listino' | null
let tabellaAttiva = null;
// Filtro rapido della tabella "Da consegnare": 'tutti' | 'oggi' | 'ritardo' | 'parziali'
let filtroRapido = 'tutti';

function tabellaCorrente() {
    return $.fn.dataTable.isDataTable('#table') ? $('#table').DataTable() : null;
}

function distruggiTabella() {
    const dt = tabellaCorrente();
    if (dt) dt.destroy();
    $('#table_div').empty();
    tabellaAttiva = null;
}

// Righe finte mentre arrivano i dati
function mostraScheletroTabella(colonne = 7) {
    distruggiTabella();
    const riga = `<tr>${'<td><div class="scheletro"></div></td>'.repeat(colonne)}</tr>`;
    $('#table_div').html(`<table class="tabella scheletro-tabella"><tbody>${riga.repeat(8)}</tbody></table>`);
}

function creaTabella(intestazioni, opzioni) {
    distruggiTabella();
    $('#table_div').html(`<table id="table" class="tabella"><thead><tr>${intestazioni.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody></tbody></table>`);
    return $('#table').DataTable({ ...OPZIONI_DATATABLE, ...opzioni });
}

// ── Ordini ──────────────────────────────────────────────────────────────────

const COLONNE = {
    aperti: {
        intestazioni: ['Ordine', 'Cliente', 'Capi', 'Quantità', 'Ritiro previsto', 'Posizione', 'Totale', ''],
        colonne: [
            { data: 'id', render: renderCartellino, className: 'col-tag' },
            { data: 'cliente_nome', render: renderCliente },
            { data: 'prodotto_descrizione', render: renderCapi },
            { data: null, render: renderQuantita },
            { data: 'data_ritiro_prevista', render: renderRitiroPrevisto },
            { data: 'posizione', render: renderPosizione },
            { data: null, render: renderTotale, className: 'col-importo' },
            { data: null, render: renderAzioniAperto, orderable: false, searchable: false, className: 'col-azioni' }
        ],
        ordine: [[0, 'desc']]
    },
    consegnati: {
        intestazioni: ['Ordine', 'Cliente', 'Capi', 'Quantità', 'Lasciato', 'Ritirato', 'Totale', ''],
        colonne: [
            { data: 'id', render: renderCartellino, className: 'col-tag' },
            { data: 'cliente_nome', render: renderCliente },
            { data: 'prodotto_descrizione', render: renderCapi },
            { data: null, render: (_, type, o) => (type === 'display' ? `<div class="quantita num"><b>${o.quantita}</b> <small>${o.quantita === 1 ? 'capo' : 'capi'}</small></div>` : o.quantita) },
            { data: 'data_consegna', render: renderData },
            { data: 'data_ritiro_effettiva', render: renderData },
            { data: null, render: renderTotale, className: 'col-importo' },
            { data: null, render: renderAzioniConsegnato, orderable: false, searchable: false, className: 'col-azioni' }
        ],
        ordine: [[5, 'desc']]
    }
};

// Filtro rapido applicato da DataTables insieme alla ricerca testuale
$.fn.dataTable.ext.search.push((settings, _campi, _indice, ordine) => {
    if (settings.nTable.id !== 'table' || tabellaAttiva !== 'aperti') return true;
    return corrispondeFiltro(ordine, filtroRapido);
});

async function creaTabellaOrdini(vista) {
    mostraScheletroTabella(8);
    const ordini = await api('getOrdini', { vista, anno: stato.annoConsegnati });
    const config = COLONNE[vista];

    creaTabella(config.intestazioni, {
        data: ordini,
        columns: config.colonne,
        order: config.ordine,
        rowId: (o) => 'tr_' + o.id,
        // Chiamato a ogni disegno: le classi restano giuste anche dopo l'aggiornamento di una riga
        rowCallback: (tr, o) => {
            tr.classList.toggle('in-ritardo', vista === 'aperti' && corrispondeFiltro(o, 'ritardo'));
            tr.classList.toggle('parziale', o.stato === STATO.PARZIALE);
        },
        language: { ...DT_LANGUAGE, emptyTable: vista === 'aperti' ? 'Nessun ordine da consegnare' : 'Nessun ordine consegnato in questo anno' }
    });
    tabellaAttiva = vista;
    aggiornaConteggiFiltri();
}

function impostaFiltroRapido(filtro) {
    filtroRapido = filtro;
    $('#barra-filtri .chip[data-filtro]').each(function () {
        $(this).toggleClass('attivo', this.dataset.filtro === filtro);
    });
    const dt = tabellaCorrente();
    if (dt && tabellaAttiva === 'aperti') dt.draw();
}

function aggiornaConteggiFiltri() {
    const dt = tabellaCorrente();
    if (!dt || tabellaAttiva !== 'aperti') return;
    const dati = dt.rows().data().toArray();
    for (const filtro of ['tutti', 'oggi', 'ritardo', 'parziali']) {
        $(`#conteggio-${filtro}`).text(dati.filter((o) => corrispondeFiltro(o, filtro)).length);
    }
}

// L'ordine appartiene alla tabella che si sta guardando?
function ordineNellaTabella(ordine) {
    if (tabellaAttiva === 'aperti') return ordine.stato !== STATO.CONSEGNATO;
    if (tabellaAttiva === 'consegnati') return ordine.stato === STATO.CONSEGNATO && String(ordine.anno) === String(stato.annoConsegnati);
    return false;
}

// Riga tolta con una breve animazione
function togliRiga(riga) {
    const tr = riga.node();
    if (tr) tr.classList.add('in-uscita');
    setTimeout(() => {
        riga.remove().draw(false);
        aggiornaConteggiFiltri();
    }, tr ? 240 : 0);
}

// Aggiunge, aggiorna o toglie la riga dell'ordine; ricerca, filtri e pagina restano come sono.
function aggiornaRigaOrdine(ordine) {
    const dt = tabellaCorrente();
    if (!dt || (tabellaAttiva !== 'aperti' && tabellaAttiva !== 'consegnati')) return;

    const riga = dt.row('#tr_' + ordine.id);
    const presente = riga.any();
    const appartiene = ordineNellaTabella(ordine);

    if (presente && appartiene) {
        riga.data(ordine).draw(false);
    } else if (presente) {
        togliRiga(riga);
        return;
    } else if (appartiene) {
        const nuova = dt.row.add(ordine).draw(false);
        const tr = nuova.node();
        if (tr) tr.classList.add('in-entrata');
    }
    aggiornaConteggiFiltri();
}

function rimuoviRigaOrdine(id) {
    const dt = tabellaCorrente();
    if (!dt) return;
    const riga = dt.row('#tr_' + id);
    if (riga.any()) togliRiga(riga);
}

function datiRiga(prefisso, id) {
    const dt = tabellaCorrente();
    if (!dt) return null;
    const riga = dt.row('#' + prefisso + id);
    return riga.any() ? riga.data() : null;
}

// ── Clienti ─────────────────────────────────────────────────────────────────

async function creaTabellaClienti() {
    mostraScheletroTabella(4);
    const clienti = await api('getClienti');
    creaTabella(['Cliente', 'Telefono', 'Ordini aperti', ''], {
        data: clienti,
        rowId: (c) => 'cliente_' + c.id,
        order: [[0, 'asc']],
        columns: [
            {
                data: 'nome',
                render: (nome, type) => (type !== 'display' ? nome :
                    `<div class="cella-cliente-avatar"><span class="avatar">${escapeHtml(iniziali(nome))}</span><b>${escapeHtml(nome)}</b></div>`)
            },
            { data: 'telefono', render: (t, type) => (type !== 'display' ? t : (t ? `<span class="num">${escapeHtml(t)}</span>` : '<span class="vuoto">—</span>')) },
            {
                data: 'ordini_aperti', searchable: false,
                render: (n, type) => (type !== 'display' ? n : (n ? `<span class="badge-app teal">${plurale(n, 'ordine', 'ordini')}</span>` : '<span class="vuoto">—</span>'))
            },
            {
                data: null, orderable: false, searchable: false, className: 'col-azioni',
                render: (_, type, c) => (type !== 'display' ? '' :
                    `<div class="azioni"><button type="button" class="btn-icona" data-azione="modifica-cliente" data-id="${c.id}" title="Modifica"><i class="fa-solid fa-pen"></i></button></div>`)
            }
        ],
        language: { ...DT_LANGUAGE, emptyTable: 'Nessun cliente' }
    });
    tabellaAttiva = 'clienti';
}

function aggiornaRigaCliente(cliente) {
    const dt = tabellaCorrente();
    if (!dt || tabellaAttiva !== 'clienti') return;
    const riga = dt.row('#cliente_' + cliente.id);
    if (riga.any()) {
        riga.data(cliente).draw(false);
    } else {
        const tr = dt.row.add(cliente).draw(false).node();
        if (tr) tr.classList.add('in-entrata');
    }
}

// ── Listino ─────────────────────────────────────────────────────────────────

async function creaTabellaListino() {
    mostraScheletroTabella(4);
    stato.prodotti = await api('getProdotti');
    creaTabella(['Articolo', 'Prezzo', 'Usato in', ''], {
        data: stato.prodotti,
        rowId: (p) => 'articolo_' + p.id,
        order: [[0, 'asc']],
        columns: [
            { data: 'descrizione', render: (d, type) => (type !== 'display' ? d : `<b>${escapeHtml(d)}</b>`) },
            {
                data: null,
                render: (_, type, p) => {
                    if (type === 'sort' || type === 'type') return p.prezzo_cent ?? -1;
                    if (type !== 'display') return testoPrezzo(p);
                    return p.prezzo_cent != null ? `<span class="num">${formatEuro(p.prezzo_cent)}</span>` : `<span class="senza-prezzo">${escapeHtml(maiuscolaIniziale(testoPrezzo(p)))}</span>`;
                }
            },
            { data: 'ordini', searchable: false, render: (n, type) => (type !== 'display' ? n : (n ? `<span class="num">${plurale(n, 'ordine', 'ordini')}</span>` : '<span class="vuoto">mai usato</span>')) },
            {
                data: null, orderable: false, searchable: false, className: 'col-azioni',
                render: (_, type, p) => {
                    if (type !== 'display') return '';
                    // Gli articoli usati in qualche ordine non si possono eliminare: il pulsante resta ma disattivato
                    const titolo = p.ordini ? `Usato in ${plurale(p.ordini, 'ordine', 'ordini')}: non eliminabile` : 'Elimina';
                    return `<div class="azioni">
                        <button type="button" class="btn-icona" data-azione="modifica-articolo" data-id="${p.id}" title="Modifica"><i class="fa-solid fa-pen"></i></button>
                        <span title="${escapeHtml(titolo)}"><button type="button" class="btn-icona pericolo" data-azione="elimina-articolo" data-id="${p.id}"${p.ordini ? ' disabled' : ''}><i class="fa-solid fa-trash-can"></i></button></span>
                    </div>`;
                }
            }
        ],
        language: { ...DT_LANGUAGE, emptyTable: 'Nessun articolo nel listino' }
    });
    tabellaAttiva = 'listino';
}
