// Modali: ordine (nuovo/modifica), consegna, cliente, articolo, conferma. Azioni sulle righe delle tabelle.

// ── Helper comuni ───────────────────────────────────────────────────────────

function modale(id) {
    return bootstrap.Modal.getOrCreateInstance(document.getElementById(id));
}

function nascondiErroreModale($modale) {
    $modale.find('.errore-modale').addClass('d-none').text('');
    $modale.find('.is-invalid').removeClass('is-invalid');
}

function mostraErroreModale($modale, messaggio) {
    $modale.find('.errore-modale').removeClass('d-none').text(messaggio);
}

// Esegue l'azione di una modale: pulsante in attesa, errori mostrati nella modale.
// campi: nome del campo usato dal main process -> selettore dell'input da evidenziare.
async function invia({ modale: selettore, bottone, campi = {} }, azione) {
    const $modale = $(selettore);
    const $bottone = $(bottone);
    if ($bottone.hasClass('in-corso')) return;
    nascondiErroreModale($modale);
    $bottone.addClass('in-corso').prop('disabled', true);
    try {
        await azione();
    } catch (error) {
        if (error instanceof ErroreApi && error.codice !== 'interno') {
            if (error.campo && campi[error.campo]) $(campi[error.campo]).addClass('is-invalid');
            mostraErroreModale($modale, error.message);
        } else {
            console.error(error);
            mostraErroreModale($modale, 'Operazione non riuscita: ' + error.message);
        }
    } finally {
        $bottone.removeClass('in-corso').prop('disabled', false);
    }
}

// Appena l'utente corregge un campo evidenziato, tolgo l'evidenziazione
$(document).on('input change', '.modal .is-invalid', function () {
    $(this).removeClass('is-invalid');
});

// Primo campo con il focus all'apertura
$(document).on('shown.bs.modal', '.modal', function () {
    const $primo = $(this).find('[data-focus]:visible').first();
    ($primo.length ? $primo : $(this).find('input:visible, select:visible').first()).trigger('focus');
});

function isQuantitaValida(valore, minimo = 1) {
    return /^\d+$/.test(String(valore).trim()) && parseInt(valore, 10) >= minimo;
}

// Stepper −/+ generico: il valore resta tra data-min e data-max dell'input
$(document).on('click', '.stepper [data-passo]', function () {
    const $input = $(this).siblings('input');
    const min = Number($input.attr('data-min') || 1);
    const max = Number($input.attr('data-max') || 9999);
    const valore = Math.min(max, Math.max(min, (parseInt($input.val(), 10) || 0) + Number(this.dataset.passo)));
    $input.val(valore).trigger('input');
});

// Conferma generica per le operazioni non reversibili
let azioneConferma = null;
function chiediConferma({ titolo, testo, bottone = 'Elimina', azione }) {
    azioneConferma = azione;
    nascondiErroreModale($('#modale-conferma'));
    $('#cf-titolo').text(titolo);
    $('#cf-testo').html(testo);
    $('#cf-conferma').text(bottone);
    modale('modale-conferma').show();
}

$(document).on('click', '#cf-conferma', () => {
    if (!azioneConferma) return;
    invia({ modale: '#modale-conferma', bottone: '#cf-conferma' }, async () => {
        await azioneConferma();
        modale('modale-conferma').hide();
    });
});

// ── Modale ordine (nuovo / modifica) ────────────────────────────────────────

let formOrdine = { modo: 'nuovo', originale: null, cliente: null, capi: [] };

function nuovoCapo() {
    return { prodotto_id: '', quantita: 1, descrizione: '' };
}

function impostaData(selettore, iso) {
    $(selettore).val(iso || '');
    aggiornaScorciatoie();
}

function spostaIso(iso, giorni) {
    const d = dataDaIso(iso) || dataDaIso(oggiIso());
    d.setDate(d.getDate() + giorni);
    return isoDaData(d);
}

