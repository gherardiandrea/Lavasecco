const DT_LANGUAGE = {
    lengthMenu: "Mostra _MENU_ risultati per pagina",
    zeroRecords: "Nessuno trovato - spiacente",
    info: "Mostro pagina _PAGE_ di _PAGES_",
    infoEmpty: "Nessun record disponibile",
    infoFiltered: "",
    search: "Cerca",
    infoPostFix: "",
    loadingRecords: "Ricerca in corso",
    emptyTable: "Nessun dato disponibile nella tabella",
    paginate: {
        first: "Primo",
        previous: "Precedente",
        next: "Successivo",
        last: "Ultimo"
    },
    aria: {
        sortAscending: "Ordinamento ascendente",
        sortDescending: "Ordinamento discendente"
    }
};

// Colonna "Ritiro previsto", filtrabile col secondo campo di ricerca
const COLONNA_RITIRO_PREVISTO = 7;

const OPZIONI_DATATABLE = {
    language: DT_LANGUAGE,
    pageLength: 5,
    lengthChange: false,
    autoWidth: false,
    scrollX: true,
    deferRender: true
};

function distruggiTabella() {
    if ($('#table').length && $.fn.dataTable.isDataTable('#table')) {
        $('#table').DataTable().destroy();
    }
    $('#table_div').empty();
}

function htmlTabella(classi, intestazioni) {
    return `
        <table id="table" class="table table-striped table-bordered table-datatable-ddx ${classi}" cellspacing="0">
            <thead>
                <tr class="thBorderRight">${intestazioni}</tr>
            </thead>
            <tbody id='table_tbody'></tbody>
        </table>
    `;
}

function addExtraFilter() {
    $("#table_filter").parent().removeClass().addClass("col-12");
    $("#table_filter").prepend(`
        <div class="table-extra-filter d-flex align-items-center">
            <i class="fas fa-search me-2 text-primary fa-fw"></i>
            <span>Filtra per data di ritiro prevista</span>
            <input id="search_column" type="text" class="form-control form-control-sm ms-2">
        </div>
    `);
    $("#table_filter").addClass('d-flex');
    $("#table_filter").find("label").addClass('mt-0 text-dark fst-italic');
}

// Secondo campo di ricerca, basato esclusivamente sulla data di ritiro prevista.
$(document).on("keyup", "#search_column", function() {
    $('#table').DataTable().column(COLONNA_RITIRO_PREVISTO).search(this.value).draw();
});

// vista: 'aperti' (scheda Ordini) oppure 'consegnati' (scheda Consegnati)
async function create_data_table_ordini(vista) {
    const anno = vista === 'consegnati' ? selected_year_close : selected_year;
    const ordini = await api('getOrdini', { vista, anno });

    distruggiTabella();
    $('#table_div').html(htmlTabella(`table-ordini${vista === 'consegnati' ? ' table-ordini-chiusi' : ''}`, `
        <th class="th_first" style="width: 10% !important;"></th>
        <th>Cliente</th>
        <th>Prodotto</th>
        <th>Quantità originale</th>
        <th>Quantità da consegnare</th>
        <th>Descr.</th>
        <th>Data consegna</th>
        <th>Ritiro previsto</th>
        <th>Ritiro effettivo</th>
        <th>Pos.</th>
        <th>Prezzo totale</th>
        <th></th>
    `));
    $('#table_tbody').html(ordini.map(buildOrdineRow).join(''));

    $('#table').DataTable({
        ...OPZIONI_DATATABLE,
        columnDefs: [
            { orderable: false, searchable: false, targets: [0, -1] }
        ],
        order: [[6, "desc"]]
    });

    addExtraFilter();
}

// Ricarica la tabella ordini della scheda attiva mantenendo ricerca, filtro data e pagina.
async function ricaricaTabellaOrdini({ mantieniFiltri = true } = {}) {
    const vista = sidebar_attiva === 'sidebar_dashboard' ? 'aperti'
        : sidebar_attiva === 'sidebar_ordini_chiusi' ? 'consegnati'
        : null;
    if (!vista) {
        return;
    }

    let stato = null;
    if (mantieniFiltri && $.fn.dataTable.isDataTable('#table')) {
        const dt = $('#table').DataTable();
        stato = { ricerca: dt.search(), ritiro: dt.column(COLONNA_RITIRO_PREVISTO).search(), pagina: dt.page() };
    }

    await create_data_table_ordini(vista);

    if (stato) {
        const dt = $('#table').DataTable();
        $('#search_column').val(stato.ritiro);
        dt.search(stato.ricerca).column(COLONNA_RITIRO_PREVISTO).search(stato.ritiro).draw();
        if (stato.pagina < dt.page.info().pages) {
            dt.page(stato.pagina).draw('page');
        }
    }
}

async function create_data_table_clienti() {
    const clienti = await api('getClienti');

    distruggiTabella();
    $('#table_div').html(htmlTabella('table-clienti', `
        <th>Nome</th>
        <th>Numero di telefono</th>
        <th style="width: 6% !important;"></th>
    `));
    $('#table_tbody').html(clienti.map(buildClienteRow).join(''));

    $('#table').DataTable({
        ...OPZIONI_DATATABLE,
        columnDefs: [{ orderable: false, searchable: false, targets: -1 }],
        order: [[0, "asc"]]
    });
}

async function create_data_table_prezzi() {
    const prodotti = await api('getProdotti');

    distruggiTabella();
    $('#table_div').html(htmlTabella('table-prezzi', `
        <th style="width: 55%;">Descrizione</th>
        <th style="width: 30%;">Prezzo</th>
        <th style="width: 15%;"></th>
    `));
    $('#table_tbody').html(prodotti.map(buildProdottoRow).join(''));

    $('#table').DataTable({
        ...OPZIONI_DATATABLE,
        columnDefs: [{ orderable: false, searchable: false, targets: -1 }],
        order: [[0, "asc"]]
    });
}
