// Stati di un ordine (come nel database)
const STATO = Object.freeze({ APERTO: 0, CONSEGNATO: 1, PARZIALE: 2 });

// Variabili generali
var numero_ordini_inseriti_contemportaneamente = 0;
var sidebar_attiva = "sidebar_dashboard";
var actual_year = new Date().getFullYear();
var selected_year = actual_year;
var selected_year_close = actual_year;
var clienti_salvati = [];
var prodotti_salvati = [];

function caricaModali() {
    return new Promise((resolve, reject) => {
        $("#modali").load("modali.html", (risposta, stato, xhr) => {
            if (stato === 'error') {
                reject(new Error(`Impossibile caricare le modali (${xhr.status} ${xhr.statusText})`));
            } else {
                resolve();
            }
        });
    });
}

$(document).ready(async function() {
    renderToolbarOrdini();

    try {
        // Select e datepicker vanno inizializzati solo dopo il caricamento delle modali
        await caricaModali();
        inizializza_elementi();

        await Promise.all([popolaSelectClienti(), popolaSelectProdotti()]);

        // La tabella ordini è la prima che si visualizza all'avvio dell'app
        await create_data_table_ordini('aperti');
    } catch (error) {
        mostraErrorePagina(error);
    } finally {
        mostraLoaderPagina(false);
    }
});
