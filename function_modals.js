// Funzione di apertura modale nuovo prodotto
function apriModaleNuovoOrdine(){
    numero_ordini_inseriti_contemportaneamente = 1;
    $('#add_products').empty();

    $('#prodotto').val(null).trigger('change');
    $('#cliente').val(null).trigger('change');

    $('#quantita').removeClass('is-invalid');
    $('#data_di_consegna').removeClass('is-invalid');
    $('#cliente').removeClass('is-invalid');
    $('#prodotto').removeClass('is-invalid');

    let d = new Date();
    let giorno;
    if(d.getDate() < 10){
        giorno = "0" + d.getDate();
    }else{
        giorno = d.getDate();
    }
    var strDate = giorno + "-" + (d.getMonth()+1) + "-" + d.getFullYear();

    $('#data_di_consegna').datepicker("setDate", new Date(d.getFullYear(), d.getMonth(), giorno));

    var result = d.setDate(d.getDate() + 3);
    result = new Date(result);
    if(result.getDate() < 10){
        giorno = "0" + result.getDate();
    }else{
        giorno = result.getDate();
    }

    $('#data_di_ritiro_prevista').datepicker("setDate", new Date(result.getFullYear(), result.getMonth(), giorno));
    $('#posizione').val('');
    $('#quantita').val('');
    $('#descrizione').val('');

    $('#aggiungi_ordine_modal').modal('show');
}

$(document).on("click", ".chiudi_aggiunta_ordine", function(e){
    $('#aggiungi_ordine_modal').modal('toggle');
});

// Quando clicco il tasto di aggiunta ordine entro qui
$(document).on("click", "#conferma_aggiunta_ordine", function(e){
    $this = $(this);
    $('.loader_modal').removeClass('d-none');
    $("#conferma_aggiunta_ordine").prop("disabled", true);
    setTimeout(function() {
        aggiunta_ordine($this);
        $('.loader_modal').addClass('d-none');
        $("#conferma_aggiunta_ordine").prop("disabled", false);
    }, 100);
});

