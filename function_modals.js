// Mostra il loader e disabilita il bottone, esegue l'azione e ripristina tutto
// anche in caso di errore (es. validazione fallita nel preload).
function eseguiConLoader(loader, bottone, azione) {
    $(loader).removeClass('d-none');
    $(bottone).prop('disabled', true);

    setTimeout(function() {
        try {
            azione();
        } catch (error) {
            console.error(error);
            alert('Operazione non riuscita: ' + error.message);
        } finally {
            $(loader).addClass('d-none');
            $(bottone).prop('disabled', false);
        }
    }, 100);
}

// Intero > 0 (le quantità nei form arrivano come stringhe).
function isQuantitaValida(valore) {
    return /^\d+$/.test(String(valore).trim()) && parseInt(valore, 10) > 0;
}

function dataOdierna() {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return day + '-' + month + '-' + d.getFullYear();
}

// Salva i due filtri della tabella corrente: search = ricerca generale, search2 = data di ritiro prevista.
function salvaFiltriTabella() {
    search = $('.dataTables_filter input:eq(1)').val();
    search2 = $('.dataTables_filter input:eq(0)').val();
}

// Ricarica la tabella ordini della scheda attiva, ripristinando opzionalmente i filtri salvati.
function ricaricaTabellaOrdini(ripristinaFiltri = true) {
    if (sidebar_attiva == "sidebar_dashboard") {
        create_data_table_ordini(0);
    } else if (sidebar_attiva == "sidebar_ordini_chiusi") {
        create_data_table_ordini_chiusi(1);
    } else {
        return;
    }

    if (ripristinaFiltri) {
        const tabella = $('#table').DataTable();
        $('#search_column').val(search2 || '');
        $('.dataTables_filter input:eq(1)').val(search || '');
        tabella.column(7).search(search2 || '');
        tabella.search(search || '').draw();
    }
}

// Funzione di apertura modale nuovo ordine
function apriModaleNuovoOrdine(){
    numero_ordini_inseriti_contemportaneamente = 1;
    $('#add_products').empty();

    $('#prodotto').val(null).trigger('change');
    $('#cliente').val(null).trigger('change');

    $('#quantita').removeClass('is-invalid');
    $('#data_di_consegna').removeClass('is-invalid');
    $('#cliente').removeClass('is-invalid');
    $('#prodotto').removeClass('is-invalid');

    const oggi = new Date();
    $('#data_di_consegna').datepicker("setDate", oggi);

    const ritiro = new Date(oggi);
    ritiro.setDate(ritiro.getDate() + 3);
    $('#data_di_ritiro_prevista').datepicker("setDate", ritiro);

    $('#posizione').val('');
    $('#quantita').val('');
    $('#descrizione').val('');

    $('#aggiungi_ordine_modal').modal('show');
}

$(document).on("click", ".chiudi_aggiunta_ordine", function(){
    $('#aggiungi_ordine_modal').modal('toggle');
});

// Quando clicco il tasto di aggiunta ordine entro qui
$(document).on("click", "#conferma_aggiunta_ordine", function(){
    eseguiConLoader('.loader_modal', '#conferma_aggiunta_ordine', aggiunta_ordine);
});

function aggiunta_ordine(){
    const comuni = {
        data_di_consegna: $('#data_di_consegna').val(),
        data_di_ritiro_prevista: $('#data_di_ritiro_prevista').val(),
        cliente: $('#cliente').val(),
        posizione: $('#posizione').val(),
        stato: "0",
        data_di_consegna_effettiva: "",
        quantita_consegnata: 0
    };

    // La prima riga ha id senza suffisso, le righe aggiunte hanno suffisso _2, _3, ...
    const suffissi = [''];
    for (let i = 2; i <= numero_ordini_inseriti_contemportaneamente; i++) {
        suffissi.push('_' + i);
    }

    let errore = false;

    $('#data_di_consegna, #cliente').removeClass('is-invalid');
    if (!comuni.data_di_consegna) {
        $('#data_di_consegna').addClass('is-invalid');
        errore = true;
    }
    if (!comuni.cliente) {
        $('#cliente').addClass('is-invalid');
        errore = true;
    }

    const ordini = suffissi.map(function(s) {
        const $prodotto = $('#prodotto' + s);
        const $quantita = $('#quantita' + s);
        const riga = {
            ...comuni,
            prodotto: $prodotto.val(),
            quantita: $quantita.val(),
            descrizione: $('#descrizione' + s).val()
        };

        $prodotto.toggleClass('is-invalid', !riga.prodotto);
        $quantita.toggleClass('is-invalid', !isQuantitaValida(riga.quantita));
        if (!riga.prodotto || !isQuantitaValida(riga.quantita)) {
            errore = true;
        }
        return riga;
    });

    if (errore) {
        return;
    }

    ordini.forEach(function(ordine) {
        inserisciOrdine(ordine);
    });

    $('#aggiungi_ordine_modal').modal('toggle');
    ricaricaTabellaOrdini(false);
}

