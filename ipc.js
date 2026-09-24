// Gestori delle richieste dal renderer (IPC), separati da Electron per poterli testare.
// Ogni risposta ha la forma { ok: true, dati } oppure { ok: false, errore: { codice, messaggio, campo } }.
const { ErroreValidazione } = require('./repository');

const NON_AUTORIZZATO = Object.freeze({ ok: false, errore: { codice: 'non_autorizzato', messaggio: 'Richiesta non autorizzata' } });

// Accetto richieste solo dalla pagina locale dell'app (file://), non da contenuti esterni
function mittenteAutorizzato(event) {
    return !!(event && event.senderFrame && typeof event.senderFrame.url === 'string' && event.senderFrame.url.startsWith('file://'));
}

function rispostaErrore(error, contesto, log) {
    if (error instanceof ErroreValidazione) {
        return { ok: false, errore: { codice: error.codice, messaggio: error.message, campo: error.campo } };
    }
    log(`Errore in ${contesto}:`, error);
    return { ok: false, errore: { codice: 'interno', messaggio: error.message } };
}

// Canale 'db': esegue solo i metodi del repository nella lista `metodiPubblici`
function creaGestoreDb(repository, metodiPubblici, { log = console.error } = {}) {
    const metodi = new Set(metodiPubblici);
    return (event, metodo, ...args) => {
        if (!mittenteAutorizzato(event)) {
            return NON_AUTORIZZATO;
        }
        if (!metodi.has(metodo) || typeof repository[metodo] !== 'function') {
            return { ok: false, errore: { codice: 'metodo_sconosciuto', messaggio: `Metodo sconosciuto: ${metodo}` } };
        }
        try {
            return { ok: true, dati: repository[metodo](...args) };
        } catch (error) {
            return rispostaErrore(error, metodo, log);
        }
    };
}

// Canali per singole azioni asincrone (es. 'app:esportaBackup')
function creaGestoreAzione(nome, azione, { log = console.error } = {}) {
    return async (event) => {
        if (!mittenteAutorizzato(event)) {
            return NON_AUTORIZZATO;
        }
        try {
            return { ok: true, dati: await azione() };
        } catch (error) {
            return rispostaErrore(error, nome, log);
        }
    };
}

module.exports = { creaGestoreDb, creaGestoreAzione, mittenteAutorizzato };
