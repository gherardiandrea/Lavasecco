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

function buildOrdineRow(ordine, showEditButton, firstCellClass) {
    const nome_cliente = window.myAPI.getClienteById(ordine.cliente);
    const prodotto = window.myAPI.getProdottoById(ordine.prodotto) || {};

    const tValue = prodotto.prezzo ? parseFloat(prodotto.prezzo.replace(/,/g, '.')) : '';
    const prezzo = isNumber(tValue) ? parseInt(prodotto.prezzo) * parseInt(ordine.quantita) : '';

    const descrizione = ordine.descrizione || '';
    const quantita_consegnata = ordine.quantita_consegnata || 0;
    const quantitaDaConsegnare = (ordine.quantita_consegnata != null)
        ? ordine.quantita - ordine.quantita_consegnata
        : ordine.quantita;

    const tdClass = firstCellClass ? ` class="${firstCellClass}"` : '';

    let html = `<tr id="tr_${ordine.id}"><td${tdClass}>`;
    html += `<button class="btn btn-sm btn-danger rimuovi_ordine mt-1" id="rimuovi_ordine" onclick="apri_modale_elimina_ordine('${ordine.id}')" data-id="${ordine.id}" style='min-width: 34px;'><i class="fas fa-trash"></i></button>`;
    if (showEditButton) {
        html += `<button class="btn btn-sm btn-primary modifica_ordine mt-1" onclick="apri_modale_modifica_ordine('${ordine.id}')" id="modifica_ordine" data-id="${ordine.id}" style='min-width: 34px;'><i class="far fa-edit"></i></button>`;
    }
    html += `</td>`;

    html += `<td>${nome_cliente}</td>`;
    html += prodotto.descrizione ? `<td>${prodotto.descrizione}</td>` : `<td></td>`;
    html += `<td>${ordine.quantita}</td>`;
    html += `<td>${quantitaDaConsegnare}</td>`;

    html += descrizione.length > 50
        ? `<td data-toggle="tooltip" title="${descrizione}" style="cursor: pointer;">${descrizione.substring(0, 50)}...</td>`
        : `<td>${descrizione}</td>`;

    html += `<td data-sort='${getDateSortKey(ordine.data_di_consegna)}'>${ordine.data_di_consegna || ''}</td>`;
    html += `<td data-sort='${getDateSortKey(ordine.data_di_ritiro_prevista)}'>${ordine.data_di_ritiro_prevista || ''}</td>`;
    html += `<td data-sort='${getDateSortKey(ordine.data_di_consegna_effettiva)}'>${ordine.data_di_consegna_effettiva || ''}</td>`;

    if (ordine.posizione && (ordine.stato == 0 || ordine.stato == 2)) {
        const pos = ordine.posizione;
        if (descrizione.length > 50 && pos.length > 20) {
            html += `<td data-toggle="tooltip" title="${pos}" style="cursor: pointer;">${pos.substring(0, 20)}...</td>`;
        } else if (pos.length > 50) {
            html += `<td data-toggle="tooltip" title="${pos}" style="cursor: pointer;">${pos.substring(0, 50)}...</td>`;
        } else {
            html += `<td>${pos}</td>`;
        }
    } else {
        html += `<td></td>`;
    }

    html += prezzo !== '' ? `<td>${prezzo}€</td>` : `<td>A vista</td>`;

    if (ordine.stato == "0") {
        html += `<td><button class='btn btn-sm btn-success consegna_articolo' data-quantita_originale=${ordine.quantita} data-quantita_consegnata=${quantita_consegnata} data-id='${ordine.id}'>Consegnato</button></td>`;
    } else if (ordine.stato == "1") {
        html += `<td><div class="loader_modal_annulla_consegna d-none" id='loader_annulla_consegna_${ordine.id}'></div><button class='btn btn-sm btn-danger annulla_consegna' data-id='${ordine.id}'>Annulla consegna</button></td>`;
    } else {
        html += `<td><button class='btn btn-sm btn-warning consegna_articolo' data-quantita_originale=${ordine.quantita} data-quantita_consegnata=${quantita_consegnata} data-id='${ordine.id}'>Consegnato</button></td>`;
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

function cercaCliente(nome, num_telefono) {
    return window.myAPI.getClienteByNomeEEmail(nome, num_telefono);
}

function inserisciCliente(cliente) {
    window.myAPI.putCliente(cliente);
}

function popolaTabellaClienti() {
    let clienti = window.myAPI.getElencoClienti();
    let html = '';

    $.each(clienti, function(index, cliente) {
        html += `<tr>`;
        html += `<td class='nome_cliente' data-id="${cliente.id}" data-nome="${cliente.nome}">${cliente.nome}</td>`;
        html += `<td class="edit_numero_di_telefono" id="${cliente.id}" data-id="${cliente.id}" data-numero="${cliente.email}">${cliente.email}</td>`;
        html += `<td style="width: 6% !important;"><button class='btn btn-sm btn-secondary modifica_cliente' data-num_telefono="${cliente.email}" data-nome="${cliente.nome}" data-id='${cliente.id}'>Modifica</button></td>`;
        html += `</tr>`;
    });

    return html;
}

function isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

function getDateSortKey(dateValue) {
    if (!dateValue || typeof dateValue !== 'string') {
        return '';
    }
    const parts = dateValue.split('-');
    if (parts.length !== 3) {
        return '';
    }
    return `${parts[2]}${parts[1]}${parts[0]}`;
}

function popolaTabellaPrezzi() {
    let prodotti = window.myAPI.getElencoProdotti();
    let html = '';

    $.each(prodotti, function(index, prodotto) {
        const tValue = prodotto.prezzo ? parseFloat(prodotto.prezzo.replace(/,/g, '.')) : '';
        const simbolo_euro = isNumber(tValue) ? '€' : '';

        html += `<tr>`;
        html += `<td class='nome_prodotto' data-id="${prodotto.id}" data-nome="${prodotto.descrizione}">${prodotto.descrizione}</td>`;
        html += `<td class="edit_prezzo_prodotto" id="${prodotto.id}" data-id="${prodotto.id}" data-prezzo="${prodotto.prezzo}">${prodotto.prezzo} ${simbolo_euro}</td>`;
        html += `</tr>`;
    });

    return html;
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

function cambiaOrdini(anno_da_controllare) {
    let ordini;

    ordini = window.myAPI.cambiaOrdini(anno_da_controllare, 0);
    $.each(ordini, function(index, ordine) {
        if (!ordine.data_di_consegna || ordine.data_di_consegna.length < 10) return;
        const nuovo_anno = ordine.data_di_consegna.slice(6, 10);
        if (nuovo_anno != anno_da_controllare) {
            window.myAPI.putOrdine(ordine, nuovo_anno);
            window.myAPI.eliminaOrdine(ordine.id, anno_da_controllare);
        }
    });

    ordini = window.myAPI.cambiaOrdini(anno_da_controllare, 2);
    $.each(ordini, function(index, ordine) {
        if (!ordine.data_di_consegna || ordine.data_di_consegna.length < 10) return;
        const nuovo_anno = ordine.data_di_consegna.slice(6, 10);
        if (nuovo_anno != anno_da_controllare) {
            window.myAPI.putOrdine(ordine, nuovo_anno);
            window.myAPI.eliminaOrdine(ordine.id, anno_da_controllare);
        }
    });

    ordini = window.myAPI.cambiaOrdini(anno_da_controllare, 1, "ordini_chiusi_");
    $.each(ordini, function(index, ordine) {
        if (!ordine.data_di_consegna_effettiva || ordine.data_di_consegna_effettiva.length < 10) return;
        const nuovo_anno = ordine.data_di_consegna_effettiva.slice(6, 10);
        if (nuovo_anno != anno_da_controllare) {
            window.myAPI.putOrdineChiuso(ordine, nuovo_anno);
            window.myAPI.eliminaOrdineChiuso(ordine.id, anno_da_controllare);
        }
    });
}

function modificaClienteFunction(where, set) {
    window.myAPI.modificaCliente(where, set);
}
