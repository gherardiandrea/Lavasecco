// HTML delle celle e delle righe (tabelle e pagina "Oggi"): funzioni pure, senza jQuery né DOM,
// così i test le caricano in Node (test/renderer.test.js). Usano le funzioni di formato.js.

// ── Render delle celle ──────────────────────────────────────────────────────
// DataTables chiama il render con type = 'display' (HTML), 'filter' (testo per la ricerca)
// o 'sort' (valore per l'ordinamento): solo 'display' produce HTML, sempre con escape.

function renderCartellino(id, type, ordine) {
    if (type === 'sort' || type === 'type') return id;
    if (type === 'filter') return `${id} ${dataNumerica(ordine.data_consegna)}`;
    const lasciato = ordine.data_consegna ? `Lasciato ${dataBreve(ordine.data_consegna)}` : '';
    return `<span class="tag" title="${escapeHtml(lasciato)}">${numeroOrdine(id)}</span>`;
}

function renderCliente(nome, type, riga) {
    const telefono = riga.cliente_telefono ?? riga.telefono;
    if (type !== 'display') return `${nome || ''} ${telefono || ''}`;
    return `<div class="cella-doppia"><b>${escapeHtml(nome)}</b><span>${escapeHtml(telefono || '—')}</span></div>`;
}

function renderCapi(prodotto, type, ordine) {
    if (type !== 'display') return `${prodotto || ''} ${ordine.descrizione || ''}`;
    const descr = ordine.descrizione || '';
    return `<div class="cella-doppia cella-capi"><b>${escapeHtml(prodotto)}</b>${descr ? `<span title="${escapeHtml(descr)}">${escapeHtml(descr)}</span>` : ''}</div>`;
}

function renderQuantita(_, type, ordine) {
    const resto = ordine.quantita - ordine.quantita_consegnata;
    if (type !== 'display') return resto;
    if (ordine.stato === STATO.PARZIALE) {
        return `<div class="quantita"><div class="num"><b>${resto}</b> <small>di ${ordine.quantita} da consegnare</small></div>
            <div class="progresso"><div style="width:${Math.round(ordine.quantita_consegnata / ordine.quantita * 100)}%"></div></div></div>`;
    }
    return `<div class="quantita num"><b>${ordine.quantita}</b> <small>${ordine.quantita === 1 ? 'capo' : 'capi'}</small></div>`;
}

function badgeGiorni(iso) {
    const g = giorniDaOggi(iso);
    if (g == null) return '';
    if (g < 0) return `<span class="badge-app coral"><i class="fa-solid fa-clock"></i> ${g === -1 ? 'da ieri' : `da ${-g} giorni`}</span>`;
    if (g === 0) return `<span class="badge-app teal"><i class="fa-solid fa-bag-shopping"></i> oggi</span>`;
    if (g === 1) return `<span class="badge-app neutro">domani</span>`;
    return `<span class="badge-app neutro">tra ${g} giorni</span>`;
}

function renderData(iso, type) {
    if (type === 'sort' || type === 'type') return iso || '';
    if (type === 'filter') return iso ? `${dataNumerica(iso)} ${dataBreve(iso)}` : '';
    return iso ? `<span class="num">${escapeHtml(dataBreve(iso))}</span>` : '<span class="vuoto">—</span>';
}

function renderRitiroPrevisto(iso, type) {
    if (type !== 'display') return renderData(iso, type);
    if (!iso) return '<span class="vuoto">—</span>';
    return `<div class="data-ritiro"><div class="num">${escapeHtml(dataBreve(iso))}</div>${badgeGiorni(iso)}</div>`;
}

function renderPosizione(pos, type) {
    if (type !== 'display') return pos || '';
    return pos ? `<span class="pos" title="${escapeHtml(pos)}"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(pos)}</span>` : '';
}

// Totale con il prezzo salvato nell'ordine al momento della registrazione (non il listino attuale)
function renderTotale(_, type, ordine) {
    if (ordine.prezzo_unitario_cent == null) {
        const nota = maiuscolaIniziale(ordine.nota_prezzo || 'a vista');
        return type === 'display' ? `<span class="senza-prezzo">${escapeHtml(nota)}</span>` : (type === 'sort' ? -1 : nota);
    }
    const centesimi = ordine.prezzo_unitario_cent * ordine.quantita;
    return type === 'sort' || type === 'type' ? centesimi : formatEuro(centesimi);
}

