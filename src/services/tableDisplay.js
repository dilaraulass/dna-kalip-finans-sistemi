export function formatDate(value) {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

export function sortRows(rows, sort) {
  if (!sort?.field) return rows;
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const first = a[sort.field];
    const second = b[sort.field];
    const empty = (value) => value === null || value === undefined || value === "";
    if (empty(first)) return empty(second) ? 0 : 1;
    if (empty(second)) return -1;
    if (typeof first === "number" && typeof second === "number") return (first - second) * direction;
    if (typeof first === "boolean" && typeof second === "boolean") return (Number(first) - Number(second)) * direction;
    return String(first).localeCompare(String(second), "tr", { numeric: true }) * direction;
  });
}
