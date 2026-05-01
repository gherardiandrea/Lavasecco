const path = require('path');

const ROOT_DIR = __dirname;
const DATA_DIR = process.env.LAVASECCO_DATA_DIR || path.join(ROOT_DIR, 'str', 'extraResources');
const DB_FILE_NAME = process.env.LAVASECCO_DB_FILE || 'lavasecco.sqlite3';
const DB_PATH = path.join(DATA_DIR, DB_FILE_NAME);
const BACKUP_DIR = process.env.LAVASECCO_BACKUP_DIR || path.join(DATA_DIR, 'backups');
const BACKUP_RETENTION_DAYS = Number.parseInt(process.env.LAVASECCO_BACKUP_RETENTION_DAYS || '30', 10);

module.exports = {
    ROOT_DIR,
    DATA_DIR,
    DB_FILE_NAME,
    DB_PATH,
    BACKUP_DIR,
    BACKUP_RETENTION_DAYS
};