// Evidenzia la scorciatoia corrispondente alla data scelta
function aggiornaScorciatoie() {
    $('#modale-ordine .scorciatoie').each(function () {
        const valore = $(this.dataset.per).val();
        const base = this.dataset.base === 'oggi' ? oggiIso() : $(this.dataset.base).val();
        $(this).find('button').each(function () {
            $(this).toggleClass('attivo', !!valore && spostaIso(base, Number(this.dataset.giorni)) === valore);
        });
    });
}

$(document).on('click', '#modale-ordine .scorciatoie button', function () {
    const $gruppo = $(this).closest('.scorciatoie');
    const base = $gruppo.data('base') === 'oggi' ? oggiIso() : $($gruppo.data('base')).val();
    $($gruppo.data('per')).val(spostaIso(base, Number(this.dataset.giorni))).trigger('input');
});

$(document).on('input change', '#or-data-consegna, #or-data-ritiro, #or-data-ritiro-effettivo, #or-posizione', () => {
    aggiornaScorciatoie();
    aggiornaRicevuta();
});

function apriNuovoOrdine() {
    formOrdine = { modo: 'nuovo', originale: null, cliente: null, capi: [nuovoCapo()] };
    nascondiErroreModale($('#modale-ordine'));
    $('#or-titolo').text('Nuovo ordine');
    $('#or-registra-testo').text('Registra ordine');
    $('#or-r-numero').text('Nuovo');
    $('#or-aggiungi-capo').removeClass('d-none');
    $('#or-elimina').addClass('d-none');
    $('#or-box-ritiro-effettivo').addClass('d-none');
    impostaData('#or-data-consegna', oggiIso());
    impostaData('#or-data-ritiro', oggiIso(3));
    impostaData('#or-data-ritiro-effettivo', '');
    $('#or-posizione').val('');
    scegliCliente(null);
    disegnaCapi();
    modale('modale-ordine').show();
}

async function apriModificaOrdine(id) {
    const o = await api('getOrdine', id);
    formOrdine = {
        modo: 'modifica',
        originale: o,
        cliente: { id: o.cliente_id, nome: o.cliente_nome, telefono: o.cliente_telefono },
        capi: [{ prodotto_id: o.prodotto_id, quantita: o.quantita, descrizione: o.descrizione }]
    };
    nascondiErroreModale($('#modale-ordine'));
    $('#or-titolo').text('Modifica ordine');
    $('#or-registra-testo').text('Salva modifiche');
    $('#or-r-numero').text('N° ' + numeroOrdine(o.id));
    $('#or-aggiungi-capo').addClass('d-none');
    $('#or-elimina').removeClass('d-none');
    // La data dell'ultima consegna si corregge solo per gli ordini consegnati in parte
    $('#or-box-ritiro-effettivo').toggleClass('d-none', o.stato !== STATO.PARZIALE);
    impostaData('#or-data-consegna', o.data_consegna);
    impostaData('#or-data-ritiro', o.data_ritiro_prevista);
    impostaData('#or-data-ritiro-effettivo', o.data_ritiro_effettiva);
    $('#or-posizione').val(o.posizione);
    scegliCliente(formOrdine.cliente);
    disegnaCapi();
    modale('modale-ordine').show();
}

$('#btn-nuovo-ordine').on('click', () => apriNuovoOrdine());

// Prezzo di un capo per la ricevuta: in modifica, se il prodotto non cambia, vale il prezzo salvato nell'ordine
function prezzoCapo(capo) {
    const o = formOrdine.originale;
    if (o && Number(capo.prodotto_id) === o.prodotto_id) {
        return { cent: o.prezzo_unitario_cent, nota: o.nota_prezzo };
    }
    const p = stato.prodotti.find((x) => x.id === Number(capo.prodotto_id));
    return p ? { cent: p.prezzo_cent, nota: p.nota_prezzo } : null;
}

function quantitaMinima() {
    return formOrdine.originale ? Math.max(1, formOrdine.originale.quantita_consegnata) : 1;
}

