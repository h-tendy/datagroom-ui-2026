import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AllDs.module.css';
import useAllDs from './useAllDs';
import useCreateDsFromDs from '../../hooks/useCreateDsFromDs';
import { useAuth } from '../../auth/AuthProvider';
import SidebarLayout from '../../SidebarLayout';

function NewDsFromDsForm() {
  const auth = useAuth();
  const userId = auth.userId;
  const navigate = useNavigate();
  const { data, isLoading: listLoading } = useAllDs(userId);
  const createMut = useCreateDsFromDs();

  const [fromDsName, setFromDsName] = useState('');
  const [toDsName, setToDsName] = useState('');
  const [retainData, setRetainData] = useState(true);
  const [incompleteErr, setIncompleteErr] = useState('');

  const dbList = data?.dbList || [];

  function onSubmit(e) {
    e.preventDefault();
    if (!toDsName) return setIncompleteErr('Specify new DS name!');
    if (!fromDsName) return setIncompleteErr('Select FROM DS name!');
    setIncompleteErr('');
    createMut.mutate({ fromDsName, toDsName, dsUser: userId, retainData });
  }

  function onCancel() {
    navigate('/');
  }

  const serverStatus = createMut.data?.data;

  return (
    <div className={styles.container}>
      <div style={{marginBottom: 12}}>
        <h3><label className="underline">Copy Dataset from an existing Dataset</label></h3>
      </div>

      <form onSubmit={onSubmit}>
        <div style={{marginBottom:12}}>
          <label><strong>Step 1.</strong> Select From DS:</label>
          <div>
            <select value={fromDsName} onChange={e => setFromDsName(e.target.value)} style={{minWidth: 300}}>
              <option value="">-- select --</option>
              {dbList.map(d => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{marginBottom:12}}>
          <label>
            <input type="checkbox" checked={retainData} onChange={e => setRetainData(e.target.checked)} /> &nbsp; Retain data
          </label>
        </div>

        <div style={{marginBottom:12}}>
          <label><strong>Step 2.</strong> Specify new dataset name:</label>
          <div>
            <input type="text" value={toDsName} onChange={e => {
              const v = e.target.value;
              if (!v || (v.match(/^[a-zA-Z][a-zA-Z0-9_]*$/g) && v.length <= 64)) setToDsName(v);
            }} style={{minWidth: 300}} />
          </div>
        </div>

        <div style={{marginBottom:12}}>
          <button type="submit" className="btn btn-primary" disabled={createMut.isLoading}> {createMut.isLoading ? 'Creating...' : 'Create'} </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel} style={{marginLeft:8}}>Cancel</button>
        </div>

        <div style={{marginTop:8}}>
          {incompleteErr && <div style={{color:'red'}}>{incompleteErr}</div>}
          {createMut.isError && <div style={{color:'red'}}>{createMut.error?.message || 'Create failed'}</div>}
          {serverStatus && serverStatus.status === 'fail' && <div style={{color:'red'}}>{serverStatus.message}</div>}
          {serverStatus && serverStatus.status === 'success' && toDsName && (
            <div style={{color:'green'}}>
              <strong>Successfully created: </strong>
              <a href={`/ds/${toDsName}/default`} onClick={(e) => { e.preventDefault(); navigate(`/ds/${toDsName}/default`); }}>{`Click here for your dataset`}</a>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

export default function NewDsFromDsPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    auth.logout();
    navigate('/login');
  }

  return (
    <SidebarLayout onLogout={handleLogout}>
      <div style={{ position: 'relative', width: '100%', margin: '0 auto', padding: '0 20px' }}>
        <NewDsFromDsForm />
      </div>
    </SidebarLayout>
  );
}
