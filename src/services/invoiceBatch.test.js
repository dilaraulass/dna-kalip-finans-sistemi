import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInvoiceDraft,
  draftToExpensePayload,
  getInvoiceDraftFieldSeverity,
  getFirstInvoiceDraftErrorField,
  getInvoiceDraftReviewStatus,
  invoiceDuplicateKey,
  validateInvoiceDraft,
} from './invoiceBatch.js';

const company = { id: 'company-1', name: 'Örnek Firma', taxNumber: '1234567890' };
const file = { name: 'fatura.pdf' };
const extracted = { seller: { name: 'Örnek Firma', taxNumber: '1234567890' }, fields: {
  invoiceNumber: 'ABC-1', invoiceDate: '2026-11-10', amount: 1200, currency: 'TRY', dueDays: 30,
} };

test('OCR sonucundan düzenlenebilir toplu fatura taslağı üretir', () => {
  const draft = createInvoiceDraft(file, { previews: [], text: '' }, extracted, [company], 'draft-1');
  assert.equal(draft.form.companyId, company.id);
  assert.equal(draft.form.invoiceIssued, true);
  assert.equal(draft.form.amount, '1200');
});

test('zorunlu alanları ve mükerrer faturayı doğrular', () => {
  const draft = createInvoiceDraft(file, { previews: [], text: '' }, extracted, [company], 'draft-1');
  draft.form.expenseTypeId = '2';
  const key = invoiceDuplicateKey(company.id, 'abc-1');
  assert.deepEqual(validateInvoiceDraft(draft, new Set([key]), new Map([[key, 1]])),
    ['Bu firmaya ait fatura numarası sistemde zaten var.']);
});

test('boş vade alanını sıfır olarak varsaymaz', () => {
  const draft = createInvoiceDraft(file, { previews: [], text: '' }, extracted, [company], 'draft-1');
  draft.form.expenseTypeId = '2';
  draft.form.dueDays = '';
  assert.ok(validateInvoiceDraft(draft).includes('Vade sıfır veya pozitif tam sayı olmalı.'));
});

test('doğrulanmış taslağı mevcut API payload biçimine çevirir', () => {
  const draft = createInvoiceDraft(file, { previews: [], text: '' }, extracted, [company], 'draft-1');
  draft.form.expenseTypeId = '2';
  assert.deepEqual(draftToExpensePayload(draft, [company]), {
    companyId: company.id, workOrderNumber: null, expenseTypeId: 2, description: company.name,
    amount: 1200, currency: 'TRY', invoiceDate: '2026-11-10', dueDays: 30,
    paymentDate: null, status: 'pending', invoiceIssued: true, invoiceNumber: 'ABC-1',
  });
});

test('isimle eşleşen ve VKN bilgisi boş firmayı yalnızca forma önerir', () => {
  const companyWithoutTax = { id: 'company-2', name: 'BSA TOOLİNG', taxNumber: null };
  const parsed = { seller: {
    name: 'BSA TOOLING KALIP PRES METAL FORM SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
    taxNumber: '1871429265',
  }, fields: extracted.fields };
  const draft = createInvoiceDraft(file, { previews: [], text: '' }, parsed, [companyWithoutTax], 'draft-2');
  assert.equal(draft.form.companyId, companyWithoutTax.id);
  assert.equal('updateCompanyTaxNumber' in draft.form, false);
  assert.equal(draft.companyMatch.method, 'strong-name');
});

test('toplu fatura inceleme durumu güncel doğrulama sonucunu gösterir', () => {
  const draft = createInvoiceDraft(file, { previews: [], text: '' }, extracted, [company], 'draft-1');
  assert.deepEqual(getInvoiceDraftReviewStatus(draft, { expenseTypeId: ['Gider türü seçin.'] }),
    { key: 'missing', label: 'Eksik bilgi' });
  assert.deepEqual(getInvoiceDraftReviewStatus(draft),
    { key: 'ready', label: 'Kontrole hazır' });
  assert.deepEqual(getInvoiceDraftReviewStatus({ ...draft, state: 'saved' }),
    { key: 'saved', label: 'Kaydedildi' });
});

test('ilk eksik alan kullanıcı formundaki doğal sıraya göre seçilir', () => {
  assert.equal(getFirstInvoiceDraftErrorField({
    amount: ['Tutar girin.'],
    companyId: ['Firma seçin.'],
  }), 'companyId');
  assert.equal(getFirstInvoiceDraftErrorField({}), null);
});

test('mükerrer fatura numarası eksik alan gibi odaklanmaz ve uyarı olarak gösterilir', () => {
  const duplicate = { invoiceNumber: ['Bu firmaya ait fatura numarası sistemde zaten var.'] };
  assert.equal(getInvoiceDraftFieldSeverity('invoiceNumber', duplicate.invoiceNumber), 'warning');
  assert.equal(getFirstInvoiceDraftErrorField(duplicate), null);
  assert.deepEqual(getInvoiceDraftReviewStatus({ state: 'ready' }, duplicate),
    { key: 'duplicate', label: 'Mükerrer kayıt' });
});
