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

export async function uploadXlsFile(formData) {
  const headers = getAuthHeaders();
  try {
    const BASE = import.meta.env.VITE_API_BASE || '/api';
    const res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: { ...headers }
    });
    if (!res.ok) throw new Error('Upload failed');
    return await res.json();
  } catch (err) {
    throw new Error(err.message || 'Upload failed');
  }
}

export async function loadHdrsFromRange(body) {
  const headers = getAuthHeaders();
  return api('/upload/loadHdrsFromRange', { method: 'POST', body, headers });
}

export async function createDsFromXls(body) {
  const headers = getAuthHeaders();
  return api('/upload/createDs', { method: 'POST', body, headers });
}

export async function uploadCsvFile(formData) {
  const headers = getAuthHeaders();
  try {
    const BASE = import.meta.env.VITE_API_BASE || '/api';
    const res = await fetch(`${BASE}/uploadCsv`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: { ...headers }
    });
    if (!res.ok) throw new Error('Upload failed');
    return await res.json();
  } catch (err) {
    throw new Error(err.message || 'Upload failed');
  }
}

export async function createDsFromCsv(body) {
  const headers = getAuthHeaders();
  return api('/uploadCsv/createDs', { method: 'POST', body, headers });
}

export default {
  fetchDsList,
  createDsFromDs,
  uploadXlsFile,
  loadHdrsFromRange,
  createDsFromXls,
  uploadCsvFile,
  createDsFromCsv,
};
