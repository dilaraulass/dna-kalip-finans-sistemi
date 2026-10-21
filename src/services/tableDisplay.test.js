import test from "node:test";
import assert from "node:assert/strict";
import { formatDate, sortRows } from "./tableDisplay.js";

test("dates display as day.month.year without timezone shifts", () => {
  assert.equal(formatDate("2026-10-14"), "14.10.2026");
  assert.equal(formatDate("2026-10-14T00:00:00Z"), "14.10.2026");
  assert.equal(formatDate(null), "-");
});

test("sorting uses numeric amounts and leaves empty values last in either direction", () => {
  const rows = [{ amount: 100 }, { amount: null }, { amount: 20 }];
  assert.deepEqual(sortRows(rows, { field: "amount", direction: "asc" }).map(r => r.amount), [20, 100, null]);
  assert.deepEqual(sortRows(rows, { field: "amount", direction: "desc" }).map(r => r.amount), [100, 20, null]);
  assert.equal(rows[0].amount, 100);
});

test("dates sort chronologically across months and years", () => {
  const rows = [{ date: "2026-01-02" }, { date: "2025-12-31" }, { date: "2026-02-01" }];
  assert.deepEqual(sortRows(rows, { field: "date", direction: "asc" }).map(r => r.date), ["2025-12-31", "2026-01-02", "2026-02-01"]);
});
