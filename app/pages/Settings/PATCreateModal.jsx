import React, { useState } from 'react';
import { createPAT } from '../../api/client';

export default function PATCreateModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({ name: '', expiresInDays: 365 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Token name is required');
      return;
    }
    if (formData.name.length > 100) {
      setError('Token name must be less than 100 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const tokenData = await createPAT({
        name: formData.name.trim(),
        expiresInDays: formData.expiresInDays,
      });
      onCreate(tokenData);
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to generate token');
      setLoading(false);
    }
  }

  function handleBackgroundClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleBackgroundClick} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050,
    }}>
      <div className="modal-content" style={{
        background: 'var(--color-bg, #fff)', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ padding: 24, borderBottom: '1px solid var(--color-border, #e9ecef)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Generate New Token</h3>
          <button type="button" onClick={onClose} disabled={loading} style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="pat-name" style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Token Name <span style={{ color: '#dc3545' }}>*</span></label>
              <input
                id="pat-name"
                type="text"
                className="form-control"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Cursor IDE, MCP Client"
                maxLength={100}
                required
                disabled={loading}
                autoFocus
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border, #ced4da)', borderRadius: 6 }}
              />
              <small style={{ display: 'block', marginTop: 6, color: '#6c757d' }}>A descriptive name to help you identify this token later</small>
            </div>
            <div style={{ marginBottom: 20, padding: 12, background: 'var(--color-bg-muted, #f8f9fa)', borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 14 }}>
                This token will grant access to <strong>all datasets you have permission to</strong> (your ACL). Use it in MCP to query any of your datasets.
              </p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="pat-expiry" style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Token Expiration</label>
              <select
                id="pat-expiry"
                value={formData.expiresInDays}
                onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value, 10) })}
                disabled={loading}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border, #ced4da)', borderRadius: 6 }}
              >
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>1 year (recommended)</option>
                <option value={0}>Never (not recommended)</option>
              </select>
              <small style={{ display: 'block', marginTop: 6, color: '#6c757d' }}>Tokens should expire for security reasons</small>
            </div>
            {error && (
              <div style={{ padding: 12, background: '#f8d7da', color: '#721c24', borderRadius: 6, marginBottom: 20 }}>{error}</div>
            )}
          </div>
          <div style={{ padding: '20px 24px', borderTop: '1px solid var(--color-border, #e9ecef)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Generating...' : 'Generate Token'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
