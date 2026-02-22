import { api } from './client';

function getAuthHeaders() {
  const accessToken = localStorage.getItem('accessToken');
  const sessionToken = localStorage.getItem('sessionToken');
  return {
    'x-access-token': accessToken || '',
    'x-session-token': sessionToken || '',
  };
}

/**
 * Upload attachment file
 * Reference: DsAttachments.js lines 102-138
 * @param {FormData} formData - FormData containing file and dsName
 * @returns {Promise} Response from server
 */
export async function uploadAttachment(formData) {
  const headers = getAuthHeaders();
  try {
    const BASE = import.meta.env.VITE_API_BASE || '';
    const res = await fetch(`${BASE}/uploadAttachments`, {
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

/**
 * Delete one attachment
 * Reference: DsAttachments.js lines 183-193
 * @param {Object} payload - { dsName, dsView, user, _id }
 * @returns {Promise} Response from server
 */
export async function deleteOneAttachment(payload) {
  const headers = getAuthHeaders();
  return api('/uploadAttachments/deleteAttachment', { 
    method: 'POST', 
    body: payload, 
    headers 
  });
}