function disegnaCapi() {
    const minimo = quantitaMinima();
    const rimovibili = formOrdine.modo === 'nuovo' && formOrdine.capi.length > 1;
    $('#or-capi').html(formOrdine.capi.map((c, i) => `
        <div class="capo" data-i="${i}">
            <select class="input" data-campo="prodotto_id" aria-label="Capo">
                <option value="">Scegli un capo…</option>
                ${stato.prodotti.map((p) => `<option value="${p.id}"${p.id === Number(c.prodotto_id) ? ' selected' : ''}>${escapeHtml(p.descrizione)} — ${escapeHtml(testoPrezzo(p))}</option>`).join('')}
            </select>
            <div class="stepper">
                <button type="button" data-passo="-1" aria-label="Uno in meno">−</button>
                <input class="num" data-campo="quantita" value="${c.quantita}" data-min="${minimo}" inputmode="numeric" aria-label="Quantità">
                <button type="button" data-passo="1" aria-label="Uno in più">+</button>
            </div>
            <input class="input" data-campo="descrizione" placeholder="Note (colore, macchie…)" value="${escapeHtml(c.descrizione)}" autocomplete="off">
            ${rimovibili ? '<button type="button" class="rimuovi" title="Togli questo capo" aria-label="Togli"><i class="fa-solid fa-trash-can"></i></button>' : '<span></span>'}
        </div>`).join(''));
    aggiornaRicevuta();
}

$(document).on('input change', '#or-capi [data-campo]', function () {
    const i = Number($(this).closest('.capo').data('i'));
    formOrdine.capi[i][this.dataset.campo] = this.value;
    aggiornaRicevuta();
});

$(document).on('click', '#or-capi .rimuovi', function () {
    formOrdine.capi.splice(Number($(this).closest('.capo').data('i')), 1);
    disegnaCapi();
});

$(document).on('click', '#or-aggiungi-capo', () => {
    formOrdine.capi.push(nuovoCapo());
    disegnaCapi();
    $('#or-capi .capo:last-child select').trigger('focus');
});

function aggiornaRicevuta() {
    let totale = 0;
    const daDefinire = [];
    let capiTotali = 0;
    const voci = formOrdine.capi.map((c) => {
        const p = stato.prodotti.find((x) => x.id === Number(c.prodotto_id));
        if (!p) return '';
        const q = Math.max(0, parseInt(c.quantita, 10) || 0);
        capiTotali += q;
        const prezzo = prezzoCapo(c);
        let importo;
        if (prezzo.cent == null) {
            daDefinire.push(`${p.descrizione} (${prezzo.nota || 'a vista'})`);
            importo = escapeHtml(prezzo.nota || 'a vista');
        } else {
            totale += prezzo.cent * q;
            importo = formatEuro(prezzo.cent * q);
        }
        return `<div class="voce"><span>${q} × ${escapeHtml(p.descrizione)}</span><span class="num">${importo}</span></div>`;
    }).join('');

    $('#or-r-voci').html(voci || '<div class="vuoto">Scegli almeno un capo</div>');
    $('#or-r-totale').text(formatEuro(totale));
    $('#or-r-nota').text(daDefinire.length ? `+ ${daDefinire.join(', ')}: prezzo da definire` : '');
    $('#or-n-capi').text(capiTotali ? plurale(capiTotali, 'capo', 'capi') : '');
    $('#or-r-cliente').text(formOrdine.cliente ? formOrdine.cliente.nome : '—');
    $('#or-r-consegna').text(dataBreve($('#or-data-consegna').val()) || '—');
    $('#or-r-ritiro').text(dataBreve($('#or-data-ritiro').val()) || '—');
    $('#or-r-posizione').text($('#or-posizione').val().trim() || '—');
}

// ── Scelta del cliente (ricerca nel database mentre si scrive) ──────────────

let ricercaClienti = { seq: 0, termine: '', risultati: [], selezionato: 0 };

