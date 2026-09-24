// Avvio dell'app per i test end-to-end: database di prova in una cartella temporanea,
// profilo Electron separato (--user-data-dir), così i dati reali non vengono mai toccati.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron, expect } = require('@playwright/test');

const RADICE = path.join(__dirname, '..', '..');
const { apriDatabase, oggiIso } = require(path.join(RADICE, 'database'));
const { createRepository } = require(path.join(RADICE, 'repository'));

// Data ISO spostata di n giorni rispetto a oggi
function giorno(n = 0) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return oggiIso(d);
}

// Dati di prova con date relative a oggi. Ritorna gli id utili ai test.
function seminaStandard(repo) {
    const mario = repo.salvaCliente({ nome: 'Mario Rossi', telefono: '333 111 2222' });
    const anna = repo.salvaCliente({ nome: 'Anna Bianchi', telefono: '' });
    const luca = repo.salvaCliente({ nome: 'Luca Verdi', telefono: '347 555 0000' });

    const giacca = repo.salvaProdotto({ descrizione: 'Giacca', prezzo: '7,50' });
    const camicia = repo.salvaProdotto({ descrizione: 'Camicia', prezzo: '4,50' });
    const tappeto = repo.salvaProdotto({ descrizione: 'Tappeto', prezzo: 'a peso' });
    const maiUsato = repo.salvaProdotto({ descrizione: 'Cravatta', prezzo: '3' });

    const ordine = (cliente_id, prodotto_id, quantita, ritiro, posizione) => repo.creaOrdini([{
        cliente_id, prodotto_id, quantita, posizione, data_consegna: giorno(-7), data_ritiro_prevista: ritiro
    }])[0];

    const ids = {
        clienti: { mario, anna, luca },
        prodotti: { giacca, camicia, tappeto, maiUsato },
        giaccaMarioOggi: ordine(mario, giacca, 1, giorno(0), 'A1'),
        camicieAnnaOggi: ordine(anna, camicia, 3, giorno(0), 'B2'),
        tappetoLucaRitardo: ordine(luca, tappeto, 1, giorno(-5), 'Magazzino'),
        camicieMarioParziale: ordine(mario, camicia, 2, giorno(2), 'C3'),
        giaccheLucaConsegnate: ordine(luca, giacca, 2, giorno(-1), 'D4')
    };
    repo.consegnaOrdine(ids.camicieMarioParziale, 1);
    repo.consegnaOrdine(ids.giaccheLucaConsegnate, 2);
    return ids;
}

async function avviaApp({ semina = seminaStandard } = {}) {
    const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'lavasecco-e2e-'));
    const dbPath = path.join(cartella, 'dati', 'lavasecco.sqlite3');

    const { db } = await apriDatabase({ dbPath, backupDir: path.join(cartella, 'dati', 'backups') });
    const ids = semina(createRepository(db));
    db.close();

    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE; // impostata nei terminali di VS Code: farebbe partire Electron come Node

    const app = await electron.launch({ args: [RADICE, `--user-data-dir=${cartella}`], cwd: RADICE, env });
    const page = await app.firstWindow();
    const erroriConsole = [];
    page.on('pageerror', (e) => erroriConsole.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') erroriConsole.push(m.text()); });

    await expect(page.locator('#vista-oggi')).toHaveClass(/attiva/);
    await expect(page.locator('#kpi-aperti')).not.toHaveText('–');

    return { app, page, ids, cartella, dbPath, erroriConsole };
}

async function chiudiApp(contesto) {
    if (!contesto) return;
    await contesto.app.close();
    fs.rmSync(contesto.cartella, { recursive: true, force: true });
}

// ── Scorciatoie per i test ──────────────────────────────────────────────────

async function vaiA(page, pagina) {
    await page.locator(`.nav a[data-pagina="${pagina}"]`).click();
    if (pagina !== 'oggi') await expect(page.locator('#table')).toBeVisible();
}

// Scrive nella ricerca in alto e aspetta che la tabella sia filtrata (la ricerca parte dopo una breve pausa)
async function cerca(page, testo) {
    await page.locator('#cerca-globale').fill(testo);
    await expect.poll(() => page.evaluate(() => (tabellaCorrente() ? tabellaCorrente().search() : null))).toBe(testo);
}

function riga(page, testo) {
    return page.locator('#table tbody tr', { hasText: testo });
}

function ultimoToast(page) {
    return page.locator('#toasts .toast-app').last();
}

module.exports = { avviaApp, chiudiApp, vaiA, cerca, riga, ultimoToast, giorno, expect };
