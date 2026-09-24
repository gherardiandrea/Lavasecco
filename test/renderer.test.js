const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { caricaRenderer } = require('./supporto/renderer');

// Oggi, per tutti i test di questo file, è giovedì 24 settembre 2026 alle 10:00
const r = caricaRenderer();
const STATO = r.valuta('STATO');

function ordine(dati = {}) {
    return {
        id: 17117, anno: 2026, stato: STATO.APERTO, quantita: 2, quantita_consegnata: 0,
        cliente_nome: 'Mario Rossi', cliente_telefono: '333 111', prodotto_descrizione: 'Giacca',
        descrizione: '', posizione: 'A1', data_consegna: '2026-09-20', data_ritiro_prevista: '2026-09-24',
        data_ritiro_effettiva: null, prezzo_unitario_cent: 750, nota_prezzo: '',
        ...dati
    };
}

describe('escape dell\'HTML', () => {
    test('escapeHtml neutralizza i caratteri speciali', () => {
        assert.equal(r.escapeHtml(`<img src=x onerror="alert('x')"> & co`), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; co');
        assert.equal(r.escapeHtml(null), '');
        assert.equal(r.escapeHtml(undefined), '');
        assert.equal(r.escapeHtml(17117), '17117');
    });

    test('evidenzia: senza distinzione di maiuscole, ogni occorrenza, sempre con escape', () => {
        assert.equal(r.evidenzia('Rossi Rossana', 'ross'), '<mark>Ross</mark>i <mark>Ross</mark>ana');
        assert.equal(r.evidenzia('<b>Rossi</b>', 'ross'), '&lt;b&gt;<mark>Ross</mark>i&lt;/b&gt;');
        assert.equal(r.evidenzia('Sconto 100% (a)', '0% (a'), 'Sconto 10<mark>0% (a</mark>)');
        assert.equal(r.evidenzia('<i>x</i>', ''), '&lt;i&gt;x&lt;/i&gt;');
        assert.equal(r.evidenzia(null, 'x'), '');
    });
});

describe('prezzi e numeri', () => {
    test('formatEuro in formato italiano', () => {
        assert.equal(r.formatEuro(750), '7,50 €');
        assert.equal(r.formatEuro(0), '0,00 €');
        assert.equal(r.formatEuro(123456), '1.234,56 €');
        assert.equal(r.formatEuro(1234567), '12.345,67 €');
    });

    test('testoPrezzo e prezzoPerInput per prezzi fissi e "a vista" / "a peso"', () => {
        assert.equal(r.testoPrezzo({ prezzo_cent: 900, nota_prezzo: '' }), '9,00 €');
        assert.equal(r.testoPrezzo({ prezzo_cent: null, nota_prezzo: 'a peso' }), 'a peso');
        assert.equal(r.testoPrezzo({ prezzo_cent: null, nota_prezzo: '' }), 'a vista');
        assert.equal(r.prezzoPerInput({ prezzo_cent: 123456, nota_prezzo: '' }), '1234,56');
        assert.equal(r.prezzoPerInput({ prezzo_cent: null, nota_prezzo: 'a peso' }), 'a peso');
        assert.equal(r.prezzoPerInput({ prezzo_cent: null, nota_prezzo: '' }), '');
    });

    test('numeroOrdine, iniziali, plurale, maiuscolaIniziale', () => {
        assert.equal(r.numeroOrdine(17117), '17117');
        assert.equal(r.numeroOrdine(5459), '5459');
        assert.equal(r.numeroOrdine('5'), '5');
        assert.equal(r.iniziali('  mario   rossi bianchi '), 'MR');
        assert.equal(r.iniziali(''), '?');
        assert.equal(r.plurale(1, 'capo', 'capi'), '1 capo');
        assert.equal(r.plurale(0, 'capo', 'capi'), '0 capi');
        assert.equal(r.maiuscolaIniziale('a vista'), 'A vista');
    });
});

describe('date', () => {
    test('oggiIso e giorniDaOggi, anche attraverso il cambio dell\'ora legale', () => {
        assert.equal(r.oggiIso(), '2026-09-24');
        assert.equal(r.oggiIso(-1), '2026-09-23');
        assert.equal(r.oggiIso(8), '2026-10-02');
        assert.equal(r.giorniDaOggi('2026-09-24'), 0);
        assert.equal(r.giorniDaOggi('2026-09-20'), -4);
        assert.equal(r.giorniDaOggi('2026-10-01'), 7);
        assert.equal(r.giorniDaOggi('2026-10-30'), 36); // dopo il ritorno all'ora solare (25 ottobre)
        assert.equal(r.giorniDaOggi(''), null);
        assert.equal(r.giorniDaOggi(null), null);
        assert.equal(r.giorniDaOggi('24-09-2026'), null);
    });

    test('dataBreve (anno solo se diverso), dataNumerica, dataLunga', () => {
        assert.equal(r.dataBreve('2026-09-24'), 'gio 24 set');
        assert.equal(r.dataBreve('2019-11-22'), 'ven 22 nov 2019');
        assert.equal(r.dataBreve(''), '');
        assert.equal(r.dataNumerica('2026-09-04'), '04-09-2026');
        assert.equal(r.dataNumerica(null), '');
        assert.equal(r.dataLunga(), 'Giovedì 24 settembre');
    });

    test('isoDaData / dataDaIso sono l\'una l\'inverso dell\'altra', () => {
        for (const iso of ['2026-01-01', '2026-03-29', '2026-10-25', '2024-02-29']) {
            assert.equal(r.isoDaData(r.dataDaIso(iso)), iso);
        }
        assert.equal(r.dataDaIso('2026/01/01'), null);
    });
});

describe('filtri rapidi di "Da consegnare"', () => {
    test('ritiro oggi, in ritardo, consegnati in parte', () => {
        const oggi = ordine();
        const ritardo = ordine({ data_ritiro_prevista: '2026-09-10' });
        const futuro = ordine({ data_ritiro_prevista: '2026-09-30' });
        const senzaData = ordine({ data_ritiro_prevista: null });
        const parziale = ordine({ stato: STATO.PARZIALE, quantita_consegnata: 1, data_ritiro_prevista: '2026-09-30' });

        const filtra = (f) => [oggi, ritardo, futuro, senzaData, parziale].filter((o) => r.corrispondeFiltro(o, f)).length;
        assert.equal(filtra('tutti'), 5);
        assert.equal(filtra('oggi'), 1);
        assert.equal(filtra('ritardo'), 1);
        assert.equal(filtra('parziali'), 1);
        assert.equal(r.corrispondeFiltro(senzaData, 'ritardo'), false);
    });
});

describe('celle delle tabelle', () => {
    test('cartellino: ordina per id, si trova per numero e per data in cui è stato lasciato', () => {
        const o = ordine();
        assert.equal(r.renderCartellino(o.id, 'sort', o), 17117);
        assert.equal(r.renderCartellino(o.id, 'filter', o), '17117 20-09-2026');
        assert.equal(r.renderCartellino(o.id, 'display', o), '<span class="tag" title="Lasciato dom 20 set">17117</span>');
    });

    test('cliente, capi e posizione: il testo dell\'utente non diventa HTML', () => {
        const xss = '<img src=x onerror=alert(1)>';
        const o = ordine({ cliente_nome: xss, prodotto_descrizione: xss, descrizione: xss, posizione: xss });
        for (const html of [
            r.renderCliente(o.cliente_nome, 'display', o),
            r.renderCapi(o.prodotto_descrizione, 'display', o),
            r.renderPosizione(o.posizione, 'display', o)
        ]) {
            assert.doesNotMatch(html, /<img/);
            assert.match(html, /&lt;img/);
        }
        // Per la ricerca il testo resta quello originale
        assert.equal(r.renderCliente('Mario', 'filter', ordine()), 'Mario 333 111');
    });

    test('quantità: capi normali e consegnati in parte con la barra di avanzamento', () => {
        assert.match(r.renderQuantita(null, 'display', ordine({ quantita: 1 })), /<b>1<\/b> <small>capo<\/small>/);
        const parziale = ordine({ stato: STATO.PARZIALE, quantita: 3, quantita_consegnata: 1 });
        const html = r.renderQuantita(null, 'display', parziale);
        assert.match(html, /<b>2<\/b> <small>di 3 da consegnare<\/small>/);
        assert.match(html, /width:33%/);
        assert.equal(r.renderQuantita(null, 'sort', parziale), 2);
    });

    test('date: ordinamento ISO, ricerca anche in formato gg-mm-aaaa', () => {
        assert.equal(r.renderData('2026-09-24', 'sort'), '2026-09-24');
        assert.equal(r.renderData('2026-09-24', 'filter'), '24-09-2026 gio 24 set');
        assert.match(r.renderData(null, 'display'), /—/);
        assert.equal(r.renderData(null, 'sort'), '');
    });

    test('badge del ritiro: in ritardo, oggi, domani, tra N giorni', () => {
        assert.match(r.badgeGiorni('2026-09-23'), /coral.*da ieri/);
        assert.match(r.badgeGiorni('2026-09-14'), /coral.*da 10 giorni/);
        assert.match(r.badgeGiorni('2026-09-24'), /teal.*oggi/);
        assert.match(r.badgeGiorni('2026-09-25'), /domani/);
        assert.match(r.badgeGiorni('2026-09-29'), /tra 5 giorni/);
        assert.equal(r.badgeGiorni(null), '');
    });

    test('totale: prezzo salvato × quantità; "a vista"/"a peso" in fondo quando si ordina', () => {
        const o = ordine({ quantita: 3, prezzo_unitario_cent: 450 });
        assert.equal(r.renderTotale(null, 'display', o), '13,50 €');
        assert.equal(r.renderTotale(null, 'sort', o), 1350);
        const aPeso = ordine({ prezzo_unitario_cent: null, nota_prezzo: 'a peso' });
        assert.match(r.renderTotale(null, 'display', aPeso), /senza-prezzo">A peso</);
        assert.equal(r.renderTotale(null, 'sort', aPeso), -1);
        assert.equal(r.renderTotale(null, 'display', ordine({ prezzo_unitario_cent: null, nota_prezzo: '' })), '<span class="senza-prezzo">A vista</span>');
    });

    test('pulsanti: consegna con i capi rimasti, azioni diverse per aperti e consegnati', () => {
        const parziale = ordine({ stato: STATO.PARZIALE, quantita: 5, quantita_consegnata: 2 });
        assert.match(r.bottoneConsegna(parziale), /data-azione="consegna" data-id="17117" data-resto="3"/);
        assert.match(r.renderAzioniAperto(null, 'display', parziale), /data-azione="modifica-ordine"/);
        assert.doesNotMatch(r.renderAzioniAperto(null, 'display', parziale), /elimina-ordine/);
        const consegnato = r.renderAzioniConsegnato(null, 'display', ordine({ stato: STATO.CONSEGNATO }));
        assert.match(consegnato, /annulla-consegna/);
        assert.match(consegnato, /elimina-ordine/);
        assert.equal(r.renderAzioniAperto(null, 'filter', parziale), '');
    });
});

describe('pagina "Oggi"', () => {
    test('durata del ritardo: giorni, poi mesi, poi anni', () => {
        const d = (g) => { const x = r.durataRitardo(g); return `${x.n} ${x.unita}`; };
        assert.equal(d(1), '1 giorno');
        assert.equal(d(45), '45 giorni');
        assert.equal(d(90), '3 mesi');
        assert.equal(d(1741), '4 anni');
    });

    test('righe dei ritiri e dei ritardi: escape e pulsante di consegna', () => {
        const xss = ordine({ cliente_nome: '<script>x</script>', quantita: 3, quantita_consegnata: 1 });
        const ritiro = r.htmlRitiroOggi(xss);
        assert.doesNotMatch(ritiro, /<script>/);
        assert.match(ritiro, /2 × Giacca/);
        assert.match(ritiro, /1 già consegnati/);
        assert.match(ritiro, /data-resto="2"/);

        const ritardo = r.htmlRitardo(ordine({ data_ritiro_prevista: '2026-06-01' }));
        assert.match(ritardo, /3<small>mesi<\/small>/);
        assert.match(ritardo, /title="Ritiro previsto lun 1 giu"/);
    });

    test('saluto secondo l\'ora', () => {
        assert.equal(r.saluto(), 'Buongiorno');
        assert.equal(caricaRenderer(undefined, { adesso: '2026-09-24T15:30:00' }).saluto(), 'Buon pomeriggio');
        assert.equal(caricaRenderer(undefined, { adesso: '2026-09-24T21:00:00' }).saluto(), 'Buonasera');
    });
});

test('debounce: più chiamate ravvicinate producono una sola esecuzione, con gli ultimi argomenti', async () => {
    const chiamate = [];
    const f = r.debounce((x) => chiamate.push(x), 20);
    f(1); f(2); f(3);
    await new Promise((fine) => setTimeout(fine, 60));
    assert.deepEqual(chiamate, [3]);
});
