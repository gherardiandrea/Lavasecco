// Variabili generali
var numero_ordini_inseriti_contemportaneamente = 0;
var sidebar_attiva = "sidebar_dashboard";
var search;
var search2;
var actual_year = new Date().getFullYear();
var selected_year = actual_year;
var selected_year_close = actual_year;
var clienti_salvati = [];
var prodotti_salvati = [];
var table_ordini, table_ordini_chiusi, table_clienti, table_prezzi;

$(document).ready(function() {
    renderToolbarOrdini();

    // Carico l'html delle modali: select e datepicker vanno inizializzati solo dopo il caricamento
    $("#modali").load("modali.html", function() {
        // Inizializzo gli elementi della pagina (DatePicker, Select2, ...)
        inizializza_elementi();

        // Popolo le select di clienti e prodotti (e le cache usate per disegnare la tabella ordini)
        popolaSelectClienti();
        popolaSelectProdotti();

        // La tabella ordini è la prima che si visualizza all'avvio dell'app
        create_data_table_ordini(0);

        $('.loader').parent().addClass('d-none');
    });
});
