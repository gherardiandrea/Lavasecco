// Fondamenta del renderer: stato, accesso ai dati, formattazione, messaggi (toast).

// Stati di un ordine (come nel database)
const STATO = Object.freeze({ APERTO: 0, CONSEGNATO: 1, PARZIALE: 2 });

const stato = {
    pagina: 'oggi',
    annoConsegnati: new Date().getFullYear(),
    prodotti: []
};

// ── Accesso ai dati ─────────────────────────────────────────────────────────

// Errore restituito dal main process (validazione o errore interno).
class ErroreApi extends Error {
    constructor({ codice, messaggio, campo }) {
        super(messaggio);
        this.name = 'ErroreApi';
        this.codice = codice;
        this.campo = campo || null;
    }
}

function risultato(risposta) {
    if (!risposta.ok) {
        throw new ErroreApi(risposta.errore);
    }
    return risposta.dati;
}

// Chiama un metodo del repository nel main process; lancia ErroreApi se la richiesta fallisce.
async function api(metodo, ...args) {
    return risultato(await window.lavasecco.chiama(metodo, ...args));
}

async function esportaBackup() {
    return risultato(await window.lavasecco.esportaBackup());
}

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

function formatEuro(centesimi) {
    return (centesimi / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
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

function numeroOrdine(id) {
    return Number(id).toLocaleString('it-IT');
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

// ── Toast ───────────────────────────────────────────────────────────────────

// Messaggio in basso; con `annulla` mostra il pulsante "Annulla" per qualche secondo.
function toast(html, { tipo = 'ok', annulla = null, durata = annulla ? 6000 : 3500 } = {}) {
    const icona = tipo === 'errore' ? 'fa-circle-exclamation' : 'fa-circle-check';
    const $el = $(`
        <div class="toast-app ${tipo}" role="status">
            <i class="fa-solid ${icona}"></i><span class="testo">${html}</span>
            ${annulla ? '<button type="button">Annulla</button>' : ''}
            <div class="timer"><div style="animation-duration: ${durata}ms"></div></div>
        </div>
    `);
    $('#toasts').append($el);

    let chiuso = false;
    const chiudi = () => {
        if (chiuso) return;
        chiuso = true;
        $el.addClass('in-uscita');
        setTimeout(() => $el.remove(), 200);
    };
    const timer = setTimeout(chiudi, durata);

    if (annulla) {
        $el.find('button').on('click', async () => {
            clearTimeout(timer);
            chiudi();
            try {
                await annulla();
            } catch (error) {
                mostraErrore(error);
            }
        });
    }
}

function mostraErrore(error) {
    console.error(error);
    toast(escapeHtml(error.message || 'Operazione non riuscita'), { tipo: 'errore', durata: 7000 });
}