function scegliCliente(cliente) {
    formOrdine.cliente = cliente;
    $('#or-risultati').removeClass('aperti').empty();
    if (!cliente) {
        $('#or-cliente-scelto').removeClass('visibile');
        $('#or-cliente-input').removeClass('d-none').val('');
    } else {
        $('#or-cliente-input').addClass('d-none');
        $('#or-avatar').text(iniziali(cliente.nome));
        $('#or-cliente-nome').text(cliente.nome);
        const info = [cliente.telefono || 'nessun telefono'];
        if (cliente.ordini_aperti) info.push(`${plurale(cliente.ordini_aperti, 'ordine aperto', 'ordini aperti')}`);
        $('#or-cliente-info').text(info.join(' · '));
        $('#or-cliente-scelto').addClass('visibile');
    }
    aggiornaRicevuta();
}

function disegnaRisultatiClienti() {
    const { termine, risultati, selezionato } = ricercaClienti;
    const voci = risultati.map((c, i) => `
        <div class="voce-cliente${i === selezionato ? ' sel' : ''}" data-i="${i}" role="option">
            <span>${evidenzia(c.nome, termine)}</span>
            <small>${evidenzia(c.telefono || '', termine)}${c.ordini_aperti ? `<em>${plurale(c.ordini_aperti, 'aperto', 'aperti')}</em>` : ''}</small>
        </div>`).join('');
    $('#or-risultati').html(voci + `
        <div class="voce-cliente nuovo${selezionato === risultati.length ? ' sel' : ''}" data-nuovo role="option">
            <span><i class="fa-solid fa-user-plus"></i> Nuovo cliente “${escapeHtml(termine)}”</span>
        </div>`).addClass('aperti');
}

const cercaClientiInModale = debounce(async (termine) => {
    const seq = ++ricercaClienti.seq;
    try {
        const risultati = await api('cercaClienti', termine);
        // Arrivano risposte fuori ordine? Tengo solo l'ultima ricerca
        if (seq !== ricercaClienti.seq || $('#or-cliente-input').val().trim() !== termine) return;
        ricercaClienti = { ...ricercaClienti, termine, risultati, selezionato: 0 };
        disegnaRisultatiClienti();
    } catch (error) {
        mostraErrore(error);
    }
}, 120);

$(document).on('input', '#or-cliente-input', function () {
    const termine = this.value.trim();
    if (!termine) {
        ricercaClienti.seq++;
        $('#or-risultati').removeClass('aperti').empty();
        return;
    }
    cercaClientiInModale(termine);
});

$(document).on('keydown', '#or-cliente-input', function (e) {
    const aperti = $('#or-risultati').hasClass('aperti');
    if (!aperti) return;
    const ultimo = ricercaClienti.risultati.length; // l'indice "Nuovo cliente"
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const passo = e.key === 'ArrowDown' ? 1 : -1;
        ricercaClienti.selezionato = (ricercaClienti.selezionato + passo + ultimo + 1) % (ultimo + 1);
        disegnaRisultatiClienti();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (ricercaClienti.selezionato === ultimo) mostraNuovoClienteRapido();
        else scegliCliente(ricercaClienti.risultati[ricercaClienti.selezionato]);
    } else if (e.key === 'Escape') {
        // Chiude solo l'elenco, non la modale
        e.stopPropagation();
        $('#or-risultati').removeClass('aperti');
    }
});

// mousedown (non click) così il campo non perde il focus prima della scelta
$(document).on('mousedown', '#or-risultati .voce-cliente', function (e) {
    e.preventDefault();
    if (this.hasAttribute('data-nuovo')) mostraNuovoClienteRapido();
    else scegliCliente(ricercaClienti.risultati[Number(this.dataset.i)]);
});

// Uscendo dal campo l'elenco si chiude, a meno che il focus sia passato al mini-form "Nuovo cliente"
$(document).on('blur', '#or-cliente-input', () => {
    setTimeout(() => {
        if (!$('#or-risultati').find(':focus').length) $('#or-risultati').removeClass('aperti');
    }, 150);
});

