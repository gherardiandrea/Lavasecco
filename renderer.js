// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

//console.log(window.myAPI)

// Funzione che legge da db i clienti e li mette nella select
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

// Funzione che legge da db i clienti e li mette nella select
function popolaSelectProdotti(c = 0) {
    try {
        let prezzo = "";
        let prodotti = window.myAPI.getElencoProdotti();
        if (c === 0) {
            $('.select_prodotti').val(null).empty();
            $('.select_prodotti_modifica_ordine').val(null).empty();
            if (Array.isArray(prodotti)) {
                prodotti.forEach(value => {
                    prezzo = value.prezzo === "" ? "a vista" : value.prezzo + " €";
                    $('.select_prodotti').append($('<option>', { value: value.id, text: value.descrizione + ' - ' + prezzo }));
                    $('.select_prodotti_modifica_ordine').append($('<option>', { value: value.id, text: value.descrizione + ' - ' + prezzo }));
                });
            }
        } else {
            $("#prodotto_" + c).val(null).empty();
            $("#prodotto_" + c).append($('<option>', { value: '', text: '' }));
            if (Array.isArray(prodotti)) {
                prodotti.forEach(value => {
                    prezzo = value.prezzo === "" ? "a vista" : value.prezzo + " €";
                    $("#prodotto_" + c).append($('<option>', { value: value.id, text: value.descrizione + ' - ' + prezzo }));
                });
            }
        }
    } catch (error) {
        $('#alert_feedback').removeClass('d-none').addClass('alert-danger').text('Errore caricamento prodotti!');
        console.error('Errore popolaSelectProdotti:', error);
    }
}

