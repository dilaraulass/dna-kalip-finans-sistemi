import test from 'node:test';
import assert from 'node:assert/strict';
import { extractInvoiceFields, parseInvoiceMoney, matchingInvoiceCompanies, mergeInvoiceSuggestions } from './invoiceExtraction.js';
import { validateInvoiceFile, abortable } from './localInvoiceReader.js';

test('Turkish invoice extracts labelled fields and grand total, not VAT or subtotal', () => {
  const result = extractInvoiceFields('Fatura No: ABC2026000000001\nFatura Tarihi: 27.10.2026\nVKN: 1234567890\nMal Hizmet Toplam Tutarı: 10.000,00 TL\nKDV: 2.000,00 TL\nÖdenecek Tutar: 12.000,00 TL\nVade: 30 gün');
  assert.deepEqual(result.fields, { invoiceNumber: 'ABC2026000000001', invoiceDate: '2026-10-27', amount: 12000, currency: 'TRY', dueDays: 30 });
  assert.deepEqual(result.taxNumbers, ['1234567890']);
});
test('English amounts and dates; missing labels are not guessed', () => {
  assert.equal(parseInvoiceMoney('1,234.56'), 1234.56);
  assert.equal(parseInvoiceMoney('1.234,56'), 1234.56);
  assert.equal(parseInvoiceMoney('1.234'), null);
  assert.equal(parseInvoiceMoney('-120'), null);
  assert.deepEqual(extractInvoiceFields('Invoice Number: INV-1234\nInvoice Date: 2026-10-27\nGrand Total: USD 1,234.56').fields,
    { invoiceNumber: 'INV-1234', invoiceDate: '2026-10-27', amount: 1234.56, currency: 'USD' });
  assert.deepEqual(extractInvoiceFields('12345\n27.10.2026\nKDV: 250,00 TL').fields, {});
});
test('conflicting totals, invoice numbers, currencies and invalid date require manual entry', () => {
  const result = extractInvoiceFields('Fatura No: ABC1234\nFatura No: XYZ1234\nFatura Tarihi: 31.02.2026\nGenel Toplam: 100,00 TL\nGenel Toplam: 200,00 EUR');
  assert.deepEqual(result.fields, {});
  assert.ok(result.warnings.length > 1);
});
test('amount without an unambiguous currency is never imported as TRY', () => {
  assert.equal(extractInvoiceFields('Genel Toplam: 900,00').fields.amount, undefined);
});
test('company candidates use exact tax id, no fuzzy name matching or automatic creation', () => {
  const companies = [{ id: 'a', name: 'ABC', taxNumber: '1234567890' }, { id: 'b', name: 'ABC' }];
  assert.deepEqual(matchingInvoiceCompanies(['1234567890'], companies).map(c => c.id), ['a']);
  assert.deepEqual(matchingInvoiceCompanies(['123456789'], companies), []);
});
test('manual edits and the amount/currency pair are preserved; no payment inference', () => {
  const form = { amount: '99', currency: 'USD', invoiceDate: '', invoiceNumber: '', invoiceIssued: false, status: 'pending', paymentDate: '', companyId: 'company' };
  const result = mergeInvoiceSuggestions(form, { amount: 500, currency: 'TRY', invoiceNumber: 'ABC1234', invoiceDate: '2026-10-27' }, new Set(['currency']));
  assert.equal(result.amount, '99'); assert.equal(result.currency, 'USD');
  assert.equal(result.invoiceNumber, 'ABC1234'); assert.equal(result.invoiceIssued, true);
  assert.equal(result.status, 'pending'); assert.equal(result.paymentDate, ''); assert.equal(result.companyId, 'company');
  assert.equal(form.invoiceNumber, '');
  assert.equal(mergeInvoiceSuggestions(form, { invoiceNumber: 'ABC1234' }, new Set(['invoiceIssued'])).invoiceNumber, '');
});
test('file validation checks size, signature and extension instead of trusting MIME', async () => {
  assert.equal(await validateInvoiceFile(new File(['%PDF-1.7'], 'test.pdf')), 'pdf');
  assert.equal(await validateInvoiceFile(new File([new Uint8Array([255,216,255,0])], 'test.jpg')), 'image');
  assert.equal(await validateInvoiceFile(new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'test.png')), 'image');
  await assert.rejects(validateInvoiceFile(new File(['<script>'], 'test.pdf')));
  await assert.rejects(validateInvoiceFile(new File(['%PDF-1.7'], 'test.exe')));
  await assert.rejects(validateInvoiceFile(new File([], 'empty.pdf')));
  await assert.rejects(validateInvoiceFile({ size: 11 * 1024 * 1024 }));
});
test('cancellation settles even when the OCR worker leaves its promise pending', async () => {
  const controller = new AbortController();
  const result = abortable(new Promise(() => {}), controller.signal);
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(await abortable(Promise.resolve('ok'), new AbortController().signal), 'ok');
});
