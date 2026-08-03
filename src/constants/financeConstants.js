export const FINANCE_MODULES = {
  supplier: "supplier",
  customer: "customer",
  expenses: "expenses",
  analysis: "analysis",
};

export const FINANCE_TABS = {
  customer: "musteri",
  supplier: "tedarikci",
};

export const PAYMENT_STATUSES = {
  pending: "pending",
  paid: "paid",
};

export const PAYMENT_STATUS_OPTIONS = [
  { value: PAYMENT_STATUSES.pending, label: "Bekleyen" },
  { value: PAYMENT_STATUSES.paid, label: "Ödenen" },
];

export const ALL_FILTER_VALUE = "all";

export const STATUS_KEYS = {
  all: ALL_FILTER_VALUE,
  paid: "paid",
  pending: "pending",
  approaching: "approaching",
  overdue: "overdue",
};

export const STATUS_FILTERS = {
  [STATUS_KEYS.all]: "Tümü",
  [STATUS_KEYS.paid]: "Ödenen",
  [STATUS_KEYS.pending]: "Bekleyen",
  [STATUS_KEYS.approaching]: "Yaklaşan",
  [STATUS_KEYS.overdue]: "Geciken",
};

export const CURRENCIES = {
  try: "TRY",
  eur: "EUR",
  usd: "USD",
};

export const CURRENCY_OPTIONS = [
  CURRENCIES.try,
  CURRENCIES.eur,
  CURRENCIES.usd,
];

export const DEFAULT_EXCHANGE_RATES = {
  [CURRENCIES.eur]: 1,
  [CURRENCIES.usd]: 1,
  [CURRENCIES.try]: 1,
};
