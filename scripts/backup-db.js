const fs = require('fs');
const path = require('path');
const { DB_PATH, BACKUP_DIR } = require(path.join(__dirname, '..', 'app.config'));

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function copyIfExists(srcPath, destPath) {
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        return true;
    }
    return false;
}

try {
    ensureDir(BACKUP_DIR);

    const now = new Date();
    const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const baseName = `lavasecco-backup-${stamp}`;
    const mainBackup = path.join(BACKUP_DIR, `${baseName}.sqlite3`);

    if (!fs.existsSync(DB_PATH)) {
        throw new Error(`Database non trovato: ${DB_PATH}`);
    }

    fs.copyFileSync(DB_PATH, mainBackup);

    const walCopied = copyIfExists(`${DB_PATH}-wal`, `${mainBackup}-wal`);
    const shmCopied = copyIfExists(`${DB_PATH}-shm`, `${mainBackup}-shm`);

    console.log(`Backup creato: ${mainBackup}`);
    console.log(`Database: ${DB_PATH}`);
    console.log(`Cartella backup: ${BACKUP_DIR}`);
    console.log(`File extra copiati -> WAL: ${walCopied}, SHM: ${shmCopied}`);
} catch (error) {
    console.error('Errore durante il backup:', error.message);
    process.exitCode = 1;
}
