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
        <h3>Detaylı Kâr/Zarar Dökümü</h3>
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
                  {analysisReport.incomeDetails.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="empty-analysis-row">
                        Gelir kaydı bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    analysisReport.incomeDetails.map((detail) => (
                      <tr key={detail.id}>
                        <td>{detail.workOrder}</td>
                        <td>
                          <strong>{detail.date}</strong>
                          <span>{detail.description}</span>
                          <small>{detail.type}</small>
                        </td>
                        <td>{formatMoney(detail.income, displayCurrency)}</td>
                      </tr>
                    ))
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
                  {analysisReport.expenseDetails.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="empty-analysis-row">
                        Gider kaydı bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    analysisReport.expenseDetails.map((detail) => (
                      <tr key={detail.id}>
                        <td>{detail.workOrder}</td>
                        <td>
                          <strong>{detail.date}</strong>
                          <span>{detail.description}</span>
                          <small>{detail.type}</small>
                        </td>
                        <td>{formatMoney(detail.expense, displayCurrency)}</td>
                      </tr>
                    ))
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
