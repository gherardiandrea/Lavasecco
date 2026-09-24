// Test end-to-end: avviano l'app Electron vera su un database di prova (vedi test/e2e/supporto.js).
const inCI = !!process.env.CI;

module.exports = {
    testDir: './test/e2e',
    testMatch: '**/*.spec.js',
    timeout: 60_000,
    expect: { timeout: inCI ? 10_000 : 5_000 },
    // Una sola app alla volta: ogni file avvia la sua istanza con i suoi dati
    workers: 1,
    fullyParallel: false,
    // In CI un test.only dimenticato fa fallire l'esecuzione; un nuovo tentativo assorbe le lentezze della macchina
    forbidOnly: inCI,
    retries: inCI ? 1 : 0,
    reporter: inCI ? [['list'], ['github']] : [['list']],
    outputDir: 'test-results',
    use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    }
};
