import { ALL_FILTER_VALUE } from "../../constants/financeConstants";
import { formatMoney } from "../../services/financeService";

function FinanceStatusCards({
  statusFilters,
  statusFilter,
  onStatusFilterChange,
  activeStats,
  displayCurrency,
  expenseModule,
  transactionLabel,
}) {
  return (
    <div className="stats-grid">
      {Object.entries(statusFilters).map(([key, label]) => (
        <button
          type="button"
          key={key}
          className={`stat-card ${key} ${
            statusFilter === key ? "selected" : ""
          }`}
          onClick={() => onStatusFilterChange(key)}
        >
          <h3>
            {key === ALL_FILTER_VALUE
              ? expenseModule
                ? "Toplam Gider Faturası"
                : `Toplam ${transactionLabel}`
              : label}
          </h3>
          <p>{formatMoney(activeStats[key], displayCurrency)}</p>
        </button>
      ))}
    </div>
  );
}

export default FinanceStatusCards;
