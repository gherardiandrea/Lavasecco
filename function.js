// Funzione di cambio pagina del menù e redirect
function cambiaPagina(nuova_pagina, url){
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

    html_attivo = url;

    let html = '';

    setTimeout(function (){
  
        switch(url){
            case 'ordini' : 
                // Cambio il titolo della pagina
                $('.page_title').html('Ordini');
    
                // Aggiungo il tasto per aprire la modale e la select
                html = `<button type="button" onclick="apriModaleNuovoOrdine()" class="btn btn-primary"><i class="fa-solid fa-plus-circle"></i> Ordine</button>`;
                html += `<select id="seleziona_anno" class="seleziona_anno ml-2 form-select w-auto" style="margin-left: 5px;">`;
                for (let i = actual_year; i >= 2019; i--) {
                    if(i == selected_year){
                        html += `<option value="`+i+`" selected>`+i+`</option>`;
                    }else{
                        html += `<option value="`+i+`">`+i+`</option>`;
                    }
                }
                html += ` </select>`;
                $('#div_bottone_aggiungi').html(html);
    
                // Creo la tabella degli ordini
                create_data_table_ordini(0);
    
                $('.loader').parent().addClass('d-none');
    
                break;
    
            case 'ordini_chiusi' : 
                // Cambio il titolo della pagina
                $('.page_title').html('Ordini consegnati');
    
                html = `<select id="seleziona_anno_chiuso" class="seleziona_anno ml-2 form-select w-auto">`;
                for (let i = actual_year; i >= 2019; i--) {
                    if(i == selected_year_close){
                        html += `<option value="`+i+`" selected>`+i+`</option>`;
                    }else{
                        html += `<option value="`+i+`">`+i+`</option>`;
                    }
                }
    
                $('#div_bottone_aggiungi').html(html);
    
                // Creo la tabella degli ordini
                create_data_table_ordini_chiusi(1);
    
                break;
    
            case 'prezzi' : 
                // Creo la tabella dei prezzi
                create_data_table_prezzi();
    
                // Cambio il titolo della pagina
                $('.page_title').html('Prezzi');
    
                // Aggiungo il tasto per aprire la modale
                $('#div_bottone_aggiungi').html(`<button type="button" onclick="apriModaleNuovoProdotto()" class="btn btn-primary"><i class="fa-solid fa-plus-circle"></i> Articolo</button>`);
    
                break;
    
            case 'clienti' : 
                // Creo la tabella dei clienti
                create_data_table_clienti();
    
                // Cambio il titolo della pagina
                $('.page_title').html('Clienti');
                
                // Aggiungo il tasto per aprire la modale
                $('#div_bottone_aggiungi').html(`<button type="button" onclick="apriModaleNuovoCliente()" class="btn btn-primary"><i class="fa-solid fa-plus-circle"></i> Cliente</button>`);
    
                break;
        }

        $('.loader').parent().addClass('d-none');
                  
    }, 100);
}

function inizializza_elementi(){
    // Inizializzo i DatePicker
    $('.js-datepicker').datepicker({
        format: "dd-mm-yyyy",
        weekStart: 1,
        language: 'it',
        calendarWeeks: true,
        autoclose: true,
        todayHighlight: true
    });

    // Inizializzo le select2 dei clienti
    $('.select_clienti').select2({
        dropdownParent: $('#aggiungi_ordine_modal'),
        theme: "bootstrap",
        placeholder: '',
        minimumResultsForSearch: 5,
        matcher: matchStart,
        allowClear: true
    });

    // Inizializzo le select2 dei prodotti
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

    // Inizializzo le select2 dei prodotti
    $('.select_prodotti_modifica_ordine').select2({
        dropdownParent: $('#modifica_ordine_modal'),
        theme: "bootstrap",
        placeholder: '',
        minimumResultsForSearch: 5,
        matcher: matchStart,
        allowClear: true
    });

    // Inizializzo la select2 degli anni
    /*$('.seleziona_anno').select2({
        theme: "bootstrap",
        placeholder: '',
        matcher: matchStart,
        dropdownAutoWidth: 'true',
        allowClear: true
    });*/
}

function matchStart (params, data) {
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

function formatCurrency (state) {
    if (!state.id) {
        return state.text;
    }
    var $state = $(
        '<div class="d-flex align-items-center"><i alt="" class="currency-flag currency-flag-' + state.element.value.toLowerCase() + '"></i> &nbsp; &nbsp; <b>' + state.text + '</b></div>'
    );
    return $state;
};

$(document).on('change','#seleziona_anno',function(){
    $('.loader').parent().removeClass('d-none');
    $('#table_div').empty();
    selected_year = $(this).val();

    setTimeout(function (){
        create_data_table_ordini(0);
        $('.loader').parent().addClass('d-none');
    }, 100);
});

$(document).on('change','#seleziona_anno_chiuso',function(){
    $('.loader').parent().removeClass('d-none');
    $('#table_div').empty();
    selected_year_close = $(this).val();

    setTimeout(function (){
        create_data_table_ordini_chiusi(1);
    $('.loader').parent().addClass('d-none');
    }, 100);
});