// ── Helper comuni ───────────────────────────────────────────────────────────

function nascondiErroreModale($modale) {
    $modale.find('.errore-modale').addClass('d-none').text('');
    $modale.find('.is-invalid').removeClass('is-invalid');
}

function mostraErroreModale($modale, messaggio) {
    $modale.find('.errore-modale').removeClass('d-none').text(messaggio);
}

// Esegue un'azione asincrona di una modale mostrando il loader e disabilitando il bottone.
// Se il main process rifiuta i dati evidenzia il campo indicato (campiModale: campo -> selettore input)
// e mostra il messaggio nella modale.
async function eseguiConLoader({ modale, loader = null, bottone, campi = {} }, azione) {
    const $modale = $(modale);
    nascondiErroreModale($modale);
    $(loader).removeClass('d-none');
    $(bottone).prop('disabled', true);

    try {
        await azione();
    } catch (error) {
        if (error instanceof ErroreApi && error.codice !== 'interno') {
            if (error.campo && campi[error.campo]) {
                $(campi[error.campo]).addClass('is-invalid');
            }
            mostraErroreModale($modale, error.message);
        } else {
            console.error(error);
            mostraErroreModale($modale, 'Operazione non riuscita: ' + error.message);
        }
    } finally {
        $(loader).addClass('d-none');
        $(bottone).prop('disabled', false);
    }
}

// Appena l'utente corregge un campo evidenziato, tolgo l'evidenziazione
$(document).on('input change', '.modal .is-invalid', function() {
    $(this).removeClass('is-invalid');
});

// Intero > 0 (le quantità nei form arrivano come stringhe).
function isQuantitaValida(valore) {
    return /^\d+$/.test(String(valore).trim()) && parseInt(valore, 10) > 0;
}

function impostaData(selettore, iso) {
    $(selettore).datepicker('update', isoToIt(iso));
}

function leggiData(selettore) {
    return itToIso($(selettore).val());
}

// ── Nuovo ordine ────────────────────────────────────────────────────────────

function apriModaleNuovoOrdine(){
    numero_ordini_inseriti_contemportaneamente = 1;
    $('#add_products').empty();
    nascondiErroreModale($('#aggiungi_ordine_modal'));

    $('#prodotto').val(null).trigger('change');
    $('#cliente').val(null).trigger('change');

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
    $('#aggiungi_ordine_modal').modal('hide');
});

$(document).on("click", "#conferma_aggiunta_ordine", function(){
    eseguiConLoader({
        modale: '#aggiungi_ordine_modal',
        loader: '.loader_modal',
        bottone: '#conferma_aggiunta_ordine',
        campi: { data_consegna: '#data_di_consegna', data_ritiro_prevista: '#data_di_ritiro_prevista', cliente_id: '#cliente' }
    }, aggiunta_ordine);
});

async function aggiunta_ordine(){
    const comuni = {
        data_consegna: leggiData('#data_di_consegna'),
        data_ritiro_prevista: leggiData('#data_di_ritiro_prevista'),
        cliente_id: $('#cliente').val(),
        posizione: $('#posizione').val()
    };

    // La prima riga ha id senza suffisso, le righe aggiunte hanno suffisso _2, _3, ...
    const suffissi = [''];
    for (let i = 2; i <= numero_ordini_inseriti_contemportaneamente; i++) {
        suffissi.push('_' + i);
    }

    // Controllo lato UI per evidenziare la riga giusta; il main process rivalida comunque tutto.
    let errore = false;
    $('#data_di_consegna').toggleClass('is-invalid', !comuni.data_consegna);
    $('#cliente').toggleClass('is-invalid', !comuni.cliente_id);
    errore = !comuni.data_consegna || !comuni.cliente_id;

    const righe = suffissi.map(function(s) {
        const riga = {
            ...comuni,
            prodotto_id: $('#prodotto' + s).val(),
            quantita: $('#quantita' + s).val(),
            descrizione: $('#descrizione' + s).val()
        };
        $('#prodotto' + s).toggleClass('is-invalid', !riga.prodotto_id);
        $('#quantita' + s).toggleClass('is-invalid', !isQuantitaValida(riga.quantita));
        if (!riga.prodotto_id || !isQuantitaValida(riga.quantita)) {
            errore = true;
        }
        return riga;
    });

    if (errore) {
        mostraErroreModale($('#aggiungi_ordine_modal'), 'Controlla i campi evidenziati: data di consegna, cliente, prodotto e quantità (maggiore di zero) sono obbligatori.');
        return;
    }

    await api('creaOrdini', righe);

    $('#aggiungi_ordine_modal').modal('hide');
    // I nuovi ordini sono registrati nell'anno corrente: torno a quell'anno per mostrarli
    if (sidebar_attiva == "sidebar_dashboard" && selected_year != actual_year) {
        selected_year = actual_year;
        $('#seleziona_anno').val(String(actual_year));
    }
    await ricaricaTabellaOrdini({ mantieniFiltri: false });
}

