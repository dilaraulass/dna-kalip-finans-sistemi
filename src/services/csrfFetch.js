let pendingToken = null;

function getToken() {
  // Share only an in-flight request to avoid racing initial cookie creation.
  // Never cache completed tokens: the next write uses the current login identity.
  if (!pendingToken) {
    pendingToken = (async () => {
      const response = await fetch('/api/auth/csrf', {
        credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Güvenlik doğrulaması alınamadı. Tekrar deneyin.');
      const data = await response.json();
      if (typeof data.token !== 'string' || !data.token)
        throw new Error('Güvenlik doğrulaması alınamadı. Sayfayı yenileyin.');
      return data.token;
    })().finally(() => { pendingToken = null; });
  }
  return pendingToken;
}

export async function csrfFetch(url, options = {}) {
  // Never forward a security token to external URLs.
  if (typeof url !== 'string' || !url.startsWith('/api/') || url.includes('\\'))
    throw new Error('Geçersiz API adresi.');
  const method = (options.method || 'GET').toUpperCase();
  options.signal?.throwIfAborted();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return fetch(url, options);
  const token = await getToken();
  options.signal?.throwIfAborted();
  const headers = new Headers(options.headers);
  headers.set('X-CSRF-TOKEN', token);
  // No automatic replay of writes: avoid duplicate financial operations.
  return fetch(url, { ...options, credentials: 'include', headers });
}
