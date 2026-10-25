import test from "node:test";
import assert from "node:assert/strict";
import { activityQuery, formatActivityTime } from "./activityFilters.js";
import { getUserActivities } from "./usersApi.js";

const filters = { actorName: " Dilara ", action: "Vade", contractNumber: "DNA-1", workOrderNumber: "26001", from: "", to: "" };
test("activity filters default to newest first and trim search terms", () => {
  assert.deepEqual(activityQuery(filters, { page: 0, pageSize: 25 }, []), {
    actorName: "Dilara", action: "Vade", contractNumber: "DNA-1", workOrderNumber: "26001",
    page: 0, pageSize: 25, sort: "createdAt", direction: "desc",
  });
});
test("activity day range includes whole last day in Turkey across year boundary", () => {
  const query = activityQuery({ ...filters, from: "2026-12-31", to: "2026-12-31" }, { page: 2, pageSize: 10 }, [{ field: "actorName", sort: "asc" }]);
  assert.equal(query.from, "2026-12-31T00:00:00+03:00");
  assert.equal(query.to, "2027-01-01T00:00:00+03:00");
  assert.equal(query.sort, "actorName");
  assert.equal(query.direction, "asc");
});
test("UTC timestamp displays Turkey date and seconds", () => {
  const formatted = formatActivityTime("2026-10-25T22:01:02Z");
  assert.match(formatted, /26\.10\.2026/);
  assert.match(formatted, /01:01:02/);
});
test("activity API encodes filters, sends cookie and abort signal", async (t) => {
  const signal = new AbortController().signal;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const parsed = new URL(url, "http://localhost");
    assert.equal(parsed.pathname, "/api/users/activities");
    assert.equal(parsed.searchParams.get("actorName"), "A&B + C");
    assert.equal(parsed.searchParams.get("from"), "2026-10-25T00:00:00+03:00");
    assert.equal(options.signal, signal);
    assert.equal(options.credentials, "include");
    return Response.json({ items: [], totalCount: 0 });
  });
  assert.deepEqual(await getUserActivities({ actorName: "A&B + C", from: "2026-10-25T00:00:00+03:00" }, { signal }), { items: [], totalCount: 0 });
});
test("activity API exposes failures rather than treating them as empty history", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "Erişim reddedildi" }, { status: 403 }));
  await assert.rejects(getUserActivities({}), /Erişim reddedildi/);
});
