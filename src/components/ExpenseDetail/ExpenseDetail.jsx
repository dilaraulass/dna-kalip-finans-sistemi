import { useState } from "react";
import {
  CURRENCIES,
  CURRENCY_OPTIONS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_OPTIONS,
} from "../../constants/financeConstants";
import { formatMoney } from "../../services/financeService";
import "../FinanceDetail/FinanceDetail.css";

function getInitialForm(selectedRow) {
  return {
    companyId: selectedRow?.companyId || "",
    workOrderNumber:
      selectedRow?.workOrder === "GENEL" ? "" : selectedRow?.workOrder || "",
    invoiceType: selectedRow?.invoiceType || "",
    description: selectedRow?.company || "",
    amount: String(selectedRow?.amount ?? ""),
    currency: selectedRow?.currency || CURRENCIES.try,
    invoiceDate: selectedRow?.invoiceDate || "",
    dueDays: String(selectedRow?.dueDays ?? ""),
    paymentDate: selectedRow?.paymentDate || "",
    status: selectedRow?.paymentStatus || PAYMENT_STATUSES.pending,
    invoiceIssued: Boolean(selectedRow?.invoiceIssued),
    invoiceNumber: selectedRow?.invoiceNumber || "",
  };
}

function ExpenseDetail({
  selectedRow,
  displayCurrency,
  error = "",
  saving = false,
  archiving = false,
  mode = "edit",
  companyOptions = [],
  onSave,
  onArchive,
}) {
  const [form, setForm] = useState(() => getInitialForm(selectedRow));
  const isCreateMode = mode === "create";

  if (!selectedRow) return null;

  const selectedCompany = companyOptions.find(
    (company) => company.id === form.companyId,
  );

  function handleChange(event) {
    const { checked, name, type, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "invoiceIssued" && !checked ? { invoiceNumber: "" } : {}),
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    onSave?.({
      companyId: form.companyId,
      workOrderNumber: form.workOrderNumber || null,
      invoiceType: form.invoiceType || null,
      description: selectedCompany?.name || form.description,
      amount: Number.parseFloat(form.amount || "0"),
      currency: form.currency,
      invoiceDate: form.invoiceDate,
      dueDays: Number.parseInt(form.dueDays || "0", 10),
      paymentDate: form.paymentDate || null,
      status: form.status,
      invoiceIssued: form.invoiceIssued,
      invoiceNumber: form.invoiceIssued ? form.invoiceNumber.trim() : null,
    });
  }

  return (
    <div className="finance-detail">
      {!isCreateMode && (
        <>
          <div className="finance-detail-status">
            <span className={`status-badge ${selectedRow.statusKey}`}>
              {selectedRow.status}
              {selectedRow.daysUntilDue !== null &&
                selectedRow.statusKey !== PAYMENT_STATUSES.paid &&
                ` (${Math.abs(selectedRow.daysUntilDue)} gün)`}
            </span>
          </div>

          <div className="finance-detail-section">
            <h3>Fatura Bilgileri</h3>

            <div className="finance-detail-grid">
              <div>
                <span>Firma</span>
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

              <div>
                <span>Fatura Kesildi</span>
                <strong>{selectedRow.invoiceIssued ? "Evet" : "Hayır"}</strong>
              </div>

              <div>
                <span>Fatura No</span>
                <strong>{selectedRow.invoiceNumber || "-"}</strong>
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
        </>
      )}

      <form className="finance-detail-section" onSubmit={handleSubmit}>
        <h3>{isCreateMode ? "Yeni Fatura Bilgisi" : "Fatura Bilgilerini Güncelle"}</h3>

        {error && <div className="finance-detail-error">{error}</div>}

        <div className="finance-detail-form-grid">
          <label>
            <span>Firma</span>
            <select
              name="companyId"
              value={form.companyId}
              onChange={handleChange}
              required
            >
              <option value="">
                {form.description
                  ? `Firma seçin (${form.description})`
                  : "Firma seçin"}
              </option>
              {companyOptions.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
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
              required
            />
          </label>

          <label>
            <span>Para Birimi</span>
            <select name="currency" value={form.currency} onChange={handleChange}>
              {CURRENCY_OPTIONS.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Fatura Tarihi</span>
            <input
              type="date"
              name="invoiceDate"
              value={form.invoiceDate}
              onChange={handleChange}
              required
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
              {PAYMENT_STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <label className="finance-detail-checkbox-label">
            <input
              type="checkbox"
              name="invoiceIssued"
              checked={form.invoiceIssued}
              onChange={handleChange}
            />
            <span>Fatura Kesildi</span>
          </label>

          <label>
            <span>Fatura No</span>
            <input
              type="text"
              name="invoiceNumber"
              value={form.invoiceNumber}
              onChange={handleChange}
              disabled={!form.invoiceIssued}
              required={form.invoiceIssued}
            />
          </label>
        </div>

        <div className="finance-detail-actions">
          <button
            type="submit"
            className="detail-btn primary"
            disabled={saving || archiving}
          >
            {saving ? "Kaydediliyor..." : isCreateMode ? "Fatura Ekle" : "Kaydet"}
          </button>
          {!isCreateMode && (
            <button
              type="button"
              className="detail-btn danger"
              onClick={onArchive}
              disabled={saving || archiving}
            >
              {archiving ? "Arşivleniyor..." : "Arşivle"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default ExpenseDetail;
