import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExpenseInvoices,
  buildFinancialAnalysis,
  buildFinanceMilestones,
  convertAmount,
  extractAmount,
  isCustomerContract,
} from "./financeService.js";

test("extractAmount parses Turkish formatted values", () => {
  assert.equal(extractAmount("117.000 EUR"), 117000);
  assert.equal(extractAmount("1.234,56 TL"), 1234.56);
  assert.equal(extractAmount(9500), 9500);
});

test("buildFinanceMilestones uses deterministic tracking keys", () => {
  const contracts = [
    {
      id: "DNA-TEST-001",
      tedarikci: "Test Firma",
      finansData: {
        sekme: "tedarikci",
        tamSozlesmeNo: "DNA-TEST-001",
        kalipAdeti: "1",
        toplamTutarNum: 1000,
        paraBirimi: "EUR",
        hakedisler: [
          { oran: 50, sart: "İlk hakediş", vadeSarti: "30 GÜN" },
          { oran: 50, sart: "İkinci hakediş", vadeSarti: "60 GÜN" },
        ],
      },
      odemeTakibi: {
        h_1: {
          onayTarihi: "2026-01-01",
          odemeTarihi: "2026-03-02",
          durum: "paid",
        },
      },
    },
  ];

  const milestones = buildFinanceMilestones(contracts, "supplier");

  assert.equal(milestones.length, 2);
  assert.equal(milestones[0].trackingKey, "h_0");
  assert.equal(milestones[0].paymentDate, "");
  assert.equal(milestones[1].trackingKey, "h_1");
  assert.equal(milestones[1].paymentDate, "2026-03-02");
  assert.equal(milestones[1].statusKey, "paid");
});

test("supplier first milestone is split by mold count", () => {
  const contracts = [
    {
      id: "DNA-TEST-002",
      finansData: {
        sekme: "tedarikci",
        kalipAdeti: "2",
        toplamTutarNum: 1000,
        paraBirimi: "EUR",
        hakedisler: [
          { oran: 60, sart: "Kalıp hakedişi", vadeSarti: "30 GÜN" },
          { oran: 40, sart: "Teslim", vadeSarti: "30 GÜN" },
        ],
      },
      formData: {
        kalipTutarlari: {
          0: "250 EUR",
          1: "350 EUR",
        },
      },
      odemeTakibi: {
        h_0_alt_1: { onayTarihi: "2026-02-01" },
      },
    },
  ];

  const milestones = buildFinanceMilestones(contracts, "supplier");

  assert.equal(milestones.length, 3);
  assert.deepEqual(
    milestones.map((item) => item.trackingKey),
    ["h_0_alt_0", "h_0_alt_1", "h_1"],
  );
  assert.deepEqual(
    milestones.map((item) => item.amount),
    [250, 350, 400],
  );
  assert.equal(milestones[1].approvalDate, "2026-02-01");
});

test("contracts are separated by finance tab", () => {
  assert.equal(
    isCustomerContract({ finansData: { sekme: "musteri" } }),
    true,
  );
  assert.equal(
    isCustomerContract({ finansData: { sekme: "tedarikci" } }),
    false,
  );
});

test("convertAmount converts currencies through TRY", () => {
  const rates = { EUR: 50, USD: 40, TRY: 1 };

  assert.equal(convertAmount(100, "EUR", "TRY", rates), 5000);
  assert.equal(convertAmount(100, "EUR", "USD", rates), 125);
  assert.equal(convertAmount(5000, "TL", "EUR", rates), 100);
});

test("buildExpenseInvoices maps invoice fields and explicit paid status", () => {
  const invoices = buildExpenseInvoices([
    {
      id: "inv-1",
      isEmri: "26001",
      type: "Fason İşçilik",
      desc: "Test Firma",
      amount: 1500,
      currency: "TRY",
      date: "2026-01-01",
      vade: 30,
      paymentDate: "2026-02-05",
      status: "paid",
    },
  ]);

  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].workOrder, "26001");
  assert.equal(invoices[0].company, "Test Firma");
  assert.equal(invoices[0].expectedPaymentDate, "2026-01-31");
  assert.equal(invoices[0].paymentDateDifference, 5);
  assert.equal(invoices[0].statusKey, "paid");
});

test("buildFinancialAnalysis separates real and pending profit", () => {
  const report = buildFinancialAnalysis({
    customerRows: [
      {
        id: "customer-1",
        workOrder: "26001",
        contractNumber: "M-001",
        company: "Müşteri A",
        milestoneCondition: "Teslim",
        convertedAmount: 1000,
        paymentStatus: "paid",
        statusKey: "paid",
        status: "Ödenen",
        paymentDate: "2026-01-10",
      },
      {
        id: "customer-2",
        workOrder: "26001",
        contractNumber: "M-001",
        company: "Müşteri A",
        milestoneCondition: "Kapanış",
        convertedAmount: 500,
        paymentStatus: "pending",
        statusKey: "pending",
        status: "Bekleyen",
        approvalDate: "2026-01-20",
      },
    ],
    supplierRows: [
      {
        id: "supplier-1",
        workOrder: "26001",
        contractNumber: "T-001",
        company: "Tedarikçi A",
        milestoneCondition: "İmalat",
        convertedAmount: 300,
        paymentStatus: "paid",
        statusKey: "paid",
        status: "Ödenen",
        paymentDate: "2026-01-12",
      },
    ],
    expenseRows: [
      {
        id: "expense-1",
        workOrder: "26001",
        invoiceType: "Fason",
        company: "Ek Gider A",
        convertedAmount: 200,
        paymentStatus: "pending",
        statusKey: "pending",
        status: "Bekleyen",
        invoiceDate: "2026-01-15",
      },
    ],
    mode: "project",
    workOrder: "26001",
  });

  assert.equal(report.totals.paidIncome, 1000);
  assert.equal(report.totals.pendingIncome, 500);
  assert.equal(report.totals.paidExpense, 300);
  assert.equal(report.totals.pendingExpense, 200);
  assert.equal(report.totals.realProfit, 700);
  assert.equal(report.totals.pendingProfit, 300);
  assert.equal(report.totals.totalProfit, 1000);
  assert.equal(report.totals.margin, 66.7);
  assert.equal(report.incomeDetails.length, 2);
  assert.equal(report.expenseDetails.length, 2);
});
