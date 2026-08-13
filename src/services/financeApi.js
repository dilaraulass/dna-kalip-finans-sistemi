const API_BASE_URL = "/api";

async function request(path, options = {}) {
  const { headers, ...fetchOptions } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      Accept: "application/json",
      ...headers,
    },
  });

  if (!response.ok) {
    let message = `API isteği başarısız oldu: ${response.status}`;

    try {
      const errorBody = await response.json();
      message =
        errorBody.message ||
        errorBody.title ||
        Object.values(errorBody.errors || {})
          .flat()
          .join(" ") ||
        message;
    } catch {
      // Response body JSON değilse varsayılan hata mesajını kullanırız.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

export function getFinanceDashboard({ signal } = {}) {
  return request("/finance/dashboard", { signal });
}

export function getExchangeRates({ signal } = {}) {
  return request("/finance/exchange-rates", { signal });
}

export function updateExchangeRate(currency, payload, { signal } = {}) {
  return request(`/finance/exchange-rates/${currency}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
}

export function updatePaymentTracking(milestoneId, payload, { signal } = {}) {
  return request(`/contract-milestones/${milestoneId}/payment-tracking`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
}

export function createExpenseInvoice(payload, { signal } = {}) {
  return request("/expense-invoices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
}

export function updateExpenseInvoice(invoiceId, payload, { signal } = {}) {
  return request(`/expense-invoices/${invoiceId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
}

export function archiveExpenseInvoice(invoiceId, { signal } = {}) {
  return request(`/expense-invoices/${invoiceId}/archive`, {
    method: "PATCH",
    signal,
  });
}
