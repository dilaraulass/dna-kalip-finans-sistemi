import { CURRENCIES, PAYMENT_STATUSES } from '../constants/financeConstants.js';
import { findInvoiceCompanyMatch } from './invoiceExtraction.js';

export const MAX_BATCH_INVOICES = 10;
export const MAX_BATCH_BYTES = 50 * 1024 * 1024;
const REVIEW_FIELD_ORDER = [
  'companyId',
  'expenseTypeId',
  'invoiceNumber',
  'invoiceDate',
  'amount',
  'currency',
  'dueDays',
];

const DUPLICATE_INVOICE_MESSAGES = new Set([
  'Bu firmaya ait fatura numarası sistemde zaten var.',
  'Aynı firma ve fatura numarası seçilen belgelerde tekrar ediyor.',
]);

const normalizeInvoiceNumber = value => String(value || '').trim().toLocaleUpperCase('tr-TR');
export const invoiceDuplicateKey = (companyId, invoiceNumber) => {
  const normalized = normalizeInvoiceNumber(invoiceNumber);
  return companyId && normalized ? `${companyId}|${normalized}` : '';
};

export function createInvoiceDraft(file, document, extracted, companies, id = crypto.randomUUID()) {
  const companyMatch = findInvoiceCompanyMatch(extracted.seller, companies);
  const company = companyMatch?.company;
  const invoiceNumber = String(extracted.fields.invoiceNumber || '');
  return {
    id,
    file,
    fileName: file.name,
    selected: true,
    state: 'ready',
    error: '',
    progress: '',
    result: { ...document, ...extracted, fileName: file.name },
    sellerName: extracted.seller?.name || '',
    companyMatch,
    form: {
      companyId: company?.id || '',
      workOrderNumber: '',
      expenseTypeId: '',
      amount: String(extracted.fields.amount ?? ''),
      currency: extracted.fields.currency || CURRENCIES.try,
      invoiceDate: extracted.fields.invoiceDate || '',
      dueDays: String(extracted.fields.dueDays ?? ''),
      paymentDate: '',
      status: PAYMENT_STATUSES.pending,
      invoiceIssued: Boolean(invoiceNumber),
      invoiceNumber,
    },
  };
}

export function validateInvoiceDraftFields(draft, duplicateKeys = new Set(), batchKeys = new Map()) {
  if (draft.state !== 'ready') return { document: ['Belge başarıyla okunmadı.'] };
  const { form } = draft;
  const errors = {};
  const add = (field, message) => { errors[field] = [...(errors[field] || []), message]; };
  if (!form.companyId) add('companyId', 'Firma seçin.');
  if (!Number.isInteger(Number(form.expenseTypeId)) || Number(form.expenseTypeId) <= 0)
    add('expenseTypeId', 'Gider türü seçin.');
  if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0)
    add('amount', 'Geçerli bir tutar girin.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.invoiceDate)) add('invoiceDate', 'Fatura tarihini girin.');
  if (String(form.dueDays).trim() === '' || !Number.isInteger(Number(form.dueDays)) || Number(form.dueDays) < 0)
    add('dueDays', 'Vade sıfır veya pozitif tam sayı olmalı.');
  if (form.invoiceIssued && !form.invoiceNumber.trim()) add('invoiceNumber', 'Fatura numarasını girin.');
  const key = form.invoiceIssued ? invoiceDuplicateKey(form.companyId, form.invoiceNumber) : '';
  if (key && duplicateKeys.has(key)) add('invoiceNumber', 'Bu firmaya ait fatura numarası sistemde zaten var.');
  if (key && (batchKeys.get(key) || 0) > 1)
    add('invoiceNumber', 'Aynı firma ve fatura numarası seçilen belgelerde tekrar ediyor.');
  return errors;
}

export function validateInvoiceDraft(draft, duplicateKeys = new Set(), batchKeys = new Map()) {
  return Object.values(validateInvoiceDraftFields(draft, duplicateKeys, batchKeys)).flat();
}

export function getInvoiceDraftReviewStatus(draft, errors = {}) {
  if (draft.state === 'saved') return { key: 'saved', label: 'Kaydedildi' };
  if (draft.state === 'saving') return { key: 'saving', label: 'Kaydediliyor' };
  if (draft.state === 'processing') return { key: 'processing', label: 'Taranıyor' };
  if (draft.state === 'error') return { key: 'error', label: 'Okunamadı' };
  if (draft.error || Object.entries(errors).some(([field, messages]) =>
    getInvoiceDraftFieldSeverity(field, messages) === 'error'))
    return { key: 'missing', label: 'Eksik bilgi' };
  if (Object.entries(errors).some(([field, messages]) =>
    getInvoiceDraftFieldSeverity(field, messages) === 'warning'))
    return { key: 'duplicate', label: 'Mükerrer kayıt' };
  return { key: 'ready', label: 'Kontrole hazır' };
}

export function getInvoiceDraftFieldSeverity(field, messages = []) {
  if (!messages.length) return null;
  return field === 'invoiceNumber' && messages.every(message => DUPLICATE_INVOICE_MESSAGES.has(message))
    ? 'warning'
    : 'error';
}

export function getFirstInvoiceDraftErrorField(errors = {}) {
  return REVIEW_FIELD_ORDER.find(field =>
    getInvoiceDraftFieldSeverity(field, errors[field]) === 'error') || null;
}

export function draftToExpensePayload(draft, companies) {
  const { form } = draft;
  const company = companies.find(item => item.id === form.companyId);
  return {
    companyId: form.companyId,
    workOrderNumber: form.workOrderNumber.trim() || null,
    expenseTypeId: Number(form.expenseTypeId),
    description: company?.name || draft.sellerName || '',
    amount: Number(form.amount),
    currency: form.currency,
    invoiceDate: form.invoiceDate,
    dueDays: Number(form.dueDays),
    paymentDate: form.paymentDate || null,
    status: form.status,
    invoiceIssued: form.invoiceIssued,
    invoiceNumber: form.invoiceIssued ? form.invoiceNumber.trim() : null,
  };
}
