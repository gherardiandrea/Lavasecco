const { test } = require('@playwright/test');
const { avviaApp, chiudiApp, vaiA, cerca, riga, ultimoToast, expect } = require('./supporto');

// I test di questo file sono un percorso unico sugli stessi dati
test.describe.configure({ mode: 'serial' });

let ctx;
test.beforeAll(async () => { ctx = await avviaApp(); });
test.afterAll(async () => { await chiudiApp(ctx); });

test('nuovo ordine da tastiera: ricerca cliente, più capi, totale nella ricevuta', async () => {
    const { page, ids } = ctx;
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('n');
    await expect(page.locator('#modale-ordine')).toBeVisible();
    await expect(page.locator('#or-cliente-input')).toBeFocused();

    await page.locator('#or-cliente-input').fill('ross');
    await expect(page.locator('#or-risultati .voce-cliente').first()).toContainText('Mario Rossi');
    await expect(page.locator('#or-risultati .voce-cliente').first()).toContainText('2 aperti');
    await page.locator('#or-cliente-input').press('Enter');
    await expect(page.locator('#or-cliente-nome')).toHaveText('Mario Rossi');

    const capi = page.locator('#or-capi .capo');
    await capi.nth(0).locator('select').selectOption(String(ids.prodotti.giacca));
    await capi.nth(0).locator('[data-passo="1"]').click();
    await capi.nth(0).locator('[data-passo="1"]').click();
    await capi.nth(0).locator('[data-campo="descrizione"]').fill('blu, macchia sul collo');
    await page.locator('#or-aggiungi-capo').click();
    await capi.nth(1).locator('select').selectOption(String(ids.prodotti.tappeto));
    await page.locator('#or-posizione').fill('E5');

    await expect(page.locator('#or-r-voci .voce')).toHaveText(['3 × Giacca22,50 €', '1 × Tappetoa peso']);
    await expect(page.locator('#or-r-totale')).toHaveText('22,50 €');
    await expect(page.locator('#or-r-nota')).toContainText('Tappeto (a peso): prezzo da definire');
    await expect(page.locator('#or-n-capi')).toHaveText('4 capi');

    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#modale-ordine')).toBeHidden();
    await expect(ultimoToast(page)).toContainText('Ordine registrato per Mario Rossi · 4 capi');
    await expect(page.locator('#kpi-aperti')).toHaveText('6');

    await vaiA(page, 'aperti');
    await cerca(page, 'E5');
    await expect(page.locator('#table tbody tr')).toHaveCount(2);
    await expect(riga(page, 'Giacca')).toContainText('22,50 €');
    await expect(riga(page, 'Tappeto')).toContainText('A peso');
});

