const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getDateTimestamp(dateValue) {
  if (!dateValue) return null;

  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return null;

  return Date.UTC(year, month - 1, day);
}

function getTodayValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function extractAmount(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;

  let normalized = String(value).replace(/[^0-9,.-]/g, "");

  if (normalized.includes(".") && normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  } else if (normalized.includes(".")) {
    const parts = normalized.split(".");
    if (parts.length === 2 && parts[1].length === 3) {
      normalized = normalized.replace(".", "");
    }
  }

  return Number.parseFloat(normalized) || 0;
}

export function isCustomerContract(contract) {
  const finance = contract.finansData || contract;
  const tab = finance.sekme || contract.sekme || "";

  if (tab) return tab === "musteri";

  const workOrder = finance.dnaIsEmriNo || finance.projeNo || "-";
  const contractNumber = finance.tamSozlesmeNo || contract.id || "";

  return workOrder !== "-" && contractNumber.endsWith(workOrder);
}

function getMilestoneStatus(milestone, today = getTodayValue()) {
  if (milestone.paymentStatus === "paid") {
    return { status: "Ödenen", statusKey: "paid", daysUntilDue: null };
  }

  const targetDate = milestone.paymentDate || milestone.approvalDate;
  const targetTimestamp = getDateTimestamp(targetDate);
  const todayTimestamp = getDateTimestamp(today);

  if (targetTimestamp === null || todayTimestamp === null) {
    return { status: "Bekleyen", statusKey: "pending", daysUntilDue: null };
  }

  const daysUntilDue = Math.ceil(
    (targetTimestamp - todayTimestamp) / DAY_IN_MS,
  );

  if (daysUntilDue < 0) {
    return { status: "Geciken", statusKey: "overdue", daysUntilDue };
  }

  if (daysUntilDue <= 14) {
    return { status: "Yaklaşan", statusKey: "approaching", daysUntilDue };
  }

  return { status: "Bekleyen", statusKey: "pending", daysUntilDue };
}

function getPaymentStatus(paymentStatus, targetDate, today = getTodayValue()) {
  if (paymentStatus === "paid") {
    return { status: "Ödenen", statusKey: "paid", daysUntilDue: null };
  }

  const targetTimestamp = getDateTimestamp(targetDate);
  const todayTimestamp = getDateTimestamp(today);

  if (targetTimestamp === null || todayTimestamp === null) {
    return { status: "Bekleyen", statusKey: "pending", daysUntilDue: null };
  }

  const daysUntilDue = Math.ceil(
    (targetTimestamp - todayTimestamp) / DAY_IN_MS,
  );

  if (daysUntilDue < 0) {
    return { status: "Geciken", statusKey: "overdue", daysUntilDue };
  }

  if (daysUntilDue <= 14) {
    return { status: "Yaklaşan", statusKey: "approaching", daysUntilDue };
  }

  return { status: "Bekleyen", statusKey: "pending", daysUntilDue };
}

