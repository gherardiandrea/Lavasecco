// Avvio del renderer: modali, listino, pagina "Oggi", stato del backup.

function caricaModali() {
    return new Promise((resolve, reject) => {
        $('#modali').load('modali.html', (risposta, esito, xhr) => {
            if (esito === 'error') reject(new Error(`Impossibile caricare le modali (${xhr.status} ${xhr.statusText})`));
            else resolve();
        });
    });
}

$(async () => {
    const oggi = new Date();
    $('#data-oggi-giorno').text(dataLunga(oggi));
    $('#data-oggi-anno').text(oggi.getFullYear());

    try {
        await caricaModali();
        stato.prodotti = await api('getProdotti');
        await vaiA('oggi');
    } catch (error) {
        mostraErrore(error);
    }
    aggiornaStatoBackup();
    // Il backup giornaliero parte in background all'avvio: ricontrollo poco dopo
    setTimeout(aggiornaStatoBackup, 5000);
});
