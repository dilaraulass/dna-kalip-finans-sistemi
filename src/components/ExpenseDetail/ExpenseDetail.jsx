import { useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { useFormChanges, useLeaveConfirmation } from "../UnsavedChanges/useUnsavedChanges";
import { FormScopeContext } from "../UnsavedChanges/UnsavedChangesContext";
import InvoiceImport from './InvoiceImport';
import { mergeInvoiceSuggestions } from '../../services/invoiceExtraction';
import { createCompany } from "../../services/companiesApi";
import { getExpenseTypes, getCompanyExpenseDefaults } from "../../services/financeApi";
import { formatDate } from "../../services/tableDisplay";
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
    expenseTypeId: String(selectedRow?.expenseTypeId || ""),
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
  onCompanyCreated,
  onSave,
  onArchive,
}) {
  const [form, setForm] = useState(() => getInitialForm(selectedRow));
  const touchedFields = useRef(new Set());
  const [importedFields, setImportedFields] = useState({});
  const [importBusy, setImportBusy] = useState(false);
  const formScope = useContext(FormScopeContext);
  const requestLeave = useLeaveConfirmation();
  const { can } = useAuth();
  const isCreateMode = mode === "create";
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [typesError, setTypesError] = useState("");
  const [typesAttempt, setTypesAttempt] = useState(0);
  const [defaultsLoading, setDefaultsLoading] = useState(false);
  const [defaultsMessage, setDefaultsMessage] = useState("");
  const defaultsRequest = useRef(null);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const [newCompany, setNewCompany] = useState({ name: "", companyType: "tedarikci", taxNumber: "", email: "", phone: "" });
  useFormChanges(form, { busy: saving || archiving || defaultsLoading });
  const confirmCompanyClose = useFormChanges(newCompany, { enabled: showCompanyForm, busy: companySaving });

  useEffect(() => {
    const controller = new AbortController();
    getExpenseTypes({ signal: controller.signal })
      .then(setExpenseTypes)
      .catch((error) => { if (!controller.signal.aborted) setTypesError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setTypesLoading(false); });
    return () => controller.abort();
  }, [typesAttempt]);

  useEffect(() => () => defaultsRequest.current?.abort(), []);

  async function selectCompany(companyId) {
    defaultsRequest.current?.abort();
    const controller = new AbortController();
    defaultsRequest.current = controller;
    setForm((current) => ({ ...current, companyId, dueDays: touchedFields.current.has('dueDays') ? current.dueDays : "", expenseTypeId: "" }));
    setDefaultsMessage("");
    setDefaultsLoading(Boolean(companyId));
    if (!companyId) return;
    try {
      const defaults = await getCompanyExpenseDefaults(companyId, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (defaults) {
        setForm((current) => ({ ...current, dueDays: touchedFields.current.has('dueDays') ? current.dueDays : String(defaults.dueDays), expenseTypeId: String(defaults.expenseTypeId || "") }));
        setDefaultsMessage(touchedFields.current.has('dueDays') ? "Gider türü son faturadan önerildi; girdiğiniz veya belgeden aktardığınız vade korundu." : "Vade ve gider türü son ek gider faturasından alındı. Değiştirebilirsiniz.");
      } else {
        setDefaultsMessage("Bu firmanın önceki faturası yok. Vade ve gider türünü girin.");
      }
    } catch (error) {
      if (!controller.signal.aborted) setDefaultsMessage(`Önceki bilgiler alınamadı: ${error.message}. Alanları elle doldurabilirsiniz.`);
    } finally {
      if (!controller.signal.aborted) setDefaultsLoading(false);
    }
  }

  async function handleCompanyCreate(event) {
    event.preventDefault();
    setCompanySaving(true);
    setCompanyError("");
    try {
      const company = await createCompany(newCompany);
      onCompanyCreated?.(company);
      setShowCompanyForm(false);
      setNewCompany({ name: "", companyType: "tedarikci", taxNumber: "", email: "", phone: "" });
      await selectCompany(company.id);
    } catch (error) {
      setCompanyError(error.message);
    } finally {
      setCompanySaving(false);
    }
  }

  if (!selectedRow) return null;

  const selectedCompany = companyOptions.find(
    (company) => company.id === form.companyId,
  );

  function handleChange(event) {
    const { checked, name, type, value } = event.target;
    touchedFields.current.add(name);
    setImportedFields(current => {
      const next = { ...current };
      delete next[name];
      if (name === 'invoiceIssued' && !checked) delete next.invoiceNumber;
      return next;
    });

    if (name === "companyId") {
      if (value === "__new") {
        setShowCompanyForm(true);
      } else {
        selectCompany(value);
      }
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "invoiceIssued" && !checked ? { invoiceNumber: "" } : {}),
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (saving || archiving || defaultsLoading || typesLoading || typesError || showCompanyForm || companySaving || importBusy) return;

    onSave?.({
      companyId: form.companyId,
      workOrderNumber: form.workOrderNumber || null,
      invoiceType: form.invoiceType || null,
      expenseTypeId: Number(form.expenseTypeId),
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
      {isCreateMode && can('expenses.edit') && can('finance.view') && <InvoiceImport
        onBusyChange={setImportBusy}
        companies={companyOptions} disabled={saving || companySaving || defaultsLoading || showCompanyForm}
        onApply={fields => {
          const touched = new Set(touchedFields.current);
          setForm(current => mergeInvoiceSuggestions(current, fields, touched));
          // Use the same merge rules for provenance, including the amount/currency pair.
          const imported = mergeInvoiceSuggestions({}, fields, touched);
          setImportedFields(current => ({ ...current, ...imported }));
          if (fields.dueDays !== undefined) touchedFields.current.add('dueDays');
        }}
      />}
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
                <strong>{!can("finance.view") ? "***" : selectedRow.invoiceIssued ? "Evet" : "Hayır"}</strong>
              </div>

              <div>
                <span>Fatura No</span>
                <strong>{can("finance.view") ? selectedRow.invoiceNumber || "-" : "***"}</strong>
              </div>
            </div>
          </div>

          <div className="finance-detail-section">
            <h3>Tarih Bilgileri</h3>

            <div className="finance-detail-grid">
              <div>
                <span>Fatura Tarihi</span>
                <strong>{formatDate(selectedRow.invoiceDate)}</strong>
              </div>

              <div>
                <span>Ödeme Tarihi</span>
                <strong>{formatDate(selectedRow.paymentDate)}</strong>
              </div>

              <div>
                <span>Hesaplanan Vade Tarihi</span>
                <strong>{formatDate(selectedRow.expectedPaymentDate)}</strong>
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

      {showCompanyForm && (
        <form className="finance-detail-section" onSubmit={handleCompanyCreate}>
          <h3>Yeni Firma</h3>
          <p>Firma ayrıca kaydedilir; fatura bilgilerinizi kaybetmeden devam edebilirsiniz.</p>
          {companyError && <div className="finance-detail-error" role="alert">{companyError}</div>}
          <div className="finance-detail-form-grid">
            {[
              ["name", "Firma Adı", "text", 250], ["taxNumber", "Vergi No", "text", 50],
              ["email", "E-posta", "email", 250], ["phone", "Telefon", "tel", 50],
            ].map(([field, label, type, maxLength]) => (
              <label key={field}><span>{label}</span><input type={type} maxLength={maxLength}
                required={field === "name"} value={newCompany[field]} disabled={companySaving}
                onChange={(event) => setNewCompany((current) => ({ ...current, [field]: event.target.value }))} /></label>
            ))}
            <label><span>Firma Türü</span><select value={newCompany.companyType} disabled={companySaving}
              onChange={(event) => setNewCompany((current) => ({ ...current, companyType: event.target.value }))}>
              <option value="tedarikci">Tedarikçi</option><option value="musteri">Müşteri</option>
            </select></label>
          </div>
          <div className="finance-detail-actions">
            <button className="detail-btn primary" disabled={companySaving}>{companySaving ? "Kaydediliyor..." : "Firmayı Kaydet ve Seç"}</button>
            <button type="button" className="detail-btn secondary" disabled={companySaving} onClick={() => confirmCompanyClose(() => {
              setShowCompanyForm(false);
              setNewCompany({ name: "", companyType: "tedarikci", taxNumber: "", email: "", phone: "" });
            })}>Vazgeç</button>
          </div>
        </form>
      )}

      {can("expenses.edit") && <form className="finance-detail-section" onSubmit={handleSubmit}>
        <h3>{isCreateMode ? "Yeni Fatura Bilgisi" : "Fatura Bilgilerini Güncelle"}</h3>

        {error && <div className="finance-detail-error">{error}</div>}
        {typesError && <div className="finance-detail-error" role="alert">
          Gider türleri yüklenemedi: {typesError}
          <button type="button" className="detail-btn secondary" onClick={() => {
            setTypesError(""); setTypesLoading(true); setTypesAttempt((current) => current + 1);
          }}>Tekrar Dene</button>
        </div>}
        <p role="status">{defaultsLoading ? "Firmanın önceki fatura bilgileri alınıyor..." : defaultsMessage}</p>

        <div className="finance-detail-form-grid">
          <label>
            <span>Firma</span>
            <select
              name="companyId"
              disabled={saving || companySaving || showCompanyForm}
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
              <option value="__new">+ Yeni Firma Ekle</option>
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
            <select
              name="expenseTypeId"
              value={form.expenseTypeId}
              onChange={handleChange}
              disabled={typesLoading || defaultsLoading}
              required
            >
              <option value="">{typesLoading ? "Yükleniyor..." : "Gider türü seçin"}</option>
              {expenseTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </label>

          <label>
            <span>Tutar {importedFields.amount === form.amount && <small className="invoice-import-badge">Faturadan alındı</small>}</span>
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
            <span>Para Birimi {importedFields.currency === form.currency && <small className="invoice-import-badge">Faturadan alındı</small>}</span>
            <select name="currency" value={form.currency} onChange={handleChange}>
              {CURRENCY_OPTIONS.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Fatura Tarihi {importedFields.invoiceDate === form.invoiceDate && <small className="invoice-import-badge">Faturadan alındı</small>}</span>
            <input
              type="date"
              name="invoiceDate"
              value={form.invoiceDate}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            <span>Vade (Gün) {importedFields.dueDays === form.dueDays && <small className="invoice-import-badge">Faturadan alındı</small>}</span>
            <input
              type="number"
              name="dueDays"
              disabled={defaultsLoading}
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
            <span>Fatura No {importedFields.invoiceNumber === form.invoiceNumber && <small className="invoice-import-badge">Faturadan alındı</small>}</span>
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
            disabled={saving || archiving || defaultsLoading || typesLoading || !!typesError || showCompanyForm || companySaving || importBusy}
          >
            {saving ? "Kaydediliyor..." : isCreateMode ? "Fatura Ekle" : "Kaydet"}
          </button>
          {!isCreateMode && (
            <button
              type="button"
              className="detail-btn danger"
              onClick={() => requestLeave(onArchive, formScope)}
              disabled={saving || archiving}
            >
              {archiving ? "Taşınıyor..." : "Silinenlere Taşı"}
            </button>
          )}
        </div>
      </form>}
    </div>
  );
}

export default ExpenseDetail;
