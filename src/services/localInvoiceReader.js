const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 5;

// Tesseract terminate() does not settle an in-flight recognize promise.
export function abortable(promise, signal) {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new DOMException('İptal edildi', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function validateInvoiceFile(file) {
  if (!file || !file.size || file.size > MAX_BYTES) throw new Error('Dosya boş olmamalı ve en fazla 10 MB olmalıdır.');
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const pdf = head.slice(0, 5).every((v, i) => v === [37, 80, 68, 70, 45][i]) && head.length >= 5;
  const png = head.length === 8 && head.every((v, i) => v === [137, 80, 78, 71, 13, 10, 26, 10][i]);
  const jpg = head[0] === 255 && head[1] === 216 && head[2] === 255;
  const extension = file.name.split('.').at(-1).toLowerCase();
  if (pdf && extension === 'pdf') return 'pdf';
  if ((png && extension === 'png') || (jpg && ['jpg', 'jpeg'].includes(extension))) return 'image';
  throw new Error('Geçerli bir PDF, JPG veya PNG dosyası seçin.');
}

function canvasFor(width, height, maxSide) {
  if (!Number.isFinite(width * height) || width <= 0 || height <= 0) throw new Error('Belge boyutları okunamadı.');
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  return canvas;
}

function thumbnail(canvas) {
  const preview = canvasFor(canvas.width, canvas.height, 1000);
  preview.getContext('2d').drawImage(canvas, 0, 0, preview.width, preview.height);
  const result = preview.toDataURL('image/jpeg', 0.8);
  preview.width = preview.height = 0;
  return result;
}

export async function readLocalInvoice(file, { signal, onProgress = () => {} } = {}) {
  const kind = await validateInvoiceFile(file);
  signal?.throwIfAborted();
  let worker, loadingTask, renderTask;
  const previews = [], texts = [];
  const abort = () => { renderTask?.cancel(); void worker?.terminate(); void loadingTask?.destroy(); };
  signal?.addEventListener('abort', abort, { once: true });
  async function recognize(canvas) {
    if (!worker) {
      onProgress('Türkçe OCR motoru hazırlanıyor (ilk açılış biraz sürebilir)...');
      const { createWorker } = await import('tesseract.js');
      signal?.throwIfAborted();
      const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href;
      let rejectInitialization;
      const initializationError = new Promise((_, reject) => { rejectInitialization = reject; });
      const creation = createWorker('tur+eng', 1, {
        workerPath: `${base}worker.min.js`, corePath: base, langPath: base,
        workerBlobURL: false,
        errorHandler: message => rejectInitialization(new Error(String(message))),
        logger: message => { if (!signal?.aborted && message.status === 'recognizing text') onProgress(`Metin okunuyor: %${Math.round(message.progress * 100)}`); },
      });
      // If cancelled during initialization, release the worker as soon as it becomes available.
      creation.then(created => { if (signal?.aborted) void created.terminate(); }, () => {});
      worker = await abortable(Promise.race([creation, initializationError]), signal);
      signal?.throwIfAborted();
    }
    const { data } = await abortable(worker.recognize(canvas), signal);
    signal?.throwIfAborted();
    return data.text;
  }
  try {
    if (kind === 'pdf') {
      const pdfjs = await import('pdfjs-dist');
      const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      signal?.throwIfAborted();
      loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()),
        isEvalSupported: false, enableXfa: false, useSystemFonts: true, maxImageSize: 16_000_000 });
      const pdf = await loadingTask.promise;
      if (pdf.numPages > MAX_PAGES) throw new Error('En fazla 5 sayfalık tek bir fatura seçin. Belge kısmen okunmayacaktır.');
      for (let n = 1; n <= pdf.numPages; n++) {
        signal?.throwIfAborted();
        onProgress(`PDF sayfası okunuyor: ${n}/${pdf.numPages}`);
        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(3, 2400 / Math.max(viewport.width, viewport.height));
        const scaled = page.getViewport({ scale });
        const canvas = canvasFor(scaled.width, scaled.height, 2400);
        try {
          renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport: scaled });
          await renderTask.promise;
          previews.push(thumbnail(canvas));
          const content = await page.getTextContent();
          let previousY;
          const text = content.items.map(item => {
            if (!('str' in item)) return '';
            const newLine = previousY !== undefined && Math.abs(previousY - item.transform[5]) > 3;
            previousY = item.transform[5];
            return `${newLine ? '\n' : ' '}${item.str}${item.hasEOL ? '\n' : ''}`;
          }).join('');
          texts.push(text.replace(/\s/g, '').length > 30 ? text : await recognize(canvas));
        } finally { canvas.width = canvas.height = 0; page.cleanup(); }
      }
    } else {
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width * bitmap.height > 24_000_000) throw new Error('Görsel en fazla 24 megapiksel olmalıdır.');
        const canvas = canvasFor(bitmap.width, bitmap.height, 2400);
        try {
          const context = canvas.getContext('2d');
          context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          previews.push(thumbnail(canvas));
          texts.push(await recognize(canvas));
        } finally { canvas.width = canvas.height = 0; }
      } finally { bitmap.close(); }
    }
    signal?.throwIfAborted();
    const text = texts.join('\n');
    if (!text.trim()) throw new Error('Belgede okunabilir metin bulunamadı. Daha net bir dosya deneyin.');
    if (text.length > 100_000) throw new Error('Belge metni çok uzun. Tek bir fatura seçin.');
    return { text, previews };
  } finally {
    signal?.removeEventListener('abort', abort);
    await worker?.terminate();
    await loadingTask?.destroy();
  }
}
