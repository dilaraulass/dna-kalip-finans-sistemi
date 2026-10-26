export function formsEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length &&
    keys.every(key => Object.hasOwn(right, key) && formsEqual(left[key], right[key]));
}

export function matchingChanges(entries, scope) {
  return [...entries.entries()].filter(([id, entry]) =>
    (scope === undefined || (Array.isArray(scope) ? scope.includes(id) || scope.includes(entry.scope) : entry.scope === scope)) &&
    (entry.dirty || entry.busy)).map(([, entry]) => entry);
}

export function hasInvoiceChanges(drafts) {
  return Object.values(drafts).some(draft => !formsEqual(
    { invoiceIssued: draft.invoiceIssued, invoiceNumber: draft.invoiceNumber }, draft.initial,
  ));
}
