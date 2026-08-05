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

export function getContracts({ signal } = {}) {
  return request("/contracts", { signal });
}

export function getContractById(id, { signal } = {}) {
  return request(`/contracts/${id}`, { signal });
}

export function createContract(payload, { signal } = {}) {
  return request("/contracts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
}

export function updateContract(id, payload, { signal } = {}) {
  return request(`/contracts/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
}

export function archiveContract(id, { signal } = {}) {
  return request(`/contracts/${id}/archive`, {
    method: "PATCH",
    signal,
  });
}
