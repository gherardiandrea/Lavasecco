// Backup manuale del database: npm run backup-db [-- <cartella di destinazione>]
// Usa l'API di backup di SQLite: la copia è coerente anche con l'app aperta.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { resolvePaths } = require('../app.config');
const { creaBackup, timestamp } = require('../database');

async function main() {
    const { DB_PATH, BACKUP_DIR } = resolvePaths();
    const destDir = process.argv[2] ? path.resolve(process.argv[2]) : BACKUP_DIR;

    if (!fs.existsSync(DB_PATH)) {
        throw new Error(`Database non trovato: ${DB_PATH}`);
    }

    const db = new DatabaseSync(DB_PATH, { readOnly: true });
    try {
        const dest = await creaBackup(db, path.join(destDir, `lavasecco-backup-${timestamp()}.sqlite3`));
        console.log(`Backup creato: ${dest}`);
        console.log(`Database: ${DB_PATH}`);
    } finally {
        db.close();
    }
}

main().catch((error) => {
    console.error('Errore durante il backup:', error.message);
    process.exitCode = 1;
});
