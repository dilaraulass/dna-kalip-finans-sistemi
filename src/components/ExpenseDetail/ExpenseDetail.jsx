import { formatMoney } from "../../services/financeService";
import "../FinanceDetail/FinanceDetail.css";

function ExpenseDetail({ selectedRow, displayCurrency }) {
  if (!selectedRow) return null;

  return (
    <div className="finance-detail">
      <div className="finance-detail-status">
        <span className={`status-badge ${selectedRow.statusKey}`}>
          {selectedRow.status}
          {selectedRow.daysUntilDue !== null &&
            selectedRow.statusKey !== "paid" &&
            ` (${Math.abs(selectedRow.daysUntilDue)} gün)`}
        </span>
      </div>

      <div className="finance-detail-section">
        <h3>Fatura Bilgileri</h3>

        <div className="finance-detail-grid">
          <div>
            <span>Firma / Açıklama</span>
            <strong>{selectedRow.company}</strong>
          </div>

          <div>
            <span>İş Emri</span>
            <strong>{selectedRow.workOrder}</strong>
          </div>

          <div>
            <span>Gider Türü</span>
            <strong>{selectedRow.invoiceType}</strong>
          </div>

          <div>
            <span>Tutar</span>
            <strong>
              {formatMoney(selectedRow.convertedAmount, displayCurrency)}
            </strong>
          </div>

          <div>
            <span>Orijinal Para Birimi</span>
            <strong>{selectedRow.currency}</strong>
          </div>

          <div>
            <span>Vade</span>
            <strong>{selectedRow.dueDays} gün</strong>
          </div>
        </div>
      </div>

      <div className="finance-detail-section">
        <h3>Tarih Bilgileri</h3>

        <div className="finance-detail-grid">
          <div>
            <span>Fatura Tarihi</span>
            <strong>{selectedRow.invoiceDate || "-"}</strong>
          </div>

          <div>
            <span>Ödeme Tarihi</span>
            <strong>{selectedRow.paymentDate || "-"}</strong>
          </div>

          <div>
            <span>Hesaplanan Vade Tarihi</span>
            <strong>{selectedRow.expectedPaymentDate || "-"}</strong>
          </div>

          <div>
            <span>Tarih Farkı</span>
            <strong>
              {selectedRow.paymentDateDifference
                ? `${selectedRow.paymentDateDifference > 0 ? "+" : ""}${
                    selectedRow.paymentDateDifference
                  } gün`
                : "Yok"}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExpenseDetail;
