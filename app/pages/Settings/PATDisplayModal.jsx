import React, { useState } from 'react';

const DEFAULT_GATEWAY_URL = 'http://localhost:8887';
const DEFAULT_MCP_URL = 'http://localhost:8000/mcp';

export default function PATDisplayModal({ tokenData, onClose }) {
  const [copied, setCopied] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState(DEFAULT_GATEWAY_URL);
  const [mcpUrl, setMcpUrl] = useState(DEFAULT_MCP_URL);

  const token = tokenData?.token || '';
  const tokenPrefix = tokenData?.token_prefix || '';

  async function copyToClipboard(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  const mcpSnippet = JSON.stringify(
    {
      datagroom: {
        type: 'http',
        url: mcpUrl,
        env: {
          DATAGROOM_PAT_TOKEN: token,
          DATAGROOM_GATEWAY_URL: gatewayUrl,
        },
      },
    },
    null,
    2
  );

  function handleClose() {
    if (!confirmed) {
      const ok = window.confirm('Have you saved this token? You will NOT be able to see it again!');
      if (!ok) return;
    }
    onClose();
  }

  function handleBackgroundClick(e) {
    if (e.target === e.currentTarget) handleClose();
  }

  return (
    <div
      className="modal-overlay"
      onClick={handleBackgroundClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
      }}
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--color-bg, #fff)',
          borderRadius: 12,
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          maxWidth: 640,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            padding: 24,
            borderBottom: '1px solid var(--color-border, #e9ecef)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Token Created — Copy Now</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 24 }}>
          <div
            style={{
              padding: 12,
              background: '#fff3cd',
              color: '#856404',
              borderRadius: 8,
              marginBottom: 24,
            }}
          >
            <strong>Important:</strong> This token is shown only once. Copy it now and store it securely.
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Your Token</label>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                background: 'var(--color-bg-muted, #f8f9fa)',
                padding: 12,
                borderRadius: 8,
                fontFamily: 'monospace',
                fontSize: 13,
                wordBreak: 'break-all',
              }}
            >
              <code style={{ flex: 1 }}>{token}</code>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => copyToClipboard(token, 'token')}
              >
                {copied === 'token' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              MCP server URL (optional)
            </label>
            <input
              type="text"
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--color-border, #ced4da)',
                borderRadius: 6,
              }}
              placeholder="http://localhost:8000/mcp"
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Datagroom Gateway URL (optional)
            </label>
            <input
              type="text"
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--color-border, #ced4da)',
                borderRadius: 6,
              }}
              placeholder="http://localhost:8887"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Add to Cursor mcp.json
            </label>
            <p style={{ fontSize: 14, color: '#6c757d', margin: '0 0 8px' }}>
              Copy the snippet below and add it to <code>~/.cursor/mcp.json</code> under{' '}
              <code>mcpServers</code> to use this token with the Datagroom MCP server.
            </p>
            <div
              style={{
                position: 'relative',
                background: '#1e1e1e',
                color: '#d4d4d4',
                padding: 16,
                borderRadius: 8,
                fontFamily: 'monospace',
                fontSize: 12,
                overflowX: 'auto',
              }}
            >
              <pre style={{ margin: 0 }}>{mcpSnippet}</pre>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => copyToClipboard(mcpSnippet, 'mcp')}
                style={{ position: 'absolute', top: 12, right: 12 }}
              >
                {copied === 'mcp' ? '✓ Copied' : 'Copy MCP config'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>I have saved this token in a secure location</span>
            </label>
          </div>
        </div>

        <div
          style={{
            padding: '20px 24px',
            borderTop: '1px solid var(--color-border, #e9ecef)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="btn btn-primary" onClick={handleClose}>
            {confirmed ? 'Done' : 'Please confirm you have saved the token'}
          </button>
        </div>
      </div>
    </div>
  );
}
