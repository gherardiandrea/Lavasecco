// Solo questi file finiscono nell'app pacchettizzata (whitelist): niente dati locali, build vecchie, test.
const INCLUSI = [
    /^\/package\.json$/,
    /^\/LICENSE\.md$/,
    /^\/(main|preload|ipc|database|repository|app\.config)\.js$/,
    /^\/renderer(\/|$)/,
    /^\/(index|modali)\.html$/,
    /^\/styles\.css$/,
    /^\/img(\/|$)/,
    /^\/node_modules(\/|$)/
];

module.exports = {
    packagerConfig: {
        asar: true,
        // Senza estensione: il packager usa icon.ico su Windows e icon.png altrove (generate da scripts/crea-icona.js)
        icon: 'img/icon',
        ignore: (percorso) => percorso !== '' && !INCLUSI.some((re) => re.test(percorso))
    },
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                name: 'lavasecco',
                setupIcon: 'img/icon.ico'
            }
        },
        {
            name: '@electron-forge/maker-zip',
            platforms: ['darwin']
        },
        {
            name: '@electron-forge/maker-deb',
            config: {}
        },
        {
            name: '@electron-forge/maker-rpm',
            config: {}
        }
    ]
};