function createMilestone({
  contract,
  finance,
  milestone,
  milestoneIndex,
  trackingKey,
  tracking,
  subMilestone,
  amount,
}) {
  const dueText = String(milestone.vadeSarti || milestone.vade || "");
  const defaultDueDays = Number.parseInt(dueText.replace(/[^\d]/g, ""), 10) || 0;
  const activeDueDays =
    tracking.vade === undefined
      ? defaultDueDays
      : Number.parseInt(tracking.vade, 10) || 0;

  const paymentStatus =
    tracking.durum === "paid" ||
    milestone.durum === "paid" ||
    milestone.odendiMi ||
    subMilestone?.durum === "paid" ||
    subMilestone?.odendiMi
      ? "paid"
      : "pending";

  const baseMilestone = {
    id: `${contract.id}-${trackingKey}`,
    contractId: contract.id,
    trackingKey,
    contractNumber:
      finance.tamSozlesmeNo || finance.sozlesmeNo || contract.id || "-",
    company:
      finance.tedarikci ||
      contract.tedarikci ||
      finance.firmaAdi ||
      finance.musteriFirma ||
      "-",
    workOrder:
      finance.dnaIsEmriNo ||
      contract.dnaIsEmriNo ||
      finance.projeNo ||
      contract.projeNo ||
      "-",
    referenceNumber:
      finance.referansNo ||
      contract.referansNo ||
      contract.parcaReferans ||
      "-",
    contractDate:
      finance.sozlesmeTarihi || contract.sozlesmeTarihi || "",
    contractAmount:
      Number.parseFloat(
        finance.toplamTutarNum ||
          finance.toplamBedel ||
          contract.toplamBedel,
      ) || 0,
    currency: finance.paraBirimi || contract.paraBirimi || "EUR",
    milestoneRate: milestone.oran || 0,
    milestoneCondition: milestone.sart || milestone.sartAna || "-",
    subMilestone: subMilestone?.isim || subMilestone?.ad || "",
    amount: extractAmount(amount),
    dueText,
    defaultDueDays,
    activeDueDays,
    approvalDate:
      tracking.onayTarihi ||
      subMilestone?.onayTarihi ||
      milestone.onayTarihi ||
      "",
    paymentDate:
      tracking.odemeTarihi ||
      subMilestone?.odemeTarihi ||
      milestone.odemeTarihi ||
      "",
    paymentStatus,
    milestoneIndex,
  };

  return {
    ...baseMilestone,
    ...getMilestoneStatus(baseMilestone),
  };
}

export function buildFinanceMilestones(contracts, mode) {
  const customerMode = mode === "customer";

  return contracts.flatMap((contract) => {
    if (isCustomerContract(contract) !== customerMode) return [];

    const finance = contract.finansData || contract;
    const trackingData = contract.odemeTakibi || {};
    const rawMilestones =
      finance.hakedisler?.length > 0
        ? finance.hakedisler
        : finance.musteriHakedisler || contract.hakedisler || [];
    const contractAmount =
      Number.parseFloat(
        finance.toplamTutarNum ||
          finance.toplamBedel ||
          contract.toplamBedel,
      ) || 0;
    let moldCount = Number.parseInt(
      finance.kalipAdeti ||
        contract.formData?.kalipAdeti ||
        contract.kalipAdeti ||
        contract.kalipSayisi ||
        1,
      10,
    );

    if (!Number.isFinite(moldCount) || moldCount <= 0) moldCount = 1;

    return rawMilestones.flatMap((milestone, milestoneIndex) => {
      const mainAmount =
        extractAmount(milestone.tutarStr || milestone.tutar) ||
        (milestone.oran && contractAmount
          ? (contractAmount * milestone.oran) / 100
          : 0);
      let subMilestones =
        milestone.altKaliplar ||
        milestone.kaliplar ||
        milestone.altOdemeler ||
        milestone.parcalar ||
        null;

      if (
        !customerMode &&
        (!subMilestones || subMilestones.length === 0) &&
        moldCount > 1 &&
        milestoneIndex === 0
      ) {
        const moldAmounts = contract.formData?.kalipTutarlari || {};
        subMilestones = Array.from({ length: moldCount }, (_, index) => ({
          isim: `${index + 1}. Kalıp`,
          tutar: moldAmounts[index]
            ? extractAmount(moldAmounts[index])
            : mainAmount / moldCount,
        }));
      }

      if (Array.isArray(subMilestones) && subMilestones.length > 0) {
        return subMilestones.map((subMilestone, subIndex) => {
          const trackingKey = `h_${milestoneIndex}_alt_${subIndex}`;

          return createMilestone({
            contract,
            finance,
            milestone,
            milestoneIndex,
            trackingKey,
            tracking: trackingData[trackingKey] || {},
            subMilestone,
            amount:
              extractAmount(subMilestone.tutar) ||
              mainAmount / subMilestones.length,
          });
        });
      }

      const trackingKey = `h_${milestoneIndex}`;

      return [
        createMilestone({
          contract,
          finance,
          milestone,
          milestoneIndex,
          trackingKey,
          tracking: trackingData[trackingKey] || {},
          subMilestone: null,
          amount: mainAmount,
        }),
      ];
    });
  });
}

