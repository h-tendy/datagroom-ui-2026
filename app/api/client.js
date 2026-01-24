const BASE = import.meta.env.VITE_API_BASE || '/api';

async function rawFetch(path, opts = {}) {
  const url = `${BASE}${path}`;
  const { headers = {}, body, ...rest } = opts;
  const init = {
    method: opts.method || (body ? 'POST' : 'GET'),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...rest,
  };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) {
    if (res.status === 401) {
      // consumer may handle logout on 401
    }
    const err = new Error((data && data.message) || res.statusText || 'API error');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function api(path, opts = {}) {
  return rawFetch(path, opts);
}

// Specific helpers matching reference/user.service.js
export async function loginApi(username, password) {
  return rawFetch('/login', {
    method: 'POST',
    body: { username, password },
  });
}

export async function logoutApi() {
  return rawFetch('/logout', { method: 'GET' });
}

export async function sessionCheckApi(user) {
  // user param is optional; reference used a header 'user'
  const headers = user ? { user: user.user } : {};
  return rawFetch('/sessionCheck', { method: 'GET', headers });
}

export async function getAllUsers() { return rawFetch('/users', { method: 'GET' }); }
export async function getUserById(id) { return rawFetch(`/users/${id}`, { method: 'GET' }); }
export async function registerUser(user) { return rawFetch('/users/register', { method: 'POST', body: user }); }
export async function updateUser(user) { return rawFetch(`/users/${user.id}`, { method: 'PUT', body: user }); }
export async function deleteUser(id) { return rawFetch(`/users/${id}`, { method: 'DELETE' }); }
