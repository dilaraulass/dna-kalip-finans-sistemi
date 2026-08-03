import { useState } from "react";
import "./FinanceDetail.css";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_OPTIONS,
} from "../../constants/financeConstants";
import { formatMoney } from "../../services/financeService";

function getInitialForm(selectedRow) {
  return {
    approvalDate: selectedRow?.approvalDate || "",
    paymentDate: selectedRow?.paymentDate || "",
    status: selectedRow?.paymentStatus || PAYMENT_STATUSES.pending,
    dueDays: String(selectedRow?.activeDueDays ?? ""),
  };
}

function FinanceDetail({
  selectedRow,
  displayCurrency,
  error = "",
  saving = false,
  onSave,
}) {
  const [form, setForm] = useState(() => getInitialForm(selectedRow));

  if (!selectedRow) return null;

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const parsedDueDays =
      form.dueDays === "" ? null : Number.parseInt(form.dueDays, 10);
    const dueDaysOverride =
      parsedDueDays === null || parsedDueDays === selectedRow.defaultDueDays
        ? null
        : parsedDueDays;

    onSave?.({
      approvalDate: form.approvalDate || null,
      paymentDate: form.paymentDate || null,
      status: form.status,
      dueDaysOverride,
    });
  }

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
            <span>Ödeme / Tahsilat Tarihi</span>
            <strong>{selectedRow.paymentDate || "-"}</strong>
          </div>

          <div>
            <span>Vade</span>
            <strong>{selectedRow.activeDueDays} gün</strong>
          </div>
        </div>
      </div>

      <form className="finance-detail-section" onSubmit={handleSubmit}>
        <h3>Takip Bilgilerini Güncelle</h3>

        {error && <div className="finance-detail-error">{error}</div>}

        <div className="finance-detail-form-grid">
          <label>
            <span>Onay Tarihi</span>
            <input
              type="date"
              name="approvalDate"
              value={form.approvalDate}
              onChange={handleChange}
            />
          </label>

          <label>
            <span>Ödeme / Tahsilat Tarihi</span>
            <input
              type="date"
              name="paymentDate"
              value={form.paymentDate}
              onChange={handleChange}
            />
          </label>

          <label>
            <span>Durum</span>
            <select name="status" value={form.status} onChange={handleChange}>
              {PAYMENT_STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Vade (Gün)</span>
            <input
              type="number"
              name="dueDays"
              min="0"
              value={form.dueDays}
              onChange={handleChange}
            />
          </label>
        </div>

        <div className="finance-detail-actions">
          <button
            type="submit"
            className="detail-btn primary"
            disabled={saving}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>

      <div className="finance-detail-section">
        <h3>Hakediş Şartı</h3>

        <p className="finance-detail-note">
          {selectedRow.milestoneCondition}
          {selectedRow.subMilestone && ` — ${selectedRow.subMilestone}`}
        </p>
      </div>
    </div>
  );
}

export default FinanceDetail;