export function buildExpenseInvoices(expenses) {
  return expenses.map((invoice) => {
    const invoiceDate = invoice.date || "";
    const dueDays = Number.parseInt(invoice.vade, 10) || 0;
    const paymentDate = invoice.paymentDate || invoiceDate;
    const expectedPaymentTimestamp = getDateTimestamp(invoiceDate);
    const actualPaymentTimestamp = getDateTimestamp(paymentDate);
    const expectedPaymentDate =
      expectedPaymentTimestamp === null
        ? ""
        : new Date(expectedPaymentTimestamp + dueDays * DAY_IN_MS)
            .toISOString()
            .slice(0, 10);
    const paymentDateDifference =
      expectedPaymentTimestamp === null || actualPaymentTimestamp === null
        ? null
        : Math.round(
            (actualPaymentTimestamp -
              (expectedPaymentTimestamp + dueDays * DAY_IN_MS)) /
              DAY_IN_MS,
          );
    const paymentStatus = invoice.status === "paid" ? "paid" : "pending";

    return {
      id: invoice.id,
      workOrder: invoice.isEmri || "GENEL",
      invoiceType: invoice.type || "-",
      company: invoice.desc || "-",
      amount: extractAmount(invoice.amount),
      currency: invoice.currency || "TRY",
      invoiceDate,
      dueDays,
      paymentDate,
      expectedPaymentDate,
      paymentDateDifference,
      paymentStatus,
      ...getPaymentStatus(paymentStatus, paymentDate),
    };
  });
}

function getAnalysisAmount(row) {
  return row.convertedAmount ?? row.amount ?? 0;
}

function getAnalysisDate(row, source) {
  if (source === "expense") {
    return row.paymentDate || row.invoiceDate || "";
  }

  return row.paymentDate || row.approvalDate || row.contractDate || "";
}

function matchesAnalysisFilters(row, source, filters) {
  const workOrder = row.workOrder || (source === "expense" ? "GENEL" : "-");
  const date = getAnalysisDate(row, source);

  if (
    filters.mode === "project" &&
    filters.workOrder &&
    filters.workOrder !== "all" &&
    workOrder !== filters.workOrder
  ) {
    return false;
  }

  if (
    filters.mode === "monthly" &&
    filters.month &&
    !date.startsWith(filters.month)
  ) {
    return false;
  }

  return true;
}

function sortAnalysisDetails(first, second) {
  const firstWorkOrder =
    first.workOrder === "-" || first.workOrder === "GENEL"
      ? "ZZZ"
      : first.workOrder || "ZZZ";
  const secondWorkOrder =
    second.workOrder === "-" || second.workOrder === "GENEL"
      ? "ZZZ"
      : second.workOrder || "ZZZ";
  const workOrderComparison = firstWorkOrder.localeCompare(
    secondWorkOrder,
    "tr",
    { numeric: true },
  );

  if (workOrderComparison !== 0) return workOrderComparison;

  return (second.date || "").localeCompare(first.date || "");
}

