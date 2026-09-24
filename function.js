function popolaSelectClienti() {
    try {
        $('.select_clienti').val(null).empty();
        $('.select_clienti_modifica_ordine').val(null).empty();
        let clienti = window.myAPI.getElencoClienti();
        clienti_salvati = clienti;
        if (Array.isArray(clienti)) {
            clienti.forEach(value => {
                $('.select_clienti').append($('<option>', { value: value.id, text: value.nome }));
                $('.select_clienti_modifica_ordine').append($('<option>', { value: value.id, text: value.nome }));
            });
        }
    } catch (error) {
        $('#alert_feedback').removeClass('d-none').addClass('alert-danger').text('Errore caricamento clienti!');
        console.error('Errore popolaSelectClienti:', error);
    }
}

function popolaSelectProdotti(c = 0) {
    try {
        let prodotti = window.myAPI.getElencoProdotti();
        if (c === 0) {
            prodotti_salvati = prodotti;
            $('.select_prodotti').val(null).empty();
            $('.select_prodotti_modifica_ordine').val(null).empty();
            if (Array.isArray(prodotti)) {
                prodotti.forEach(value => {
                    const prezzo = value.prezzo === "" ? "a vista" : value.prezzo + " €";
                    $('.select_prodotti').append($('<option>', { value: value.id, text: value.descrizione + ' - ' + prezzo }));
                    $('.select_prodotti_modifica_ordine').append($('<option>', { value: value.id, text: value.descrizione + ' - ' + prezzo }));
                });
            }
        } else {
            $("#prodotto_" + c).val(null).empty();
            $("#prodotto_" + c).append($('<option>', { value: '', text: '' }));
            if (Array.isArray(prodotti)) {
                prodotti.forEach(value => {
                    const prezzo = value.prezzo === "" ? "a vista" : value.prezzo + " €";
                    $("#prodotto_" + c).append($('<option>', { value: value.id, text: value.descrizione + ' - ' + prezzo }));
                });
            }
        }
    } catch (error) {
        $('#alert_feedback').removeClass('d-none').addClass('alert-danger').text('Errore caricamento prodotti!');
        console.error('Errore popolaSelectProdotti:', error);
    }
}

// Escape per inserire testo dell'utente in HTML (contenuto e attributi).
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Converte un prezzo salvato come testo ("7,50", "7.50", "7") in numero; NaN se "a vista".
function parsePrezzo(prezzo) {
    if (prezzo == null || String(prezzo).trim() === '') {
        return NaN;
    }
    return parseFloat(String(prezzo).replace(/,/g, '.'));
}