function bottoneConsegna(ordine, compatto = false) {
    const resto = ordine.quantita - ordine.quantita_consegnata;
    return `<button type="button" class="btn-app btn-consegna${compatto ? ' compatto' : ''}" data-azione="consegna" data-id="${ordine.id}" data-resto="${resto}" title="Registra la consegna">
        <i class="fa-solid fa-check"></i>${compatto ? '' : ' Consegna'}</button>`;
}

function renderAzioniAperto(_, type, ordine) {
    if (type !== 'display') return '';
    // "Elimina" è nella modale di modifica: meno a portata di clic per sbaglio
    return `<div class="azioni">${bottoneConsegna(ordine)}
        <button type="button" class="btn-icona" data-azione="modifica-ordine" data-id="${ordine.id}" title="Modifica o elimina"><i class="fa-solid fa-pen"></i></button></div>`;
}

function renderAzioniConsegnato(_, type, ordine) {
    if (type !== 'display') return '';
    return `<div class="azioni">
        <button type="button" class="btn-app btn-neutro compatto" data-azione="annulla-consegna" data-id="${ordine.id}" title="Riporta l'ordine tra quelli da consegnare"><i class="fa-solid fa-rotate-left"></i> Annulla consegna</button>
        <button type="button" class="btn-icona pericolo" data-azione="elimina-ordine" data-id="${ordine.id}" title="Elimina"><i class="fa-solid fa-trash-can"></i></button></div>`;
}

// ── Filtri rapidi della tabella "Da consegnare" ─────────────────────────────

function corrispondeFiltro(ordine, filtro) {
    const giorni = giorniDaOggi(ordine.data_ritiro_prevista);
    if (filtro === 'oggi') return giorni === 0;
    if (filtro === 'ritardo') return giorni != null && giorni < 0;
    if (filtro === 'parziali') return ordine.stato === STATO.PARZIALE;
    return true;
}

// ── Righe della pagina "Oggi" ──────────────────────────────────────────────

function saluto() {
    const ora = new Date().getHours();
    if (ora < 13) return 'Buongiorno';
    if (ora < 18) return 'Buon pomeriggio';
    return 'Buonasera';
}

function htmlRitiroOggi(o) {
    const resto = o.quantita - o.quantita_consegnata;
    const importo = o.prezzo_unitario_cent != null ? formatEuro(o.prezzo_unitario_cent * o.quantita) : maiuscolaIniziale(o.nota_prezzo || 'a vista');
    return `<div class="riga-oggi" id="oggi_${o.id}">
        <span class="tag">${numeroOrdine(o.id)}</span>
        <div class="chi"><b>${escapeHtml(o.cliente_nome)}</b><span>${escapeHtml(o.cliente_telefono || 'nessun telefono')}</span>
            <div class="capi">${resto} × ${escapeHtml(o.prodotto_descrizione)}${o.quantita_consegnata ? ` <span class="badge-app oro">${o.quantita_consegnata} già consegnati</span>` : ''}</div></div>
        ${o.posizione ? `<span class="pos"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(o.posizione)}</span>` : '<span></span>'}
        <div class="fine-riga"><span class="importo num${o.prezzo_unitario_cent == null ? ' senza-prezzo' : ''}">${escapeHtml(importo)}</span>${bottoneConsegna(o)}</div>
    </div>`;
}

// Durata compatta per il riquadro del ritardo: giorni, poi mesi, poi anni
function durataRitardo(giorni) {
    if (giorni < 60) return { n: giorni, unita: giorni === 1 ? 'giorno' : 'giorni' };
    if (giorni < 730) return { n: Math.floor(giorni / 30), unita: 'mesi' };
    return { n: Math.floor(giorni / 365), unita: 'anni' };
}

function htmlRitardo(o) {
    const giorni = -giorniDaOggi(o.data_ritiro_prevista);
    const durata = durataRitardo(giorni);
    return `<div class="riga-ritardo" id="ritardo_${o.id}">
        <div class="giorni num" title="Ritiro previsto ${escapeHtml(dataBreve(o.data_ritiro_prevista))}">${durata.n}<small>${durata.unita}</small></div>
        <div class="chi"><b>${escapeHtml(o.cliente_nome)}</b><span>${escapeHtml(o.prodotto_descrizione)}${o.posizione ? ` · ${escapeHtml(o.posizione)}` : ''}${o.cliente_telefono ? ` · ${escapeHtml(o.cliente_telefono)}` : ''}</span></div>
        ${bottoneConsegna(o, true)}
    </div>`;
}
