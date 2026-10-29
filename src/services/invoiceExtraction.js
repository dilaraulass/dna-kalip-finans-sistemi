// Conservative suggestions, never authoritative accounting data.
const normalize = value => value.toLocaleUpperCase('tr-TR').replaceAll('İ', 'I')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const unique = values => [...new Set(values)];

export function parseInvoiceMoney(value) {
  const text = value.replace(/\s/g, '');
  if (/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(text) || /^\d+,\d{2}$/.test(text))
    return Number(text.replaceAll('.', '').replace(',', '.'));
  if (/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(text) || /^\d+\.\d{2}$/.test(text))
    return Number(text.replaceAll(',', ''));
  if (/^\d+$/.test(text)) return Number(text);
  return null; // 1.234 is ambiguous; do not guess.
}

function parseDate(text) {
  const match = text.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/);
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!match && !iso) return null;
  const [year, month, day] = match ? [match[3], match[2], match[1]] : iso.slice(1);
  const result = `${year}-${month}-${day}`;
  const date = new Date(`${result}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === result ? result : null;
}

export function extractInvoiceFields(text) {
  const lines = text.split(/\r?\n/).map(line => normalize(line.trim())).filter(Boolean);
  const numbers = [], dates = [], amounts = [], currencies = [], taxes = [], dueDays = [];
  for (const line of lines) {
    const number = line.match(/(?:FATURA\s*(?:NO(?:SU)?|NUMARASI)|INVOICE\s*(?:NO|NUMBER))\s*[:.#-]?\s*([A-Z0-9][A-Z0-9/-]{3,39})\b/);
    if (number && /\d/.test(number[1])) numbers.push(number[1]);
    if (/(?:FATURA\s*TARIHI|INVOICE\s*DATE)/.test(line)) {
      const date = parseDate(line); if (date) dates.push(date);
    }
    // Only explicitly labelled grand totals, never VAT/subtotal or an arbitrary largest number.
    const total = line.match(/(?:ODENECEK\s*(?:TUTAR|TOPLAM)|VERGILER\s*DAHIL\s*TOPLAM\s*TUTAR|GENEL\s*TOPLAM|GRAND\s*TOTAL|AMOUNT\s*DUE)\s*[:=-]?\s*(?:(?:TRY|TL|EUR|USD|₺|€|\$)\s*)?([\d][\d., ]*)/);
    if (total) {
      const amount = parseInvoiceMoney(total[1]);
      if (amount !== null && amount > 0 && amount < 1e12) amounts.push(amount);
      const found = unique([...line.matchAll(/\b(TRY|TL|EUR|USD)\b|[₺€$]/g)].map(m =>
        ({ TL: 'TRY', '₺': 'TRY', '€': 'EUR', '$': 'USD' })[m[0]] || m[0]));
      currencies.push(...found);
    }
    const tax = line.match(/(?:VKN|TCKN|VERGI\s*(?:NO|NUMARASI))\s*[:.-]?\s*(\d{10,11})\b/);
    if (tax) taxes.push(tax[1]);
    const days = line.match(/VADE\s*[:=-]?\s*(\d{1,3})\s*GUN\b/);
    if (days) dueDays.push(Number(days[1]));
  }
  const fields = {};
  const warnings = ['OCR sonucu hatalı olabilir. Belgeyi ve tüm alanları kaydetmeden önce kontrol edin.'];
  for (const [key, values] of Object.entries({ invoiceNumber: numbers, invoiceDate: dates, amount: amounts, currency: currencies, dueDays })) {
    const options = unique(values);
    if (options.length === 1) fields[key] = options[0];
    if (options.length > 1) warnings.push(`${key}: birden fazla farklı değer bulundu; alan otomatik doldurulmadı.`);
  }
  if (fields.amount !== undefined && !fields.currency) {
    delete fields.amount;
    warnings.push('Toplamın para birimi net değil. Tutar ve para birimini belgeden kontrol ederek girin.');
  }
  if (fields.amount !== undefined) warnings.push('Önerilen tutar belgedeki ödenecek/genel toplamdır; KDV hariç tutar olarak yorumlamayın.');
  return { fields, taxNumbers: unique(taxes), warnings };
}

export function matchingInvoiceCompanies(taxNumbers, companies) {
  return companies.filter(company => taxNumbers.includes(String(company.taxNumber || '').replace(/\D/g, '')));
}

export function mergeInvoiceSuggestions(form, fields, touched = new Set()) {
  const next = { ...form };
  for (const key of ['invoiceNumber', 'invoiceDate', 'amount', 'currency', 'dueDays']) {
    if (['amount', 'currency'].includes(key) && (touched.has('amount') || touched.has('currency'))) continue;
    if (key === 'invoiceNumber' && touched.has('invoiceIssued') && !form.invoiceIssued) continue;
    if (fields[key] !== undefined && !touched.has(key)) next[key] = String(fields[key]);
  }
  if (fields.invoiceNumber && !touched.has('invoiceNumber') && !touched.has('invoiceIssued')) next.invoiceIssued = true;
  // Company, expense type, payment status/date and work order are never inferred here.
  return next;
}
