import { ALL_FILTER_VALUE } from "../../constants/financeConstants";
import { useAuth } from "../../auth/useAuth";
import { formatMoney } from "../../services/financeService";

function FinanceStatusCards({
  statusFilters,
  statusFilter,
  onStatusFilterChange,
  activeStats,
  mixedCurrencies = false,
  displayCurrency,
  expenseModule,
  transactionLabel,
}) {
  const { can } = useAuth();
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
          {!can("finance.view") ? <p>***</p> : mixedCurrencies ? (
            typeof activeStats[key] === "object"
              ? Object.entries(activeStats[key]).sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => (
                <p key={currency}>{formatMoney(amount, currency)}</p>
              ))
              : <p>—</p>
          ) : <p>{formatMoney(activeStats[key], displayCurrency)}</p>}
        </button>
      ))}
    </div>
  );
}

export default FinanceStatusCards;
