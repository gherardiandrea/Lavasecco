// Test end-to-end: avviano l'app Electron vera su un database di prova (vedi test/e2e/supporto.js).
module.exports = {
    testDir: './test/e2e',
    testMatch: '**/*.spec.js',
    timeout: 60_000,
    expect: { timeout: 5_000 },
    // Una sola app alla volta: ogni file avvia la sua istanza con i suoi dati
    workers: 1,
    fullyParallel: false,
    reporter: [['list']],
    outputDir: 'test-results',
    use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    }
};
