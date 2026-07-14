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
    throw new Error(`API isteği başarısız oldu: ${response.status}`);
  }

  return response.json();
}

export function getContracts({ signal } = {}) {
  return request("/contracts", { signal });
}

export function getContractById(id, { signal } = {}) {
  return request(`/contracts/${id}`, { signal });
}