function popolaTabellaOrdini(stato){
    let ordini = '';
    if(stato == 1){
        ordini = window.myAPI.getElencoOrdini(stato, selected_year_close);
    }else{
        ordini = window.myAPI.getElencoOrdini(stato, selected_year);
    }
    
    let html = ``;
    let nome_cliente = ``;
    let prodotto = ``;
    let prezzo = ``;
    let tValue = ``;
    let quantita_consegnata;

    $.each(ordini, function(index, ordine) {
        // Tasti 'modifica' ed 'elimina'
        html += `
            <tr id="tr_`+ordine.id+`">
                <td class="td_first">
                    <button class="btn btn-sm btn-danger rimuovi_ordine mt-1" id="rimuovi_ordine" onclick="apri_modale_elimina_ordine('`+ordine.id+`')" data-id="`+ordine.id+`" style='min-width: 34px;'>
                        <i class="fas fa-trash"></i>
                    </button>
        `;

        if(stato != 1){
            html += `
                        <button class="btn btn-sm btn-primary modifica_ordine mt-1" onclick="apri_modale_modifica_ordine('`+ordine.id+`')" id="modifica_ordine" data-id="`+ordine.id+`" style='min-width: 34px;'>
                            <i class="far fa-edit"></i>
                        </button>
                    </td>
            `;
        }

        // Cliente
        nome_cliente = window.myAPI.getClienteById(ordine.cliente);
        html += `<td>` + nome_cliente + `</td>`;

        // Prodotto
        prodotto = window.myAPI.getProdottoById(ordine.prodotto) || {};
        if (typeof prodotto.descrizione === 'undefined'){
            html += `<td></td>`;
        }else{
            html += `<td>` + prodotto.descrizione + `</td>`;
        }
        tValue = prodotto.prezzo;
        tValue = tValue ? parseFloat(tValue.replace(/,/g, '.')) : '';
        if(isNumber(tValue)){
            prezzo = parseInt(prodotto.prezzo) * parseInt(ordine.quantita);
        }else{
            prezzo = "";
        }

        // Quantità originale
        html += `<td>` + ordine.quantita + `</td>`;

        // Quantità da consegnare
        if(ordine.quantita_consegnata || ordine.quantita_consegnata == 0)
            html += `<td>` + (ordine.quantita - ordine.quantita_consegnata) + `</td>`;
        else
            html += `<td>` + ordine.quantita + `</td>`;

        // Descrizione
        const descrizione = ordine.descrizione || '';
        if(descrizione.length > 50){
            html += `<td data-toggle="tooltip" title="`+descrizione+`" style="cursor: pointer;">`+descrizione.substring(0,50)+`...</td>`;
        }else{
            html += `<td>`+descrizione+`</td>`;
        }

        // Data di consegna
        const dataConsegna = getDateSortKey(ordine.data_di_consegna);
        html += `<td data-sort='`+dataConsegna+`'>`+(ordine.data_di_consegna || '')+`</td>`;
        
        // Data di ritiro prevista
        const dataDiRitiroPrevista = getDateSortKey(ordine.data_di_ritiro_prevista);
        html += `<td data-sort='`+dataDiRitiroPrevista+`'>`+(ordine.data_di_ritiro_prevista || '')+`</td>`;
        
        // Data di ritiro effettiva
        const dataDiRitiroEffettiva = getDateSortKey(ordine.data_di_consegna_effettiva);
        html += `<td data-sort='`+dataDiRitiroEffettiva+`'>`+(ordine.data_di_consegna_effettiva || '')+`</td>`;

        // Posizione
        if(ordine.posizione && (ordine.stato == 0 || ordine.stato == 2)){
            if(descrizione.length > 50 && ordine.posizione.length > 20){
                html += `<td data-toggle="tooltip" title="`+ordine.posizione+`" style="cursor: pointer;">`+ordine.posizione.substring(0,20)+`...</td>`;
            }else{
                if(ordine.posizione.length > 50){
                    html += `<td data-toggle="tooltip" title="`+ordine.posizione+`" style="cursor: pointer;">`+ordine.posizione.substring(0,50)+`...</td>`;
                }else{
                    html += `<td>`+ordine.posizione+`</td>`;
                }
            }
        }else{
            html += `<td></td>`;
        }

        // Prezzo
        if(prezzo != "")
            html += `<td>`+prezzo+`€</td>`;
        else
            html += `<td>A vista</td>`;

        // Ultima colonna
        if(ordine.stato == "0"){
            if(!ordine.quantita_consegnata)
                quantita_consegnata = 0;
            else
                quantita_consegnata = ordine.quantita_consegnata;

            html += `<td><button class='btn btn-sm btn-success consegna_articolo' data-quantita_originale=`+ordine.quantita+` data-quantita_consegnata=`+quantita_consegnata+` data-id='`+ordine.id+`'>Consegnato</button></td></tr>`;
        }else{
            if(ordine.stato == "1")
                html += `<td><div class="loader_modal_annulla_consegna d-none" id='loader_annulla_consegna_`+ordine.id+`'></div><button class='btn btn-sm btn-danger annulla_consegna' data-id='`+ordine.id+`'>Annulla consegna</button></td></tr>`;
            else{
                if(!ordine.quantita_consegnata)
                    quantita_consegnata = 0;
                else
                    quantita_consegnata = ordine.quantita_consegnata;
                
                html += `<td><button class='btn btn-sm btn-warning consegna_articolo' data-quantita_originale=`+ordine.quantita+` data-quantita_consegnata=`+quantita_consegnata+` data-id='`+ordine.id+`'>Consegnato</button></td></tr>`;
            }
        }
    });

    //Se sto visualizzando gli ordini aperti devo prendere anche gli ordini che sono stati consegnati solamente parzialmente
    if(stato == 0){
        ordini = window.myAPI.getElencoOrdini(2, selected_year);

        $.each(ordini, function(index, ordine) {
            // Tasti 'modifica' ed 'elimina'
            html += `
                <tr id="tr_`+ordine.id+`">
                    <td>
                        <button class="btn btn-sm btn-danger rimuovi_ordine mt-1" id="rimuovi_ordine" onclick="apri_modale_elimina_ordine('`+ordine.id+`')" data-id="`+ordine.id+`" style='min-width: 34px;'>
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn btn-sm btn-primary modifica_ordine mt-1" onclick="apri_modale_modifica_ordine('`+ordine.id+`')" id="modifica_ordine" data-id="`+ordine.id+`" style='min-width: 34px;'>
                            <i class="far fa-edit"></i>
                        </button>
                    </td>
            `;
    
            // Cliente
            nome_cliente = window.myAPI.getClienteById(ordine.cliente);
            html += `<td>` + nome_cliente + `</td>`;
    
            // Prodotto
            prodotto = window.myAPI.getProdottoById(ordine.prodotto) || {};
            if (typeof prodotto.descrizione === 'undefined'){
                html += `<td></td>`;
            } else {
                html += `<td>` + prodotto.descrizione + `</td>`;
            }
            prezzo = "";
            tValue = prodotto.prezzo;
            tValue = tValue ? parseFloat(tValue.replace(/,/g, '.')) : '';
            if($.isNumeric(tValue))
                prezzo = parseInt(prodotto.prezzo) * parseInt(ordine.quantita);
    
            // Quantità originale
            html += `<td>` + ordine.quantita + `</td>`;
    
            // Quantità da consegnare
            if(ordine.quantita_consegnata || ordine.quantita_consegnata == 0)
                html += `<td>` + (ordine.quantita - ordine.quantita_consegnata) + `</td>`;
            else
                html += `<td>` + ordine.quantita + `</td>`;
    
            // Descrizione
            const descrizione = ordine.descrizione || '';
            if(descrizione.length > 50){
                html += `<td data-toggle="tooltip" title="`+descrizione+`" style="cursor: pointer;">`+descrizione.substring(0,50)+`...</td>`;
            }else{
                html += `<td>`+descrizione+`</td>`;
            }
    
           // Data di consegna
            const dataConsegna = getDateSortKey(ordine.data_di_consegna);
            html += `<td data-sort='`+dataConsegna+`'>`+(ordine.data_di_consegna || '')+`</td>`;
            
            // Data di ritiro prevista
            const dataDiRitiroPrevista = getDateSortKey(ordine.data_di_ritiro_prevista);
            html += `<td data-sort='`+dataDiRitiroPrevista+`'>`+(ordine.data_di_ritiro_prevista || '')+`</td>`;
            
            // Data di ritiro effettiva
            const dataDiRitiroEffettiva = getDateSortKey(ordine.data_di_consegna_effettiva);
            html += `<td data-sort='`+dataDiRitiroEffettiva+`'>`+(ordine.data_di_consegna_effettiva || '')+`</td>`;
    
            // Posizione
            if(ordine.posizione && (ordine.stato == 0 || ordine.stato == 2)){
                if(descrizione.length > 50 && ordine.posizione.length > 20){
                    html += `<td data-toggle="tooltip" title="`+ordine.posizione+`" style="cursor: pointer;">`+ordine.posizione.substring(0,20)+`...</td>`;
                }else{
                    if(ordine.posizione.length > 50){
                        html += `<td data-toggle="tooltip" title="`+ordine.posizione+`" style="cursor: pointer;">`+ordine.posizione.substring(0,50)+`...</td>`;
                    }else{
                        html += `<td>`+ordine.posizione+`</td>`;
                    }
                }
            }else{
                html += `<td></td>`;
            }
    
            // Prezzo
            if(prezzo != "")
                html += `<td>`+prezzo+`€</td>`;
            else
                html += `<td>A vista</td>`;
    
            // Ultima colonna
            if(ordine.stato == "0"){
                if(!ordine.quantita_consegnata)
                    quantita_consegnata = 0;
                else
                    quantita_consegnata = ordine.quantita_consegnata;
    
                html += `<td><button class='btn btn-sm btn-success consegna_articolo' data-quantita_originale=`+ordine.quantita+` data-quantita_consegnata=`+quantita_consegnata+` data-id='`+ordine.id+`'>Consegnato</button></td></tr>`;
            }else{
                if(ordine.stato == "1")
                    html += `<td><div class="loader_modal_annulla_consegna d-none" id='loader_annulla_consegna_`+ordine.id+`'></div><button class='btn btn-sm btn-danger annulla_consegna' data-id='`+ordine.id+`'>Annulla consegna</button></td></tr>`;
                else{
                    if(!ordine.quantita_consegnata)
                        quantita_consegnata = 0;
                    else
                        quantita_consegnata = ordine.quantita_consegnata;
                    
                    html += `<td><button class='btn btn-sm btn-warning consegna_articolo' data-quantita_originale=`+ordine.quantita+` data-quantita_consegnata=`+quantita_consegnata+` data-id='`+ordine.id+`'>Consegnato</button></td></tr>`;
                }
            }
        });
    }

    return html;
}

