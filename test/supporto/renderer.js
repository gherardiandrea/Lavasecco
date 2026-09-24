// Carica gli script "puri" del renderer (nessun jQuery/DOM) in un contesto isolato di Node,
// come farebbe il browser: le funzioni diventano globali del contesto.
// L'orologio è fissato, così i test sulle date non dipendono dal giorno in cui si eseguono.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CARTELLA_RENDERER = path.join(__dirname, '..', '..', 'renderer');

function caricaRenderer(file = ['formato.js', 'celle.js'], { adesso = '2026-09-24T10:00:00' } = {}) {
    const DataReale = Date;
    const istante = new DataReale(adesso).getTime();
    class DataFissa extends DataReale {
        constructor(...argomenti) {
            super(...(argomenti.length ? argomenti : [istante]));
        }
        static now() {
            return istante;
        }
    }

    const contesto = vm.createContext({ Date: DataFissa, setTimeout, clearTimeout, console });
    for (const nome of file) {
        vm.runInContext(fs.readFileSync(path.join(CARTELLA_RENDERER, nome), 'utf8'), contesto, { filename: nome });
    }
    // Le costanti (const) non diventano proprietà del contesto: le leggo valutandole
    contesto.valuta = (espressione) => vm.runInContext(espressione, contesto);
    return contesto;
}

module.exports = { caricaRenderer };
