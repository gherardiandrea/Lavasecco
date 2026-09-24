const { test } = require('@playwright/test');
const { avviaApp, chiudiApp, vaiA, riga, expect } = require('./supporto');

let ctx;
test.beforeAll(async () => { ctx = await avviaApp(); });
test.afterAll(async () => { await chiudiApp(ctx); });

test('i riquadri riassumono la giornata', async () => {
    const { page } = ctx;
    await expect(page.locator('#kpi-oggi')).toHaveText('2');
    await expect(page.locator('#kpi-oggi-nota')).toHaveText('4 capi');
    await expect(page.locator('#kpi-ritardo')).toHaveText('1');
    await expect(page.locator('#kpi-aperti')).toHaveText('4');
    await expect(page.locator('#kpi-incasso')).toHaveText('15,00 €');
    await expect(page.locator('#oggi-sottotitolo')).toHaveText('2 ritiri previsti oggi, 1 in ritardo.');
    await expect(page.locator('#conta-aperti')).toHaveText('4');
    await expect(page.locator('#conta-ritardo')).toHaveText('1');
});

test('ritiri di oggi in ordine di posizione, ritardi con i giorni', async () => {
    const { page } = ctx;
    const ritiri = page.locator('#lista-ritiri-oggi .riga-oggi');
    await expect(ritiri).toHaveCount(2);
    await expect(ritiri.nth(0)).toContainText('Mario Rossi');
    await expect(ritiri.nth(0)).toContainText('A1');
    await expect(ritiri.nth(1)).toContainText('Anna Bianchi');
    await expect(ritiri.nth(1)).toContainText('3 × Camicia');

    const ritardi = page.locator('#lista-ritardi .riga-ritardo');
    await expect(ritardi).toHaveCount(1);
    await expect(ritardi.first()).toContainText('Luca Verdi');
    await expect(ritardi.first().locator('.giorni')).toHaveText('5giorni');
});

test('il riquadro "In ritardo" apre l\'elenco già filtrato', async () => {
    const { page } = ctx;
    await page.locator('.kpi[data-filtro="ritardo"]').click();
    await expect(page.locator('#titolo-pagina')).toHaveText('Da consegnare');
    await expect(page.locator('#barra-filtri .chip.attivo')).toHaveAttribute('data-filtro', 'ritardo');
    await expect(page.locator('#table tbody tr')).toHaveCount(1);
    await expect(riga(page, 'Luca Verdi')).toHaveClass(/in-ritardo/);
    await expect(page.locator('#conteggio-tutti')).toHaveText('4');
    await expect(page.locator('#conteggio-parziali')).toHaveText('1');
});

test('consegnando dalla pagina "Oggi" i riquadri si aggiornano', async () => {
    const { page } = ctx;
    await vaiA(page, 'oggi');
    await page.locator('#lista-ritiri-oggi .riga-oggi', { hasText: 'Mario Rossi' }).locator('[data-azione="consegna"]').click();
    await expect(page.locator('#kpi-oggi')).toHaveText('1');
    await expect(page.locator('#kpi-incasso')).toHaveText('22,50 €');
    await expect(page.locator('#barre-settimana .barra.oggi em')).toHaveText('2');
});

test('nessun errore nella console', async () => {
    expect(ctx.erroriConsole).toEqual([]);
});
