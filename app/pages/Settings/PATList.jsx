import React from 'react';

function formatDate(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function formatExpiry(expiresAt, isExpired) {
  if (!expiresAt) return <span style={{ color: '#28a745', fontWeight: 500 }}>Never</span>;
  if (isExpired) return <span style={{ color: '#dc3545', fontWeight: 600 }}>Expired</span>;
  const date = new Date(expiresAt);
  const now = new Date();
  const diffMs = date - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return <span style={{ color: '#dc3545', fontWeight: 600 }}>In {diffDays} days</span>;
  if (diffDays < 30) return <span style={{ color: '#ffc107', fontWeight: 500 }}>In {Math.ceil(diffDays / 7)} weeks</span>;
  return <span style={{ color: '#28a745' }}>{formatDate(expiresAt)}</span>;
}

export default function PATList({ tokens, loading, onDelete, onRefresh }) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p>Loading tokens...</p>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60, background: 'var(--color-bg-muted, #f8f9fa)', borderRadius: 8, border: '2px dashed #dee2e6' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
        <h3 style={{ margin: '0 0 8px', color: '#333' }}>No tokens yet</h3>
        <p style={{ margin: 0, color: '#666' }}>Generate your first personal access token to get started with MCP clients.</p>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--color-bg, #fff)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottom: '1px solid var(--color-border, #e9ecef)' }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Your Tokens ({tokens.length})</h3>
        <button type="button" className="btn btn-secondary" onClick={onRefresh} style={{ padding: '6px 12px', fontSize: 13 }}>↻ Refresh</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--color-bg-muted, #f8f9fa)' }}>
            <th style={{ textAlign: 'left', padding: 12, fontWeight: 600 }}>Name</th>
            <th style={{ textAlign: 'left', padding: 12, fontWeight: 600 }}>Dataset</th>
            <th style={{ textAlign: 'left', padding: 12, fontWeight: 600 }}>Created</th>
            <th style={{ textAlign: 'left', padding: 12, fontWeight: 600 }}>Expires</th>
            <th style={{ textAlign: 'left', padding: 12, fontWeight: 600 }}>Scopes</th>
            <th style={{ textAlign: 'right', padding: 12, width: 120 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr key={token.token_id} style={{ borderTop: '1px solid var(--color-border, #e9ecef)', opacity: token.is_expired ? 0.6 : 1 }}>
              <td style={{ padding: 16 }}>
                <strong>{token.name}</strong>
                {token.is_expired && <span style={{ marginLeft: 8, background: '#fff3cd', color: '#856404', padding: '2px 8px', borderRadius: 4 }}>Expired</span>}
              </td>
              <td style={{ padding: 16 }}><code style={{ background: '#e9ecef', padding: '4px 8px', borderRadius: 4 }}>{token.dataset_name}</code></td>
              <td style={{ padding: 16 }}>{formatDate(token.created_at)}</td>
              <td style={{ padding: 16 }}>{formatExpiry(token.expires_at, token.is_expired)}</td>
              <td style={{ padding: 16 }}>
                {token.scopes?.map((s) => <span key={s} style={{ marginRight: 4, background: '#007bff', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>{s}</span>)}
              </td>
              <td style={{ padding: 16, textAlign: 'right' }}>
                <button type="button" className="btn btn-danger" onClick={() => onDelete({ token_id: token.token_id, name: token.name })} style={{ padding: '6px 12px', fontSize: 13 }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
