const API_BASE_URL = "/api";

async function request(path, options = {}) {
  const { headers, ...fetchOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    credentials: "include",
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

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function login(payload, { signal } = {}) {
  return request("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
}

export function logout({ signal } = {}) {
  return request("/auth/logout", {
    method: "POST",
    signal,
  });
}

export function getCurrentUser({ signal } = {}) {
  return request("/auth/me", { signal });
}