test('un ordine senza capo non si registra', async () => {
    const { page } = ctx;
    await page.locator('#btn-nuovo-ordine').click();
    await page.locator('#or-cliente-input').fill('Anna');
    await page.locator('#or-cliente-input').press('Enter');
    await page.locator('#or-registra').click();
    await expect(page.locator('#modale-ordine .errore-modale')).toContainText('capo e quantità');
    await expect(page.locator('#or-capi select')).toHaveClass(/is-invalid/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#modale-ordine')).toBeHidden();
});

test('consegna parziale di un ordine da più capi e "Annulla" dal messaggio', async () => {
    const { page } = ctx;
    await cerca(page, 'Anna Bianchi');
    await riga(page, 'Anna Bianchi').locator('[data-azione="consegna"]').click();
    await expect(page.locator('#modale-consegna')).toBeVisible();
    await expect(page.locator('#cons-quantita')).toHaveValue('3');
    await page.locator('#cons-quantita').fill('1');
    await page.locator('#cons-conferma').click();

    await expect(ultimoToast(page)).toContainText('Anna Bianchi · 1 capo consegnato, ne restano 2');
    await expect(riga(page, 'Anna Bianchi')).toContainText('2 di 3 da consegnare');
    await expect(riga(page, 'Anna Bianchi')).toHaveClass(/parziale/);

    await ultimoToast(page).getByRole('button', { name: 'Annulla' }).click();
    await expect(riga(page, 'Anna Bianchi')).toContainText('3 capi');
    await expect(riga(page, 'Anna Bianchi')).not.toHaveClass(/parziale/);
});

test('consegna immediata di un capo solo, poi "Annulla consegna" dai consegnati', async () => {
    const { page } = ctx;
    await cerca(page, 'A1');
    await riga(page, 'Mario Rossi').locator('[data-azione="consegna"]').click();
    await expect(ultimoToast(page)).toContainText(`ordine ${ctx.ids.giaccaMarioOggi} consegnato`);
    await expect(page.locator('#table tbody tr', { hasText: 'Mario Rossi' })).toHaveCount(0);

    await vaiA(page, 'consegnati');
    await cerca(page, 'Mario Rossi');
    await expect(riga(page, 'Giacca')).toBeVisible();
    await riga(page, 'Giacca').locator('[data-azione="annulla-consegna"]').click();
    await expect(ultimoToast(page)).toContainText('di nuovo da consegnare');
    await expect(page.locator('#table tbody tr', { hasText: 'Giacca' })).toHaveCount(0);

    await vaiA(page, 'aperti');
    await cerca(page, 'A1');
    await expect(riga(page, 'Mario Rossi')).toContainText('1 capo');
});

test('modifica di un ordine: il prezzo registrato non cambia se cambia il listino', async () => {
    const { page } = ctx;
    // Il listino della giacca passa da 7,50 a 9,00
    await vaiA(page, 'listino');
    await cerca(page, 'Giacca');
    await riga(page, 'Giacca').locator('[data-azione="modifica-articolo"]').click();
    await expect(page.locator('#ar-nota-modifica')).toBeVisible();
    await page.locator('#ar-prezzo').fill('9');
    await page.locator('#ar-salva').click();
    await expect(riga(page, 'Giacca')).toContainText('9,00 €');

    // L'ordine da 3 giacche resta a 22,50 €, anche dopo una modifica
    await vaiA(page, 'aperti');
    await cerca(page, 'E5');
    await riga(page, 'Giacca').locator('[data-azione="modifica-ordine"]').click();
    await expect(page.locator('#or-titolo')).toHaveText('Modifica ordine');
    await expect(page.locator('#or-r-totale')).toHaveText('22,50 €');
    await page.locator('#or-posizione').fill('E6');
    await page.locator('#or-registra').click();
    await expect(page.locator('#modale-ordine')).toBeHidden();
    await cerca(page, 'E6');
    await expect(riga(page, 'Giacca')).toContainText('22,50 €');

    // Un nuovo ordine usa invece il listino aggiornato
    await page.locator('#btn-nuovo-ordine').click();
    await page.locator('#or-cliente-input').fill('Luca');
    await page.locator('#or-cliente-input').press('Enter');
    await page.locator('#or-capi .capo select').selectOption(String(ctx.ids.prodotti.giacca));
    await expect(page.locator('#or-r-totale')).toHaveText('9,00 €');
    await page.keyboard.press('Escape');
});

test('eliminazione di un ordine dalla modale di modifica, con conferma', async () => {
    const { page } = ctx;
    await cerca(page, 'E6');
    await riga(page, 'Giacca').locator('[data-azione="modifica-ordine"]').click();
    await page.locator('#or-elimina').click();
    await expect(page.locator('#modale-conferma')).toBeVisible();
    await expect(page.locator('#cf-testo')).toContainText('Mario Rossi');
    await page.locator('#cf-conferma').click();
    await expect(ultimoToast(page)).toContainText('eliminato');
    await expect(page.locator('#table tbody tr', { hasText: 'Giacca' })).toHaveCount(0);
});

test('nessun errore nella console', async () => {
    expect(ctx.erroriConsole).toEqual([]);
});
