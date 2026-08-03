import { FINANCE_MODULES } from "../../constants/financeConstants";

const FINANCE_TAB_OPTIONS = [
  { key: FINANCE_MODULES.supplier, label: "Tedarikçi Ödemeleri" },
  { key: FINANCE_MODULES.customer, label: "Müşteri Tahsilatları" },
  { key: FINANCE_MODULES.expenses, label: "Ek Gider Faturaları" },
  { key: FINANCE_MODULES.analysis, label: "Finansal Analiz" },
];

function FinanceTabs({ activeTab, onTabChange }) {
  return (
    <div className="finance-tabs">
      {FINANCE_TAB_OPTIONS.map((tab) => (
        <button
          key={tab.key}
          className={activeTab === tab.key ? "active" : ""}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default FinanceTabs;