function inserisciOrdine(ordine, year = actual_year){
    window.myAPI.putOrdine(ordine, year);
}

function inserisciOrdineChiuso(ordine, year){
    window.myAPI.putOrdineChiuso(ordine, year);
}

function cercaCliente(nome, num_telefono){
    return window.myAPI.getClienteByNomeEEmail(nome, num_telefono);
}

function inserisciCliente(cliente){
    window.myAPI.putCliente(cliente);
}

function popolaTabellaClienti(){
    let clienti = window.myAPI.getElencoClienti();

    let html = '';

    $.each(clienti, function(index, cliente) {
        html += `<tr>`;
        html += `<td class='nome_cliente' data-id="`+cliente.id+`" data-nome="`+cliente.nome+`">`+cliente.nome+`</td>`;
        html += `<td class="edit_numero_di_telefono" id="`+cliente.id+`" data-id="`+cliente.id+`" data-numero="`+cliente.email+`">`+cliente.email+`</td>`;
        html += `<td style="width: 6% !important;"><button class='btn btn-sm btn-secondary modifica_cliente' data-num_telefono="`+cliente.email+`" data-nome="`+cliente.nome+`" data-id='`+cliente.id+`'>Modifica</button></td>`;
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

function popolaTabellaPrezzi(){
    let prodotti = window.myAPI.getElencoProdotti();

    let html = '';
    let simbolo_euro = '';

    $.each(prodotti, function(index, prodotto) {
        tValue = prodotto.prezzo;
        tValue = tValue ? parseFloat(tValue.replace(/,/g, '.')) : '';

        if(isNumber(tValue)){
            simbolo_euro = '€';
        }else{
            simbolo_euro = '';
        }

        html += `<tr>`;
        html += `<td class='nome_prodotto' data-id="`+prodotto.id+`" data-nome="`+prodotto.descrizione+`">`+prodotto.descrizione+`</td>`;
        html += `<td class="edit_prezzo_prodotto" id="`+prodotto.id+`" data-id="`+prodotto.id+`" data-prezzo="`+prodotto.prezzo+`">`+prodotto.prezzo+` `+simbolo_euro+`</td>`;
        html += `</tr>`;
    });

    return html;
}

function cercaProdotto(descrizione){
    return window.myAPI.getProdottoByDescrizione(descrizione);
}

function inserisciProdotto(prodotto){
    window.myAPI.putProdotto(prodotto);
}

function eliminaOrdine(id_ordine, year){
    window.myAPI.eliminaOrdine(id_ordine, year);
}

function getOrdineDaModificare(id_ordine, year){
    let ordine = window.myAPI.getOrdineById(id_ordine, year);
    return ordine;
}

function modificaOrdineFunction(where, set, year){
    let prod = window.myAPI.modificaOrdine(where, set, year);
}

function getOrdineAnnullaConsegna(id_ordine, year){
    let ordine = window.myAPI.getOrdineChiusoById(id_ordine, year);
    return ordine;
}

function eliminaOrdineChiuso(id_ordine, year){
    window.myAPI.eliminaOrdineChiuso(id_ordine, year);
}

function cambiaOrdini(anno_da_controllare){
    let ordini;
    let nuovo_anno = '';
    ordini = window.myAPI.cambiaOrdini(anno_da_controllare, 0);
    $.each(ordini, function(index, ordine) {
        if (!ordine.data_di_consegna || ordine.data_di_consegna.length < 10) {
            return;
        }
        nuovo_anno = ordine.data_di_consegna[6] + ordine.data_di_consegna[7] + ordine.data_di_consegna[8] + ordine.data_di_consegna[9];
        if(nuovo_anno != anno_da_controllare){
            window.myAPI.putOrdine(ordine, nuovo_anno);
            window.myAPI.eliminaOrdine(ordine.id, anno_da_controllare);
        }
    });

    ordini = window.myAPI.cambiaOrdini(anno_da_controllare, 2);
    $.each(ordini, function(index, ordine) {
        if (!ordine.data_di_consegna || ordine.data_di_consegna.length < 10) {
            return;
        }
        nuovo_anno = ordine.data_di_consegna[6] + ordine.data_di_consegna[7] + ordine.data_di_consegna[8] + ordine.data_di_consegna[9];
        if(nuovo_anno != anno_da_controllare){
            window.myAPI.putOrdine(ordine, nuovo_anno);
            window.myAPI.eliminaOrdine(ordine.id, anno_da_controllare);
        }
    });

    ordini = window.myAPI.cambiaOrdini(anno_da_controllare, 1, "ordini_chiusi_");
    $.each(ordini, function(index, ordine) {
        if (!ordine.data_di_consegna_effettiva || ordine.data_di_consegna_effettiva.length < 10) {
            return;
        }
        nuovo_anno = ordine.data_di_consegna_effettiva[6] + ordine.data_di_consegna_effettiva[7] + ordine.data_di_consegna_effettiva[8] + ordine.data_di_consegna_effettiva[9];
        if(nuovo_anno != anno_da_controllare){
            window.myAPI.putOrdineChiuso(ordine, nuovo_anno);
            window.myAPI.eliminaOrdineChiuso(ordine.id, anno_da_controllare);
        }
    });
}

function modificaClienteFunction(where, set){
    let cliente = window.myAPI.modificaCliente(where, set);
}