function aggiungi_nuova_riga_ordine(){
    numero_ordini_inseriti_contemportaneamente ++;

    $('#add_products').append(`
        <div class='col-md-6 mt-2'><label class="form-label">Prodotto</label>
            <select class="select_prodotti" id="prodotto_`+numero_ordini_inseriti_contemportaneamente+`">
                <option value=""></option>
            </select>
        </div>
        <div class='col-md-5 mt-2'>
            <label class="form-label">Quantità</label>
            <input type="number" min="1" step="1" class="form-control" id="quantita_`+numero_ordini_inseriti_contemportaneamente+`">
        </div>
        <div class="col-md-12 mt-2">
            <label class="form-label">Descrizione</label>
            <textarea class="form-control" rows="4" id="descrizione_`+numero_ordini_inseriti_contemportaneamente+`"></textarea>
        </div>
    `);

    popolaSelectProdotti(numero_ordini_inseriti_contemportaneamente);

    $("#prodotto_" + numero_ordini_inseriti_contemportaneamente).select2({
        dropdownParent: $("#add_products"),
        theme: "bootstrap",
        placeholder: '',
        minimumResultsForSearch: 5,
        matcher: matchStart,
        allowClear: true
    });
}

$(document).on("click", "#aggiungi_prodotto_a_ordine", function(){
    aggiungi_nuova_riga_ordine();
});

// Funzione di apertura modale nuovo cliente
function apriModaleNuovoCliente(){
    $('#nome_nuovo_cliente').val('').removeClass('is-invalid');
    $('#num_telefono_nuovo_cliente').val('');

    $('#nuovo_cliente_modal').modal('show');
}

// Quando clicco il tasto di aggiunta nuovo cliente entro qui
$(document).on("click", "#conferma_aggiunta_cliente", function(){
    eseguiConLoader(null, '#conferma_aggiunta_cliente', aggiunta_cliente);
});

function aggiunta_cliente(){
    let nome = $('#nome_nuovo_cliente').val().trim();
    let num_telefono = $('#num_telefono_nuovo_cliente').val().trim();

    if (nome == '' || !cercaCliente(nome, num_telefono)) {
        // Nome vuoto oppure cliente già esistente
        $('#nome_nuovo_cliente').addClass('is-invalid');
        return;
    }

    inserisciCliente({ nome: nome, email: num_telefono });

    if(sidebar_attiva == "sidebar_clienti"){
        create_data_table_clienti();
    }

    popolaSelectClienti();

    $('#nuovo_cliente_modal').modal('toggle');
}

// Funzione di apertura modale nuovo prodotto
function apriModaleNuovoProdotto(){
    $('#descrizione_nuovo_articolo').val('').removeClass('is-invalid');
    $('#prezzo_nuovo_articolo').val('').removeClass('is-invalid');

    $('#nuovo_prodotto_modal').modal('show');
}

// Quando clicco il tasto di aggiunta nuovo prodotto entro qui
$(document).on("click", "#conferma_aggiunta_prodotto", function(){
    eseguiConLoader(null, '#conferma_aggiunta_prodotto', aggiunta_prodotto);
});

function aggiunta_prodotto(){
    let descrizione = $('#descrizione_nuovo_articolo').val().trim();
    let prezzo = $('#prezzo_nuovo_articolo').val().trim();

    $('#descrizione_nuovo_articolo').toggleClass('is-invalid', descrizione == '');
    $('#prezzo_nuovo_articolo').toggleClass('is-invalid', prezzo == '');
    if (descrizione == '' || prezzo == '') {
        return;
    }

    if (!cercaProdotto(descrizione)) {
        // Prodotto già esistente
        $('#descrizione_nuovo_articolo').addClass('is-invalid');
        return;
    }

    inserisciProdotto({ descrizione: descrizione, prezzo: prezzo });

    if(sidebar_attiva == "sidebar_prezzi"){
        create_data_table_prezzi();
    }

    popolaSelectProdotti();

    $('#nuovo_prodotto_modal').modal('toggle');
}

$(document).on("click", ".rimuovi_ordine", function(){
    apri_modale_elimina_ordine($(this).attr('data-id'));
});

function apri_modale_elimina_ordine(id_ordine){
    $('#conferma_rimuovi_ordine').attr('data-id', id_ordine);
    salvaFiltriTabella();

    $('#sei_sicuro_modal').modal('toggle');
}

