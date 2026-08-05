import {
  ALL_FILTER_VALUE,
  CURRENCY_OPTIONS,
} from "../../constants/financeConstants";
import { formatMoney } from "../../services/financeService";
import ViewModeSwitch from "../ui/ViewModeSwitch";

const ANALYSIS_MODES = [
  { value: "general", label: "Genel Durum" },
  { value: "monthly", label: "Aylık Rapor" },
  { value: "project", label: "İş Emri (Proje)" },
];

function groupDetailsByWorkOrder(details) {
  return details.reduce((groups, detail) => {
    const lastGroup = groups.at(-1);

    if (!lastGroup || lastGroup.workOrder !== detail.workOrder) {
      groups.push({ workOrder: detail.workOrder, items: [detail] });
    } else {
      lastGroup.items.push(detail);
    }

    return groups;
  }, []);
}

function escapeExcelValue(value) {
  const normalizedValue = value === null || value === undefined ? "" : value;

  return String(normalizedValue)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildExcelTable({ columns, rows }) {
  const colGroup = columns
    .map((column) => `<col style="width:${column.width}px;" />`)
    .join("");
  const headerRow = columns
    .map((column) => `<th>${escapeExcelValue(column.label)}</th>`)
    .join("");
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${columns
          .map(
            (column) =>
              `<td class="${column.className || ""}">${escapeExcelValue(
                row[column.key],
              )}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return `
    <table>
      <colgroup>${colGroup}</colgroup>
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
}

function downloadExcel(filename, html) {
  const blob = new Blob([`\uFEFF${html}`], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getExportDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function FinancialAnalysis({
  analysisReport,
  analysisWorkOrders,
  reportMode,
  setReportMode,
  reportMonth,
  setReportMonth,
  reportWorkOrder,
  setReportWorkOrder,
  displayCurrency,
  setDisplayCurrency,
}) {
  const analysisTotals = analysisReport.totals;
  const incomeGroups = groupDetailsByWorkOrder(analysisReport.incomeDetails);
  const expenseGroups = groupDetailsByWorkOrder(analysisReport.expenseDetails);
  const hasAnalysisDetails =
    analysisReport.incomeDetails.length > 0 ||
    analysisReport.expenseDetails.length > 0;
  const profitState =
    analysisTotals.totalProfit > 0
      ? "positive"
      : analysisTotals.totalProfit < 0
        ? "negative"
        : "neutral";
  const reportDescription =
    reportMode === "project" && reportWorkOrder !== ALL_FILTER_VALUE
      ? `${reportWorkOrder} iş emri analiz ediliyor.`
      : reportMode === "monthly" && reportMonth
        ? `${reportMonth} dönemi analiz ediliyor.`
        : "Sistemdeki tüm kayıtlar kümülatif olarak analiz ediliyor.";

  const handleExportExcel = () => {
    const summaryRows = [
      {
        label: "Tahsil Edilen",
        amount: formatMoney(analysisTotals.paidIncome, displayCurrency),
      },
      {
        label: "Bekleyen Alacak",
        amount: formatMoney(analysisTotals.pendingIncome, displayCurrency),
      },
      {
        label: "Toplam Gelir",
        amount: formatMoney(analysisTotals.totalIncome, displayCurrency),
      },
      {
        label: "Ödenen",
        amount: formatMoney(analysisTotals.paidExpense, displayCurrency),
      },
      {
        label: "Bekleyen Borç",
        amount: formatMoney(analysisTotals.pendingExpense, displayCurrency),
      },
      {
        label: "Toplam Gider",
        amount: formatMoney(analysisTotals.totalExpense, displayCurrency),
      },
      {
        label: "Net Kasa",
        amount: formatMoney(analysisTotals.realProfit, displayCurrency),
      },
      {
        label: "Bekleyen Net",
        amount: formatMoney(analysisTotals.pendingProfit, displayCurrency),
      },
      {
        label: "Genel Net",
        amount: formatMoney(analysisTotals.totalProfit, displayCurrency),
      },
      { label: "Kâr Marjı", amount: `%${analysisTotals.margin}` },
    ];
    const detailRows = [
      ...analysisReport.incomeDetails.map((detail) => ({
        type: "Gelir",
        workOrder: detail.workOrder,
        date: detail.date,
        description: detail.description,
        status: detail.status,
        amount: formatMoney(detail.income, displayCurrency),
      })),
      ...analysisReport.expenseDetails.map((detail) => ({
        type: "Gider",
        workOrder: detail.workOrder,
        date: detail.date,
        description: detail.description,
        status: detail.status,
        amount: formatMoney(detail.expense, displayCurrency),
      })),
    ];
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; }
            h1 { font-size: 20px; margin: 0 0 8px; }
            h2 { font-size: 16px; margin: 24px 0 8px; color: #0f766e; }
            p { margin: 4px 0; }
            table { border-collapse: collapse; margin-top: 8px; }
            th {
              background: #e2e8f0;
              border: 1px solid #94a3b8;
              font-weight: 700;
              padding: 8px;
              text-align: left;
            }
            td {
              border: 1px solid #cbd5e1;
              padding: 8px;
              vertical-align: top;
            }
            .text { mso-number-format:"\\@"; }
            .amount { font-weight: 700; text-align: right; white-space: nowrap; }
          </style>
        </head>
        <body>
          <h1>Finansal Analiz Raporu</h1>
          <p><strong>Rapor:</strong> ${escapeExcelValue(reportDescription)}</p>
          <p><strong>Para Birimi:</strong> ${escapeExcelValue(displayCurrency)}</p>

          <h2>Özet</h2>
          ${buildExcelTable({
            columns: [
              { key: "label", label: "Özet", width: 220 },
              { key: "amount", label: "Tutar", width: 160, className: "amount" },
            ],
            rows: summaryRows,
          })}

          <h2>Detaylar</h2>
          ${buildExcelTable({
            columns: [
              { key: "type", label: "Tür", width: 90 },
              { key: "workOrder", label: "İş Emri", width: 100, className: "text" },
              { key: "date", label: "Tarih", width: 120, className: "text" },
              { key: "description", label: "Açıklama", width: 520 },
              { key: "status", label: "Durum", width: 110 },
              { key: "amount", label: "Tutar", width: 150, className: "amount" },
            ],
            rows: detailRows,
          })}
        </body>
      </html>
    `;

    downloadExcel(`finansal-analiz-${getExportDateStamp()}.xls`, html);
  };

  const renderDetailRows = (groups, amountKey, emptyText) => {
    if (groups.length === 0) {
      return (
        <tr>
          <td colSpan="3" className="empty-analysis-row">
            {emptyText}
          </td>
        </tr>
      );
    }

    return groups.flatMap((group) =>
      group.items.map((detail, index) => (
        <tr key={detail.id}>
          {index === 0 && (
            <td rowSpan={group.items.length} className="analysis-work-order-cell">
              {group.workOrder}
            </td>
          )}
          <td>
            <strong>{detail.date}</strong>
            <span>{detail.description}</span>
            <small>{detail.type}</small>
          </td>
          <td>
            <strong className="analysis-amount">
              {formatMoney(detail[amountKey], displayCurrency)}
            </strong>
            <small className={`analysis-status ${detail.statusKey}`}>
              {detail.status}
            </small>
          </td>
        </tr>
      )),
    );
  };

  return (
    <div className="analysis-module">
      <div className="analysis-header">
        <div>
          <h2>Finansal Analiz</h2>
          <p>
            Tüm değerler seçilen kura göre çevrilerek kümülatif, aylık veya
            iş emri bazlı hesaplanır.
          </p>
        </div>

        <ViewModeSwitch
          ariaLabel="Rapor görünümü"
          options={ANALYSIS_MODES}
          value={reportMode}
          onChange={setReportMode}
        />
      </div>

      <div className="finance-filters">
        {reportMode === "project" && (
          <label>
            <span>İş Emri Seç</span>
            <select
              value={reportWorkOrder}
              onChange={(event) => setReportWorkOrder(event.target.value)}
            >
              <option value={ALL_FILTER_VALUE}>Tümü</option>
              {analysisWorkOrders.map((workOrder) => (
                <option key={workOrder} value={workOrder}>
                  {workOrder}
                </option>
              ))}
            </select>
          </label>
        )}

        {reportMode === "monthly" && (
          <label>
            <span>Ay Seçin</span>
            <input
              type="month"
              value={reportMonth}
              onChange={(event) => setReportMonth(event.target.value)}
            />
          </label>
        )}

        <label>
          <span>Gösterim Kuru</span>
          <select
            value={displayCurrency}
            onChange={(event) => setDisplayCurrency(event.target.value)}
          >
            {CURRENCY_OPTIONS.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>

        <p className="analysis-filter-note">{reportDescription}</p>
      </div>

      <div className="analysis-summary-grid">
        <div className="analysis-card income">
          <h3>Gelir (Müşteri)</h3>
          <div>
            <span>Tahsil Edilen</span>
            <strong>
              {formatMoney(analysisTotals.paidIncome, displayCurrency)}
            </strong>
          </div>
          <div>
            <span>Bekleyen (Alacak)</span>
            <strong>
              {formatMoney(analysisTotals.pendingIncome, displayCurrency)}
            </strong>
          </div>
          <footer>
            <span>Toplam</span>
            <strong>
              {formatMoney(analysisTotals.totalIncome, displayCurrency)}
            </strong>
          </footer>
        </div>

        <div className="analysis-card expense">
          <h3>Gider (Tedarikçi + Fatura)</h3>
          <div>
            <span>Ödenen</span>
            <strong>
              {formatMoney(analysisTotals.paidExpense, displayCurrency)}
            </strong>
          </div>
          <div>
            <span>Bekleyen (Borç)</span>
            <strong>
              {formatMoney(analysisTotals.pendingExpense, displayCurrency)}
            </strong>
          </div>
          <footer>
            <span>Toplam</span>
            <strong>
              {formatMoney(analysisTotals.totalExpense, displayCurrency)}
            </strong>
          </footer>
        </div>

        <div className={`analysis-card net ${profitState}`}>
          <h3>Net Durum</h3>
          <div>
            <span>Net Kasa (Reel)</span>
            <strong>
              {formatMoney(analysisTotals.realProfit, displayCurrency)}
            </strong>
          </div>
          <div>
            <span>Bekleyen Net</span>
            <strong>
              {formatMoney(analysisTotals.pendingProfit, displayCurrency)}
            </strong>
          </div>
          <footer>
            <span>Genel Net</span>
            <strong>
              {formatMoney(analysisTotals.totalProfit, displayCurrency)}
            </strong>
          </footer>
          <p>
            {analysisTotals.totalProfit < 0
              ? "Zarar (Genel)"
              : `%${analysisTotals.margin} Kâr Marjı (Genel)`}
          </p>
        </div>
      </div>

      <div className="analysis-detail-area">
        <div className="analysis-detail-header">
          <h3>Detaylı Kâr/Zarar Dökümü</h3>
          <button
            type="button"
            className="analysis-export-btn"
            onClick={handleExportExcel}
            disabled={!hasAnalysisDetails}
          >
            Excel'e Aktar
          </button>
        </div>
        <div className="analysis-detail-grid">
          <div className="analysis-detail-card income">
            <div className="analysis-detail-title">
              <span>Gelirler (+)</span>
              <small>Müşteri Sözleşmeleri</small>
            </div>
            <div className="analysis-table-wrap">
              <table className="analysis-table">
                <thead>
                  <tr>
                    <th>İş Emri</th>
                    <th>Tarih / Açıklama</th>
                    <th>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {renderDetailRows(
                    incomeGroups,
                    "income",
                    "Gelir kaydı bulunamadı.",
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="analysis-detail-card expense">
            <div className="analysis-detail-title">
              <span>Giderler (-)</span>
              <small>Tedarikçi + Ek Gider</small>
            </div>
            <div className="analysis-table-wrap">
              <table className="analysis-table">
                <thead>
                  <tr>
                    <th>İş Emri</th>
                    <th>Tarih / Açıklama</th>
                    <th>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {renderDetailRows(
                    expenseGroups,
                    "expense",
                    "Gider kaydı bulunamadı.",
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinancialAnalysis;
