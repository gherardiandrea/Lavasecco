// Navigazione tra le pagine, pagina "Oggi", ricerca, contatori e stato del backup.

const PAGINE = {
    oggi: { vista: 'oggi', cerca: 'Cerca negli ordini da consegnare…' },
    aperti: {
        vista: 'tabella',
        titolo: 'Da consegnare',
        sottotitolo: () => 'Ordini aperti di tutti gli anni.',
        cerca: 'Cerca cliente, telefono, capo, posizione o data…',
        barra: () => `
            <button type="button" class="chip" data-filtro="tutti">Tutti <span class="n" id="conteggio-tutti"></span></button>
            <button type="button" class="chip" data-filtro="oggi">Ritiro oggi <span class="n" id="conteggio-oggi"></span></button>
            <button type="button" class="chip coral" data-filtro="ritardo">In ritardo <span class="n" id="conteggio-ritardo"></span></button>
            <button type="button" class="chip" data-filtro="parziali">Consegnati in parte <span class="n" id="conteggio-parziali"></span></button>`,
        carica: () => creaTabellaOrdini('aperti')
    },
    consegnati: {
        vista: 'tabella',
        titolo: 'Consegnati',
        sottotitolo: () => `Ordini consegnati registrati nel ${stato.annoConsegnati}.`,
        cerca: 'Cerca tra i consegnati…',
        barra: () => {
            let opzioni = '';
            for (let anno = new Date().getFullYear(); anno >= 2019; anno--) {
                opzioni += `<option value="${anno}"${anno == stato.annoConsegnati ? ' selected' : ''}>${anno}</option>`;
            }
            return `<label class="scelta-anno"><i class="fa-regular fa-calendar"></i> Anno <select id="seleziona-anno">${opzioni}</select></label>`;
        },
        carica: () => creaTabellaOrdini('consegnati')
    },
    clienti: {
        vista: 'tabella',
        titolo: 'Clienti',
        sottotitolo: () => 'Nome, telefono e ordini ancora da consegnare.',
        cerca: 'Cerca per nome o telefono…',
        barra: () => `<button type="button" class="btn-app btn-neutro spinto-destra" data-azione="nuovo-cliente"><i class="fa-solid fa-user-plus"></i> Nuovo cliente</button>`,
        carica: creaTabellaClienti
    },
    listino: {
        vista: 'tabella',
        titolo: 'Listino',
        sottotitolo: () => 'I nuovi prezzi valgono per gli ordini inseriti da ora in poi.',
        cerca: 'Cerca un articolo…',
        barra: () => `<button type="button" class="btn-app btn-neutro spinto-destra" data-azione="nuovo-articolo"><i class="fa-solid fa-plus"></i> Nuovo articolo</button>`,
        carica: creaTabellaListino
    }
};

async function vaiA(nome, { filtro = null, ricerca = '' } = {}) {
    const pagina = PAGINE[nome];
    if (!pagina) return;
    stato.pagina = nome;

    $('.nav a').each(function () { $(this).toggleClass('attivo', this.dataset.pagina === nome); });
    $('.vista').removeClass('attiva');
    $(`#vista-${pagina.vista}`).addClass('attiva');
    $('#cerca-globale').attr('placeholder', pagina.cerca).val(ricerca);
    $('#contenuto').scrollTop(0);

    if (pagina.vista === 'oggi') {
        distruggiTabella();
        await caricaOggi();
        return;
    }

    $('#titolo-pagina').text(pagina.titolo);
    $('#sottotitolo-pagina').text(pagina.sottotitolo());
    $('#barra-filtri').html(pagina.barra());
    if (nome === 'aperti') impostaFiltroRapido(filtro || 'tutti');

    try {
        await pagina.carica();
        if (nome === 'aperti') impostaFiltroRapido(filtro || 'tutti');
        if (ricerca) tabellaCorrente().search(ricerca).draw();
    } catch (error) {
        distruggiTabella();
        mostraErrore(error);
    }
}

$(document).on('click', '.nav a', function (e) {
    e.preventDefault();
    vaiA(this.dataset.pagina);
});

$(document).on('click', '#barra-filtri .chip[data-filtro]', function () {
    impostaFiltroRapido(this.dataset.filtro);
});

$(document).on('change', '#seleziona-anno', function () {
    stato.annoConsegnati = Number(this.value);
    $('#sottotitolo-pagina').text(PAGINE.consegnati.sottotitolo());
    creaTabellaOrdini('consegnati').catch(mostraErrore);
});

// Riquadri e link della pagina "Oggi" aprono "Da consegnare" già filtrato
$(document).on('click', '.kpi[data-filtro]', function () { vaiA('aperti', { filtro: this.dataset.filtro }); });
$(document).on('click', '[data-vai-filtro]', function (e) {
    e.preventDefault();
    vaiA('aperti', { filtro: this.dataset.vaiFiltro });
});

// ── Ricerca nella barra in alto ─────────────────────────────────────────────

const cercaNellaTabella = debounce((testo) => {
    const dt = tabellaCorrente();
    if (dt) dt.search(testo).draw();
}, 120);

$('#cerca-globale').on('input', function () {
    // Dalla pagina "Oggi" la ricerca porta agli ordini da consegnare
    if (stato.pagina === 'oggi') {
        vaiA('aperti', { ricerca: this.value });
        return;
    }
    cercaNellaTabella(this.value);
});

$('#cerca-globale').on('keydown', function (e) {
    if (e.key === 'Escape') {
        this.value = '';
        cercaNellaTabella('');
        this.blur();
    }
});

// ── Pagina "Oggi" ───────────────────────────────────────────────────────────