$(document).on("click", "#conferma_rimuovi_ordine", function(){
    const id_ordine = $('#conferma_rimuovi_ordine').attr('data-id');
    eseguiConLoader('.loader_modal_elimina_ordine', '#conferma_rimuovi_ordine', function() {
        rimuovi_ordine(id_ordine);
    });
});

function rimuovi_ordine(id_ordine){
    if(sidebar_attiva == "sidebar_dashboard"){
        eliminaOrdine(id_ordine, selected_year);
    }

    if(sidebar_attiva == "sidebar_ordini_chiusi"){
        eliminaOrdineChiuso(id_ordine, selected_year_close);
    }

    ricaricaTabellaOrdini();

    $('#sei_sicuro_modal').modal('toggle');
}

$(document).on("click", ".modifica_ordine", function(){
    apri_modale_modifica_ordine($(this).attr('data-id'));
});

function apri_modale_modifica_ordine(id_ordine){
    let ordine = getOrdineDaModificare(id_ordine, selected_year);

    if(ordine.stato == "0"){
        $('#div_data_di_ritiro_effettiva').addClass('d-none');
        $('#div_data_di_ritiro_prevista').removeClass('d-none');
    }else{
        $('#div_data_di_ritiro_prevista').addClass('d-none');
        $('#div_data_di_ritiro_effettiva').removeClass('d-none');
    }
    $('#modifica_data_di_ritiro_prevista').val(ordine.data_di_ritiro_prevista);
    $('#modifica_data_di_ritiro_effettiva').val(ordine.data_di_consegna_effettiva);

    $('#modifica_data_di_consegna').val(ordine.data_di_consegna);
    $('#modifica_quantita').val(ordine.quantita).removeClass('is-invalid');
    $('#modifica_descrizione').val(ordine.descrizione);
    $('#modifica_prodotto').val(ordine.prodotto).trigger('change');
    $('#modifica_cliente').val(ordine.cliente).trigger('change');
    $('#modifica_posizione').val(ordine.posizione);

    salvaFiltriTabella();

    $('#conferma_modifica_ordine').attr('data-id', id_ordine);
    $('#conferma_modifica_ordine').attr('data-quantita_consegnata', ordine.quantita_consegnata || 0);
    $('#modifica_ordine_modal').modal('toggle');
}

$(document).on("click", "#conferma_modifica_ordine", function(){
    const id_ordine = $('#conferma_modifica_ordine').attr('data-id');
    eseguiConLoader('.loader_modal_modifica_ordine', '#conferma_modifica_ordine', function() {
        modifica_ordine(id_ordine);
    });
});

function modifica_ordine(id_ordine){
    const quantita = $('#modifica_quantita').val();
    const gia_consegnata = parseInt($('#conferma_modifica_ordine').attr('data-quantita_consegnata'), 10) || 0;

    // La quantità non può scendere sotto quanto già consegnato
    if (!isQuantitaValida(quantita) || parseInt(quantita, 10) < gia_consegnata) {
        $('#modifica_quantita').addClass('is-invalid');
        return;
    }

    let where = {
        "id": parseInt(id_ordine, 10)
    };

    let set = {
        "data_di_consegna_effettiva": $('#modifica_data_di_ritiro_effettiva').val(),
        "data_di_ritiro_prevista": $('#modifica_data_di_ritiro_prevista').val(),
        "data_di_consegna": $('#modifica_data_di_consegna').val(),
        "quantita": quantita,
        "descrizione": $('#modifica_descrizione').val(),
        "prodotto": $('#modifica_prodotto').val(),
        "cliente": $('#modifica_cliente').val(),
        "posizione": $('#modifica_posizione').val(),
    }

    modificaOrdineFunction(where, set, selected_year);

    ricaricaTabellaOrdini();

    $('#modifica_ordine_modal').modal('toggle');
}

$(document).on("click", ".consegna_articolo", function(){
    var id = $(this).attr('data-id');
    var quantita_originale = $(this).attr('data-quantita_originale');
    var quantita_consegnata = $(this).attr('data-quantita_consegnata');

    salvaFiltriTabella();

    $('#modifica_quantita_consegnata').removeClass('is-invalid');

    $('#modifica_quantita_consegnata').val(quantita_originale-quantita_consegnata);
    $("#modifica_quantita_consegnata").attr({
        "max" : quantita_originale-quantita_consegnata,
        "min" : 1
    });

    $('#conferma_quantita_consegnata').attr('data-id', id);
    $('#conferma_quantita_consegnata').attr('data-quantita_originale', quantita_originale);
    $('#conferma_quantita_consegnata').attr('data-quantita_consegnata', quantita_consegnata);

    $('#quantita_consegnata_modal').modal('toggle');
});

