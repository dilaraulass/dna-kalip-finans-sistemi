import { useMemo, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { trTR } from "@mui/x-data-grid/locales";
import {
  getContracts,
  getExpenses,
  getSettings,
} from "../services/databaseService";
import {
  buildExpenseInvoices,
  buildFinanceMilestones,
  convertAmount,
  formatMoney,
} from "../services/financeService";
import "./Finance.css";
import Drawer from "../components/Drawer/Drawer";
import FinanceDetail from "../components/FinanceDetail/FinanceDetail";
import ExpenseDetail from "../components/ExpenseDetail/ExpenseDetail";

const STATUS_FILTERS = {
  all: "Tümü",
  paid: "Ödenen",
  pending: "Bekleyen",
  approaching: "Yaklaşan",
  overdue: "Geciken",
};

function Finance() {
  const contracts = getContracts();
  const settings = getSettings();
  const [activeTab, setActiveTab] = useState("supplier");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [workOrderFilter, setWorkOrderFilter] = useState("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState("EUR");
  const [expenseViewMode, setExpenseViewMode] = useState("grouped");
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);

  const paymentRows = useMemo(() => {
    if (activeTab !== "supplier" && activeTab !== "customer") return [];

    return buildFinanceMilestones(contracts, activeTab).map((row) => ({
      ...row,
      convertedAmount: convertAmount(
        row.amount,
        row.currency,
        displayCurrency,
        settings.exchangeRates,
      ),
      convertedContractAmount: convertAmount(
        row.contractAmount,
        row.currency,
        displayCurrency,
        settings.exchangeRates,
      ),
    }));
  }, [activeTab, contracts, displayCurrency, settings.exchangeRates]);

  const expenseRows = useMemo(
    () =>
      buildExpenseInvoices(getExpenses()).map((row) => ({
        ...row,
        convertedAmount: convertAmount(
          row.amount,
          row.currency,
          displayCurrency,
          settings.exchangeRates,
        ),
      })),
    [displayCurrency, settings.exchangeRates],
  );

  const companies = useMemo(
    () =>
      [...new Set(paymentRows.map((row) => row.company))].sort((a, b) =>
        a.localeCompare(b, "tr"),
      ),
    [paymentRows],
  );

  const companyRows = useMemo(
    () =>
      companyFilter === "all"
        ? paymentRows
        : paymentRows.filter((row) => row.company === companyFilter),
    [companyFilter, paymentRows],
  );

  const paymentStats = useMemo(() => {
    const result = {
      all: 0,
      paid: 0,
      pending: 0,
      approaching: 0,
      overdue: 0,
    };

    companyRows.forEach((row) => {
      const targetDate =
        row.paymentDate || row.approvalDate || row.contractDate;
      const matchesDate =
        (!dateStart || (targetDate && targetDate >= dateStart)) &&
        (!dateEnd || (targetDate && targetDate <= dateEnd));

      if (!matchesDate) return;

      result.all += row.convertedAmount;
      result[row.statusKey] += row.convertedAmount;
    });

    return result;
  }, [companyRows, dateEnd, dateStart]);

  const expenseCompanies = useMemo(
    () =>
      [...new Set(expenseRows.map((row) => row.company))].sort((a, b) =>
        a.localeCompare(b, "tr"),
      ),
    [expenseRows],
  );

  const expenseWorkOrders = useMemo(
    () =>
      [...new Set(expenseRows.map((row) => row.workOrder))].sort((a, b) =>
        a.localeCompare(b, "tr", { numeric: true }),
      ),
    [expenseRows],
  );

  const expenseBaseRows = useMemo(
    () =>
      expenseRows.filter((row) => {
        const matchesCompany =
          companyFilter === "all" || row.company === companyFilter;
        const matchesWorkOrder =
          workOrderFilter === "all" || row.workOrder === workOrderFilter;
        const matchesDate =
          (!dateStart || row.invoiceDate >= dateStart) &&
          (!dateEnd || row.invoiceDate <= dateEnd);

        return matchesCompany && matchesWorkOrder && matchesDate;
      }),
    [
      companyFilter,
      dateEnd,
      dateStart,
      expenseRows,
      workOrderFilter,
    ],
  );

  const expenseStats = useMemo(() => {
    const result = {
      all: 0,
      paid: 0,
      pending: 0,
      approaching: 0,
      overdue: 0,
    };

    expenseBaseRows.forEach((row) => {
      result.all += row.convertedAmount;
      result[row.statusKey] += row.convertedAmount;
    });

    return result;
  }, [expenseBaseRows]);

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
        <span className={`status-badge ${row.statusKey}`}>
          {row.status}
          {row.daysUntilDue !== null &&
            row.statusKey !== "paid" &&
            ` (${Math.abs(row.daysUntilDue)} gün)`}
        </span>
      ),
    },
  ];

  const expenseColumns = [
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
        <span className={`status-badge ${row.statusKey}`}>
          {row.status}
          {row.daysUntilDue !== null &&
            row.statusKey !== "paid" &&
            ` (${Math.abs(row.daysUntilDue)} gün)`}
        </span>
      ),
    },
  ];

  const filteredRows = companyRows.filter((row) => {
    const search = searchText.trim().toLocaleLowerCase("tr-TR");
    const targetDate =
      row.paymentDate || row.approvalDate || row.contractDate;
    const matchesSearch =
      !search ||
      row.contractNumber.toLocaleLowerCase("tr-TR").includes(search) ||
      row.company.toLocaleLowerCase("tr-TR").includes(search) ||
      row.workOrder.toLocaleLowerCase("tr-TR").includes(search) ||
      row.referenceNumber.toLocaleLowerCase("tr-TR").includes(search) ||
      row.milestoneCondition.toLocaleLowerCase("tr-TR").includes(search);
    const matchesStatus =
      statusFilter === "all" || row.statusKey === statusFilter;
    const matchesDate =
      (!dateStart || (targetDate && targetDate >= dateStart)) &&
      (!dateEnd || (targetDate && targetDate <= dateEnd));

    return matchesSearch && matchesStatus && matchesDate;
  });

  const filteredExpenseRows = expenseBaseRows
    .filter((row) => {
      const search = searchText.trim().toLocaleLowerCase("tr-TR");
      const matchesSearch =
        !search ||
        row.workOrder.toLocaleLowerCase("tr-TR").includes(search) ||
        row.invoiceType.toLocaleLowerCase("tr-TR").includes(search) ||
        row.company.toLocaleLowerCase("tr-TR").includes(search);
      const matchesStatus =
        statusFilter === "all" || row.statusKey === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((first, second) => {
      if (expenseViewMode === "chrono") {
        return first.invoiceDate.localeCompare(second.invoiceDate);
      }

      const workOrderComparison = first.workOrder.localeCompare(
        second.workOrder,
        "tr",
        { numeric: true },
      );

      return (
        workOrderComparison ||
        first.invoiceDate.localeCompare(second.invoiceDate)
      );
    });

  const changePaymentModule = (module) => {
    setActiveTab(module);
    setStatusFilter("all");
    setCompanyFilter("all");
    setWorkOrderFilter("all");
    setSearchText("");
    setSelectedRow(null);
    setSelectedRowId(null);
  };

  const paymentModule =
    activeTab === "supplier" || activeTab === "customer";
  const expenseModule = activeTab === "expenses";
  const companyLabel = activeTab === "customer" ? "Müşteri" : "Tedarikçi";
  const transactionLabel =
    activeTab === "customer" ? "Tahsilat" : "Ödeme";
  const activeStats = expenseModule ? expenseStats : paymentStats;

  return (
    <>
      <div className="finance-tabs">
        <button
          className={activeTab === "supplier" ? "active" : ""}
          onClick={() => changePaymentModule("supplier")}
        >
          Tedarikçi Ödemeleri
        </button>

        <button
          className={activeTab === "customer" ? "active" : ""}
          onClick={() => changePaymentModule("customer")}
        >
          Müşteri Tahsilatları
        </button>

        <button
          className={activeTab === "expenses" ? "active" : ""}
          onClick={() => changePaymentModule("expenses")}
        >
          Ek Gider Faturaları
        </button>

        <button
          className={activeTab === "analysis" ? "active" : ""}
          onClick={() => changePaymentModule("analysis")}
        >
          Finansal Analiz
        </button>
      </div>

      {(paymentModule || expenseModule) && (
        <div className="stats-grid">
          {Object.entries(STATUS_FILTERS).map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={`stat-card ${key} ${
                statusFilter === key ? "selected" : ""
              }`}
              onClick={() => setStatusFilter(key)}
            >
              <h3>
                {key === "all"
                  ? expenseModule
                    ? "Toplam Gider Faturası"
                    : `Toplam ${transactionLabel}`
                  : label}
              </h3>
              <p>{formatMoney(activeStats[key], displayCurrency)}</p>
            </button>
          ))}
        </div>
      )}

      <div className="dashboard-section">
        {paymentModule && (
          <>
            <div className="table-header">
              <div>
                <h2>
                  {activeTab === "customer"
                    ? "Müşteri Tahsilatları"
                    : "Tedarikçi Ödemeleri"}
                </h2>
                <p>
                  {filteredRows.length} hakediş kaydı gösteriliyor
                </p>
              </div>

              <input
                className="table-search"
                type="text"
                placeholder="Sözleşme, tedarikçi, iş emri ara..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
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
                rows={filteredRows}
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
                localeText={
                  trTR.components.MuiDataGrid.defaultProps.localeText
                }
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
        )}

        {activeTab === "expenses" && (
          <>
            <div className="table-header">
              <div>
                <h2>Ek Gider Faturaları</h2>
                <p>{filteredExpenseRows.length} fatura kaydı gösteriliyor</p>
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

            <div className="view-mode-switch" aria-label="Fatura görünümü">
              <button
                type="button"
                className={expenseViewMode === "grouped" ? "active" : ""}
                onClick={() => setExpenseViewMode("grouped")}
              >
                İş Emrine Göre
              </button>
              <button
                type="button"
                className={expenseViewMode === "chrono" ? "active" : ""}
                onClick={() => setExpenseViewMode("chrono")}
              >
                Kronolojik
              </button>
            </div>

            <div style={{ height: 600, width: "100%" }}>
              <DataGrid
                rows={filteredExpenseRows}
                columns={expenseColumns}
                pageSizeOptions={[10, 25, 50, 100]}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 25, page: 0 },
                  },
                }}
                localeText={
                  trTR.components.MuiDataGrid.defaultProps.localeText
                }
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
        )}

        {activeTab === "analysis" && (
          <p>Finansal analiz bölümü eklenecek.</p>
        )}
      </div>
      <Drawer
        isOpen={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        title={expenseModule ? "Fatura Detayı" : `${transactionLabel} Detayı`}
        subtitle={
          expenseModule ? selectedRow?.company : selectedRow?.contractNumber
        }
        width={520}
      >
        {expenseModule ? (
          <ExpenseDetail
            selectedRow={selectedRow}
            displayCurrency={displayCurrency}
          />
        ) : (
          <FinanceDetail
            selectedRow={selectedRow}
            displayCurrency={displayCurrency}
          />
        )}
      </Drawer>
    </>
  );
}

export default Finance;
