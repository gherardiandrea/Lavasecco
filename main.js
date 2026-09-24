const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');

const { resolvePaths } = require('./app.config');
const { apriDatabase, backupGiornaliero, creaBackup, timestamp } = require('./database');
const { createRepository, METODI_PUBBLICI } = require('./repository');
const { creaGestoreDb, creaGestoreAzione } = require('./ipc');

const INDEX_PATH = path.join(__dirname, 'index.html');

// Interfaccia in italiano anche per i controlli di Chromium (es. selettore data gg/mm/aaaa)
app.commandLine.appendSwitch('lang', 'it-IT');

let mainWindow = null;
let database = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1024,
        minHeight: 680,
        show: false,
        icon: path.join(__dirname, 'img', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    // L'app mostra solo index.html: niente navigazione né nuove finestre.
    mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    mainWindow.loadFile(INDEX_PATH);
    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
    });

    if (process.env.ELECTRON_DEVTOOLS === '1') {
        mainWindow.webContents.openDevTools();
    }
}

function registraIpc(repository) {
    // Canale unico per i dati: solo i metodi elencati in METODI_PUBBLICI (vedi ipc.js)
    ipcMain.handle('db', creaGestoreDb(repository, METODI_PUBBLICI));
    // Dall'interfaccia (riquadro backup): l'esito lo mostra il renderer
    ipcMain.handle('app:esportaBackup', creaGestoreAzione('esportaBackup', esportaBackup));
}

// Salva una copia del database dove sceglie l'utente (es. chiavetta).
// Ritorna { esportato, percorso } oppure { esportato: false } se annullato; lancia in caso di errore.
async function esportaBackup() {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Esporta backup del database',
        defaultPath: `lavasecco-backup-${timestamp()}.sqlite3`,
        filters: [{ name: 'Database SQLite', extensions: ['sqlite3'] }]
    });
    if (canceled || !filePath) {
        return { esportato: false };
    }
    await creaBackup(database.db, filePath);
    return { esportato: true, percorso: filePath };
}

// Dal menu: esito mostrato con le finestre di sistema
async function esportaBackupDaMenu() {
    try {
        const esito = await esportaBackup();
        if (esito.esportato) {
            dialog.showMessageBox(mainWindow, { type: 'info', message: 'Backup esportato', detail: esito.percorso });
        }
    } catch (error) {
        dialog.showErrorBox('Backup non riuscito', error.message);
    }
}

function creaMenu(paths) {
    const template = [
        {
            label: 'File',
            submenu: [
                { label: 'Esporta backup…', accelerator: 'CmdOrCtrl+Shift+S', click: esportaBackupDaMenu },
                { label: 'Apri cartella dati', click: () => shell.openPath(paths.DATA_DIR) },
                { type: 'separator' },
                { role: 'quit', label: 'Esci' }
            ]
        },
        { role: 'editMenu', label: 'Modifica' },
        {
            label: 'Visualizza',
            submenu: [
                { role: 'reload', label: 'Ricarica' },
                { type: 'separator' },
                { role: 'resetZoom', label: 'Zoom predefinito' },
                { role: 'zoomIn', label: 'Aumenta zoom' },
                { role: 'zoomOut', label: 'Riduci zoom' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Schermo intero' },
                ...(app.isPackaged ? [] : [{ role: 'toggleDevTools', label: 'Strumenti sviluppatore' }])
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function avvia() {
    const paths = resolvePaths(app.getPath('userData'));

    try {
        database = await apriDatabase({ dbPath: paths.DB_PATH, backupDir: paths.BACKUP_DIR });
    } catch (error) {
        console.error('Apertura database non riuscita:', error);
        dialog.showErrorBox('Impossibile aprire il database', `${error.message}\n\nPercorso: ${paths.DB_PATH}`);
        app.exit(1);
        return;
    }

    if (database.migrazioni.length) {
        console.log(`Schema del database aggiornato (migrazioni ${database.migrazioni.join(', ')})`);
        if (database.backupPreMigrazione) console.log('Backup pre-migrazione:', database.backupPreMigrazione);
    }

    registraIpc(createRepository(database.db));
    creaMenu(paths);
    createWindow();

    backupGiornaliero(database.db, paths.BACKUP_DIR, paths.BACKUP_RETENTION_DAYS)
        .catch((error) => console.error('Backup giornaliero non riuscito:', error));
}

// - Installer Squirrel (Windows): durante install/update/uninstall l'app deve solo uscire.
// - Una sola istanza alla volta: due processi sullo stesso database porterebbero a dati incoerenti.
if (require('electron-squirrel-startup') || !app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(avvia);

    app.on('activate', () => {
        if (database && BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });

    app.on('will-quit', () => {
        if (database) {
            database.db.close();
            database = null;
        }
    });
}