$(document).on("click", "#conferma_quantita_consegnata", function(){
    var $this = $(this);
    salvaFiltriTabella();
    eseguiConLoader('.loader_modal_conferma_quantita_confermata', '#conferma_quantita_consegnata', function() {
        consegna_articoli($this);
    });
});

function consegna_articoli($this) {
    var id_ordine = $this.attr('data-id');
    var valore_inserito = $('#modifica_quantita_consegnata').val();
    var quantita_originale = parseInt($this.attr('data-quantita_originale'), 10);
    var quantita_consegnata_originale = parseInt($this.attr('data-quantita_consegnata'), 10) || 0;

    // Serve un intero > 0 che non superi quanto resta da consegnare
    if (!isQuantitaValida(valore_inserito)) {
        $('#modifica_quantita_consegnata').addClass('is-invalid');
        return;
    }

    var totale_consegnato = parseInt(valore_inserito, 10) + quantita_consegnata_originale;
    if (totale_consegnato > quantita_originale) {
        $('#modifica_quantita_consegnata').addClass('is-invalid');
        return;
    }

    if (totale_consegnato < quantita_originale) {
        // Consegna parziale: l'ordine resta aperto con stato 2
        modificaOrdineFunction({ "id": parseInt(id_ordine, 10) }, {
            "stato": "2",
            "data_di_consegna_effettiva": dataOdierna(),
            "quantita_consegnata": totale_consegnato
        }, selected_year);
    } else {
        // Consegna completa: l'ordine passa tra i consegnati
        let ordine = getOrdineDaModificare(id_ordine, selected_year);

        inserisciOrdineChiuso({
            data_di_consegna: ordine.data_di_consegna,
            quantita: ordine.quantita,
            cliente: ordine.cliente,
            data_di_ritiro_prevista: ordine.data_di_ritiro_prevista,
            descrizione: ordine.descrizione,
            prodotto: ordine.prodotto,
            stato: "1",
            data_di_consegna_effettiva: dataOdierna(),
            posizione: ordine.posizione,
            quantita_consegnata: totale_consegnato
        }, selected_year);

        eliminaOrdine(id_ordine, selected_year);
    }

    ricaricaTabellaOrdini();

    $('#quantita_consegnata_modal').modal('toggle');
}

$(document).on("click", ".annulla_consegna", function(){
    var $this = $(this);
    eseguiConLoader('#loader_annulla_consegna_' + $this.attr('data-id'), '.annulla_consegna', function() {
        function_annulla_consegna($this);
    });
});

function function_annulla_consegna($this){
    var id_ordine = $this.attr('data-id');

    let ordine = getOrdineAnnullaConsegna(id_ordine, selected_year_close);

    inserisciOrdine({
        data_di_consegna: ordine.data_di_consegna,
        quantita: ordine.quantita,
        cliente: ordine.cliente,
        data_di_ritiro_prevista: ordine.data_di_ritiro_prevista,
        descrizione: ordine.descrizione,
        prodotto: ordine.prodotto,
        stato: "0",
        data_di_consegna_effettiva: "",
        posizione: ordine.posizione,
        quantita_consegnata: 0
    }, selected_year_close);

    eliminaOrdineChiuso(id_ordine, selected_year_close);

    salvaFiltriTabella();
    ricaricaTabellaOrdini();
}

$(document).on("click", ".modifica_cliente", function(){
    var id = $(this).attr('data-id');
    var num_telefono = $(this).attr('data-num_telefono');
    var nome = $(this).attr('data-nome');

    $('#nome_modifica_cliente').val(nome);
    $('#num_telefono_modifica_cliente').val(num_telefono);

    $("#conferma_modifica_cliente").attr('data-id', id);

    $('#nome_modifica_cliente').removeClass('is-invalid');

    $('#modifica_cliente_modal').modal('toggle');
});

// Quando clicco il tasto di modifica cliente entro qui
$(document).on("click", "#conferma_modifica_cliente", function(){
    var id_cliente = $(this).attr('data-id');
    eseguiConLoader(null, '#conferma_modifica_cliente', function() {
        modifica_cliente(id_cliente);
    });
});

function modifica_cliente(id_cliente){
    let nome = $('#nome_modifica_cliente').val().trim();
    let num_telefono = $('#num_telefono_modifica_cliente').val().trim();

    // Nome vuoto oppure un ALTRO cliente ha già stesso nome e telefono
    if (nome == '' || !cercaCliente(nome, num_telefono, id_cliente)) {
        $('#nome_modifica_cliente').addClass('is-invalid');
        return;
    }

    modificaClienteFunction({ "id": parseInt(id_cliente, 10) }, { "nome": nome, "email": num_telefono });

    create_data_table_clienti();

    popolaSelectClienti();

    $('#modifica_cliente_modal').modal('toggle');
}
