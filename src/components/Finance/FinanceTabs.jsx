const FINANCE_TABS = [
  { key: "supplier", label: "Tedarikçi Ödemeleri" },
  { key: "customer", label: "Müşteri Tahsilatları" },
  { key: "expenses", label: "Ek Gider Faturaları" },
  { key: "analysis", label: "Finansal Analiz" },
];

function FinanceTabs({ activeTab, onTabChange }) {
  return (
    <div className="finance-tabs">
      {FINANCE_TABS.map((tab) => (
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