$(document).on('click', '#or-cliente-cambia', () => {
    scegliCliente(null);
    $('#or-cliente-input').trigger('focus');
});

// Nuovo cliente senza uscire dall'ordine
function mostraNuovoClienteRapido() {
    const nome = $('#or-cliente-input').val().trim();
    $('#or-risultati').html(`
        <div class="nuovo-cliente-rapido">
            <b>Nuovo cliente</b>
            <div class="riga-2">
                <input class="input" id="or-nuovo-nome" value="${escapeHtml(nome)}" placeholder="Nome e cognome" autocomplete="off">
                <input class="input" id="or-nuovo-telefono" placeholder="Telefono (facoltativo)" inputmode="tel" autocomplete="off">
            </div>
            <div class="azioni-rapide">
                <button type="button" class="btn-app btn-trasparente compatto" id="or-nuovo-annulla">Annulla</button>
                <button type="button" class="btn-app btn-primario compatto" id="or-nuovo-crea"><i class="fa-solid fa-check"></i> Crea e usa</button>
            </div>
        </div>`).addClass('aperti');
    $('#or-nuovo-telefono').trigger('focus');
}

$(document).on('keydown', '#or-nuovo-nome, #or-nuovo-telefono', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('#or-nuovo-crea').trigger('click'); }
    if (e.key === 'Escape') { e.stopPropagation(); $('#or-nuovo-annulla').trigger('click'); }
});

$(document).on('click', '#or-nuovo-annulla', () => {
    $('#or-risultati').removeClass('aperti').empty();
    $('#or-cliente-input').trigger('focus');
});

$(document).on('click', '#or-nuovo-crea', () => {
    invia({ modale: '#modale-ordine', bottone: '#or-nuovo-crea', campi: { nome: '#or-nuovo-nome' } }, async () => {
        const nome = $('#or-nuovo-nome').val().trim();
        const telefono = $('#or-nuovo-telefono').val().trim();
        const id = await api('salvaCliente', { nome, telefono });
        scegliCliente({ id, nome, telefono, ordini_aperti: 0 });
        toast(`Cliente <b>${escapeHtml(nome)}</b> creato`);
        $('#or-capi .capo:first-child select').trigger('focus');
    });
});

// ── Registrazione dell'ordine ───────────────────────────────────────────────

function validaFormOrdine() {
    const errori = [];
    if (!formOrdine.cliente) {
        $('#or-cliente-input').addClass('is-invalid');
        errori.push('il cliente');
    }
    if (!$('#or-data-consegna').val()) {
        $('#or-data-consegna').addClass('is-invalid');
        errori.push('la data in cui è stato lasciato');
    }
    const minimo = quantitaMinima();
    let capiNonValidi = !formOrdine.capi.length;
    $('#or-capi .capo').each(function (i) {
        const c = formOrdine.capi[i];
        const prodottoOk = !!c.prodotto_id;
        const quantitaOk = isQuantitaValida(c.quantita, minimo);
        $(this).find('select').toggleClass('is-invalid', !prodottoOk);
        $(this).find('.stepper').toggleClass('is-invalid', !quantitaOk);
        if (!prodottoOk || !quantitaOk) capiNonValidi = true;
    });
    if (capiNonValidi) {
        errori.push(minimo > 1 ? `capo e quantità (almeno ${minimo}, già consegnati)` : 'capo e quantità di ogni riga');
    }
    return errori;
}