function aggiunta_ordine($this){
    let insert_error = 0;
    let obj = new Object();
    
    obj.data_di_consegna = $('#data_di_consegna').val();
    obj.quantita = $('#quantita').val();
    obj.cliente = $('#cliente').val();
    obj.data_di_ritiro_prevista = $('#data_di_ritiro_prevista').val();
    obj.descrizione = $('#descrizione').val();
    obj.prodotto = $('#prodotto').val();
    obj.stato = "0";
    obj.data_di_consegna_effettiva = "";
    obj.posizione = $('#posizione').val();
    obj.quantita_consegnata = 0;
    
    if(obj.data_di_consegna != "" && obj.quantita !="" && obj.cliente !="" && obj.cliente != null && obj.prodotto !="" && obj.prodotto != null){
        if(numero_ordini_inseriti_contemportaneamente <= 1){
            inserisciOrdine(obj);
        }
    }else{
        insert_error = 1;

        if(obj.data_di_consegna == "")
            $('#data_di_consegna').addClass('is-invalid');
        if(obj.quantita == "")
            $('#quantita').addClass('is-invalid');
        if(obj.cliente == "")
            $('#cliente').addClass('is-invalid');
        if(obj.prodotto == "" || obj.prodotto == null)
            $('#prodotto').addClass('is-invalid');
    }

    if(numero_ordini_inseriti_contemportaneamente > 1 && insert_error == 0){
        for(let i = 2; i <= numero_ordini_inseriti_contemportaneamente; i++){
            obj = new Object();
    
            obj.data_di_consegna = $('#data_di_consegna').val();
            obj.quantita = $('#quantita_' + i).val();
            obj.cliente = $('#cliente').val();
            obj.data_di_ritiro_prevista = $('#data_di_ritiro_prevista').val();
            obj.descrizione = $('#descrizione_' + i).val();
            obj.prodotto = $('#prodotto_' + i).val();
            obj.stato = "0";
            obj.data_di_consegna_effettiva = "";
            obj.posizione = $('#posizione').val();
            obj.quantita_consegnata = 0;
            
            if(obj.data_di_consegna != "" && obj.quantita !="" && obj.cliente && obj.cliente != null !="" && obj.prodotto !="" && obj.prodotto != null){
            }else{
                insert_error = 1;

                if(obj.data_di_consegna == "")
                    $('#data_di_consegna').addClass('is-invalid');
                if(obj.quantita == "")
                    $('#quantita_' + i).addClass('is-invalid');
                if(obj.cliente == "")
                    $('#cliente').addClass('is-invalid');
                if(obj.prodotto == "")
                    $('#prodotto_' + i).addClass('is-invalid');
            }
        }

        if(insert_error == 0){
            //Se non ci sono errori devo inserire tutti gli ordini
            obj = new Object();

            obj.data_di_consegna = $('#data_di_consegna').val();
            obj.quantita = $('#quantita').val();
            obj.cliente = $('#cliente').val();
            obj.data_di_ritiro_prevista = $('#data_di_ritiro_prevista').val();
            obj.descrizione = $('#descrizione').val();
            obj.prodotto = $('#prodotto').val();
            obj.stato = "0";
            obj.data_di_consegna_effettiva = "";
            obj.posizione = $('#posizione').val();
            obj.quantita_consegnata = 0;

            inserisciOrdine(obj);

            for(let i = 2; i <= numero_ordini_inseriti_contemportaneamente; i++){
                obj = new Object();
    
                obj.data_di_consegna = $('#data_di_consegna').val();
                obj.quantita = $('#quantita_' + i).val();
                obj.cliente = $('#cliente').val();
                obj.data_di_ritiro_prevista = $('#data_di_ritiro_prevista').val();
                obj.descrizione = $('#descrizione_' + i).val();
                obj.prodotto = $('#prodotto_' + i).val();
                obj.stato = "0";
                obj.data_di_consegna_effettiva = "";
                obj.posizione = $('#posizione').val();
                obj.quantita_consegnata = 0;

                inserisciOrdine(obj);
            }
        }
    }

    if(insert_error == 0){
        $('#aggiungi_ordine_modal').modal('toggle');

        // La tabella la aggiorno solo se sono nella tab Ordini o nella tab Ordini Chiusi
        if(sidebar_attiva == "sidebar_dashboard"){
            create_data_table_ordini(0);
        }

        if(sidebar_attiva == "sidebar_ordini_chiusi"){
            create_data_table_ordini(1);
        }
    }
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
            <input type="number" min="0" step="1" class="form-control" id="quantita_`+numero_ordini_inseriti_contemportaneamente+`">
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

// Funzione di apertura modale nuovo cliente
function apriModaleNuovoCliente(){
    $('#nome_nuovo_cliente').val('');
    $('#num_telefono_nuovo_cliente').val('');

    $('#nuovo_cliente_modal').modal('show');
}

// Quando clicco il tasto di aggiunta nuovo cliente entro qui
$(document).on("click", "#conferma_aggiunta_cliente", function(e){
    $this = $(this);

    $("#conferma_aggiunta_prodotto").prop("disabled", true);
    
    setTimeout(function() {
        aggiunta_cliente($this);

        $("#conferma_aggiunta_prodotto").prop("disabled", false);
    }, 100);
});

function aggiunta_cliente($this){
    let inseribile;
    
    let nome = $('#nome_nuovo_cliente').val();
    let num_telefono = $('#num_telefono_nuovo_cliente').val();

    if(nome != ''){
        inseribile = cercaCliente(nome, num_telefono);
    
        if(inseribile){
            let cliente = new Object();
            
            cliente.nome = nome;
            cliente.email = num_telefono;

            inserisciCliente(cliente);
            
            if(sidebar_attiva == "sidebar_clienti"){
                create_data_table_clienti();
            }

            popolaSelectClienti();

            $('#nuovo_cliente_modal').modal('toggle');
        }else{
            //alert("Cliente già esistente, cambiare nome");
            $('#nome_nuovo_cliente').addClass('is-invalid');
        }
    }else{
        if(nome == ''){
            $('#nome_nuovo_cliente').addClass('is-invalid');
        }
    }
}

// Funzione di apertura modale nuovo prodotto
function apriModaleNuovoProdotto(){
    $('#descrizione_nuovo_articolo').val('');
    $('#prezzo_nuovo_articolo').val('');

    $('#nuovo_prodotto_modal').modal('show');
}

// Quando clicco il tasto di aggiunta nuovo prodotto entro qui
$(document).on("click", "#conferma_aggiunta_prodotto", function(e){
    $this = $(this);

    $("#conferma_aggiunta_prodotto").prop("disabled", true);

    setTimeout(function() {
        aggiunta_prodotto($this);

        $("#conferma_aggiunta_prodotto").prop("disabled", false);
    }, 100);
});

function aggiunta_prodotto($this){
    let inseribile;
    
    let descrizione = $('#descrizione_nuovo_articolo').val();
    let prezzo = $('#prezzo_nuovo_articolo').val();

    if(descrizione != '' && prezzo != ''){
        inseribile = cercaProdotto(descrizione);
    
        if(inseribile){
            let prodotto = new Object();
            
            prodotto.descrizione = descrizione;
            prodotto.prezzo = prezzo;

            inserisciProdotto(prodotto);
            
            if(sidebar_attiva == "sidebar_prezzi"){
                create_data_table_prezzi();
            }

            popolaSelectProdotti();

            $('#nuovo_prodotto_modal').modal('toggle');
        }else{
            //alert("Prodotto già esistente, cambiare descrizione");
            $('#descrizione_nuovo_articolo').addClass('is-invalid');
        }
    }else{
        if(descrizione == ''){
            $('#descrizione_nuovo_articolo').addClass('is-invalid');
        }

        if(prezzo == ''){
            $('#prezzo_nuovo_articolo').addClass('is-invalid');
        }
    }
}

function apri_modale_elimina_ordine(id_ordine){
    $('#conferma_rimuovi_ordine').attr('data-id', id_ordine);
    search = $('.dataTables_filter input:eq(1)').val();            
    search2 = $('.dataTables_filter input:eq(0)').val();

    $('#sei_sicuro_modal').modal('toggle');
}

$(document).on("click", "#conferma_rimuovi_ordine", function(e){
    id_ordine = $('#conferma_rimuovi_ordine').attr('data-id');

    $('.loader_modal_elimina_ordine').removeClass('d-none');
    $("#conferma_rimuovi_ordine").prop("disabled", true);

    setTimeout(function() {
        rimuovi_ordine(id_ordine);
        $('.loader_modal_elimina_ordine').addClass('d-none');
        $("#conferma_rimuovi_ordine").prop("disabled", false);
    }, 100);
});

function rimuovi_ordine(id_ordine){
    // La tabella la aggiorno solo se sono nella tab Ordini o nella tab Ordini Chiusi
    if(sidebar_attiva == "sidebar_dashboard"){
        eliminaOrdine(id_ordine, selected_year);
        create_data_table_ordini(0);
    }

    if(sidebar_attiva == "sidebar_ordini_chiusi"){
        eliminaOrdineChiuso(id_ordine, selected_year_close);
        create_data_table_ordini(1);
    }

    if(sidebar_attiva == "sidebar_dashboard" || sidebar_attiva == "sidebar_ordini_chiusi"){
        $('#search_column').val(search2);
        table_ordini.api().columns( 7 )
            .search( search2 )
            .draw();
        $('.dataTables_filter input:eq(1)').val(search);
        $('#table').dataTable().fnFilter(search);
    }

    $('#sei_sicuro_modal').modal('toggle');
}

function apri_modale_modifica_ordine(id_ordine){
    let ordine = getOrdineDaModificare(id_ordine, selected_year);
    console.log(ordine);

    if(ordine.stato == "0"){
        $('#div_data_di_ritiro_effettiva').addClass('d-none');
        $('#div_data_di_ritiro_prevista').removeClass('d-none');
        $('#modifica_data_di_ritiro_prevista').val(ordine.data_di_ritiro_prevista);
        $('#modifica_data_di_ritiro_effettiva').val(ordine.data_di_consegna_effettiva);
    }else{
        $('#div_data_di_ritiro_prevista').addClass('d-none');
        $('#div_data_di_ritiro_effettiva').removeClass('d-none');
        $('#modifica_data_di_ritiro_effettiva').val(ordine.data_di_consegna_effettiva);
        $('#modifica_data_di_ritiro_prevista').val(ordine.data_di_ritiro_prevista);
    }

    $('#modifica_data_di_consegna').val(ordine.data_di_consegna);
    $('#modifica_quantita').val(ordine.quantita);
    $('#modifica_descrizione').val(ordine.descrizione);
    $('#modifica_prodotto').val(ordine.prodotto).trigger('change');
    $('#modifica_cliente').val(ordine.cliente).trigger('change');
    $('#modifica_posizione').val(ordine.posizione);
    

    search = $('.dataTables_filter input:eq(1)').val();            
    search2 = $('.dataTables_filter input:eq(0)').val();

    $('#conferma_modifica_ordine').attr('data-id', id_ordine);
    $('#modifica_ordine_modal').modal('toggle');
}

function confermaModificaOrdine(){
    id_ordine = $('#conferma_modifica_ordine').attr('data-id');

    $('.loader_modal_modifica_ordine').removeClass('d-none');
    $("#conferma_modifica_ordine").prop("disabled", true);

    setTimeout(function() {
        modifica_ordine(id_ordine);

        $('.loader_modal_modifica_ordine').addClass('d-none');
        $("#conferma_modifica_ordine").prop("disabled", false);
    }, 100);
}

function modifica_ordine(id_ordine){
    let where = {
        "id": parseInt(id_ordine)
    };

    let set = {
        "data_di_consegna_effettiva": $('#modifica_data_di_ritiro_effettiva').val(),
        "data_di_ritiro_prevista": $('#modifica_data_di_ritiro_prevista').val(),
        "data_di_consegna": $('#modifica_data_di_consegna').val(),
        "quantita": $('#modifica_quantita').val(),
        "descrizione": $('#modifica_descrizione').val(),
        "prodotto": $('#modifica_prodotto').val(),
        "cliente": $('#modifica_cliente').val(),
        "posizione": $('#modifica_posizione').val(),
    }

    modificaOrdineFunction(where, set, selected_year);

    // La tabella la aggiorno solo se sono nella tab Ordini o nella tab Ordini Chiusi
    if(sidebar_attiva == "sidebar_dashboard"){
        create_data_table_ordini(0);
    }
    
    if(sidebar_attiva == "sidebar_ordini_chiusi"){
        create_data_table_ordini(1);
    }

    if(sidebar_attiva == "sidebar_dashboard" || sidebar_attiva == "sidebar_ordini_chiusi"){
        $('#search_column').val(search2);
        table_ordini.api().columns( 7 )
            .search( search2 )
            .draw();
        $('.dataTables_filter input:eq(1)').val(search);
        $('#table').dataTable().fnFilter(search);
    }

    $('#modifica_ordine_modal').modal('toggle');
}

$(document).on("click", ".consegna_articolo", function(e){
    var $this = $(this);
    var id = $(this).attr('data-id');
    var quantita_originale = $(this).attr('data-quantita_originale');
    var quantita_consegnata = $(this).attr('data-quantita_consegnata');

    search = $('.dataTables_filter input:eq(1)').val();            
    search2 = $('.dataTables_filter input:eq(0)').val();

    $('#modifica_quantita_consegnata').removeClass('is-invalid');

    $('#modifica_quantita_consegnata').val(quantita_originale-quantita_consegnata);
    $("#modifica_quantita_consegnata").attr({
        "max" : quantita_originale-quantita_consegnata,
        "min" : 0
    });

    $('#conferma_quantita_consegnata').attr('data-id', id);
    $('#conferma_quantita_consegnata').attr('data-quantita_originale', quantita_originale);
    $('#conferma_quantita_consegnata').attr('data-quantita_consegnata', quantita_consegnata);

    $('#quantita_consegnata_modal').modal('toggle');
});

$(document).on("click", "#conferma_quantita_consegnata", function(e){
    var $this = $(this);
    $this.addClass("btn-loading");

    $('.loader_modal_conferma_quantita_confermata').removeClass('d-none');
    $("#conferma_quantita_consegnata").prop("disabled", true);

    search = $('.dataTables_filter input:eq(1)').val();            
    search2 = $('.dataTables_filter input:eq(0)').val();

    setTimeout(function() {
        consegna_articoli($this);

        $('.loader_modal_conferma_quantita_confermata').addClass('d-none');
        $("#conferma_quantita_consegnata").prop("disabled", false);
    }, 100);
});

function consegna_articoli($this) {
    var id_ordine = $this.attr('data-id');
    var quantita_consegnata = parseInt($('#modifica_quantita_consegnata').val());
    var quantita_originale = parseInt($this.attr('data-quantita_originale'));
    var quantita_consegnata_originale = parseInt($this.attr('data-quantita_consegnata'));

    if((quantita_consegnata + quantita_consegnata_originale) > quantita_originale){
        $('#modifica_quantita_consegnata').addClass('is-invalid');
    }else{
        let where = {
            "id": parseInt(id_ordine)
        };

        var d = new Date();
        var day = d.getDate();
        var month = d.getMonth() + 1;
        var year = d.getFullYear();
        if (day < 10) {
            day = "0" + day;
        }
        if (month < 10) {
            month = "0" + month;
        }

        var stato;
        if(quantita_originale - (quantita_consegnata + quantita_consegnata_originale) == 0){
            stato = "1";
        }else{
            if(quantita_originale - (quantita_consegnata + quantita_consegnata_originale) > 0){
                stato = "2";
            }
        }

        if(stato == "2"){
            let set = {
                "stato": stato,
                "data_di_consegna_effettiva": day +'-'+month+'-'+year,
                "quantita_consegnata": (quantita_consegnata + quantita_consegnata_originale)
            }

            modificaOrdineFunction(where, set, selected_year);
        }else{
            let obj = new Object();
            let ordine = getOrdineDaModificare(id_ordine, selected_year);

            obj.data_di_consegna = ordine.data_di_consegna;
            obj.quantita = ordine.quantita;
            obj.cliente = ordine.cliente;
            obj.data_di_ritiro_prevista = ordine.data_di_ritiro_prevista;
            obj.descrizione = ordine.descrizione;
            obj.prodotto = ordine.prodotto;
            obj.stato = stato;
            obj.data_di_consegna_effettiva = day +'-'+month+'-'+year;
            obj.posizione = ordine.posizione;
            obj.quantita_consegnata = (quantita_consegnata + quantita_consegnata_originale);

            inserisciOrdineChiuso(obj, selected_year);

            eliminaOrdine(id_ordine, selected_year);
        }

        // La tabella la aggiorno solo se sono nella tab Ordini o nella tab Ordini Chiusi
        if(sidebar_attiva == "sidebar_dashboard"){
            create_data_table_ordini(0);
        }
        
        if(sidebar_attiva == "sidebar_ordini_chiusi"){
            create_data_table_ordini(1);
        }

        if(sidebar_attiva == "sidebar_dashboard" || sidebar_attiva == "sidebar_ordini_chiusi"){
            $('#search_column').val(search2);
            table_ordini.api().columns( 7 )
                .search( search2 )
                .draw();
            $('.dataTables_filter input:eq(1)').val(search);
            $('#table').dataTable().fnFilter(search);
        }

        $('#quantita_consegnata_modal').modal('toggle');
    }
};

$(document).on("click", ".annulla_consegna", function(e){
    var $this = $(this);

    $('#loader_annulla_consegna_' + $this.attr('data-id')).removeClass('d-none');
    $(".annulla_consegna").prop("disabled", true);

    setTimeout(function() {
        function_annulla_consegna($this);

        $('#loader_annulla_consegna_' + $this.attr('data-id')).addClass('d-none');
        $(".annulla_consegna").prop("disabled", false);
    }, 100);
});

function function_annulla_consegna($this){
    var id_ordine = $this.attr('data-id');

    let obj = new Object();
    let ordine = getOrdineAnnullaConsegna(id_ordine, selected_year_close);

    obj.data_di_consegna = ordine.data_di_consegna;
    obj.quantita = ordine.quantita;
    obj.cliente = ordine.cliente;
    obj.data_di_ritiro_prevista = ordine.data_di_ritiro_prevista;
    obj.descrizione = ordine.descrizione;
    obj.prodotto = ordine.prodotto;
    obj.stato = "0";
    obj.data_di_consegna_effettiva = "";
    obj.posizione = ordine.posizione;
    obj.quantita_consegnata = 0;

    inserisciOrdine(obj, selected_year_close);

    eliminaOrdineChiuso(id_ordine, selected_year_close);

    search = $('.dataTables_filter input:eq(1)').val();            
    search2 = $('.dataTables_filter input:eq(0)').val();

    // La tabella la aggiorno solo se sono nella tab Ordini o nella tab Ordini Chiusi
    if(sidebar_attiva == "sidebar_dashboard"){
        create_data_table_ordini(0);
    }
    
    if(sidebar_attiva == "sidebar_ordini_chiusi"){
        create_data_table_ordini(1);
    }

    if(sidebar_attiva == "sidebar_dashboard" || sidebar_attiva == "sidebar_ordini_chiusi"){
        $('#search_column').val(search2);
        table_ordini.api().columns( 7 )
            .search( search2 )
            .draw();
        $('.dataTables_filter input:eq(1)').val(search);
        $('#table').dataTable().fnFilter(search);
    }
}

$(document).on("click", ".modifica_cliente", function(e){
    var $this = $(this);
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
$(document).on("click", "#conferma_modifica_cliente", function(e){
    $this = $(this);
    var id_cliente = $(this).attr('data-id');

    $("#conferma_aggiunta_cliente").prop("disabled", true);
    
    setTimeout(function() {
        modifica_cliente(id_cliente);

        $("#conferma_aggiunta_cliente").prop("disabled", false);
    }, 100);
});

function modifica_cliente(id_cliente){
    let inseribile;
    let nome = $('#nome_modifica_cliente').val();
    let num_telefono = $('#num_telefono_modifica_cliente').val();

    if(nome != ''){
        inseribile = cercaCliente(nome, num_telefono);
    
        if(inseribile){
            let where = {
                "id": parseInt(id_cliente)
            };
        
            let set = {
                "nome": nome,
                "email": num_telefono
            }

            modificaClienteFunction(where, set);
            
            create_data_table_clienti();

            popolaSelectClienti();

            $('#modifica_cliente_modal').modal('toggle');
        }else{
            $('#nome_modifica_cliente').addClass('is-invalid');
        }
    }else{
        if(nome == ''){
            $('#nome_modifica_cliente').addClass('is-invalid');
        }
    }
}