import { DataGrid } from "@mui/x-data-grid";
import { trTR } from "@mui/x-data-grid/locales";
import { formatMoney } from "../../services/financeService";
import StatusBadge from "../ui/StatusBadge";

function PaymentMilestoneTable({
  activeTab,
  rows,
  companies,
  companyLabel,
  companyFilter,
  setCompanyFilter,
  dateStart,
  setDateStart,
  dateEnd,
  setDateEnd,
  displayCurrency,
  setDisplayCurrency,
  setStatusFilter,
  searchText,
  setSearchText,
  selectedRowId,
  setSelectedRow,
  setSelectedRowId,
}) {
  const columns = [
    { field: "contractNumber", headerName: "Sözleşme No", width: 160 },
    {
      field: "company",
      headerName: activeTab === "customer" ? "Müşteri" : "Tedarikçi",
      width: 175,
    },
    { field: "workOrder", headerName: "İş Emri No", width: 115 },
    { field: "referenceNumber", headerName: "Parça Ref. No", width: 180 },
    {
      field: "convertedContractAmount",
      headerName: "Sözleşme Bedeli",
      width: 150,
      valueFormatter: (value) => formatMoney(value, displayCurrency),
    },
    {
      field: "milestoneCondition",
      headerName: "Hakediş Şartı",
      width: 260,
      valueGetter: (_value, row) =>
        row.subMilestone
          ? `${row.milestoneCondition} (${row.subMilestone})`
          : row.milestoneCondition,
    },
    { field: "activeDueDays", headerName: "Vade", width: 80 },
    { field: "approvalDate", headerName: "Onay Trh.", width: 115 },
    { field: "paymentDate", headerName: "Ödeme Trh.", width: 115 },
    {
      field: "convertedAmount",
      headerName: "Tutar",
      width: 130,
      valueFormatter: (value) => formatMoney(value, displayCurrency),
    },
    {
      field: "status",
      headerName: "Durum",
      width: 145,
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
          <h2>
            {activeTab === "customer"
              ? "Müşteri Tahsilatları"
              : "Tedarikçi Ödemeleri"}
          </h2>
          <p>{rows.length} hakediş kaydı gösteriliyor</p>
        </div>

        <input
          className="table-search"
          type="text"
          placeholder="Sözleşme, tedarikçi, iş emri ara..."
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
      </div>

      <div className="finance-filters">
        <label>
          <span>{companyLabel}</span>
          <select
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
          >
            <option value="all">Tümü</option>
            {companies.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Başlangıç</span>
          <input
            type="date"
            value={dateStart}
            onChange={(event) => setDateStart(event.target.value)}
          />
        </label>

        <label>
          <span>Bitiş</span>
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
            setStatusFilter("all");
          }}
        >
          Filtreleri Temizle
        </button>
      </div>

      <div style={{ height: 560, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10, page: 0 },
            },
            sorting: {
              sortModel: [{ field: "paymentDate", sort: "asc" }],
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

export default PaymentMilestoneTable;