async function registraOrdine() {
    const $m = $('#modale-ordine');
    await invia({
        modale: '#modale-ordine',
        bottone: '#or-registra',
        campi: {
            cliente_id: '#or-cliente-input',
            data_consegna: '#or-data-consegna',
            data_ritiro_prevista: '#or-data-ritiro',
            data_ritiro_effettiva: '#or-data-ritiro-effettivo',
            quantita: '#or-capi .capo:first-child .stepper',
            prodotto_id: '#or-capi .capo:first-child select'
        }
    }, async () => {
        const errori = validaFormOrdine();
        if (errori.length) {
            mostraErroreModale($m, `Controlla ${errori.join(', ')}.`);
            return;
        }
        const comuni = {
            cliente_id: formOrdine.cliente.id,
            data_consegna: $('#or-data-consegna').val(),
            data_ritiro_prevista: $('#or-data-ritiro').val(),
            posizione: $('#or-posizione').val()
        };

        if (formOrdine.modo === 'nuovo') {
            const ids = await api('creaOrdini', formOrdine.capi.map((c) => ({ ...comuni, prodotto_id: c.prodotto_id, quantita: c.quantita, descrizione: c.descrizione })));
            modale('modale-ordine').hide();
            const ordini = await Promise.all(ids.map((id) => api('getOrdine', id)));
            ordini.forEach(aggiornaRigaOrdine);
            const capi = formOrdine.capi.reduce((s, c) => s + Number(c.quantita), 0);
            toast(`Ordine registrato per <b>${escapeHtml(formOrdine.cliente.nome)}</b> · ${plurale(capi, 'capo', 'capi')}`);
        } else {
            const [c] = formOrdine.capi;
            const ordine = await api('modificaOrdine', formOrdine.originale.id, {
                ...comuni,
                prodotto_id: c.prodotto_id,
                quantita: c.quantita,
                descrizione: c.descrizione,
                data_ritiro_effettiva: $('#or-data-ritiro-effettivo').val() || formOrdine.originale.data_ritiro_effettiva
            });
            modale('modale-ordine').hide();
            aggiornaRigaOrdine(ordine);
            toast(`Ordine <b>${numeroOrdine(ordine.id)}</b> aggiornato`);
        }
        aggiornaRiepilogo();
    });
}

$(document).on('click', '#or-registra', registraOrdine);
$(document).on('keydown', '#modale-ordine', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        registraOrdine();
    }
});

$(document).on('click', '[data-azione="modifica-ordine"]', function () {
    apriModificaOrdine(this.dataset.id).catch(mostraErrore);
});

// ── Consegna ────────────────────────────────────────────────────────────────

function statoConsegna(o) {
    return { stato: o.stato, quantita_consegnata: o.quantita_consegnata, data_ritiro_effettiva: o.data_ritiro_effettiva };
}

// Ordine aggiornato: riga della tabella, pagina "Oggi" e contatori
function applicaOrdine(ordine) {
    aggiornaRigaOrdine(ordine);
    aggiornaRiepilogo();
}

// Registra la consegna e offre "Annulla" (riporta l'ordine esattamente com'era, anche se era parziale)
async function eseguiConsegna(id, quantita) {
    const prima = await api('getOrdine', id);
    const dopo = await api('consegnaOrdine', id, quantita);
    applicaOrdine(dopo);

    const chi = `<b>${escapeHtml(dopo.cliente_nome)}</b>`;
    const resto = dopo.quantita - dopo.quantita_consegnata;
    const testo = dopo.stato === STATO.CONSEGNATO
        ? `${chi} · ordine ${numeroOrdine(dopo.id)} consegnato`
        : `${chi} · ${plurale(Number(quantita), 'capo consegnato', 'capi consegnati')}, ${resto === 1 ? 'ne resta 1' : `ne restano ${resto}`}`;
    toast(testo, {
        annulla: async () => {
            applicaOrdine(await api('ripristinaConsegna', id, statoConsegna(prima)));
            toast('Consegna annullata');
        }
    });
}

let consegnaInCorso = null;

