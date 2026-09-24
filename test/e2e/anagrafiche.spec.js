const { test } = require('@playwright/test');
const { avviaApp, chiudiApp, vaiA, cerca, riga, ultimoToast, expect } = require('./supporto');

test.describe.configure({ mode: 'serial' });

let ctx;
test.beforeAll(async () => { ctx = await avviaApp(); });
test.afterAll(async () => { await chiudiApp(ctx); });

test('clienti: nuovo, duplicato rifiutato, modifica; il nome non viene interpretato come HTML', async () => {
    const { page } = ctx;
    await vaiA(page, 'clienti');
    await expect(riga(page, 'Mario Rossi')).toContainText('2 ordini');

    const nome = '<img src=x onerror="window.__xss = 1">Zeta';
    await page.locator('[data-azione="nuovo-cliente"]').click();
    await page.locator('#cl-nome').fill(nome);
    await page.locator('#cl-telefono').fill('111');
    await page.locator('#cl-salva').click();
    await expect(ultimoToast(page)).toContainText('creato');
    await cerca(page, 'Zeta');
    await expect(page.locator('#table tbody tr')).toHaveCount(1);
    await expect(page.locator('#table tbody tr td').first()).toContainText(nome);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(page.locator('#table img')).toHaveCount(0);

    // Stesso nome e telefono: rifiutato con messaggio
    await page.locator('[data-azione="nuovo-cliente"]').click();
    await page.locator('#cl-nome').fill('mario rossi');
    await page.locator('#cl-telefono').fill('333 111 2222');
    await page.locator('#cl-salva').click();
    await expect(page.locator('#modale-cliente .errore-modale')).toContainText('Esiste già un cliente');
    await expect(page.locator('#cl-nome')).toHaveClass(/is-invalid/);
    await page.keyboard.press('Escape');

    // Modifica del telefono: la riga si aggiorna al suo posto
    await cerca(page, 'Anna');
    await riga(page, 'Anna Bianchi').locator('[data-azione="modifica-cliente"]').click();
    await expect(page.locator('#cl-nome')).toHaveValue('Anna Bianchi');
    await page.locator('#cl-telefono').fill('345 000 1111');
    await page.locator('#cl-nome').press('Enter');
    await expect(riga(page, 'Anna Bianchi')).toContainText('345 000 1111');
});

test('nuovo cliente creato al volo dentro un ordine', async () => {
    const { page } = ctx;
    await page.locator('#btn-nuovo-ordine').click();
    await page.locator('#or-cliente-input').fill('Carla Neri');
    await page.locator('#or-risultati [data-nuovo]').click();
    await page.locator('#or-nuovo-telefono').fill('320 123 4567');
    await page.locator('#or-nuovo-crea').click();
    await expect(page.locator('#or-cliente-nome')).toHaveText('Carla Neri');
    await expect(page.locator('#or-cliente-info')).toHaveText('320 123 4567');
    await expect(ultimoToast(page)).toContainText('Cliente Carla Neri creato');
    await page.keyboard.press('Escape');

    await cerca(page, 'Carla');
    await expect(riga(page, 'Carla Neri')).toContainText('320 123 4567');
});

test('listino: nuovo articolo, eliminabile solo se mai usato', async () => {
    const { page } = ctx;
    await vaiA(page, 'listino');
    await expect(riga(page, 'Giacca').locator('[data-azione="elimina-articolo"]')).toBeDisabled();

    await page.locator('[data-azione="nuovo-articolo"]').click();
    await page.locator('#ar-descrizione').fill('Tenda');
    await page.locator('#ar-prezzo').fill('12,5');
    await page.locator('#ar-salva').click();
    await expect(riga(page, 'Tenda')).toContainText('12,50 €');
    await expect(riga(page, 'Tenda')).toContainText('mai usato');

    await riga(page, 'Tenda').locator('[data-azione="elimina-articolo"]').click();
    await page.locator('#cf-conferma').click();
    await expect(ultimoToast(page)).toContainText('eliminato');
    await expect(page.locator('#table tbody tr', { hasText: 'Tenda' })).toHaveCount(0);

    // La ricerca in alto resta applicata dopo il ricaricamento del listino
    await cerca(page, 'Cam');
    await expect(page.locator('#table tbody tr')).toHaveCount(1);
});

test('consegnati: cambio anno', async () => {
    const { page } = ctx;
    await vaiA(page, 'consegnati');
    await cerca(page, '');
    await expect(riga(page, 'Luca Verdi')).toBeVisible();
    await page.locator('#seleziona-anno').selectOption(String(new Date().getFullYear() - 1));
    await expect(page.locator('#table tbody tr td.dataTables_empty')).toHaveText('Nessun ordine consegnato in questo anno');
});

test('nessun errore nella console', async () => {
    expect(ctx.erroriConsole).toEqual([]);
});
