import database from "../data/database.json";

export function getContracts() {
  return database.filter((item) => {
    return item.id !== "SYSTEM_EXPENSES_DB" && item.id !== "SYSTEM_SETTINGS_DB";
  });
}

export function getExpenses() {
  const expensesDb = database.find((item) => item.id === "SYSTEM_EXPENSES_DB");
  return expensesDb?.faturalar || [];
}

export function getSettings() {
  const settingsDb = database.find((item) => item.id === "SYSTEM_SETTINGS_DB");
  return settingsDb || {};
}