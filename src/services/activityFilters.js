// Activity days are interpreted in Turkey, independently of the viewer's device timezone.
export function activityQuery(filters, pagination, sorting) {
  const query = {
    actorName: filters.actorName.trim(), action: filters.action.trim(),
    contractNumber: filters.contractNumber.trim(), workOrderNumber: filters.workOrderNumber.trim(),
    page: pagination.page, pageSize: pagination.pageSize,
    sort: sorting[0]?.field || "createdAt", direction: sorting[0]?.sort || "desc",
  };
  if (filters.from) query.from = `${filters.from}T00:00:00+03:00`;
  if (filters.to) {
    const nextDay = new Date(`${filters.to}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    query.to = `${nextDay.toISOString().slice(0, 10)}T00:00:00+03:00`;
  }
  return query;
}

export function formatActivityTime(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date(value));
}
