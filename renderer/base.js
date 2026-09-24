// Fondamenta del renderer: stato, accesso ai dati, messaggi (toast).
// Formattazione e date sono in formato.js.

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
