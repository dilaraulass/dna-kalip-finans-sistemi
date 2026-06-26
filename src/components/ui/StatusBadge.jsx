function StatusBadge({ statusKey, status, daysUntilDue }) {
  return (
    <span className={`status-badge ${statusKey}`}>
      {status}
      {daysUntilDue != null &&
        statusKey !== "paid" &&
        ` (${Math.abs(daysUntilDue)} gün)`}
    </span>
  );
}

export default StatusBadge;
