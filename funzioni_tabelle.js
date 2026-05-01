
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

function addExtraFilter() {
    $("#table_filter").parent().removeClass();
    $("#table_filter").parent().addClass("col-12");
    $("#table_filter").prepend(`
        <div class="table-extra-filter d-flex align-items-center">
            <i class="fas fa-search mr-2 text-primary fa-fw"></i>
            <span>Filtra per data di ritiro prevista</span>
            <input id="search_column" type="text" class="form-control form-control-sm ml-2">
        </div>
    `);
    $("#table_filter").addClass('d-flex');
    $("#table_filter").find("label").addClass('mt-0 text-dark font-italic');
}

function create_data_table_ordini(stato) {
    $('#table_div').empty();

    $('#table_div').html(`
        <table id="table" class="table table-striped table-bordered table-datatable-ddx table-ordini" cellspacing="0">
            <thead>
                <tr class="thBorderRight">
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
                </tr>
            </thead>
            <tbody id='table_tbody'>
            </tbody>
        </table>
    `);

    $('#table_tbody').html(popolaTabellaOrdini(stato, selected_year));

    table_ordini = $('#table').dataTable({
        columnDefs: [
            { orderable: false, targets: -1 },
            { bSearchable: false, targets: -1 },
            { orderable: false, targets: 0 },
            { bSearchable: false, targets: 0 }
        ],
        language: DT_LANGUAGE,
        pageLength: 5,
        lengthChange: false,
        order: [[6, "desc"]],
        autoWidth: false,
        scrollX: true,
        deferRender: true
    });

    addExtraFilter();
}

function create_data_table_ordini_chiusi(stato) {
    $('#table_div').empty();

    $('#table_div').html(`
        <table id="table" class="table table-striped table-bordered table-datatable-ddx table-ordini table-ordini-chiusi" cellspacing="0">
            <thead>
                <tr class="thBorderRight">
                    <th class="th_first" style="width: 10% !important;"></th>
                    <th>Cliente</th>
                    <th>Prodotto</th>
                    <th>Quantità originale</th>
                    <th>Quantità da consegnare</th>
                    <th>Descrizione</th>
                    <th>Data di consegna</th>
                    <th>Ritiro previsto</th>
                    <th>Ritiro effettivo</th>
                    <th>Posizione</th>
                    <th>Prezzo totale</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id='table_tbody'>
            </tbody>
        </table>
    `);

    $('#table_tbody').html(popolaTabellaOrdini(stato, selected_year_close));

    table_ordini_chiusi = $('#table').dataTable({
        columnDefs: [
            { orderable: false, targets: -1 },
            { bSearchable: false, targets: -1 },
            { orderable: false, targets: 0 },
            { bSearchable: false, targets: 0 }
        ],
        language: DT_LANGUAGE,
        pageLength: 5,
        lengthChange: false,
        order: [[6, "desc"]],
        autoWidth: false,
        scrollX: true,
        deferRender: true
    });

    addExtraFilter();
}

function create_data_table_clienti() {
    $('#table_div').empty();

    $('#table_div').html(`
        <table id="table" class="table table-striped table-bordered table-datatable-ddx table-clienti" cellspacing="0">
            <thead>
                <tr class="thBorderRight">
                    <th>Nome</th>
                    <th>Numero di telefono</th>
                    <th style="width: 6% !important;"></th>
                </tr>
            </thead>
            <tbody id='table_tbody'>
            </tbody>
        </table>
    `);

    $('#table_tbody').html(popolaTabellaClienti());

    table_clienti = $('#table').dataTable({
        language: DT_LANGUAGE,
        pageLength: 5,
        lengthChange: false,
        order: [[0, "asc"]],
        autoWidth: false,
        scrollX: true,
        deferRender: true
    });
}

function create_data_table_prezzi() {
    $('#table_div').empty();

    $('#table_div').html(`
        <table id="table" class="table table-striped table-bordered table-datatable-ddx table-prezzi" cellspacing="0">
            <thead>
                <tr class="thBorderRight">
                    <th style="width: 60%;">Descrizione</th>
                    <th style="width: 40%;">Prezzo</th>
                </tr>
            </thead>
            <tbody id='table_tbody'>
            </tbody>
        </table>
    `);

    $('#table_tbody').html(popolaTabellaPrezzi());

    table_prezzi = $('#table').dataTable({
        language: DT_LANGUAGE,
        pageLength: 5,
        lengthChange: false,
        order: [[0, "asc"]],
        autoWidth: false,
        scrollX: true,
        deferRender: true
    });
}