$(document).on('click', '[data-azione="consegna"]', async function () {
    const id = this.dataset.id;
    const resto = Number(this.dataset.resto);
    if (resto > 1) {
        try {
            const o = await api('getOrdine', id);
            consegnaInCorso = o;
            nascondiErroreModale($('#modale-consegna'));
            $('#cons-titolo').text(`Consegna · ordine ${numeroOrdine(o.id)}`);
            $('#cons-info').html(`<b>${escapeHtml(o.cliente_nome)}</b> · ${escapeHtml(o.prodotto_descrizione)}${o.posizione ? ` · <span class="pos"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(o.posizione)}</span>` : ''}`);
            $('#cons-quantita').val(resto).attr({ 'data-min': 1, 'data-max': resto });
            $('#cons-di').text(`di ${resto} da consegnare`);
            $('#cons-tutti').text(`Tutti (${resto})`);
            modale('modale-consegna').show();
        } catch (error) {
            mostraErrore(error);
        }
        return;
    }
    // Un solo capo: consegna subito, con "Annulla" nel messaggio
    const $b = $(this).prop('disabled', true);
    try {
        await eseguiConsegna(id, 1);
    } catch (error) {
        mostraErrore(error);
        $b.prop('disabled', false);
    }
});

$(document).on('click', '#cons-tutti', () => {
    $('#cons-quantita').val($('#cons-quantita').attr('data-max'));
});

$(document).on('keydown', '#cons-quantita', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('#cons-conferma').trigger('click'); }
});

$(document).on('click', '#cons-conferma', () => {
    invia({ modale: '#modale-consegna', bottone: '#cons-conferma', campi: { quantita: '#cons-quantita' } }, async () => {
        const quantita = $('#cons-quantita').val();
        if (!isQuantitaValida(quantita)) {
            $('#cons-quantita').closest('.stepper').addClass('is-invalid');
            mostraErroreModale($('#modale-consegna'), 'Indica quanti capi vengono consegnati (almeno 1).');
            return;
        }
        await eseguiConsegna(consegnaInCorso.id, quantita);
        modale('modale-consegna').hide();
    });
});

$(document).on('click', '[data-azione="annulla-consegna"]', async function () {
    const id = this.dataset.id;
    const $b = $(this).prop('disabled', true);
    try {
        const prima = await api('getOrdine', id);
        applicaOrdine(await api('annullaConsegna', id));
        toast(`<b>${escapeHtml(prima.cliente_nome)}</b> · ordine ${numeroOrdine(prima.id)} di nuovo da consegnare`, {
            annulla: async () => {
                applicaOrdine(await api('ripristinaConsegna', id, statoConsegna(prima)));
            }
        });
    } catch (error) {
        mostraErrore(error);
        $b.prop('disabled', false);
    }
});

function confermaEliminaOrdine(o) {
    const id = o.id;
    const descrizione = ` di <b>${escapeHtml(o.cliente_nome)}</b> (${escapeHtml(o.prodotto_descrizione)})`;
    chiediConferma({
        titolo: `Eliminare l'ordine ${numeroOrdine(id)}?`,
        testo: `L'ordine${descrizione} verrà eliminato definitivamente.`,
        bottone: 'Elimina ordine',
        azione: async () => {
            await api('eliminaOrdine', id);
            rimuoviRigaOrdine(id);
            aggiornaRiepilogo();
            toast(`Ordine ${numeroOrdine(id)} eliminato`);
        }
    });
}

// Dalla tabella "Consegnati"
$(document).on('click', '[data-azione="elimina-ordine"]', function () {
    const o = datiRiga('tr_', this.dataset.id);
    if (o) confermaEliminaOrdine(o);
});

// Dalla modale di modifica: chiudo la modale e chiedo conferma
$(document).on('click', '#or-elimina', () => {
    const o = formOrdine.originale;
    $('#modale-ordine').one('hidden.bs.modal', () => confermaEliminaOrdine(o));
    modale('modale-ordine').hide();
});

// ── Clienti ─────────────────────────────────────────────────────────────────

let clienteInModifica = null;

