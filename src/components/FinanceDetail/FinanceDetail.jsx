import "./FinanceDetail.css";
import { formatMoney } from "../../services/financeService";

function FinanceDetail({ selectedRow, displayCurrency }) {
  if (!selectedRow) return null;

  return (
    <div className="finance-detail">
      <div className="finance-detail-status">
        <span className={`status-badge ${selectedRow.statusKey}`}>
          {selectedRow.status}
        </span>
      </div>

      <div className="finance-detail-section">
        <h3>Sözleşme Bilgileri</h3>

        <div className="finance-detail-grid">
          <div>
            <span>Sözleşme No</span>
            <strong>{selectedRow.contractNumber}</strong>
          </div>

          <div>
            <span>Firma</span>
            <strong>{selectedRow.company}</strong>
          </div>

          <div>
            <span>İş Emri No</span>
            <strong>{selectedRow.workOrder}</strong>
          </div>

          <div>
            <span>Referans No</span>
            <strong>{selectedRow.referenceNumber}</strong>
          </div>

          <div>
            <span>Sözleşme Bedeli</span>
            <strong>
              {formatMoney(
                selectedRow.convertedContractAmount,
                displayCurrency,
              )}
            </strong>
          </div>

          <div>
            <span>Orijinal Para Birimi</span>
            <strong>{selectedRow.currency}</strong>
          </div>
        </div>
      </div>

      <div className="finance-detail-section">
        <h3>Hakediş Bilgileri</h3>

        <div className="finance-detail-grid">
          <div>
            <span>Hakediş Oranı</span>
            <strong>%{selectedRow.milestoneRate}</strong>
          </div>

          <div>
            <span>Tutar</span>
            <strong>
              {formatMoney(selectedRow.convertedAmount, displayCurrency)}
            </strong>
          </div>

          <div>
            <span>Onay Tarihi</span>
            <strong>{selectedRow.approvalDate || "-"}</strong>
          </div>

          <div>
            <span>Ödeme Tarihi</span>
            <strong>{selectedRow.paymentDate || "-"}</strong>
          </div>

          <div>
            <span>Vade</span>
            <strong>{selectedRow.activeDueDays} gün</strong>
          </div>
        </div>
      </div>

      <div className="finance-detail-section">
        <h3>Hakediş Şartı</h3>

        <p className="finance-detail-note">
          {selectedRow.milestoneCondition}
          {selectedRow.subMilestone && ` — ${selectedRow.subMilestone}`}
        </p>
      </div>
      <div className="finance-detail-actions">
            
      {/* <button className="detail-btn primary">
        PDF Görüntüle
      </button>

      <button className="detail-btn secondary">
        Ödeme Geçmişi
      </button>

      <button className="detail-btn secondary">
        Düzenle
      </button> */}
    </div>

  </div>
       
  );
}

export default FinanceDetail;
