// Preload in sandbox: nessun accesso a Node né al database, solo IPC verso il main process.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lavasecco', {
    // Ritorna { ok: true, dati } oppure { ok: false, errore: { codice, messaggio, campo } }
    chiama: (metodo, ...args) => ipcRenderer.invoke('db', metodo, ...args),
    // Apre la finestra "Salva con nome" e copia il database; stessa forma di risposta
    esportaBackup: () => ipcRenderer.invoke('app:esportaBackup')
});
