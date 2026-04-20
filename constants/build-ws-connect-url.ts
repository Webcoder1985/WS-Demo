/** Removes username/password query params so the base URL can be shown in inputs. */
export function stripSocketAuthQueryParams(savedUrl: string): string {
  const t = savedUrl.trim();
  if (!t) {
    return t;
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `ws://${t}`;
  try {
    const u = new URL(withScheme);
    if (!u.searchParams.has('username') && !u.searchParams.has('password')) {
      return t;
    }
    u.searchParams.delete('username');
    u.searchParams.delete('password');
    const q = u.searchParams.toString();
    u.search = q ? `?${q}` : '';
    return u.toString();
  } catch {
    return t;
  }
}

/**
 * Builds a WebSocket URL with credentials as query parameters, e.g.
 * ws://localhost:8080?username=admin&password=changeme
 */
export function buildWebSocketConnectUrl(baseUrl: string, username: string, password: string): string {
  const t = baseUrl.trim();
  if (!t) {
    return t;
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `ws://${t}`;

  try {
    const u = new URL(withScheme);
    u.searchParams.delete('username');
    u.searchParams.delete('password');
    if (username !== '') {
      u.searchParams.set('username', username);
    }
    if (password !== '') {
      u.searchParams.set('password', password);
    }
    return u.toString();
  } catch {
    const sep = t.includes('?') ? '&' : '?';
    const params: string[] = [];
    if (username !== '') {
      params.push(`username=${encodeURIComponent(username)}`);
    }
    if (password !== '') {
      params.push(`password=${encodeURIComponent(password)}`);
    }
    if (params.length === 0) {
      return t;
    }
    return `${t}${sep}${params.join('&')}`;
  }
}
