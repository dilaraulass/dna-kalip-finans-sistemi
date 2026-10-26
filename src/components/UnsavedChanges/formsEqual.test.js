import test from "node:test";
import assert from "node:assert/strict";
import { formsEqual, matchingChanges, hasInvoiceChanges } from "./formsEqual.js";

test("form comparison detects nested contract fields and images, ignores key order", () => {
  const original = { image: "data:image/one", dates: { first: "2026-10-26" }, checks: [true, false] };
  assert.equal(formsEqual(original, { checks: [true, false], dates: { first: "2026-10-26" }, image: "data:image/one" }), true);
  assert.equal(formsEqual(original, { ...original, image: "data:image/two" }), false);
  assert.equal(formsEqual(original, { ...original, dates: { first: "" } }), false);
  assert.equal(formsEqual(original, { ...original, checks: [false, true] }), false);
  assert.equal(formsEqual(null, {}), false);
  assert.equal(formsEqual([], {}), false);
});
test("dialog scope only includes forms being closed; navigation includes all", () => {
  const entries = new Map([
    ["user", { scope: "users", dirty: true }],
    ["role", { scope: "roles", dirty: false }],
    ["invoice", { scope: "finance-inline", dirty: true }],
    ["saving", { scope: "finance-inline", dirty: false, busy: true }],
  ]);
  assert.equal(matchingChanges(entries).length, 3);
  assert.equal(matchingChanges(entries, "roles").length, 0);
  assert.equal(matchingChanges(entries, "users").length, 1);
  assert.equal(matchingChanges(entries, ["invoice"]).length, 1);
  assert.equal(matchingChanges(entries, ["finance-inline"]).length, 2);
  entries.delete("user");
  assert.equal(matchingChanges(entries, "users").length, 0);
});
test("invoice draft restored to original values is clean even if retained across filtering", () => {
  const initial = { invoiceIssued: false, invoiceNumber: "" };
  assert.equal(hasInvoiceChanges({}), false);
  assert.equal(hasInvoiceChanges({ a: { ...initial, initial } }), false);
  assert.equal(hasInvoiceChanges({ a: { ...initial, invoiceIssued: true, initial } }), true);
});
