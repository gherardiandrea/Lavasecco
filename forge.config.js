// Solo questi file finiscono nell'app pacchettizzata (whitelist): niente dati locali, build vecchie, test.
const INCLUSI = [
    /^\/package\.json$/,
    /^\/LICENSE\.md$/,
    /^\/(main|preload|database|repository|app\.config|app|function|function_modals|funzioni_tabelle)\.js$/,
    /^\/(index|modali)\.html$/,
    /^\/styles\.css$/,
    /^\/img(\/|$)/,
    /^\/node_modules(\/|$)/
];

module.exports = {
    packagerConfig: {
        asar: true,
        ignore: (percorso) => percorso !== '' && !INCLUSI.some((re) => re.test(percorso))
    },
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: { name: 'lavasecco' }
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