function aggiungi_nuova_riga_ordine(){
    numero_ordini_inseriti_contemportaneamente ++;
    const n = numero_ordini_inseriti_contemportaneamente;

    $('#add_products').append(`
        <div class='col-md-6 mt-2'><label class="form-label">Prodotto</label>
            <select class="select_prodotti_riga" id="prodotto_${n}">
                <option value=""></option>
            </select>
        </div>
        <div class='col-md-5 mt-2'>
            <label class="form-label">Quantità</label>
            <input type="number" min="1" step="1" class="form-control" id="quantita_${n}">
        </div>
        <div class="col-md-12 mt-2">
            <label class="form-label">Descrizione</label>
            <textarea class="form-control" rows="4" id="descrizione_${n}"></textarea>
        </div>
    `);

    const $select = $('#prodotto_' + n);
    popolaSelectProdotti($select);
    inizializzaSelect2($select, $('#add_products'));
}

$(document).on("click", "#aggiungi_prodotto_a_ordine", function(){
    aggiungi_nuova_riga_ordine();
});

// ── Clienti ─────────────────────────────────────────────────────────────────

function apriModaleNuovoCliente(){
    nascondiErroreModale($('#nuovo_cliente_modal'));
    $('#nome_nuovo_cliente').val('');
    $('#num_telefono_nuovo_cliente').val('');

    $('#nuovo_cliente_modal').modal('show');
}

async function dopoModificaClienti() {
    if (sidebar_attiva == "sidebar_clienti") {
        await create_data_table_clienti();
    }
    await popolaSelectClienti();
}

$(document).on("click", "#conferma_aggiunta_cliente", function(){
    eseguiConLoader({
        modale: '#nuovo_cliente_modal',
        bottone: '#conferma_aggiunta_cliente',
        campi: { nome: '#nome_nuovo_cliente' }
    }, async function() {
        await api('salvaCliente', { nome: $('#nome_nuovo_cliente').val(), telefono: $('#num_telefono_nuovo_cliente').val() });
        $('#nuovo_cliente_modal').modal('hide');
        await dopoModificaClienti();
    });
});

$(document).on("click", ".modifica_cliente", function(){
    nascondiErroreModale($('#modifica_cliente_modal'));
    $('#nome_modifica_cliente').val($(this).attr('data-nome'));
    $('#num_telefono_modifica_cliente').val($(this).attr('data-telefono'));
    $("#conferma_modifica_cliente").attr('data-id', $(this).attr('data-id'));

    $('#modifica_cliente_modal').modal('show');
});

$(document).on("click", "#conferma_modifica_cliente", function(){
    const id = $(this).attr('data-id');
    eseguiConLoader({
        modale: '#modifica_cliente_modal',
        bottone: '#conferma_modifica_cliente',
        campi: { nome: '#nome_modifica_cliente' }
    }, async function() {
        await api('salvaCliente', { id, nome: $('#nome_modifica_cliente').val(), telefono: $('#num_telefono_modifica_cliente').val() });
        $('#modifica_cliente_modal').modal('hide');
        await dopoModificaClienti();
    });
});

// ── Prodotti ────────────────────────────────────────────────────────────────

function apriModaleNuovoProdotto(){
    nascondiErroreModale($('#nuovo_prodotto_modal'));
    $('#descrizione_nuovo_articolo').val('');
    $('#prezzo_nuovo_articolo').val('');

    $('#nuovo_prodotto_modal').modal('show');
}

$(document).on("click", "#conferma_aggiunta_prodotto", function(){
    eseguiConLoader({
        modale: '#nuovo_prodotto_modal',
        bottone: '#conferma_aggiunta_prodotto',
        campi: { descrizione: '#descrizione_nuovo_articolo' }
    }, async function() {
        await api('salvaProdotto', { descrizione: $('#descrizione_nuovo_articolo').val(), prezzo: $('#prezzo_nuovo_articolo').val() });
        $('#nuovo_prodotto_modal').modal('hide');
        if (sidebar_attiva == "sidebar_prezzi") {
            await create_data_table_prezzi();
        }
        await popolaSelectProdotti();
    });
});

// ── Eliminazione ordine ─────────────────────────────────────────────────────

$(document).on("click", ".rimuovi_ordine", function(){
    nascondiErroreModale($('#sei_sicuro_modal'));
    $('#conferma_rimuovi_ordine').attr('data-id', $(this).attr('data-id'));
    $('#sei_sicuro_modal').modal('show');
});

