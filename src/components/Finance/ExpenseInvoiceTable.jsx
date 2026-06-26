import { DataGrid } from "@mui/x-data-grid";
import { trTR } from "@mui/x-data-grid/locales";
import { formatMoney } from "../../services/financeService";
import StatusBadge from "../ui/StatusBadge";
import ViewModeSwitch from "../ui/ViewModeSwitch";

const EXPENSE_VIEW_MODES = [
  { value: "grouped", label: "İş Emrine Göre" },
  { value: "chrono", label: "Kronolojik" },
];

function ExpenseInvoiceTable({
  rows,
  expenseCompanies,
  expenseWorkOrders,
  companyFilter,
  setCompanyFilter,
  workOrderFilter,
  setWorkOrderFilter,
  dateStart,
  setDateStart,
  dateEnd,
  setDateEnd,
  displayCurrency,
  setDisplayCurrency,
  setStatusFilter,
  searchText,
  setSearchText,
  expenseViewMode,
  setExpenseViewMode,
  selectedRowId,
  setSelectedRow,
  setSelectedRowId,
}) {
  const columns = [
    { field: "workOrder", headerName: "İş Emri", width: 110 },
    { field: "invoiceType", headerName: "Gider Türü", width: 160 },
    { field: "company", headerName: "Firma / Açıklama", width: 220 },
    {
      field: "convertedAmount",
      headerName: "Tutar",
      width: 140,
      valueFormatter: (value) => formatMoney(value, displayCurrency),
    },
    { field: "invoiceDate", headerName: "Fatura Tarihi", width: 125 },
    { field: "dueDays", headerName: "Vade", width: 80 },
    { field: "paymentDate", headerName: "Ödeme Tarihi", width: 125 },
    {
      field: "status",
      headerName: "Durum",
      width: 155,
      renderCell: ({ row }) => (
        <StatusBadge
          statusKey={row.statusKey}
          status={row.status}
          daysUntilDue={row.daysUntilDue}
        />
      ),
    },
  ];

  return (
    <>
      <div className="table-header">
        <div>
          <h2>Ek Gider Faturaları</h2>
          <p>{rows.length} fatura kaydı gösteriliyor</p>
        </div>

        <input
          className="table-search"
          type="text"
          placeholder="Firma, gider türü veya iş emri ara..."
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
      </div>

      <div className="finance-filters">
        <label>
          <span>Firma</span>
          <select
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
          >
            <option value="all">Tümü</option>
            {expenseCompanies.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>İş Emri</span>
          <select
            value={workOrderFilter}
            onChange={(event) => setWorkOrderFilter(event.target.value)}
          >
            <option value="all">Tümü</option>
            {expenseWorkOrders.map((workOrder) => (
              <option key={workOrder} value={workOrder}>
                {workOrder}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Fatura Başlangıç</span>
          <input
            type="date"
            value={dateStart}
            onChange={(event) => setDateStart(event.target.value)}
          />
        </label>

        <label>
          <span>Fatura Bitiş</span>
          <input
            type="date"
            value={dateEnd}
            onChange={(event) => setDateEnd(event.target.value)}
          />
        </label>

        <label>
          <span>Gösterim Kuru</span>
          <select
            value={displayCurrency}
            onChange={(event) => setDisplayCurrency(event.target.value)}
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="TRY">TRY</option>
          </select>
        </label>

        <button
          type="button"
          className="clear-filter-btn"
          onClick={() => {
            setDateStart("");
            setDateEnd("");
            setCompanyFilter("all");
            setWorkOrderFilter("all");
            setStatusFilter("all");
          }}
        >
          Filtreleri Temizle
        </button>
      </div>

      <ViewModeSwitch
        ariaLabel="Fatura görünümü"
        options={EXPENSE_VIEW_MODES}
        value={expenseViewMode}
        onChange={setExpenseViewMode}
      />

      <div style={{ height: 600, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25, page: 0 },
            },
          }}
          localeText={trTR.components.MuiDataGrid.defaultProps.localeText}
          disableRowSelectionOnClick
          onRowClick={(params) => {
            setSelectedRow(params.row);
            setSelectedRowId(params.id);
          }}
          getRowClassName={(params) => {
            const classes = [`finance-row-${params.row.statusKey}`];
            if (params.id === selectedRowId) {
              classes.push("selected-grid-row");
            }
            return classes.join(" ");
          }}
        />
      </div>
    </>
  );
}

export default ExpenseInvoiceTable;
