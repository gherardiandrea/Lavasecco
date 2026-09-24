// Genera img/icon.ico e img/icon.png per l'installer e la finestra.
// Uso: npx electron scripts/crea-icona.js [logo|monogramma]
// Disegna su un canvas in una finestra nascosta (niente dipendenze esterne) e crea un ICO con PNG incorporati.
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const IMG_DIR = path.join(__dirname, '..', 'img');
const LOGO = path.join(IMG_DIR, 'logo_trim.png');
const DIMENSIONI = [16, 24, 32, 48, 64, 128, 256];
const VARIANTE = process.argv[2] || 'monogramma';
const OUT_DIR = process.argv[3] || IMG_DIR;

// Funzione eseguita nel canvas: ritorna un PNG (data URL) per ogni dimensione
function disegna(variante, logoDataUrl, dimensioni) {
    return new Promise((resolve) => {
        const logo = new Image();
        logo.onload = () => resolve(dimensioni.map((d) => {
            const c = document.createElement('canvas');
            c.width = c.height = d;
            const ctx = c.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            if (variante === 'logo') {
                // Logo intero centrato, su fondo bianco arrotondato
                const r = d * 0.18;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.roundRect(0, 0, d, d, r); ctx.fill();
                const margine = d * 0.06;
                const w = d - margine * 2;
                const h = w * logo.height / logo.width;
                ctx.drawImage(logo, margine, (d - h) / 2, w, h);
            } else {
                // Monogramma: quadrato arrotondato con i colori dell'app e una "L" bianca
                const g = ctx.createLinearGradient(0, 0, d, d);
                g.addColorStop(0, '#1a3a6b');
                g.addColorStop(1, '#0a8f9b');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.roundRect(0, 0, d, d, d * 0.22); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.35)';
                ctx.lineWidth = Math.max(1, d * 0.06);
                ctx.beginPath(); ctx.arc(d * 0.5, d * 0.5, d * 0.34, Math.PI * 0.15, Math.PI * 1.75); ctx.stroke();
                ctx.fillStyle = '#ffffff';
                ctx.font = `800 ${Math.round(d * 0.62)}px "Segoe UI", Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('L', d * 0.52, d * 0.54);
            }
            return c.toDataURL('image/png');
        }));
        logo.src = logoDataUrl;
    });
}

// File ICO con immagini PNG incorporate (supportato da Windows Vista in poi)
function creaIco(pngs) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(pngs.length, 4);
    const voci = [];
    let offset = 6 + 16 * pngs.length;
    for (const { dimensione, dati } of pngs) {
        const voce = Buffer.alloc(16);
        voce.writeUInt8(dimensione >= 256 ? 0 : dimensione, 0);
        voce.writeUInt8(dimensione >= 256 ? 0 : dimensione, 1);
        voce.writeUInt16LE(1, 4);
        voce.writeUInt16LE(32, 6);
        voce.writeUInt32LE(dati.length, 8);
        voce.writeUInt32LE(offset, 12);
        offset += dati.length;
        voci.push(voce);
    }
    return Buffer.concat([header, ...voci, ...pngs.map((p) => p.dati)]);
}

app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
    await win.loadURL('data:text/html,<html><body></body></html>');
    const logoDataUrl = 'data:image/png;base64,' + fs.readFileSync(LOGO).toString('base64');
    const dataUrls = await win.webContents.executeJavaScript(`(${disegna})(${JSON.stringify(VARIANTE)}, ${JSON.stringify(logoDataUrl)}, ${JSON.stringify(DIMENSIONI)})`);

    const pngs = dataUrls.map((u, i) => ({ dimensione: DIMENSIONI[i], dati: Buffer.from(u.split(',')[1], 'base64') }));
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), creaIco(pngs));
    fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), pngs[pngs.length - 1].dati);
    console.log(`Icona "${VARIANTE}" creata in ${OUT_DIR}`);
    app.quit();
});
