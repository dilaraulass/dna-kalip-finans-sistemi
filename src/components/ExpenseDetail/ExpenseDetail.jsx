import { useState } from "react";
import { formatMoney } from "../../services/financeService";
import "../FinanceDetail/FinanceDetail.css";

function getInitialForm(selectedRow) {
  return {
    workOrderNumber: selectedRow?.workOrder === "GENEL" ? "" : selectedRow?.workOrder || "",
    invoiceType: selectedRow?.invoiceType || "",
    description: selectedRow?.company || "",
    amount: String(selectedRow?.amount ?? ""),
    currency: selectedRow?.currency || "TRY",
    invoiceDate: selectedRow?.invoiceDate || "",
    dueDays: String(selectedRow?.dueDays ?? ""),
    paymentDate: selectedRow?.paymentDate || "",
    status: selectedRow?.paymentStatus || "pending",
  };
}

function ExpenseDetail({
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

    onSave?.({
      workOrderNumber: form.workOrderNumber || null,
      invoiceType: form.invoiceType || null,
      description: form.description,
      amount: Number.parseFloat(form.amount || "0"),
      currency: form.currency,
      invoiceDate: form.invoiceDate,
      dueDays: Number.parseInt(form.dueDays || "0", 10),
      paymentDate: form.paymentDate || null,
      status: form.status,
    });
  }

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

      <form className="finance-detail-section" onSubmit={handleSubmit}>
        <h3>Fatura Bilgilerini Güncelle</h3>

        {error && <div className="finance-detail-error">{error}</div>}

        <div className="finance-detail-form-grid">
          <label>
            <span>Firma / Açıklama</span>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
            />
          </label>

          <label>
            <span>İş Emri</span>
            <input
              type="text"
              name="workOrderNumber"
              value={form.workOrderNumber}
              onChange={handleChange}
            />
          </label>

          <label>
            <span>Gider Türü</span>
            <input
              type="text"
              name="invoiceType"
              value={form.invoiceType}
              onChange={handleChange}
            />
          </label>

          <label>
            <span>Tutar</span>
            <input
              type="number"
              name="amount"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={handleChange}
            />
          </label>

          <label>
            <span>Para Birimi</span>
            <select name="currency" value={form.currency} onChange={handleChange}>
              <option value="TRY">TRY</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </label>

          <label>
            <span>Fatura Tarihi</span>
            <input
              type="date"
              name="invoiceDate"
              value={form.invoiceDate}
              onChange={handleChange}
            />
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

          <label>
            <span>Ödeme Tarihi</span>
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
              <option value="pending">Bekleyen</option>
              <option value="paid">Ödenen</option>
            </select>
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
    </div>
  );
}

export default ExpenseDetail;
