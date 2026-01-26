import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import styles from './AllDs.module.css';
import { useAuth } from '../../auth/AuthProvider';
import SidebarLayout from '../../SidebarLayout';
import { uploadCsvFile, createDsFromCsv } from '../../api/ds';

function NewDsFromCsvForm() {
  const auth = useAuth();
  const userId = auth.userId;
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [hdrs, setHdrs] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [dsName, setDsName] = useState('');
  const [createStatus, setCreateStatus] = useState(null);

  const uploadMut = useMutation({
    mutationFn: uploadCsvFile,
    onSuccess: (data) => {
      if (data && Array.isArray(data)) {
        setHdrs(data);
      } else {
        setHdrs([]);
      }
    }
  });

  const createMut = useMutation({
    mutationFn: createDsFromCsv,
    onSuccess: (data) => {
      setCreateStatus(data);
    },
    onError: (err) => {
      setCreateStatus({ loadStatus: false, error: err.message });
    }
  });

  function onFileSelect(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    const remoteFileName = userId + '_' + selectedFile.name;
    const formData = new FormData();
    formData.append('file', selectedFile, remoteFileName);
    
    setFile(selectedFile);
    setFileName(remoteFileName);
    setHdrs([]);
    setSelectedKeys([]);
    setDsName('');
    setCreateStatus(null);
    
    uploadMut.mutate(formData);
  }

  function onKeysChange(e) {
    const options = e.target.options;
    const selected = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) selected.push(options[i].value);
    }
    setSelectedKeys(selected);
  }

  function onDsNameChange(e) {
    const value = e.target.value;
    if (!value || (value.match(/^[a-zA-Z][a-zA-Z0-9_]*$/g) && value.length <= 64)) {
      setDsName(value);
    }
  }

  function onCreate() {
    if (!fileName || !selectedKeys.length || !dsName) return;
    createMut.mutate({
      fileName,
      selectedKeys,
      dsName,
      dsUser: userId
    });
  }

  return (
    <div className={styles.container}>
      <div style={{marginBottom: 12}}>
        <h3><label className="underline">New Dataset from csv file</label></h3>
      </div>

      {/* Step 1: File upload */}
      <div style={{marginBottom:12}}>
        <label><strong>Step 1.</strong> Select csv file:</label>
        <div>
          <input type="file" accept=".csv" onChange={onFileSelect} />
        </div>
      </div>

      {uploadMut.isError && <div style={{color:'red', marginBottom:12}}>{uploadMut.error?.message}</div>}
      {uploadMut.isSuccess && hdrs.length === 0 && <div style={{color:'red', marginBottom:12}}>Failed to read the hdrs!</div>}

      {/* Step 2: Key selection */}
      {hdrs.length > 0 && (
        <div style={{marginBottom:12}}>
          <label><strong>Step 2.</strong> Select keys:</label>
          <div>
            <select multiple value={selectedKeys} onChange={onKeysChange} style={{minWidth:300, minHeight:100}}>
              {hdrs.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <div style={{fontSize:'0.85em', color:'var(--color-text-muted)'}}>Hold Ctrl/Cmd to select multiple</div>
          </div>
        </div>
      )}

      {/* Step 3: DS name and create */}
      {hdrs.length > 0 && (
        <div style={{marginBottom:12}}>
          <label><strong>Step 5.</strong> Specify dataset name:</label>
          <div>
            <input type="text" value={dsName} onChange={onDsNameChange} style={{minWidth:300}} />
            <button onClick={onCreate} disabled={createMut.isLoading} style={{marginLeft:8}}>
              {createMut.isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Status messages */}
      {createStatus && createStatus.error && <div style={{color:'red', marginTop:12}}>{createStatus.error}</div>}
      {createStatus && createStatus.loadStatus && dsName && (
        <div style={{color:'green', marginTop:12}}>
          <strong>Successfully created: </strong>
          <a href={`/ds/${dsName}/default`} onClick={(e) => { e.preventDefault(); navigate(`/ds/${dsName}/default`); }}>
            Click here for your dataset
          </a>
        </div>
      )}
    </div>
  );
}

export default function NewDsFromCsvPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    auth.logout();
    navigate('/login');
  }

  return (
    <SidebarLayout onLogout={handleLogout}>
      <div style={{ position: 'relative', width: '100%', margin: '0 auto', padding: '0 20px' }}>
        <NewDsFromCsvForm />
      </div>
    </SidebarLayout>
  );
}
