const API_BASE_URL = "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
    ...options,
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
