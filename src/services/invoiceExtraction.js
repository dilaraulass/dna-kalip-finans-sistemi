// Conservative suggestions, never authoritative accounting data.
const normalize = value => value.toLocaleUpperCase('tr-TR').replaceAll('İ', 'I')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const unique = values => [...new Set(values)];
const normalizeTaxNumber = value => String(value || '').replace(/\D/g, '');

export function normalizeInvoiceCompanyName(value) {
  return normalize(String(value || ''))
    .replace(/&/g, ' VE ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Identify parties from a labelled tax line and its adjacent address/title, not
// from the first number or the PDF filename. An unlabelled layout is review-only.
function invoiceSeller(lines, originals, taxNumbers) {
  const parties = [];
  for (let i = 0; i < lines.length; i++) {
    const tax = lines[i].match(/^(?:VKN|TCKN|VERGI (?:NO|NUMARASI))\s*[:.-]?\s*(\d{10,11})$/);
    if (!tax) continue;
    const before = lines.slice(Math.max(0, i - 18), i);
    const address = before.findLastIndex(s => /^ADRES\s*:|\b(?:MAH|MH)\./.test(s));
    if (address < 1) continue;
    if (before.slice(address + 1).some(s => /^(?:VKN|TCKN|VERGI NO|SAYIN|FATURA NO)\b/.test(s))) continue;
    let start = address - 1;
    while (start > 0 && /^(?:LTD\.|STI\.|SIRKETI\b|SANAYI\b|INSAAT\b|BILGISAYAR\b|VE TICARET\b|FORM SANAYI\b)/.test(before[start])) start--;
    const name = before.slice(start, address).join(' ');
    if (!/^[A-Z][A-Z &.-]{2,170}$/.test(name)) continue;
    const offset = i - before.length;
    parties.push({ name, displayName: originals.slice(offset + start, offset + address).join(' '), taxNumber: tax[1], buyer: before[start - 1] === 'SAYIN' });
  }
  if (taxNumbers.length !== 2 || unique(parties.map(p => p.taxNumber)).length !== 2) return null;
  const buyers = parties.filter(p => p.buyer);
  const buyer = buyers.length === 1 ? buyers[0] : null;
  const receiver = buyer ?? parties.find(p => /^DNA MUHENDISLIK KALIP MAKINE\b/.test(p.name));
  if (!receiver || !/^DNA MUHENDISLIK KALIP MAKINE\b/.test(receiver.name)) return null;
  const sellers = parties.filter(p => p.taxNumber !== receiver.taxNumber);
  if (!sellers.length || sellers.some(p => p.buyer || p.name !== sellers[0].name)) return null;
  return {
    name: sellers[0].displayName,
    taxNumber: sellers[0].taxNumber,
    identification: buyer ? 'labelled-recipient' : 'known-recipient',
  };
}

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
  const originals = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const lines = originals.map(normalize);
  const numbers = [], dates = [], amounts = [], currencies = [], taxes = [], dueDays = [];
  const hasPayable = lines.some(line => /^(?:ODENECEK\s*(?:TUTAR|TOPLAM)|AMOUNT\s*DUE)\b/.test(line));
  for (const line of lines) {
    const number = line.match(/(?:FATURA\s*(?:NO(?:SU)?|NUMARASI)|INVOICE\s*(?:NO|NUMBER))\s*[:.#-]?\s*([A-Z0-9][A-Z0-9/-]{3,39})\b/);
    if (number && /\d/.test(number[1])) numbers.push(number[1]);
    if (/(?:FATURA\s*TARIHI|INVOICE\s*DATE)/.test(line)) {
      const date = parseDate(line); if (date) dates.push(date);
    }
    // Only explicitly labelled grand totals, never VAT/subtotal or an arbitrary largest number.
    const total = line.match(/(?:ODENECEK\s*(?:TUTAR|TOPLAM)|VERGILER\s*DAHIL\s*TOPLAM\s*TUTAR|GENEL\s*TOPLAM|GRAND\s*TOTAL|AMOUNT\s*DUE)\s*[:=-]?\s*(?:(?:TRY|TL|EUR|USD|₺|€|\$)\s*)?([\d][\d., ]*)/);
    if (total && (!hasPayable || /^(?:ODENECEK\s*(?:TUTAR|TOPLAM)|AMOUNT\s*DUE)\b/.test(line))) {
      const amount = parseInvoiceMoney(total[1]);
      if (amount !== null && amount > 0 && amount < 1e12) amounts.push(amount);
      const found = unique([...line.matchAll(/(?<![A-Z])(TRY|TL|EUR|USD)\b|[₺€$]/g)].map(m =>
        ({ TL: 'TRY', '₺': 'TRY', '€': 'EUR', '$': 'USD' })[m[0]] || m[0]));
      currencies.push(...found);
    }
    const tax = line.match(/(?:VKN|TCKN|VERGI\s*(?:NO|NUMARASI))\s*[:.-]?\s*(\d{10,11})\b/);
    if (tax) taxes.push(tax[1]);
    const days = line.match(/VADE\s*[:=-]?\s*(\d{1,3})\s*GUN\b/) ?? line.match(/VADE GUNU\s*:\s*(\d{1,3})\b/);
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
  const taxNumbers = unique(taxes);
  return { fields, taxNumbers, seller: invoiceSeller(lines, originals, taxNumbers), warnings };
}

export function matchingInvoiceCompanies(taxNumbers, companies) {
  const normalized = taxNumbers.map(normalizeTaxNumber).filter(Boolean);
  return companies.filter(company => normalized.includes(normalizeTaxNumber(company.taxNumber)));
}

function strongNameMatch(sellerName, companyName) {
  if (!sellerName || !companyName) return false;
  if (sellerName === companyName) return true;
  const companyTokens = companyName.split(' ');
  // A short or single-word company name is not distinctive enough for an
  // automatic prefix match. It can still be selected manually by the user.
  if (companyTokens.length < 2 || companyName.replaceAll(' ', '').length < 6) return false;
  return sellerName.startsWith(`${companyName} `) || companyName.startsWith(`${sellerName} `);
}

export function findInvoiceCompanyMatch(seller, companies) {
  if (!seller) return null;
  const sellerTaxNumber = normalizeTaxNumber(seller.taxNumber);
  if (sellerTaxNumber) {
    const taxMatches = matchingInvoiceCompanies([sellerTaxNumber], companies);
    if (taxMatches.length === 1) {
      return { company: taxMatches[0], method: 'tax-number', confidence: 'high' };
    }
    if (taxMatches.length > 1) return null;
  }

  const sellerName = normalizeInvoiceCompanyName(seller.name);
  if (!sellerName) return null;
  const compatible = companies.filter(company => {
    const companyTaxNumber = normalizeTaxNumber(company.taxNumber);
    return !sellerTaxNumber || !companyTaxNumber || companyTaxNumber === sellerTaxNumber;
  });
  const exactMatches = compatible.filter(company =>
    normalizeInvoiceCompanyName(company.name) === sellerName);
  if (exactMatches.length === 1) {
    return { company: exactMatches[0], method: 'exact-name', confidence: 'high' };
  }

  const strongMatches = compatible.filter(company =>
    strongNameMatch(sellerName, normalizeInvoiceCompanyName(company.name)));
  return strongMatches.length === 1
    ? { company: strongMatches[0], method: 'strong-name', confidence: 'review' }
    : null;
}

export function matchInvoiceSeller(seller, companies) {
  return findInvoiceCompanyMatch(seller, companies)?.company || null;
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