$(document).on("click", "#conferma_rimuovi_ordine", function(){
    const id = $(this).attr('data-id');
    eseguiConLoader({ modale: '#sei_sicuro_modal', loader: '.loader_modal_elimina_ordine', bottone: '#conferma_rimuovi_ordine' }, async function() {
        await api('eliminaOrdine', id);
        $('#sei_sicuro_modal').modal('hide');
        await ricaricaTabellaOrdini();
    });
});

// ── Modifica ordine ─────────────────────────────────────────────────────────

$(document).on("click", ".modifica_ordine", async function(){
    try {
        await apri_modale_modifica_ordine($(this).attr('data-id'));
    } catch (error) {
        mostraErrorePagina(error);
    }
});

async function apri_modale_modifica_ordine(id_ordine){
    const ordine = await api('getOrdine', id_ordine);
    nascondiErroreModale($('#modifica_ordine_modal'));

    // Per un ordine consegnato in parte si modifica la data di ritiro effettiva, altrimenti quella prevista
    const parziale = ordine.stato === STATO.PARZIALE;
    $('#div_data_di_ritiro_prevista').toggleClass('d-none', parziale);
    $('#div_data_di_ritiro_effettiva').toggleClass('d-none', !parziale);

    impostaData('#modifica_data_di_consegna', ordine.data_consegna);
    impostaData('#modifica_data_di_ritiro_prevista', ordine.data_ritiro_prevista);
    impostaData('#modifica_data_di_ritiro_effettiva', ordine.data_ritiro_effettiva);
    $('#modifica_quantita').val(ordine.quantita);
    $('#modifica_descrizione').val(ordine.descrizione);
    $('#modifica_prodotto').val(ordine.prodotto_id).trigger('change');
    $('#modifica_cliente').val(ordine.cliente_id).trigger('change');
    $('#modifica_posizione').val(ordine.posizione);

    $('#conferma_modifica_ordine').attr('data-id', ordine.id);
    $('#modifica_ordine_modal').modal('show');
}

$(document).on("click", "#conferma_modifica_ordine", function(){
    const id = $(this).attr('data-id');
    eseguiConLoader({
        modale: '#modifica_ordine_modal',
        loader: '.loader_modal_modifica_ordine',
        bottone: '#conferma_modifica_ordine',
        campi: {
            quantita: '#modifica_quantita',
            data_consegna: '#modifica_data_di_consegna',
            data_ritiro_prevista: '#modifica_data_di_ritiro_prevista',
            data_ritiro_effettiva: '#modifica_data_di_ritiro_effettiva',
            cliente_id: '#modifica_cliente',
            prodotto_id: '#modifica_prodotto'
        }
    }, async function() {
        await api('modificaOrdine', id, {
            data_consegna: leggiData('#modifica_data_di_consegna'),
            data_ritiro_prevista: leggiData('#modifica_data_di_ritiro_prevista'),
            data_ritiro_effettiva: leggiData('#modifica_data_di_ritiro_effettiva'),
            quantita: $('#modifica_quantita').val(),
            descrizione: $('#modifica_descrizione').val(),
            prodotto_id: $('#modifica_prodotto').val(),
            cliente_id: $('#modifica_cliente').val(),
            posizione: $('#modifica_posizione').val()
        });
        $('#modifica_ordine_modal').modal('hide');
        await ricaricaTabellaOrdini();
    });
});

// ── Consegna / annullamento consegna ────────────────────────────────────────

$(document).on("click", ".consegna_articolo", function(){
    const da_consegnare = $(this).attr('data-da_consegnare');
    nascondiErroreModale($('#quantita_consegnata_modal'));

    $('#modifica_quantita_consegnata').val(da_consegnare).attr({ max: da_consegnare, min: 1 });
    $('#conferma_quantita_consegnata').attr('data-id', $(this).attr('data-id'));

    $('#quantita_consegnata_modal').modal('show');
});

$(document).on("click", "#conferma_quantita_consegnata", function(){
    const id = $(this).attr('data-id');
    eseguiConLoader({
        modale: '#quantita_consegnata_modal',
        loader: '.loader_modal_conferma_quantita_confermata',
        bottone: '#conferma_quantita_consegnata',
        campi: { quantita: '#modifica_quantita_consegnata' }
    }, async function() {
        await api('consegnaOrdine', id, $('#modifica_quantita_consegnata').val());
        $('#quantita_consegnata_modal').modal('hide');
        await ricaricaTabellaOrdini();
    });
});

$(document).on("click", ".annulla_consegna", async function(){
    const id = $(this).attr('data-id');
    const $loader = $('#loader_annulla_consegna_' + id);
    $loader.removeClass('d-none');
    $('.annulla_consegna').prop('disabled', true);
    try {
        await api('annullaConsegna', id);
        await ricaricaTabellaOrdini();
    } catch (error) {
        mostraErrorePagina(error);
    } finally {
        $loader.addClass('d-none');
        $('.annulla_consegna').prop('disabled', false);
    }
});
