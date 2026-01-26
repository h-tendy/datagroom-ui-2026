import { api } from './client';

function getAuthHeaders() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return {};
    const u = JSON.parse(raw);
    if (u && u.token) return { authorization: 'Bearer ' + u.token };
  } catch (e) {}
  return {};
}

export async function fetchDsList(userId) {
  const headers = getAuthHeaders();
  return api(`/ds/dsList/${userId}`, { method: 'GET', headers });
}

export async function createDsFromDs(body) {
  const headers = getAuthHeaders();
  try {
    const data = await api('/ds/createDsFromDs', { method: 'POST', body, headers });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, data: { status: 'fail', message: err.message || 'Create failed' } };
  }
}

export default {
  fetchDsList,
  createDsFromDs,
};
