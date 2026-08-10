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

  return response.json();
}

export function getCompanies({ companyType = "all", search, signal } = {}) {
  const searchParams = new URLSearchParams();

  if (companyType) {
    searchParams.set("companyType", companyType);
  }

  if (search) {
    searchParams.set("search", search);
  }

  const queryString = searchParams.toString();

  return request(`/companies${queryString ? `?${queryString}` : ""}`, {
    signal,
  });
}

export function getCompanyById(id, { signal } = {}) {
  return request(`/companies/${id}`, { signal });
}

export function createCompany(payload, { signal } = {}) {
  return request("/companies", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
}

export function updateCompany(id, payload, { signal } = {}) {
  return request(`/companies/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
}
