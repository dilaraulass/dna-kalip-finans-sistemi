import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildFinancialAnalysis,
  convertAmount,
} from "../services/financeService";
import {
  archiveExpenseInvoice,
  createExpenseInvoice,
  getFinanceDashboard,
  updateExpenseInvoice,
  updatePaymentTracking,
} from "../services/financeApi";
import "./Finance.css";
import Drawer from "../components/Drawer/Drawer";
import ExpenseInvoiceTable from "../components/Finance/ExpenseInvoiceTable";
import FinancialAnalysis from "../components/Finance/FinancialAnalysis";
import FinanceStatusCards from "../components/Finance/FinanceStatusCards";
import FinanceTabs from "../components/Finance/FinanceTabs";
import PaymentMilestoneTable from "../components/Finance/PaymentMilestoneTable";
import FinanceDetail from "../components/FinanceDetail/FinanceDetail";
import ExpenseDetail from "../components/ExpenseDetail/ExpenseDetail";
import {
  ALL_FILTER_VALUE,
  DEFAULT_EXCHANGE_RATES,
  CURRENCIES,
  FINANCE_MODULES,
  FINANCE_TABS,
  STATUS_KEYS,
  STATUS_FILTERS,
} from "../constants/financeConstants";

const NEW_EXPENSE_INVOICE_ROW = {
  id: "new-expense-invoice",
  isNew: true,
  workOrder: "",
  invoiceType: "",
  company: "",
  amount: 0,
  convertedAmount: 0,
  currency: CURRENCIES.try,
  invoiceDate: "",
  dueDays: 0,
  paymentDate: "",
  expectedPaymentDate: "",
  paymentDateDifference: null,
  paymentStatus: "pending",
  statusKey: "pending",
  status: "Bekleyen",
  daysUntilDue: null,
};

