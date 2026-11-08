import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { readLocalInvoice } from '../../services/localInvoiceReader';
import { extractInvoiceFields, matchInvoiceSeller } from '../../services/invoiceExtraction';
import { useUnsavedChanges } from '../UnsavedChanges/useUnsavedChanges';
import './InvoiceImport.css';
import { FiFileText, FiUploadCloud, FiCheck, FiCheckCircle, FiAlertCircle, FiRefreshCw, FiMinus, FiPlus, FiChevronLeft, FiChevronRight, FiEye } from 'react-icons/fi';

const labels = { invoiceNumber: 'Fatura no', invoiceDate: 'Fatura tarihi', amount: 'Ödenecek toplam', currency: 'Para birimi', dueDays: 'Vade (gün)' };

export default function InvoiceImport({ companies, onApply, disabled, onBusyChange }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const viewport = useRef(null);
  const zoomAnchor = useRef(null);
  const fileInput = useRef(null);
  const request = useRef(null);
  useUnsavedChanges(false, { busy }); // The parent form tracks imported values as unsaved changes.
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    function handleWheel(event) {
      // Chromium exposes touchpad pinch as Ctrl+wheel. Ordinary two-finger scrolling stays native.
      if (!event.ctrlKey) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      const next = Math.round(Math.min(300, Math.max(100, zoom * Math.exp(-delta * 0.01))));
      if (next === zoom) return;
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left - element.clientLeft;
      const y = event.clientY - rect.top - element.clientTop;
      zoomAnchor.current = { left: (element.scrollLeft + x) * next / zoom - x, top: (element.scrollTop + y) * next / zoom - y };
      setZoom(next);
    }
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [result, busy, zoom]);
  useLayoutEffect(() => {
    if (zoomAnchor.current && viewport.current) {
      viewport.current.scrollTo(zoomAnchor.current);
      zoomAnchor.current = null;
    }
  }, [zoom]);

  async function read(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setFileName(file.name); setProgress('Belge kontrol ediliyor...');
    // Preserve the previous result if the replacement fails.
    const timer = setTimeout(() => controller.abort(new Error('Okuma 3 dakika içinde tamamlanamadı. Daha küçük/net bir dosya deneyin.')), 180_000);
    try {
      const document = await readLocalInvoice(file, { signal: controller.signal, onProgress: setProgress });
      if (controller.signal.aborted) return;
      const extracted = extractInvoiceFields(document.text);
      onApply(extracted.fields, matchInvoiceSeller(extracted.seller, companies)?.id);
      setResult({ ...document, ...extracted, fileName: file.name });
      setPage(0); setZoom(100);
    } catch (failure) {
      if (request.current === controller) setError(controller.signal.aborted ? controller.signal.reason?.message || 'Okuma iptal edildi.' :
        failure.name === 'PasswordException' ? 'Şifreli PDF okunamıyor. Şifresiz bir kopya seçin.' : 'Belge okunamadı. Dosyayı kontrol edin. ' + failure.message);
    } finally {
      clearTimeout(timer);
      if (request.current === controller) { setBusy(false); setProgress(''); }
    }
  }
  const missing = result ? Object.keys(labels).filter(key => result.fields[key] === undefined) : [];
  const needsReview = result && ['invoiceNumber', 'invoiceDate', 'amount', 'currency'].some(key => result.fields[key] === undefined);
  const scanLabel = progress.startsWith('PDF') ? progress.replace('PDF sayfası okunuyor:', 'Sayfa okunuyor ·') :
    progress.startsWith('Metin') ? progress.replace('Metin okunuyor:', 'Metin okunuyor ·') : 'Belge hazırlanıyor';
  const chooseFile = () => fileInput.current?.click();
  function changePage(next) {
    setPage(next);
    viewport.current?.scrollTo({ top: 0, left: 0 });
  }
  return <section className="invoice-import" aria-label="Faturadan otomatik doldurma">
    <header className="invoice-import-heading">
      <span className="invoice-import-icon" aria-hidden="true"><FiFileText /></span>
      <div><h3>Faturadan doldur</h3><p>Belgeyi seçin, bilgileri otomatik okuyalım.</p></div>
    </header>
    <input ref={fileInput} className="invoice-import-input" type="file" accept=".pdf,.jpg,.jpeg,.png"
      aria-label="Fatura dosyası seç" disabled={disabled || busy} onChange={read} tabIndex={-1} />
    {!result && !busy && <>
      <button type="button" className="invoice-import-upload" disabled={disabled} onClick={chooseFile}>
        <FiUploadCloud aria-hidden="true" /><strong>Fatura seç</strong>
        <span>PDF, JPG, PNG · En fazla 10 MB / 5 sayfa</span>
      </button>
      <p className="invoice-import-footnote">Tek fatura seçin. Dosya kayda eklenmez.</p>
    </>}
    {busy && <div className="invoice-import-scanning">
      <div className="invoice-import-scan-paper" aria-hidden="true"><FiFileText /><span /></div>
      <div className="invoice-import-scan-copy"><strong>Fatura taranıyor</strong>
        <span className="invoice-import-filename" title={fileName}>{fileName}</span>
        <span role="status" aria-live="polite">{scanLabel}</span>
      </div>
      <button type="button" className="invoice-import-link" onClick={() => request.current?.abort(new Error('Tarama iptal edildi.'))}>İptal</button>
    </div>}
    {error && <div role="alert" className="invoice-import-notice invoice-import-notice--error"><FiAlertCircle aria-hidden="true" /><span>{error}{result && ' Önceki tarama sonucu korundu.'}</span></div>}
    {result && !busy && <>
      <div className="invoice-import-document">
        {result.previews[0] && <img src={result.previews[0]} alt="" className="invoice-import-thumbnail" />}
        <div className="invoice-import-document-info"><span className="invoice-import-filename" title={result.fileName}>{result.fileName}</span>
          <span className={`invoice-import-state${needsReview ? ' invoice-import-state--review' : ''}`} role="status">
            {needsReview ? <FiAlertCircle aria-hidden="true" /> : <FiCheckCircle aria-hidden="true" />}
            {needsReview ? 'Eksik alanları kontrol edin' : 'Tarama tamamlandı'}
          </span>
        </div>
        <button type="button" className="invoice-import-link" disabled={disabled} onClick={chooseFile} aria-label="Fatura dosyasını değiştir"><FiRefreshCw aria-hidden="true" />Değiştir</button>
      </div>
      <details className="invoice-import-preview">
      <summary><FiEye aria-hidden="true" />Belgeyi görüntüle<span>{result.previews.length} sayfa</span></summary>
      <div className="invoice-viewer-toolbar" role="group" aria-label="Belge görünümü">
        <button type="button" aria-label="Uzaklaştır" title="Uzaklaştır" disabled={zoom <= 100} onClick={() => setZoom(value => Math.max(100, value - 25))}><FiMinus /></button>
        <output aria-live="polite">%{zoom}</output>
        <button type="button" aria-label="Yakınlaştır" title="Yakınlaştır" disabled={zoom >= 300} onClick={() => setZoom(value => Math.min(300, value + 25))}><FiPlus /></button>
        <button type="button" onClick={() => { setZoom(100); viewport.current?.scrollTo({ top: 0, left: 0 }); }}>Genişliğe sığdır</button>
        <div className="invoice-viewer-pages">
          <button type="button" aria-label="Önceki sayfa" disabled={page === 0} onClick={() => changePage(page - 1)}><FiChevronLeft /></button>
          <span aria-live="polite">{page + 1} / {result.previews.length}</span>
          <button type="button" aria-label="Sonraki sayfa" disabled={page >= result.previews.length - 1} onClick={() => changePage(page + 1)}><FiChevronRight /></button>
        </div>
      </div>
      <div ref={viewport} className="invoice-viewer-viewport" tabIndex={0} role="region" aria-label="Fatura önizlemesi, touchpad ile yakınlaştırabilir ve kaydırabilirsiniz">
        <img src={result.previews[page]} alt={`Fatura sayfa ${page + 1}`} style={{ width: `${zoom}%` }} />
      </div>
      <p className="invoice-import-footnote">Touchpad üzerinde iki parmağınızı açıp kapatarak yakınlaştırın veya uzaklaştırın.</p>
      </details>
      {missing.length > 0 && <p className="invoice-import-notice"><FiAlertCircle aria-hidden="true" /><span>Okunamayan alanları formda kontrol edin: {missing.map(key => labels[key]).join(', ')}.</span></p>}
      <p className="invoice-import-company">{result.seller
        ? <>Belgedeki olası satıcı: <strong>{result.seller.name}</strong>. Firma seçimini kontrol edin.</>
        : 'Satıcı net okunamadı. Firmayı listeden seçin.'}</p>
      <div className="invoice-import-success" role="status"><FiCheck aria-hidden="true" /><span>Formdaki bilgileri ve ödenecek toplamı belgeyle karşılaştırıp kaydedin.<small>Elle girdiğiniz değerler korundu. Firma ve gider türünü seçin. Henüz kayıt oluşturulmadı.</small></span></div>
    </>}
  </section>;
}
