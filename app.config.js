const os = require('os');
const path = require('path');

const APP_NAME = 'Lavasecco';

// Vecchia posizione del database (versioni <= 1.x): dentro la cartella del progetto.
const LEGACY_DB_PATH = path.join(__dirname, 'str', 'extraResources', 'lavasecco.sqlite3');

// Stessa cartella che Electron restituisce con app.getPath('userData'),
// calcolata a mano per gli script che girano fuori da Electron (es. backup-db).
function defaultUserDataDir() {
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), APP_NAME);
    }
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
    }
    return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), APP_NAME);
}

function resolvePaths(userDataDir = defaultUserDataDir()) {
    const DATA_DIR = process.env.LAVASECCO_DATA_DIR || path.join(userDataDir, 'dati');
    const DB_FILE_NAME = process.env.LAVASECCO_DB_FILE || 'lavasecco.sqlite3';
    return {
        DATA_DIR,
        DB_PATH: path.join(DATA_DIR, DB_FILE_NAME),
        BACKUP_DIR: process.env.LAVASECCO_BACKUP_DIR || path.join(DATA_DIR, 'backups'),
        BACKUP_RETENTION_DAYS: Number.parseInt(process.env.LAVASECCO_BACKUP_RETENTION_DAYS || '30', 10)
    };
}

module.exports = {
    APP_NAME,
    LEGACY_DB_PATH,
    defaultUserDataDir,
    resolvePaths
};