function Finance() {
  const [financeData, setFinanceData] = useState({
    paymentMilestones: [],
    expenseInvoices: [],
    exchangeRates: DEFAULT_EXCHANGE_RATES,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailUpdateError, setDetailUpdateError] = useState("");
  const [detailUpdateSubmitting, setDetailUpdateSubmitting] = useState(false);
  const [detailArchiveSubmitting, setDetailArchiveSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(FINANCE_MODULES.supplier);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_KEYS.all);
  const [companyFilter, setCompanyFilter] = useState(ALL_FILTER_VALUE);
  const [workOrderFilter, setWorkOrderFilter] = useState(ALL_FILTER_VALUE);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState(CURRENCIES.eur);
  const [expenseViewMode, setExpenseViewMode] = useState("grouped");
  const [reportMode, setReportMode] = useState("general");
  const [reportMonth, setReportMonth] = useState("");
  const [reportWorkOrder, setReportWorkOrder] = useState(ALL_FILTER_VALUE);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);

  const loadFinanceDashboard = useCallback(async ({ signal } = {}) => {
    await Promise.resolve();

    try {
      setLoading(true);
      setError("");
      const data = await getFinanceDashboard({ signal });
      setFinanceData({
        paymentMilestones: data.paymentMilestones || [],
        expenseInvoices: data.expenseInvoices || [],
        exchangeRates: data.exchangeRates || DEFAULT_EXCHANGE_RATES,
      });
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError("Finans verileri yüklenirken bir hata oluştu.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      loadFinanceDashboard({ signal: controller.signal });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadFinanceDashboard]);

  const supplierRows = useMemo(
    () =>
      financeData.paymentMilestones
        .filter((row) => row.financeTab === FINANCE_TABS.supplier)
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
        .filter((row) => row.financeTab === FINANCE_TABS.customer)
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
    if (activeTab === FINANCE_MODULES.supplier) return supplierRows;
    if (activeTab === FINANCE_MODULES.customer) return customerRows;

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
      companyFilter === ALL_FILTER_VALUE
        ? paymentRows
        : paymentRows.filter((row) => row.company === companyFilter),
    [companyFilter, paymentRows],
  );

  const paymentStats = useMemo(() => {
    const result = {
      [STATUS_KEYS.all]: 0,
      [STATUS_KEYS.paid]: 0,
      [STATUS_KEYS.pending]: 0,
      [STATUS_KEYS.approaching]: 0,
      [STATUS_KEYS.overdue]: 0,
    };

    companyRows.forEach((row) => {
      const targetDate =
        row.paymentDate || row.approvalDate || row.contractDate;
      const matchesDate =
        (!dateStart || (targetDate && targetDate >= dateStart)) &&
        (!dateEnd || (targetDate && targetDate <= dateEnd));

      if (!matchesDate) return;

      result[STATUS_KEYS.all] += row.convertedAmount;
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
          companyFilter === ALL_FILTER_VALUE || row.company === companyFilter;
        const matchesWorkOrder =
          workOrderFilter === ALL_FILTER_VALUE || row.workOrder === workOrderFilter;
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
      [STATUS_KEYS.all]: 0,
      [STATUS_KEYS.paid]: 0,
      [STATUS_KEYS.pending]: 0,
      [STATUS_KEYS.approaching]: 0,
      [STATUS_KEYS.overdue]: 0,
    };

    expenseBaseRows.forEach((row) => {
      result[STATUS_KEYS.all] += row.convertedAmount;
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
      statusFilter === STATUS_KEYS.all || row.statusKey === statusFilter;
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
        statusFilter === STATUS_KEYS.all || row.statusKey === statusFilter;

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
    setStatusFilter(STATUS_KEYS.all);
    setCompanyFilter(ALL_FILTER_VALUE);
    setWorkOrderFilter(ALL_FILTER_VALUE);
    setSearchText("");
    setSelectedRow(null);
    setSelectedRowId(null);
    setDetailUpdateError("");
    setDetailArchiveSubmitting(false);
  };

  async function handlePaymentTrackingSave(payload) {
    if (!selectedRow) return;

    try {
      setDetailUpdateSubmitting(true);
      setDetailUpdateError("");
      await updatePaymentTracking(selectedRow.id, payload);
      await loadFinanceDashboard();
      setSelectedRow(null);
      setSelectedRowId(null);
    } catch (requestError) {
      setDetailUpdateError(
        requestError.message || "Ödeme takibi güncellenemedi.",
      );
    } finally {
      setDetailUpdateSubmitting(false);
    }
  }

  async function handleExpenseInvoiceSave(payload) {
    if (!selectedRow) return;

    try {
      setDetailUpdateSubmitting(true);
      setDetailUpdateError("");

      if (selectedRow.isNew) {
        await createExpenseInvoice(payload);
      } else {
        await updateExpenseInvoice(selectedRow.id, payload);
      }

      await loadFinanceDashboard();
      setSelectedRow(null);
      setSelectedRowId(null);
    } catch (requestError) {
      setDetailUpdateError(
        requestError.message || "Fatura bilgileri güncellenemedi.",
      );
    } finally {
      setDetailUpdateSubmitting(false);
    }
  }

  function handleCreateExpenseInvoice() {
    setDetailUpdateError("");
    setSelectedRow({ ...NEW_EXPENSE_INVOICE_ROW });
    setSelectedRowId(null);
  }

  async function handleExpenseInvoiceArchive() {
    if (!selectedRow || selectedRow.isNew || detailArchiveSubmitting) return;

    const confirmed = window.confirm(
      `${selectedRow.company} faturası arşivlenecek. Arşivlenen fatura finans toplamlarına dahil edilmez. Devam edilsin mi?`,
    );

    if (!confirmed) return;

    try {
      setDetailArchiveSubmitting(true);
      setDetailUpdateError("");
      await archiveExpenseInvoice(selectedRow.id);
      await loadFinanceDashboard();
      setSelectedRow(null);
      setSelectedRowId(null);
    } catch (requestError) {
      setDetailUpdateError(
        requestError.message || "Fatura arşivlenemedi.",
      );
    } finally {
      setDetailArchiveSubmitting(false);
    }
  }

  const paymentModule =
    activeTab === FINANCE_MODULES.supplier ||
    activeTab === FINANCE_MODULES.customer;
  const expenseModule = activeTab === FINANCE_MODULES.expenses;
  const companyLabel =
    activeTab === FINANCE_MODULES.customer ? "Müşteri" : "Tedarikçi";
  const transactionLabel =
    activeTab === FINANCE_MODULES.customer ? "Tahsilat" : "Ödeme";
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
              setSelectedRow={(row) => {
                setDetailUpdateError("");
                setSelectedRow(row);
              }}
              setSelectedRowId={setSelectedRowId}
              onCreateInvoice={handleCreateExpenseInvoice}
            />
          )}
          {activeTab === FINANCE_MODULES.expenses && (
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
              setSelectedRow={(row) => {
                setDetailUpdateError("");
                setSelectedRow(row);
              }}
              setSelectedRowId={setSelectedRowId}
            />
          )}
          {activeTab === FINANCE_MODULES.analysis && (
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
        onClose={() => {
          setSelectedRow(null);
          setDetailUpdateError("");
          setDetailArchiveSubmitting(false);
        }}
        title={
          expenseModule && selectedRow?.isNew
            ? "Yeni Fatura"
            : expenseModule
              ? "Fatura Detayı"
              : `${transactionLabel} Detayı`
        }
        subtitle={
          expenseModule ? selectedRow?.company : selectedRow?.contractNumber
        }
        width={520}
      >
        {expenseModule ? (
          <ExpenseDetail
            key={selectedRow?.id}
            selectedRow={selectedRow}
            displayCurrency={displayCurrency}
            error={detailUpdateError}
            saving={detailUpdateSubmitting}
            archiving={detailArchiveSubmitting}
            mode={selectedRow?.isNew ? "create" : "edit"}
            onSave={handleExpenseInvoiceSave}
            onArchive={handleExpenseInvoiceArchive}
          />
        ) : (
          <FinanceDetail
            key={selectedRow?.id}
            selectedRow={selectedRow}
            displayCurrency={displayCurrency}
            error={detailUpdateError}
            saving={detailUpdateSubmitting}
            onSave={handlePaymentTrackingSave}
          />
        )}
      </Drawer>
    </>
  );
}

export default Finance;
