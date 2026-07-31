import { useEffect, useMemo, useState } from "react";
import {
  buildFinancialAnalysis,
  convertAmount,
} from "../services/financeService";
import { getFinanceDashboard } from "../services/financeApi";
import "./Finance.css";
import Drawer from "../components/Drawer/Drawer";
import ExpenseInvoiceTable from "../components/Finance/ExpenseInvoiceTable";
import FinancialAnalysis from "../components/Finance/FinancialAnalysis";
import FinanceStatusCards from "../components/Finance/FinanceStatusCards";
import FinanceTabs from "../components/Finance/FinanceTabs";
import PaymentMilestoneTable from "../components/Finance/PaymentMilestoneTable";
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
  const [financeData, setFinanceData] = useState({
    paymentMilestones: [],
    expenseInvoices: [],
    exchangeRates: { EUR: 1, USD: 1, TRY: 1 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("supplier");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [workOrderFilter, setWorkOrderFilter] = useState("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState("EUR");
  const [expenseViewMode, setExpenseViewMode] = useState("grouped");
  const [reportMode, setReportMode] = useState("general");
  const [reportMonth, setReportMonth] = useState("");
  const [reportWorkOrder, setReportWorkOrder] = useState("all");
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFinanceDashboard() {
      try {
        setLoading(true);
        setError("");
        const data = await getFinanceDashboard({ signal: controller.signal });
        setFinanceData({
          paymentMilestones: data.paymentMilestones || [],
          expenseInvoices: data.expenseInvoices || [],
          exchangeRates: data.exchangeRates || { EUR: 1, USD: 1, TRY: 1 },
        });
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError("Finans verileri yüklenirken bir hata oluştu.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadFinanceDashboard();

    return () => controller.abort();
  }, []);

  const supplierRows = useMemo(
    () =>
      financeData.paymentMilestones
        .filter((row) => row.financeTab === "tedarikci")
        .map((row) => ({
          ...row,
          convertedAmount: convertAmount(
            row.amount,
            row.currency,
            displayCurrency,
            financeData.exchangeRates,
            row,
          ),
          convertedContractAmount: convertAmount(
            row.contractAmount,
            row.contractCurrency,
            displayCurrency,
            financeData.exchangeRates,
            row,
          ),
        })),
    [displayCurrency, financeData],
  );

  const customerRows = useMemo(
    () =>
      financeData.paymentMilestones
        .filter((row) => row.financeTab === "musteri")
        .map((row) => ({
          ...row,
          convertedAmount: convertAmount(
            row.amount,
            row.currency,
            displayCurrency,
            financeData.exchangeRates,
            row,
          ),
          convertedContractAmount: convertAmount(
            row.contractAmount,
            row.contractCurrency,
            displayCurrency,
            financeData.exchangeRates,
            row,
          ),
        })),
    [displayCurrency, financeData],
  );

  const paymentRows = useMemo(() => {
    if (activeTab === "supplier") return supplierRows;
    if (activeTab === "customer") return customerRows;

    return [];
  }, [activeTab, customerRows, supplierRows]);

  const expenseRows = useMemo(
    () =>
      financeData.expenseInvoices.map((row) => ({
        ...row,
        convertedAmount: convertAmount(
          row.amount,
          row.currency,
          displayCurrency,
          financeData.exchangeRates,
        ),
      })),
    [displayCurrency, financeData],
  );

  const analysisWorkOrders = useMemo(
    () =>
      [
        ...new Set(
          [...customerRows, ...supplierRows, ...expenseRows]
            .map((row) => row.workOrder)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "tr", { numeric: true })),
    [customerRows, expenseRows, supplierRows],
  );

  const analysisReport = useMemo(
    () =>
      buildFinancialAnalysis({
        customerRows,
        supplierRows,
        expenseRows,
        mode: reportMode,
        workOrder: reportWorkOrder,
        month: reportMonth,
      }),
    [
      customerRows,
      expenseRows,
      reportMode,
      reportMonth,
      reportWorkOrder,
      supplierRows,
    ],
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
      <FinanceTabs
        activeTab={activeTab}
        onTabChange={changePaymentModule}
      />

      {loading && (
        <div className="finance-status">Finans verileri yükleniyor...</div>
      )}

      {!loading && error && (
        <div className="finance-status error">{error}</div>
      )}

      {!loading && !error && (paymentModule || expenseModule) && (
        <FinanceStatusCards
          statusFilters={STATUS_FILTERS}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          activeStats={activeStats}
          displayCurrency={displayCurrency}
          expenseModule={expenseModule}
          transactionLabel={transactionLabel}
        />
      )}

      {!loading && !error && (
        <div className="dashboard-section">
          {paymentModule && (
            <PaymentMilestoneTable
              activeTab={activeTab}
              rows={filteredRows}
              companies={companies}
              companyLabel={companyLabel}
              companyFilter={companyFilter}
              setCompanyFilter={setCompanyFilter}
              dateStart={dateStart}
              setDateStart={setDateStart}
              dateEnd={dateEnd}
              setDateEnd={setDateEnd}
              displayCurrency={displayCurrency}
              setDisplayCurrency={setDisplayCurrency}
              setStatusFilter={setStatusFilter}
              searchText={searchText}
              setSearchText={setSearchText}
              selectedRowId={selectedRowId}
              setSelectedRow={setSelectedRow}
              setSelectedRowId={setSelectedRowId}
            />
          )}
          {activeTab === "expenses" && (
            <ExpenseInvoiceTable
              rows={filteredExpenseRows}
              expenseCompanies={expenseCompanies}
              expenseWorkOrders={expenseWorkOrders}
              companyFilter={companyFilter}
              setCompanyFilter={setCompanyFilter}
              workOrderFilter={workOrderFilter}
              setWorkOrderFilter={setWorkOrderFilter}
              dateStart={dateStart}
              setDateStart={setDateStart}
              dateEnd={dateEnd}
              setDateEnd={setDateEnd}
              displayCurrency={displayCurrency}
              setDisplayCurrency={setDisplayCurrency}
              setStatusFilter={setStatusFilter}
              searchText={searchText}
              setSearchText={setSearchText}
              expenseViewMode={expenseViewMode}
              setExpenseViewMode={setExpenseViewMode}
              selectedRowId={selectedRowId}
              setSelectedRow={setSelectedRow}
              setSelectedRowId={setSelectedRowId}
            />
          )}
          {activeTab === "analysis" && (
            <FinancialAnalysis
              analysisReport={analysisReport}
              analysisWorkOrders={analysisWorkOrders}
              reportMode={reportMode}
              setReportMode={setReportMode}
              reportMonth={reportMonth}
              setReportMonth={setReportMonth}
              reportWorkOrder={reportWorkOrder}
              setReportWorkOrder={setReportWorkOrder}
              displayCurrency={displayCurrency}
              setDisplayCurrency={setDisplayCurrency}
            />
          )}
        </div>
      )}
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
