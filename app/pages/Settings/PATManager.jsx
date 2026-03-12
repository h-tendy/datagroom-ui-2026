import React, { useState, useEffect } from 'react';
import { getPATs, createPAT, deletePAT } from '../../api/client';
import PATList from './PATList';
import PATCreateModal from './PATCreateModal';
import PATDisplayModal from './PATDisplayModal';
import PATDeleteConfirm from './PATDeleteConfirm';

export default function PATManager() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTokenData, setNewTokenData] = useState(null);
  const [tokenToDelete, setTokenToDelete] = useState(null);

  async function fetchTokens() {
    try {
      setLoading(true);
      setError('');
      const data = await getPATs();
      setTokens(data.tokens || []);
    } catch (err) {
      console.error('Error fetching tokens:', err);
      setError('Failed to load tokens. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTokens(); }, []);

  async function handleCreateToken(tokenData) {
    setNewTokenData(tokenData);
    setShowCreateModal(false);
    await fetchTokens();
  }

  async function handleDeleteToken() {
    if (!tokenToDelete) return;
    try {
      await deletePAT(tokenToDelete.token_id);
      await fetchTokens();
      setTokenToDelete(null);
    } catch (err) {
      console.error('Error deleting token:', err);
      setError('Failed to delete token. Please try again.');
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: 0 }}>
      <div style={{ marginBottom: 30 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 24 }}>Personal Access Tokens</h2>
        <p style={{ color: '#666', margin: '0 0 20px', lineHeight: 1.5 }}>
          Personal access tokens (PATs) allow external applications like MCP clients to access your Datagroom datasets.
          Tokens inherit your dataset-level and row-level permissions automatically.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          disabled={loading}
        >
          + Generate New Token
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#f8d7da', color: '#721c24', borderRadius: 6, marginBottom: 20 }}>
          {error}
          <button type="button" onClick={() => setError('')} style={{ marginLeft: 12 }}>×</button>
        </div>
      )}

      <PATList tokens={tokens} loading={loading} onDelete={setTokenToDelete} onRefresh={fetchTokens} />

      {showCreateModal && (
        <PATCreateModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateToken} />
      )}
      {newTokenData && (
        <PATDisplayModal tokenData={newTokenData} onClose={() => setNewTokenData(null)} />
      )}
      {tokenToDelete && (
        <PATDeleteConfirm
          token={tokenToDelete}
          onConfirm={handleDeleteToken}
          onCancel={() => setTokenToDelete(null)}
        />
      )}
    </div>
  );
}
