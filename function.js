// ── Accesso ai dati ─────────────────────────────────────────────────────────

// Errore restituito dal main process (validazione o errore interno).
class ErroreApi extends Error {
    constructor({ codice, messaggio, campo }) {
        super(messaggio);
        this.name = 'ErroreApi';
        this.codice = codice;
        this.campo = campo || null;
    }
}

// Chiama un metodo del repository nel main process; lancia ErroreApi se la richiesta fallisce.
async function api(metodo, ...args) {
    const risposta = await window.lavasecco.chiama(metodo, ...args);
    if (!risposta.ok) {
        throw new ErroreApi(risposta.errore);
    }
    return risposta.dati;
}

// ── Formattazione ───────────────────────────────────────────────────────────

// Escape per inserire testo dell'utente in HTML (contenuto e attributi).
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatEuro(centesimi) {
    return (centesimi / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// Prezzo di listino: importo fisso oppure nota ("a vista", "a peso"); vuoto = "a vista".
function testoPrezzo(prodotto) {
    if (prodotto.prezzo_cent != null) {
        return formatEuro(prodotto.prezzo_cent);
    }
    return prodotto.nota_prezzo || 'a vista';
}

// Prezzo come va scritto nel campo del form ("7,50", "a peso", vuoto = a vista)
function prezzoPerInput(prodotto) {
    if (prodotto.prezzo_cent != null) {
        return (prodotto.prezzo_cent / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
    }
    return prodotto.nota_prezzo || '';
}

function maiuscolaIniziale(testo) {
    return testo.charAt(0).toUpperCase() + testo.slice(1);
}

// Date: nel database ISO (YYYY-MM-DD), nella UI dd-mm-yyyy come il datepicker.
function isoToIt(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function itToIso(testo) {
    const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(String(testo || '').trim());
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}

// ── Select clienti / prodotti ───────────────────────────────────────────────

function riempiSelect($select, elementi, testoOpzione) {
    $select.val(null).empty().append($('<option>', { value: '', text: '' }));
    elementi.forEach((el) => $select.append($('<option>', { value: el.id, text: testoOpzione(el) })));
}

function testoOpzioneProdotto(prodotto) {
    return `${prodotto.descrizione} - ${testoPrezzo(prodotto)}`;
}

async function popolaSelectClienti() {
    clienti_salvati = await api('getClienti');
    riempiSelect($('.select_clienti, .select_clienti_modifica_ordine'), clienti_salvati, (c) => c.nome);
}

// Senza argomenti aggiorna tutte le select prodotti; con $select solo quella (righe aggiunte all'ordine).
async function popolaSelectProdotti($select = null) {
    if ($select) {
        riempiSelect($select, prodotti_salvati, testoOpzioneProdotto);
        return;
    }
    prodotti_salvati = await api('getProdotti');
    $('.select_prodotti, .select_prodotti_modifica_ordine').each(function() {
        riempiSelect($(this), prodotti_salvati, testoOpzioneProdotto);
    });
}

// ── Righe delle tabelle ─────────────────────────────────────────────────────

// Cella con testo troncato e testo completo nel tooltip nativo (title).
function cellaTroncata(testo, maxLen) {
    if (testo.length > maxLen) {
        return `<td title="${escapeHtml(testo)}" style="cursor: pointer;">${escapeHtml(testo.substring(0, maxLen))}...</td>`;
    }
    return `<td>${escapeHtml(testo)}</td>`;
}

function cellaData(iso) {
    return `<td data-sort="${escapeHtml(iso || '')}">${escapeHtml(isoToIt(iso))}</td>`;
}

function buildOrdineRow(ordine) {
    const consegnato = ordine.stato === STATO.CONSEGNATO;
    const id = escapeHtml(ordine.id);
    const descrizione = ordine.descrizione || '';
    const statoClass = ordine.stato === STATO.PARZIALE ? 'row-parziale' : consegnato ? 'row-chiuso' : '';

    let html = `<tr id="tr_${id}"${statoClass ? ` class="${statoClass}"` : ''}><td class="td_first">`;
    html += `<button class="btn btn-sm btn-danger rimuovi_ordine mt-1" data-id="${id}" style='min-width: 34px;' title="Elimina"><i class="fas fa-trash"></i></button>`;
    if (!consegnato) {
        html += `<button class="btn btn-sm btn-primary modifica_ordine mt-1" data-id="${id}" style='min-width: 34px;' title="Modifica"><i class="far fa-edit"></i></button>`;
    }
    html += `</td>`;

    html += `<td>${escapeHtml(ordine.cliente_nome)}</td>`;
    html += `<td>${escapeHtml(ordine.prodotto_descrizione)}</td>`;
    html += `<td>${escapeHtml(ordine.quantita)}</td>`;
    html += `<td>${escapeHtml(ordine.quantita - ordine.quantita_consegnata)}</td>`;
    html += cellaTroncata(descrizione, 50);
    html += cellaData(ordine.data_consegna);
    html += cellaData(ordine.data_ritiro_prevista);
    html += cellaData(ordine.data_ritiro_effettiva);

    const pos = ordine.posizione || '';
    html += pos && !consegnato ? cellaTroncata(pos, descrizione.length > 50 ? 20 : 50) : `<td></td>`;

    // Prezzo salvato nell'ordine al momento della registrazione (non il listino attuale)
    const totale = ordine.prezzo_unitario_cent != null
        ? formatEuro(ordine.prezzo_unitario_cent * ordine.quantita)
        : maiuscolaIniziale(ordine.nota_prezzo || 'a vista');
    html += `<td>${escapeHtml(totale)}</td>`;

    if (consegnato) {
        html += `<td><div class="loader_modal_annulla_consegna d-none" id="loader_annulla_consegna_${id}"></div><button class='btn btn-sm btn-danger annulla_consegna' data-id="${id}">Annulla consegna</button></td>`;
    } else {
        const colore = ordine.stato === STATO.PARZIALE ? 'btn-warning' : 'btn-success';
        html += `<td><button class='btn btn-sm ${colore} consegna_articolo' data-id="${id}" data-da_consegnare="${escapeHtml(ordine.quantita - ordine.quantita_consegnata)}">Consegnato</button></td>`;
    }

    return html + `</tr>`;
}

function buildClienteRow(cliente) {
    const id = escapeHtml(cliente.id);
    const nome = escapeHtml(cliente.nome);
    const telefono = escapeHtml(cliente.telefono);
    return `<tr>
        <td class='nome_cliente'>${nome}</td>
        <td>${telefono}</td>
        <td style="width: 6% !important;"><button class='btn btn-sm btn-secondary modifica_cliente' data-id="${id}" data-nome="${nome}" data-telefono="${telefono}">Modifica</button></td>
    </tr>`;
}

function buildProdottoRow(prodotto) {
    const id = escapeHtml(prodotto.id);
    // Gli articoli usati in qualche ordine non si possono eliminare: il bottone resta visibile ma disattivato
    const inUso = prodotto.ordini > 0;
    const titoloElimina = inUso ? `Usato in ${prodotto.ordini} ${prodotto.ordini === 1 ? 'ordine' : 'ordini'}: non eliminabile` : 'Elimina';
    return `<tr>
        <td class='nome_prodotto'>${escapeHtml(prodotto.descrizione)}</td>
        <td>${escapeHtml(testoPrezzo(prodotto))}</td>
        <td class="text-nowrap">
            <button class='btn btn-sm btn-secondary modifica_prodotto' data-id="${id}" data-descrizione="${escapeHtml(prodotto.descrizione)}" data-prezzo="${escapeHtml(prezzoPerInput(prodotto))}">Modifica</button>
            <span title="${escapeHtml(titoloElimina)}"><button class='btn btn-sm btn-danger elimina_prodotto' data-id="${id}" data-descrizione="${escapeHtml(prodotto.descrizione)}"${inUso ? ' disabled' : ''}><i class="fas fa-trash"></i></button></span>
        </td>
    </tr>`;
}

// ── Navigazione ─────────────────────────────────────────────────────────────

function htmlSelectAnno(id, anno_selezionato) {
    let html = `<select id="${id}" class="seleziona_anno ms-2 form-select w-auto">`;
    for (let i = actual_year; i >= 2019; i--) {
        html += `<option value="${i}"${i == anno_selezionato ? ' selected' : ''}>${i}</option>`;
    }
    return html + `</select>`;
}

function renderToolbarOrdini() {
    const html = `<button type="button" class="btn btn-primary btn_nuovo_ordine"><i class="fa-solid fa-plus-circle"></i> Ordine</button>`
        + htmlSelectAnno('seleziona_anno', selected_year);
    $('#div_bottone_aggiungi').html(html);
}

function mostraLoaderPagina(visibile) {
    $('#main_loader').parent().toggleClass('d-none', !visibile);
}

function mostraErrorePagina(error) {
    console.error(error);
    $('#alert_feedback').removeClass('d-none alert-success').addClass('alert-danger').text('Errore: ' + error.message);
}

const PAGINE = {
    ordini: {
        sidebar: 'sidebar_dashboard',
        titolo: 'Ordini',
        toolbar: renderToolbarOrdini,
        tabella: () => create_data_table_ordini('aperti')
    },
    ordini_chiusi: {
        sidebar: 'sidebar_ordini_chiusi',
        titolo: 'Ordini consegnati',
        toolbar: () => $('#div_bottone_aggiungi').html(htmlSelectAnno('seleziona_anno_chiuso', selected_year_close)),
        tabella: () => create_data_table_ordini('consegnati')
    },
    prezzi: {
        sidebar: 'sidebar_prezzi',
        titolo: 'Prezzi',
        toolbar: () => $('#div_bottone_aggiungi').html(`<button type="button" class="btn btn-primary btn_nuovo_prodotto"><i class="fa-solid fa-plus-circle"></i> Articolo</button>`),
        tabella: create_data_table_prezzi
    },
    clienti: {
        sidebar: 'sidebar_clienti',
        titolo: 'Clienti',
        toolbar: () => $('#div_bottone_aggiungi').html(`<button type="button" class="btn btn-primary btn_nuovo_cliente"><i class="fa-solid fa-plus-circle"></i> Cliente</button>`),
        tabella: create_data_table_clienti
    }
};

async function cambiaPagina(nuova_pagina, url) {
    const pagina = PAGINE[url];
    if (!pagina) {
        return;
    }

    distruggiTabella();
    $('#alert_feedback').addClass('d-none');
    mostraLoaderPagina(true);

    $('.sidebar_link').removeClass('active').parent().removeClass('active-tab');
    $('.' + nuova_pagina).addClass('active').parent().addClass('active-tab');

    sidebar_attiva = pagina.sidebar;
    $('.page_title').text(pagina.titolo);
    pagina.toolbar();

    try {
        await pagina.tabella();
    } catch (error) {
        mostraErrorePagina(error);
    } finally {
        mostraLoaderPagina(false);
    }
}

$(document).on('click', '.sidebar_link', function(e) {
    e.preventDefault();
    cambiaPagina($(this).attr('data-pagina'), $(this).attr('data-url'));
});

$(document).on('click', '.btn_nuovo_ordine', function() { apriModaleNuovoOrdine(); });
$(document).on('click', '.btn_nuovo_prodotto', function() { apriModaleNuovoProdotto(); });
$(document).on('click', '.btn_nuovo_cliente', function() { apriModaleNuovoCliente(); });

async function cambiaAnno(impostaAnno, vista) {
    distruggiTabella();
    mostraLoaderPagina(true);
    impostaAnno();
    try {
        await create_data_table_ordini(vista);
    } catch (error) {
        mostraErrorePagina(error);
    } finally {
        mostraLoaderPagina(false);
    }
}

$(document).on('change', '#seleziona_anno', function() {
    const anno = $(this).val();
    cambiaAnno(() => { selected_year = anno; }, 'aperti');
});

$(document).on('change', '#seleziona_anno_chiuso', function() {
    const anno = $(this).val();
    cambiaAnno(() => { selected_year_close = anno; }, 'consegnati');
});

// ── Plugin (datepicker, select2) ────────────────────────────────────────────

const OPZIONI_SELECT2 = {
    theme: 'bootstrap-5',
    width: '100%',
    placeholder: '',
    minimumResultsForSearch: 5,
    allowClear: true
};

function inizializzaSelect2($select, $parent) {
    $select.select2({ ...OPZIONI_SELECT2, dropdownParent: $parent, matcher: matchStart });
}

function inizializza_elementi() {
    $('.js-datepicker').datepicker({
        format: "dd-mm-yyyy",
        weekStart: 1,
        language: 'it',
        calendarWeeks: true,
        autoclose: true,
        todayHighlight: true
    });

    inizializzaSelect2($('.select_clienti'), $('#aggiungi_ordine_modal'));
    inizializzaSelect2($('.select_prodotti'), $('#aggiungi_ordine_modal'));
    inizializzaSelect2($('.select_clienti_modifica_ordine'), $('#modifica_ordine_modal'));
    inizializzaSelect2($('.select_prodotti_modifica_ordine'), $('#modifica_ordine_modal'));
}

function matchStart(params, data) {
    data.parentText = data.parentText || "";
    if ($.trim(params.term) === '') {
        return data;
    }
    if (data.children && data.children.length > 0) {
        var match = $.extend(true, {}, data);
        for (var c = data.children.length - 1; c >= 0; c--) {
            var child = data.children[c];
            child.parentText += data.parentText + " " + data.text;
            var matches = matchStart(params, child);
            if (matches == null) {
                match.children.splice(c, 1);
            }
        }
        if (match.children.length > 0) {
            return match;
        }
        return matchStart(params, match);
    }
    var original = (data.parentText + ' ' + data.text).toUpperCase();
    var term = params.term.toUpperCase();
    if (original.indexOf(term) > -1) {
        return data;
    }
    return null;
}
