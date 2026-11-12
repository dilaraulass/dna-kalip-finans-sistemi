import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiAlertCircle, FiCheckCircle, FiChevronLeft, FiChevronRight, FiEdit3,
  FiFileText, FiMinus, FiPlus, FiTrash2, FiUploadCloud,
} from 'react-icons/fi';
import { CURRENCY_OPTIONS, PAYMENT_STATUS_OPTIONS } from '../../constants/financeConstants';
import { getCompanyExpenseDefaults } from '../../services/financeApi';
import { extractInvoiceFields } from '../../services/invoiceExtraction';
import {
  createInvoiceDraft,
  draftToExpensePayload,
  getInvoiceDraftFieldSeverity,
  getFirstInvoiceDraftErrorField,
  getInvoiceDraftReviewStatus,
  invoiceDuplicateKey,
  MAX_BATCH_BYTES,
  MAX_BATCH_INVOICES,
  validateInvoiceDraftFields,
} from '../../services/invoiceBatch';
import { readLocalInvoice } from '../../services/localInvoiceReader';
import { useUnsavedChanges } from '../UnsavedChanges/useUnsavedChanges';

const newItem = file => ({
  id: crypto.randomUUID(), file, fileName: file.name, selected: true,
  state: 'processing', progress: 'Sırada bekliyor', error: '', result: null, form: null,
});