function formatEuro(valore) {
    return valore.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Cella con testo troncato e testo completo nel tooltip nativo (title).
function cellaTroncata(testo, maxLen) {
    if (testo.length > maxLen) {
        return `<td title="${escapeHtml(testo)}" style="cursor: pointer;">${escapeHtml(testo.substring(0, maxLen))}...</td>`;
    }
    return `<td>${escapeHtml(testo)}</td>`;
}

function buildOrdineRow(ordine, showEditButton, firstCellClass) {
    const clienteObj = (clienti_salvati || []).find(c => c.id == ordine.cliente);
    const nome_cliente = clienteObj ? clienteObj.nome : '';
    const prodotto = (prodotti_salvati || []).find(p => p.id == ordine.prodotto) || {};

    const prezzoUnitario = parsePrezzo(prodotto.prezzo);
    const prezzo = Number.isFinite(prezzoUnitario)
        ? formatEuro(prezzoUnitario * (parseInt(ordine.quantita, 10) || 0))
        : '';

    const descrizione = ordine.descrizione || '';
    const quantita_consegnata = ordine.quantita_consegnata || 0;
    const quantitaDaConsegnare = (ordine.quantita_consegnata != null)
        ? ordine.quantita - ordine.quantita_consegnata
        : ordine.quantita;

    const id = escapeHtml(ordine.id);
    const tdClass = firstCellClass ? ` class="${firstCellClass}"` : '';
    const statoClass = ordine.stato == "2" ? 'row-parziale' : ordine.stato == "1" ? 'row-chiuso' : '';

    let html = `<tr id="tr_${id}"${statoClass ? ` class="${statoClass}"` : ''}><td${tdClass}>`;
    html += `<button class="btn btn-sm btn-danger rimuovi_ordine mt-1" data-id="${id}" style='min-width: 34px;'><i class="fas fa-trash"></i></button>`;
    if (showEditButton) {
        html += `<button class="btn btn-sm btn-primary modifica_ordine mt-1" data-id="${id}" style='min-width: 34px;'><i class="far fa-edit"></i></button>`;
    }
    html += `</td>`;

    html += `<td>${escapeHtml(nome_cliente)}</td>`;
    html += `<td>${escapeHtml(prodotto.descrizione)}</td>`;
    html += `<td>${escapeHtml(ordine.quantita)}</td>`;
    html += `<td>${escapeHtml(quantitaDaConsegnare)}</td>`;

    html += cellaTroncata(descrizione, 50);

    html += `<td data-sort="${getDateSortKey(ordine.data_di_consegna)}">${escapeHtml(ordine.data_di_consegna)}</td>`;
    html += `<td data-sort="${getDateSortKey(ordine.data_di_ritiro_prevista)}">${escapeHtml(ordine.data_di_ritiro_prevista)}</td>`;
    html += `<td data-sort="${getDateSortKey(ordine.data_di_consegna_effettiva)}">${escapeHtml(ordine.data_di_consegna_effettiva)}</td>`;

    if (ordine.posizione && (ordine.stato == "0" || ordine.stato == "2")) {
        const pos = ordine.posizione;
        html += cellaTroncata(pos, descrizione.length > 50 && pos.length > 20 ? 20 : 50);
    } else {
        html += `<td></td>`;
    }

    html += prezzo !== '' ? `<td>${prezzo} €</td>` : `<td>A vista</td>`;

    const datiConsegna = `data-quantita_originale="${escapeHtml(ordine.quantita)}" data-quantita_consegnata="${escapeHtml(quantita_consegnata)}" data-id="${id}"`;
    if (ordine.stato == "0") {
        html += `<td><button class='btn btn-sm btn-success consegna_articolo' ${datiConsegna}>Consegnato</button></td>`;
    } else if (ordine.stato == "1") {
        html += `<td><div class="loader_modal_annulla_consegna d-none" id="loader_annulla_consegna_${id}"></div><button class='btn btn-sm btn-danger annulla_consegna' data-id="${id}">Annulla consegna</button></td>`;
    } else {
        html += `<td><button class='btn btn-sm btn-warning consegna_articolo' ${datiConsegna}>Consegnato</button></td>`;
    }

    html += `</tr>`;
    return html;
}

function popolaTabellaOrdini(stato) {
    const ordini = window.myAPI.getElencoOrdini(stato, stato == 1 ? selected_year_close : selected_year);
    let html = ordini.map(o => buildOrdineRow(o, stato != 1, 'td_first')).join('');

    if (stato == 0) {
        const ordiniParziali = window.myAPI.getElencoOrdini(2, selected_year);
        html += ordiniParziali.map(o => buildOrdineRow(o, true, '')).join('');
    }

    return html;
}

function inserisciOrdine(ordine, year = actual_year) {
    window.myAPI.putOrdine(ordine, year);
}

function inserisciOrdineChiuso(ordine, year) {
    window.myAPI.putOrdineChiuso(ordine, year);
}

function cercaCliente(nome, num_telefono, escludi_id = null) {
    return window.myAPI.getClienteByNomeEEmail(nome, num_telefono, escludi_id);
}

function inserisciCliente(cliente) {
    window.myAPI.putCliente(cliente);
}

function popolaTabellaClienti() {
    const clienti = window.myAPI.getElencoClienti();
    return clienti.map(cliente => {
        const id = escapeHtml(cliente.id);
        const nome = escapeHtml(cliente.nome);
        const telefono = escapeHtml(cliente.email);
        return `<tr>
        <td class='nome_cliente' data-id="${id}" data-nome="${nome}">${nome}</td>
        <td class="edit_numero_di_telefono" id="${id}" data-id="${id}" data-numero="${telefono}">${telefono}</td>
        <td style="width: 6% !important;"><button class='btn btn-sm btn-secondary modifica_cliente' data-num_telefono="${telefono}" data-nome="${nome}" data-id="${id}">Modifica</button></td>
    </tr>`;
    }).join('');
}

function getDateSortKey(dateValue) {
    if (!dateValue || typeof dateValue !== 'string') {
        return '';
    }
    const parts = dateValue.split('-');
    if (parts.length !== 3) {
        return '';
    }
    return escapeHtml(`${parts[2]}${parts[1]}${parts[0]}`);
}

function popolaTabellaPrezzi() {
    const prodotti = window.myAPI.getElencoProdotti();
    return prodotti.map(prodotto => {
        const simbolo_euro = Number.isFinite(parsePrezzo(prodotto.prezzo)) ? '€' : '';
        const id = escapeHtml(prodotto.id);
        const descrizione = escapeHtml(prodotto.descrizione);
        const prezzo = escapeHtml(prodotto.prezzo);
        return `<tr>
            <td class='nome_prodotto' data-id="${id}" data-nome="${descrizione}">${descrizione}</td>
            <td class="edit_prezzo_prodotto" id="${id}" data-id="${id}" data-prezzo="${prezzo}">${prezzo} ${simbolo_euro}</td>
        </tr>`;
    }).join('');
}

function cercaProdotto(descrizione) {
    return window.myAPI.getProdottoByDescrizione(descrizione);
}

function inserisciProdotto(prodotto) {
    window.myAPI.putProdotto(prodotto);
}

function eliminaOrdine(id_ordine, year) {
    window.myAPI.eliminaOrdine(id_ordine, year);
}

function getOrdineDaModificare(id_ordine, year) {
    return window.myAPI.getOrdineById(id_ordine, year);
}

function modificaOrdineFunction(where, set, year) {
    window.myAPI.modificaOrdine(where, set, year);
}

function getOrdineAnnullaConsegna(id_ordine, year) {
    return window.myAPI.getOrdineChiusoById(id_ordine, year);
}

function eliminaOrdineChiuso(id_ordine, year) {
    window.myAPI.eliminaOrdineChiuso(id_ordine, year);
}

function modificaClienteFunction(where, set) {
    window.myAPI.modificaCliente(where, set);
}

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

function cambiaPagina(nuova_pagina, url) {
    $('#table_div').empty();
    $('.loader').parent().removeClass('d-none');

    $('.sidebar_link').parent().removeClass("active-tab");
    $('.sidebar_link').removeClass("active");

    $('.' + nuova_pagina).addClass('active');
    $('.' + nuova_pagina).parent().addClass('active-tab');

    if (url == 'ordini') {
        sidebar_attiva = 'sidebar_dashboard';
    } else if (url == 'clienti') {
        sidebar_attiva = 'sidebar_clienti';
    } else if (url == 'prezzi') {
        sidebar_attiva = 'sidebar_prezzi';
    } else if (url == 'ordini_chiusi') {
        sidebar_attiva = 'sidebar_ordini_chiusi';
    } else {
        sidebar_attiva = nuova_pagina;
    }

    setTimeout(function() {
        switch (url) {
            case 'ordini':
                $('.page_title').html('Ordini');
                renderToolbarOrdini();
                create_data_table_ordini(0);
                break;

            case 'ordini_chiusi':
                $('.page_title').html('Ordini consegnati');
                $('#div_bottone_aggiungi').html(htmlSelectAnno('seleziona_anno_chiuso', selected_year_close));
                create_data_table_ordini_chiusi(1);
                break;

            case 'prezzi':
                create_data_table_prezzi();
                $('.page_title').html('Prezzi');
                $('#div_bottone_aggiungi').html(`<button type="button" class="btn btn-primary btn_nuovo_prodotto"><i class="fa-solid fa-plus-circle"></i> Articolo</button>`);
                break;

            case 'clienti':
                create_data_table_clienti();
                $('.page_title').html('Clienti');
                $('#div_bottone_aggiungi').html(`<button type="button" class="btn btn-primary btn_nuovo_cliente"><i class="fa-solid fa-plus-circle"></i> Cliente</button>`);
                break;
        }
        $('.loader').parent().addClass('d-none');
    }, 100);
}

$(document).on('click', '.sidebar_link', function(e) {
    e.preventDefault();
    cambiaPagina($(this).attr('data-pagina'), $(this).attr('data-url'));
});

$(document).on('click', '.btn_nuovo_ordine', function() { apriModaleNuovoOrdine(); });
$(document).on('click', '.btn_nuovo_prodotto', function() { apriModaleNuovoProdotto(); });
$(document).on('click', '.btn_nuovo_cliente', function() { apriModaleNuovoCliente(); });

function inizializza_elementi() {
    $('.js-datepicker').datepicker({
        format: "dd-mm-yyyy",
        weekStart: 1,
        language: 'it',
        calendarWeeks: true,
        autoclose: true,
        todayHighlight: true
    });

    $('.select_clienti').select2({
        dropdownParent: $('#aggiungi_ordine_modal'),
        theme: "bootstrap",
        placeholder: '',
        minimumResultsForSearch: 5,
        matcher: matchStart,
        allowClear: true
    });

    $('.select_prodotti').select2({
        dropdownParent: $('#aggiungi_ordine_modal'),
        theme: "bootstrap",
        placeholder: '',
        minimumResultsForSearch: 5,
        matcher: matchStart,
        allowClear: true
    });

    $('.select_clienti_modifica_ordine').select2({
        dropdownParent: $('#modifica_ordine_modal'),
        theme: "bootstrap",
        placeholder: '',
        minimumResultsForSearch: 5,
        matcher: matchStart,
        allowClear: true
    });

    $('.select_prodotti_modifica_ordine').select2({
        dropdownParent: $('#modifica_ordine_modal'),
        theme: "bootstrap",
        placeholder: '',
        minimumResultsForSearch: 5,
        matcher: matchStart,
        allowClear: true
    });
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

$(document).on('change', '#seleziona_anno', function() {
    $('.loader').parent().removeClass('d-none');
    $('#table_div').empty();
    selected_year = $(this).val();
    setTimeout(function() {
        create_data_table_ordini(0);
        $('.loader').parent().addClass('d-none');
    }, 100);
});

$(document).on('change', '#seleziona_anno_chiuso', function() {
    $('.loader').parent().removeClass('d-none');
    $('#table_div').empty();
    selected_year_close = $(this).val();
    setTimeout(function() {
        create_data_table_ordini_chiusi(1);
        $('.loader').parent().addClass('d-none');
    }, 100);
});

// Secondo campo di ricerca, basato esclusivamente sulla data di ritiro prevista.
// Usa la tabella corrente (#table), valida sia nella scheda Ordini che Consegnati.
$(document).on("keyup", "#search_column", function() {
    $('#table').DataTable().column(7).search(this.value).draw();
});