function disegnaOggi(r) {
    $('#saluto').text(saluto());
    const partiSottotitolo = [
        r.daRitirare.ordini ? `${plurale(r.daRitirare.ordini, 'ritiro previsto', 'ritiri previsti')} oggi` : 'Nessun ritiro previsto oggi',
        r.inRitardo.ordini ? `${r.inRitardo.ordini} in ritardo` : 'nessun ritardo'
    ];
    $('#oggi-sottotitolo').text(partiSottotitolo.join(', ') + '.');

    $('#kpi-oggi').text(r.daRitirare.ordini);
    $('#kpi-oggi-nota').text(r.daRitirare.ordini ? plurale(r.daRitirare.capi, 'capo', 'capi') : 'niente in programma');
    $('#kpi-ritardo').text(r.inRitardo.ordini);
    $('#kpi-ritardo-nota').text(r.inRitardo.ordini ? `il più vecchio: ${dataBreve(r.inRitardo.piu_vecchio)}` : 'tutto in regola');
    $('#kpi-aperti').text(r.aperti.toLocaleString('it-IT'));
    $('#kpi-incasso').text(formatEuro(r.consegnatiOggi.cent));
    $('#kpi-incasso-nota').text(`${plurale(r.consegnatiOggi.ordini, 'ordine', 'ordini')} · ieri ${formatEuro(r.consegnatiIeri.cent)}`);

    $('#lista-ritiri-oggi').html(r.ritiriOggi.length
        ? r.ritiriOggi.map(htmlRitiroOggi).join('')
        : '<div class="vuoto-pannello"><i class="fa-regular fa-calendar-check"></i>Nessun ritiro previsto per oggi.</div>');
    $('#lista-ritardi').html(r.ritardiRecenti.length
        ? r.ritardiRecenti.map(htmlRitardo).join('')
        : '<div class="vuoto-pannello"><i class="fa-regular fa-face-smile"></i>Nessun ordine in ritardo.</div>');

    const massimo = Math.max(1, ...r.settimana.map((g) => g.ordini));
    $('#barre-settimana').html(r.settimana.map((g) => {
        const d = dataDaIso(g.data);
        const eOggi = g.data === r.oggi;
        return `<div class="barra${eOggi ? ' oggi' : ''}" title="${escapeHtml(dataBreve(g.data))}: ${plurale(g.ordini, 'consegna', 'consegne')}">
            <em class="num">${g.ordini || ''}</em><div data-altezza="${Math.max(4, g.ordini / massimo * 72)}"></div><span>${GIORNI[d.getDay()]}</span></div>`;
    }).join(''));
    // Le barre crescono con un'animazione
    requestAnimationFrame(() => $('#barre-settimana .barra div').each(function () { this.style.height = this.dataset.altezza + 'px'; }));

    aggiornaContatoriNav(r);
}

async function caricaOggi() {
    try {
        disegnaOggi(await api('riepilogoOggi'));
    } catch (error) {
        mostraErrore(error);
    }
}

// ── Contatori nella barra laterale ──────────────────────────────────────────

function aggiornaContatoriNav(r) {
    $('#conta-aperti').text(r.aperti.toLocaleString('it-IT')).toggleClass('d-none', !r.aperti);
    $('#conta-ritardo').text(r.inRitardo.ordini).toggleClass('d-none', !r.inRitardo.ordini);
}

// Dopo un'azione su un ordine: aggiorna la pagina "Oggi" (se aperta) o solo i contatori
const aggiornaRiepilogo = debounce(async () => {
    try {
        const r = await api('riepilogoOggi');
        if (stato.pagina === 'oggi') disegnaOggi(r);
        else aggiornaContatoriNav(r);
    } catch (error) {
        mostraErrore(error);
    }
}, 150);

// ── Backup ──────────────────────────────────────────────────────────────────

async function aggiornaStatoBackup() {
    try {
        const { ultimo } = await api('getInfoBackup');
        const $box = $('#stato-backup').removeClass('ok avviso errore');
        if (!ultimo) {
            $box.addClass('errore');
            $('#backup-titolo').text('Nessun backup');
            $('#backup-dettaglio').text('clicca per esportarne uno');
            return;
        }
        // "2026-09-24" (solo data) oppure data e ora ISO
        const quando = ultimo.length > 10 ? new Date(ultimo) : dataDaIso(ultimo);
        const giorni = -giorniDaOggi(isoDaData(quando));
        const ora = ultimo.length > 10 ? ` alle ${String(quando.getHours()).padStart(2, '0')}:${String(quando.getMinutes()).padStart(2, '0')}` : '';
        $box.addClass(giorni <= 1 ? 'ok' : 'avviso');
        $('#backup-titolo').text(giorni <= 1 ? 'Backup ok' : 'Backup da aggiornare');
        $('#backup-dettaglio').text(giorni === 0 ? `Oggi${ora}` : giorni === 1 ? `Ieri${ora}` : `${giorni} giorni fa`);
    } catch (error) {
        console.error(error);
    }
}

$('#stato-backup').on('click', async () => {
    try {
        const esito = await esportaBackup();
        if (esito.esportato) toast(`Backup esportato in <b>${escapeHtml(esito.percorso)}</b>`);
    } catch (error) {
        mostraErrore(error);
    }
});

// ── Scorciatoie da tastiera ─────────────────────────────────────────────────

$(document).on('keydown', (e) => {
    const inCampo = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
    const modaleAperta = $('.modal.show').length > 0;
    if (inCampo || modaleAperta || e.ctrlKey || e.altKey || e.metaKey) return;

    if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        apriNuovoOrdine();
    } else if (e.key === '/') {
        e.preventDefault();
        $('#cerca-globale').trigger('focus').trigger('select');
    }
});