function apriModaleCliente(cliente = null) {
    clienteInModifica = cliente;
    nascondiErroreModale($('#modale-cliente'));
    $('#cl-titolo').text(cliente ? 'Modifica cliente' : 'Nuovo cliente');
    $('#cl-nome').val(cliente ? cliente.nome : '');
    $('#cl-telefono').val(cliente ? cliente.telefono : '');
    modale('modale-cliente').show();
}

$(document).on('click', '[data-azione="nuovo-cliente"]', () => apriModaleCliente());
$(document).on('click', '[data-azione="modifica-cliente"]', function () {
    apriModaleCliente(datiRiga('cliente_', this.dataset.id));
});

$(document).on('keydown', '#cl-nome, #cl-telefono', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('#cl-salva').trigger('click'); }
});

$(document).on('click', '#cl-salva', () => {
    invia({ modale: '#modale-cliente', bottone: '#cl-salva', campi: { nome: '#cl-nome' } }, async () => {
        const nome = $('#cl-nome').val().trim();
        const telefono = $('#cl-telefono').val().trim();
        const id = await api('salvaCliente', { id: clienteInModifica ? clienteInModifica.id : null, nome, telefono });
        modale('modale-cliente').hide();
        aggiornaRigaCliente({ id, nome, telefono, ordini_aperti: clienteInModifica ? clienteInModifica.ordini_aperti : 0 });
        toast(`Cliente <b>${escapeHtml(nome)}</b> ${clienteInModifica ? 'aggiornato' : 'creato'}`);
    });
});

// ── Listino ─────────────────────────────────────────────────────────────────

let articoloInModifica = null;

function apriModaleArticolo(articolo = null) {
    articoloInModifica = articolo;
    nascondiErroreModale($('#modale-articolo'));
    $('#ar-titolo').text(articolo ? 'Modifica articolo' : 'Nuovo articolo');
    $('#ar-descrizione').val(articolo ? articolo.descrizione : '');
    $('#ar-prezzo').val(articolo ? prezzoPerInput(articolo) : '');
    $('#ar-nota-modifica').toggleClass('d-none', !articolo);
    modale('modale-articolo').show();
}

// Dopo una modifica del listino: tabella (se aperta, mantenendo la ricerca) e scelte nel nuovo ordine
async function ricaricaListino() {
    if (tabellaAttiva === 'listino') {
        await creaTabellaListino();
        tabellaCorrente().search($('#cerca-globale').val()).draw();
    } else {
        stato.prodotti = await api('getProdotti');
    }
}

$(document).on('click', '[data-azione="nuovo-articolo"]', () => apriModaleArticolo());
$(document).on('click', '[data-azione="modifica-articolo"]', function () {
    apriModaleArticolo(datiRiga('articolo_', this.dataset.id));
});

$(document).on('keydown', '#ar-descrizione, #ar-prezzo', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('#ar-salva').trigger('click'); }
});

$(document).on('click', '#ar-salva', () => {
    invia({ modale: '#modale-articolo', bottone: '#ar-salva', campi: { descrizione: '#ar-descrizione' } }, async () => {
        const descrizione = $('#ar-descrizione').val().trim();
        await api('salvaProdotto', { id: articoloInModifica ? articoloInModifica.id : null, descrizione, prezzo: $('#ar-prezzo').val() });
        modale('modale-articolo').hide();
        await ricaricaListino();
        toast(`Articolo <b>${escapeHtml(descrizione)}</b> ${articoloInModifica ? 'aggiornato' : 'aggiunto al listino'}`);
    });
});

$(document).on('click', '[data-azione="elimina-articolo"]', function () {
    const articolo = datiRiga('articolo_', this.dataset.id);
    chiediConferma({
        titolo: 'Eliminare l\'articolo?',
        testo: `<b>${escapeHtml(articolo.descrizione)}</b> verrà tolto dal listino.`,
        bottone: 'Elimina articolo',
        azione: async () => {
            await api('eliminaProdotto', articolo.id);
            await ricaricaListino();
            toast(`Articolo <b>${escapeHtml(articolo.descrizione)}</b> eliminato`);
        }
    });
});