export default function BatchInvoiceImport({
  companies,
  expenseTypes,
  existingInvoices = [],
  disabled,
  onSaveBatch,
  onBusyChange,
}) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [focusTarget, setFocusTarget] = useState(null);
  const input = useRef(null);
  const fields = useRef(new Map());
  const previewViewport = useRef(null);
  const request = useRef(null);
  const isBusy = busy || saving;
  useUnsavedChanges(items.some(item => item.state === 'ready'), { busy: isBusy });
  useEffect(() => { onBusyChange?.(isBusy); return () => onBusyChange?.(false); }, [isBusy, onBusyChange]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!focusTarget) return;
    const element = fields.current.get(`${focusTarget.id}:${focusTarget.field}`);
    if (!element) return;
    element.focus();
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFocusTarget(null);
  }, [activeId, focusTarget]);

  const selected = items.filter(item => item.selected && item.state === 'ready');
  const saved = items.filter(item => item.state === 'saved').length;
  const activeItem = items.find(item => item.id === activeId) || items[0] || null;
  const activeCompany = companies.find(company => company.id === activeItem?.form?.companyId);
  const activePreviews = activeItem?.result?.previews || [];
  const activePage = Math.min(page, Math.max(0, activePreviews.length - 1));
  const activeIndex = activeItem ? items.findIndex(item => item.id === activeItem.id) : -1;
  const existingKeys = useMemo(() => new Set(existingInvoices.map(invoice =>
    invoiceDuplicateKey(invoice.companyId, invoice.invoiceNumber)).filter(Boolean)), [existingInvoices]);
  const currentBatchKeys = useMemo(() => {
    const keys = new Map();
    items.filter(item => item.selected && item.state === 'ready').forEach(item => {
      const key = item.form.invoiceIssued
        ? invoiceDuplicateKey(item.form.companyId, item.form.invoiceNumber)
        : '';
      if (key) keys.set(key, (keys.get(key) || 0) + 1);
    });
    return keys;
  }, [items]);
  const currentValidation = useMemo(() => Object.fromEntries(items.map(item => [
    item.id,
    item.state === 'ready'
      ? validateInvoiceDraftFields(item, existingKeys, currentBatchKeys)
      : {},
  ])), [currentBatchKeys, existingKeys, items]);
  const activeValidation = activeItem ? (currentValidation[activeItem.id] || {}) : {};
  const invoiceNumberSeverity = getInvoiceDraftFieldSeverity('invoiceNumber', activeValidation.invoiceNumber);

  function updateItem(id, change) {
    setItems(current => current.map(item => item.id === id
      ? (typeof change === 'function' ? change(item) : { ...item, ...change })
      : item));
  }

  async function addDefaults(draft, signal) {
    if (!draft.form.companyId) return draft;
    try {
      const defaults = await getCompanyExpenseDefaults(draft.form.companyId, { signal });
      if (!defaults) return draft;
      return { ...draft, form: {
        ...draft.form,
        dueDays: draft.form.dueDays || String(defaults.dueDays),
        expenseTypeId: String(defaults.expenseTypeId || ''),
      } };
    } catch (failure) {
      if (signal.aborted) throw failure;
      return draft;
    }
  }

  async function processFiles(files) {
    if (!files.length) return;
    if (files.length > MAX_BATCH_INVOICES) {
      setError(`Tek seferde en fazla ${MAX_BATCH_INVOICES} fatura seçebilirsiniz.`); return;
    }
    if (files.reduce((total, file) => total + file.size, 0) > MAX_BATCH_BYTES) {
      setError('Seçilen dosyaların toplam boyutu en fazla 50 MB olabilir.'); return;
    }
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const queue = files.map(newItem);
    setItems(queue); setValidation({}); setError(''); setBusy(true);
    setActiveId(queue[0]?.id || null); setPage(0); setZoom(100);
    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index];
      if (controller.signal.aborted) break;
      updateItem(item.id, { progress: `${index + 1}/${queue.length} · Belge hazırlanıyor` });
      try {
        const document = await readLocalInvoice(item.file, {
          signal: controller.signal,
          onProgress: progress => updateItem(item.id, { progress: `${index + 1}/${queue.length} · ${progress}` }),
        });
        const extracted = extractInvoiceFields(document.text);
        let draft = createInvoiceDraft(item.file, document, extracted, companies, item.id);
        draft = await addDefaults(draft, controller.signal);
        updateItem(item.id, draft);
      } catch (failure) {
        if (!controller.signal.aborted) updateItem(item.id, {
          state: 'error', progress: '',
          error: failure.name === 'PasswordException'
            ? 'Şifreli PDF okunamıyor.'
            : `Belge okunamadı: ${failure.message}`,
        });
      }
    }
    if (!controller.signal.aborted) setBusy(false);
  }

  function choose(event) {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    void processFiles(files);
  }

  function changeForm(id, field, value) {
    setValidation(current => {
      const nextItem = { ...(current[id] || {}) };
      delete nextItem[field];
      return { ...current, [id]: nextItem };
    });
    updateItem(id, item => ({ ...item, form: { ...item.form, [field]: value } }));
  }

  function openItem(id) {
    setActiveId(id);
    setPage(0);
    setZoom(100);
    const firstField = getFirstInvoiceDraftErrorField(currentValidation[id]);
    setFocusTarget(firstField ? { id, field: firstField } : null);
    previewViewport.current?.scrollTo({ top: 0, left: 0 });
  }

  function moveActiveItem(offset) {
    const nextItem = items[activeIndex + offset];
    if (nextItem) openItem(nextItem.id);
  }

  function removeItem(id) {
    const nextItems = items.filter(item => item.id !== id);
    setItems(nextItems);
    if (activeId === id) setActiveId(nextItems[0]?.id || null);
    setValidation(current => {
      const next = { ...current }; delete next[id]; return next;
    });
  }

  async function selectCompany(item, companyId) {
    changeForm(item.id, 'companyId', companyId);
    if (!companyId) return;
    updateItem(item.id, { defaultsLoading: true });
    try {
      const defaults = await getCompanyExpenseDefaults(companyId);
      if (defaults) updateItem(item.id, current => ({ ...current, defaultsLoading: false, form: {
        ...current.form,
        companyId,
        dueDays: current.form.dueDays || String(defaults.dueDays),
        expenseTypeId: current.form.expenseTypeId || String(defaults.expenseTypeId || ''),
      } }));
      else updateItem(item.id, { defaultsLoading: false });
    } catch {
      updateItem(item.id, { defaultsLoading: false });
    }
  }

  async function saveSelected() {
    const batchKeys = new Map();
    selected.forEach(item => {
      const key = item.form.invoiceIssued ? invoiceDuplicateKey(item.form.companyId, item.form.invoiceNumber) : '';
      if (key) batchKeys.set(key, (batchKeys.get(key) || 0) + 1);
    });
    const errors = Object.fromEntries(selected.map(item =>
      [item.id, validateInvoiceDraftFields(item, existingKeys, batchKeys)]));
    setValidation(errors);
    const invalid = selected.find(item => Object.keys(errors[item.id]).length > 0);
    if (invalid) {
      const firstField = getFirstInvoiceDraftErrorField(errors[invalid.id]);
      setActiveId(invalid.id);
      setPage(0);
      setZoom(100);
      if (firstField) setFocusTarget({ id: invalid.id, field: firstField });
      setError('Kaydetmeden önce işaretli faturalardaki eksik veya mükerrer alanları düzeltin.'); return;
    }
    setError(''); setSaving(true);
    selected.forEach(item => updateItem(item.id, { state: 'saving' }));
    try {
      const results = await onSaveBatch(selected.map(item => ({
        draftId: item.id,
        payload: draftToExpensePayload(item, companies),
      })));
      const byId = new Map(results.map(result => [result.draftId, result]));
      setItems(current => current.map(item => {
        const result = byId.get(item.id);
        if (!result) return item;
        return result.ok
          ? { ...item, selected: false, state: 'saved', error: '' }
          : { ...item, state: 'ready', error: result.error || 'Fatura kaydedilemedi.' };
      }));
    } catch (failure) {
      setError(failure.message || 'Faturalar kaydedilemedi. Bilgileriniz korundu; tekrar deneyin.');
      const selectedIds = new Set(selected.map(item => item.id));
      setItems(current => current.map(item => selectedIds.has(item.id)
        ? { ...item, state: 'ready' }
        : item));
    } finally {
      setSaving(false);
    }
  }

  return <div className="invoice-batch">
    <input ref={input} className="invoice-import-input" type="file" multiple accept=".pdf,.jpg,.jpeg,.png"
      disabled={disabled || isBusy} onChange={choose} aria-label="Birden fazla fatura dosyası seç" />
    {!items.length && <>
      <button type="button" className="invoice-import-upload" disabled={disabled} onClick={() => input.current?.click()}>
        <FiUploadCloud aria-hidden="true" /><strong>Faturaları seç</strong>
        <span>En fazla 10 PDF, JPG veya PNG · Toplam en fazla 50 MB</span>
      </button>
      <p className="invoice-import-footnote">Belgeler bilgisayarınızda sırayla okunur; kontrol etmeden kayıt oluşturulmaz.</p>
    </>}
    {error && <div role="alert" className="invoice-import-notice invoice-import-notice--error"><FiAlertCircle /><span>{error}</span></div>}
    {items.length > 0 && <>
      <div className="invoice-batch-toolbar">
        <div><strong>{items.length} fatura</strong><span>{busy ? 'Belgeler sırayla taranıyor' : `${selected.length} kayıt seçili${saved ? ` · ${saved} kaydedildi` : ''}`}</span></div>
        <button type="button" className="invoice-import-link" disabled={isBusy} onClick={() => input.current?.click()}>Dosyaları değiştir</button>
      </div>
      <div className="invoice-batch-list">
        {items.map((item, index) => {
          const reviewStatus = getInvoiceDraftReviewStatus(item, currentValidation[item.id]);
          return <article key={item.id}
          className={`invoice-batch-item invoice-batch-item--${item.state}${activeItem?.id === item.id ? ' invoice-batch-item--active' : ''}`}>
          <label className="invoice-batch-select" title="Kaydedilecek faturayı seç">
            <input type="checkbox" checked={item.selected} disabled={item.state !== 'ready' || saving}
              onChange={event => updateItem(item.id, { selected: event.target.checked })} />
            <span>{index + 1}</span>
          </label>
          <button type="button" className="invoice-batch-open" onClick={() => openItem(item.id)}>
            <FiFileText aria-hidden="true" />
            <span><strong title={item.fileName}>{item.fileName}</strong>
              <small className={`invoice-batch-status invoice-batch-status--${reviewStatus.key}`}>{reviewStatus.label}</small></span>
            {reviewStatus.key === 'missing' && <FiAlertCircle className="invoice-batch-warning" />}
            {item.state === 'saved' ? <FiCheckCircle className="invoice-batch-ok" /> : <FiEdit3 aria-hidden="true" />}
          </button>
          {item.state !== 'saved' && <button type="button" className="invoice-import-link" disabled={isBusy}
            aria-label={`${item.fileName} dosyasını kaldır`} onClick={() => removeItem(item.id)}><FiTrash2 /></button>}
        </article>})}
      </div>
      {activeItem && <section className="invoice-batch-review" aria-label={`${activeItem.fileName} inceleme alanı`}>
        <header>
          <div><span>İncelenen fatura</span><strong>{activeItem.fileName}</strong></div>
          <div className="invoice-batch-review-controls">
            {activeItem.sellerName && <small>Olası satıcı: {activeItem.sellerName}</small>}
            <nav className="invoice-batch-navigation" aria-label="Faturalar arasında geçiş">
              <button type="button" disabled={activeIndex <= 0} onClick={() => moveActiveItem(-1)}>
                <FiChevronLeft aria-hidden="true" /> Önceki fatura
              </button>
              <strong>{activeIndex + 1} / {items.length} fatura</strong>
              <button type="button" disabled={activeIndex < 0 || activeIndex >= items.length - 1} onClick={() => moveActiveItem(1)}>
                Sonraki fatura <FiChevronRight aria-hidden="true" />
              </button>
            </nav>
          </div>
        </header>
        {(activeItem.error || Object.keys(validation[activeItem.id] || {}).length > 0) && <div className="invoice-batch-errors" role="alert">
          {activeItem.error && <span>{activeItem.error}</span>}
          {Object.values(validation[activeItem.id] || {}).flat().map(message => <span key={message}>{message}</span>)}
        </div>}
        {activeItem.state === 'processing' && <div className="invoice-import-scanning"><FiFileText /><span>{activeItem.progress}</span></div>}
        {activeItem.state === 'saved' && <div className="invoice-import-success"><FiCheckCircle /><span>Bu fatura kaydedildi.</span></div>}
        {activeItem.form && activeItem.state !== 'saved' && <>
          {activeItem.companyMatch?.method === 'strong-name' && activeCompany?.id === activeItem.companyMatch.company.id && <div className="invoice-import-notice">
            <FiAlertCircle aria-hidden="true" /><span>Firma, faturadaki ünvan ile isim benzerliğine göre önerildi. Kaydetmeden önce seçimi kontrol edin.</span>
          </div>}
          <div className="invoice-batch-viewer-toolbar" role="group" aria-label="Fatura görünümü">
            <button type="button" title="Uzaklaştır" aria-label="Uzaklaştır" disabled={zoom <= 100} onClick={() => setZoom(value => Math.max(100, value - 25))}><FiMinus /></button>
            <output>%{zoom}</output>
            <button type="button" title="Yakınlaştır" aria-label="Yakınlaştır" disabled={zoom >= 300} onClick={() => setZoom(value => Math.min(300, value + 25))}><FiPlus /></button>
            <button type="button" onClick={() => { setZoom(100); previewViewport.current?.scrollTo({ top: 0, left: 0 }); }}>Genişliğe sığdır</button>
            {activePreviews.length > 1 && <div className="invoice-viewer-pages">
              <button type="button" aria-label="Önceki sayfa" disabled={activePage === 0} onClick={() => { setPage(activePage - 1); previewViewport.current?.scrollTo({ top: 0, left: 0 }); }}><FiChevronLeft /></button>
              <span>{activePage + 1} / {activePreviews.length}</span>
              <button type="button" aria-label="Sonraki sayfa" disabled={activePage >= activePreviews.length - 1} onClick={() => { setPage(activePage + 1); previewViewport.current?.scrollTo({ top: 0, left: 0 }); }}><FiChevronRight /></button>
            </div>}
          </div>
          <div ref={previewViewport} className="invoice-batch-viewer" tabIndex={0}>
            {activePreviews[activePage]
              ? <img src={activePreviews[activePage]} alt={`${activeItem.fileName} sayfa ${activePage + 1}`} style={{ width: `${zoom}%` }} />
              : <span>Belge önizlemesi oluşturulamadı.</span>}
          </div>
          <div className="invoice-batch-grid">
            <label><span>Firma</span><select ref={element => fields.current.set(`${activeItem.id}:companyId`, element)} aria-invalid={Boolean(activeValidation.companyId)} value={activeItem.form.companyId} disabled={isBusy || activeItem.defaultsLoading} onChange={event => void selectCompany(activeItem, event.target.value)}>
              <option value="">Firma seçin</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
            <label><span>Gider türü</span><select ref={element => fields.current.set(`${activeItem.id}:expenseTypeId`, element)} aria-invalid={Boolean(activeValidation.expenseTypeId)} value={activeItem.form.expenseTypeId} disabled={isBusy || activeItem.defaultsLoading} onChange={event => changeForm(activeItem.id, 'expenseTypeId', event.target.value)}>
              <option value="">Gider türü seçin</option>{expenseTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
            <label><span>Fatura no</span><input ref={element => fields.current.set(`${activeItem.id}:invoiceNumber`, element)} aria-invalid={invoiceNumberSeverity === 'error'} data-validation={invoiceNumberSeverity || undefined} value={activeItem.form.invoiceNumber} disabled={isBusy || !activeItem.form.invoiceIssued} onChange={event => changeForm(activeItem.id, 'invoiceNumber', event.target.value)} />
              {activeValidation.invoiceNumber?.map(message => <small key={message} className={`invoice-batch-field-message invoice-batch-field-message--${invoiceNumberSeverity}`}>{message}</small>)}</label>
            <label><span>Fatura tarihi</span><input ref={element => fields.current.set(`${activeItem.id}:invoiceDate`, element)} aria-invalid={Boolean(activeValidation.invoiceDate)} type="date" value={activeItem.form.invoiceDate} disabled={isBusy} onChange={event => changeForm(activeItem.id, 'invoiceDate', event.target.value)} /></label>
            <label><span>Tutar</span><input ref={element => fields.current.set(`${activeItem.id}:amount`, element)} aria-invalid={Boolean(activeValidation.amount)} type="number" min="0" step="0.01" value={activeItem.form.amount} disabled={isBusy} onChange={event => changeForm(activeItem.id, 'amount', event.target.value)} /></label>
            <label><span>Para birimi</span><select value={activeItem.form.currency} disabled={isBusy} onChange={event => changeForm(activeItem.id, 'currency', event.target.value)}>{CURRENCY_OPTIONS.map(currency => <option key={currency}>{currency}</option>)}</select></label>
            <label><span>Vade (gün)</span><input ref={element => fields.current.set(`${activeItem.id}:dueDays`, element)} aria-invalid={Boolean(activeValidation.dueDays)} type="number" min="0" value={activeItem.form.dueDays} disabled={isBusy || activeItem.defaultsLoading} onChange={event => changeForm(activeItem.id, 'dueDays', event.target.value)} /></label>
            <label><span>İş emri</span><input value={activeItem.form.workOrderNumber} disabled={isBusy} onChange={event => changeForm(activeItem.id, 'workOrderNumber', event.target.value)} /></label>
            <label><span>Ödeme tarihi</span><input type="date" value={activeItem.form.paymentDate} disabled={isBusy} onChange={event => changeForm(activeItem.id, 'paymentDate', event.target.value)} /></label>
            <label><span>Durum</span><select value={activeItem.form.status} disabled={isBusy} onChange={event => changeForm(activeItem.id, 'status', event.target.value)}>{PAYMENT_STATUS_OPTIONS.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
            <label className="invoice-batch-checkbox"><input type="checkbox" checked={activeItem.form.invoiceIssued} disabled={isBusy}
              onChange={event => changeForm(activeItem.id, 'invoiceIssued', event.target.checked)} /><span>Fatura kesildi</span></label>
          </div>
        </>}
      </section>}
      <div className="invoice-batch-actions">
        <button type="button" className="invoice-import-apply" disabled={disabled || isBusy || selected.length === 0} onClick={saveSelected}>
          {saving ? 'Faturalar kaydediliyor...' : `Seçilenleri kaydet (${selected.length})`}
        </button>
        <button type="button" className="invoice-import-link" disabled={isBusy} onClick={() => { setItems([]); setError(''); setValidation({}); setActiveId(null); }}>Listeyi temizle</button>
      </div>
    </>}
  </div>;
}