export function buildFinancialAnalysis({
  customerRows = [],
  supplierRows = [],
  expenseRows = [],
  mode = "general",
  workOrder = "all",
  month = "",
} = {}) {
  const totals = {
    paidIncome: 0,
    pendingIncome: 0,
    totalIncome: 0,
    paidExpense: 0,
    pendingExpense: 0,
    totalExpense: 0,
    realProfit: 0,
    pendingProfit: 0,
    totalProfit: 0,
    margin: 0,
  };
  const filters = { mode, workOrder, month };
  const details = [];

  customerRows.forEach((row) => {
    if (!matchesAnalysisFilters(row, "customer", filters)) return;

    const amount = getAnalysisAmount(row);
    if (amount <= 0) return;

    const paid = row.paymentStatus === "paid";

    if (paid) totals.paidIncome += amount;
    else totals.pendingIncome += amount;

    details.push({
      id: `income-${row.id}`,
      source: "income",
      workOrder: row.workOrder || "-",
      date: getAnalysisDate(row, "customer") || "-",
      type: "Müşteri Tahsilatı",
      description: `${row.contractNumber} / ${row.company} - ${row.milestoneCondition}${
        row.subMilestone ? ` (${row.subMilestone})` : ""
      }`,
      income: amount,
      expense: 0,
      statusKey: row.statusKey,
      status: row.status,
    });
  });

  supplierRows.forEach((row) => {
    if (!matchesAnalysisFilters(row, "supplier", filters)) return;

    const amount = getAnalysisAmount(row);
    if (amount <= 0) return;

    const paid = row.paymentStatus === "paid";

    if (paid) totals.paidExpense += amount;
    else totals.pendingExpense += amount;

    details.push({
      id: `supplier-${row.id}`,
      source: "expense",
      workOrder: row.workOrder || "-",
      date: getAnalysisDate(row, "supplier") || "-",
      type: "Tedarikçi Ödemesi",
      description: `${row.contractNumber} / ${row.company} - ${row.milestoneCondition}${
        row.subMilestone ? ` (${row.subMilestone})` : ""
      }`,
      income: 0,
      expense: amount,
      statusKey: row.statusKey,
      status: row.status,
    });
  });

  expenseRows.forEach((row) => {
    if (!matchesAnalysisFilters(row, "expense", filters)) return;

    const amount = getAnalysisAmount(row);
    if (amount <= 0) return;

    const paid = row.paymentStatus === "paid";

    if (paid) totals.paidExpense += amount;
    else totals.pendingExpense += amount;

    details.push({
      id: `invoice-${row.id}`,
      source: "expense",
      workOrder: row.workOrder || "GENEL",
      date: getAnalysisDate(row, "expense") || "-",
      type: "Ek Gider Faturası",
      description: `${row.invoiceType} / ${row.company}`,
      income: 0,
      expense: amount,
      statusKey: row.statusKey,
      status: row.status,
    });
  });

  totals.totalIncome = totals.paidIncome + totals.pendingIncome;
  totals.totalExpense = totals.paidExpense + totals.pendingExpense;
  totals.realProfit = totals.paidIncome - totals.paidExpense;
  totals.pendingProfit = totals.pendingIncome - totals.pendingExpense;
  totals.totalProfit = totals.totalIncome - totals.totalExpense;
  totals.margin =
    totals.totalIncome > 0
      ? Number(((totals.totalProfit / totals.totalIncome) * 100).toFixed(1))
      : 0;

  details.sort(sortAnalysisDetails);

  return {
    totals,
    details,
    incomeDetails: details.filter((detail) => detail.income > 0),
    expenseDetails: details.filter((detail) => detail.expense > 0),
  };
}

export function convertAmount(amount, fromCurrency, toCurrency, rates) {
  if (!amount || fromCurrency === toCurrency) return amount || 0;

  const normalizedFrom = fromCurrency === "TL" ? "TRY" : fromCurrency;
  const normalizedTo = toCurrency === "TL" ? "TRY" : toCurrency;
  const safeRates = { EUR: 1, USD: 1, TRY: 1, ...rates };
  const valueInTry =
    normalizedFrom === "TRY"
      ? amount
      : amount * (safeRates[normalizedFrom] || 1);

  return normalizedTo === "TRY"
    ? valueInTry
    : valueInTry / (safeRates[normalizedTo] || 1);
}

export function formatMoney(amount, currency) {
  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)} ${currency}`;
}
