import test from "node:test";
import assert from "node:assert/strict";
import {
  getExpenseTypes, getCompanyExpenseDefaults, createExpenseInvoice, updateExpenseInvoice,
} from "./financeApi.js";

test("expense types are loaded from the API with database IDs", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, "/api/finance/expense-types");
    return Response.json([{ id: 7, name: "Özel gider" }]);
  });
  assert.deepEqual(await getExpenseTypes(), [{ id: 7, name: "Özel gider" }]);
});

test("company defaults use the selected company ID and forward cancellation", async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/finance/companies/company-a/expense-defaults");
    assert.equal(options.signal, controller.signal);
    return Response.json({ dueDays: 60, expenseTypeId: 3 });
  });
  assert.deepEqual(await getCompanyExpenseDefaults("company-a", { signal: controller.signal }), {
    dueDays: 60, expenseTypeId: 3,
  });
});

test("company without invoice history returns no defaults", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
  assert.equal(await getCompanyExpenseDefaults("new-company"), null);
});

test("create and edit send user chosen expense type ID and due days", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, method: options.method, body: JSON.parse(options.body) });
    return new Response(null, { status: 204 });
  });
  const payload = { companyId: "company-a", expenseTypeId: 5, dueDays: 45 };
  await createExpenseInvoice(payload);
  await updateExpenseInvoice("invoice-a", payload);
  assert.deepEqual(calls, [
    { url: "/api/expense-invoices", method: "POST", body: payload },
    { url: "/api/expense-invoices/invoice-a", method: "PUT", body: payload },
  ]);
});

test("defaults request failure is not silently treated as no history", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "Test error" }, { status: 500 }));
  await assert.rejects(getCompanyExpenseDefaults("company-a"), /Test error/);
});
