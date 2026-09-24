// Funzioni pure del renderer: formattazione, date, escape dell'HTML.
// Nessuna dipendenza da jQuery o dal DOM: i test le caricano in Node (test/renderer.test.js).

// Stati di un ordine (come nel database)
const STATO = Object.freeze({ APERTO: 0, CONSEGNATO: 1, PARZIALE: 2 });

// ── Formattazione ───────────────────────────────────────────────────────────

// Escape per inserire testo dell'utente in HTML (contenuto e attributi).
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Testo con le parti uguali a `termine` evidenziate (escape incluso)
function evidenzia(testo, termine) {
    const t = String(testo ?? '');
    const q = String(termine ?? '').trim();
    if (!q) return escapeHtml(t);
    const minuscolo = t.toLowerCase();
    const cercato = q.toLowerCase();
    let html = '';
    let da = 0;
    let i = minuscolo.indexOf(cercato);
    while (i !== -1) {
        html += escapeHtml(t.slice(da, i)) + '<mark>' + escapeHtml(t.slice(i, i + q.length)) + '</mark>';
        da = i + q.length;
        i = minuscolo.indexOf(cercato, da);
    }
    return html + escapeHtml(t.slice(da));
}

// Importi sempre con il separatore delle migliaia (in italiano di norma 4 cifre non lo avrebbero: 1234,56)
function formatEuro(centesimi) {
    return (centesimi / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';
}

// Prezzo di listino: importo fisso oppure nota ("a vista", "a peso"); vuoto = "a vista".
function testoPrezzo(prodotto) {
    return prodotto.prezzo_cent != null ? formatEuro(prodotto.prezzo_cent) : (prodotto.nota_prezzo || 'a vista');
}

// Prezzo come va scritto nel campo del form ("7,50", "a peso", vuoto = a vista)
function prezzoPerInput(prodotto) {
    if (prodotto.prezzo_cent != null) {
        return (prodotto.prezzo_cent / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
    }
    return prodotto.nota_prezzo || '';
}

function maiuscolaIniziale(testo) {
    return testo.charAt(0).toUpperCase() + testo.slice(1);
}

// Il numero d'ordine è un codice, non una quantità: niente separatore delle migliaia
function numeroOrdine(id) {
    return String(Number(id));
}

function iniziali(nome) {
    return String(nome || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function plurale(n, singolare, plurale) {
    return `${n} ${n === 1 ? singolare : plurale}`;
}

// ── Date (nel database sono ISO YYYY-MM-DD) ─────────────────────────────────

const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const GIORNI_LUNGHI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function dataDaIso(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function isoDaData(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function oggiIso(spostamentoGiorni = 0) {
    const d = new Date();
    d.setDate(d.getDate() + spostamentoGiorni);
    return isoDaData(d);
}

// Giorni da oggi alla data (negativo = nel passato)
function giorniDaOggi(iso) {
    const d = dataDaIso(iso);
    if (!d) return null;
    const oggi = dataDaIso(oggiIso());
    return Math.round((d - oggi) / 86400000);
}

// "gio 24 set" (con l'anno se non è quello corrente)
function dataBreve(iso) {
    const d = dataDaIso(iso);
    if (!d) return '';
    const anno = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
    return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}${anno}`;
}

// "24-09-2026", per la ricerca testuale
function dataNumerica(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function dataLunga(d = new Date()) {
    return `${maiuscolaIniziale(GIORNI_LUNGHI[d.getDay()])} ${d.getDate()} ${MESI_LUNGHI[d.getMonth()]}`;
}

// ── Utilità ─────────────────────────────────────────────────────────────────

function debounce(fn, ms) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}
