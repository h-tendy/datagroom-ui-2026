import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import styles from './AllDs.module.css';
import { useAuth } from '../../auth/AuthProvider';
import SidebarLayout from '../../SidebarLayout';
import { uploadXlsFile, loadHdrsFromRange, createDsFromXls } from '../../api/ds';

function NewDsFromXlsForm() {
  const auth = useAuth();
  const userId = auth.userId;
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [sheetInfo, setSheetInfo] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [range, setRange] = useState('');
  const [loadStatus, setLoadStatus] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [dsName, setDsName] = useState('');
  const [createStatus, setCreateStatus] = useState(null);

  const uploadMut = useMutation({
    mutationFn: uploadXlsFile,
    onSuccess: (data) => {
      if (data && Array.isArray(data)) {
        setSheetInfo(data);
      } else {
        setSheetInfo([]);
      }
    }
  });

  const validateMut = useMutation({
    mutationFn: loadHdrsFromRange,
    onSuccess: (data) => {
      setLoadStatus(data);
    }
  });

  const createMut = useMutation({
    mutationFn: createDsFromXls,
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
    setSheetInfo([]);
    setSelectedSheet('');
    setRange('');
    setLoadStatus(null);
    setSelectedKeys([]);
    setDsName('');
    setCreateStatus(null);
    
    uploadMut.mutate(formData);
  }

  function onSheetChange(e) {
    setSelectedSheet(e.target.value);
    setRange('');
    setLoadStatus(null);
    setSelectedKeys([]);
  }

  function onRangeChange(e) {
    setRange(e.target.value);
  }

  function onValidateRange() {
    if (!fileName || !selectedSheet || !range) return;
    validateMut.mutate({ fileName, sheetName: selectedSheet, selectedRange: range });
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
    if (!fileName || !selectedSheet || !range || !selectedKeys.length || !dsName) return;
    createMut.mutate({
      fileName,
      sheetName: selectedSheet,
      selectedRange: range,
      selectedKeys,
      dsName,
      dsUser: userId
    });
  }

  const hdrs = loadStatus?.hdrs ? Object.values(loadStatus.hdrs) : [];
  const hdrErrors = loadStatus?.hdrErrors || {};

  return (
    <div className={styles.container}>
      <div style={{marginBottom: 12}}>
        <h3><label className="underline">New Dataset from xls file</label></h3>
      </div>

      {/* Step 1: File upload */}
      <div style={{marginBottom:12}}>
        <label><strong>Step 1.</strong> Select xls file:</label>
        <div>
          <input type="file" accept=".xls,.xlsx" onChange={onFileSelect} />
        </div>
      </div>

      {uploadMut.isError && <div style={{color:'red', marginBottom:12}}>{uploadMut.error?.message}</div>}
      {uploadMut.isSuccess && sheetInfo.length === 0 && <div style={{color:'red', marginBottom:12}}>Failed to recognize the sheets!</div>}

      {/* Step 2: Sheet selection */}
      {sheetInfo.length > 0 && (
        <div style={{marginBottom:12}}>
          <label><strong>Step 2.</strong> Select sheet:</label>
          <div>
            <select value={selectedSheet} onChange={onSheetChange} style={{minWidth:300}}>
              <option value="">-- select --</option>
              {sheetInfo.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Step 3: Range specification */}
      {selectedSheet && (
        <div style={{marginBottom:12}}>
          <label><strong>Step 3.</strong> Specify range (must include hdrs):</label>
          <div>
            <input type="text" value={range} onChange={onRangeChange} style={{minWidth:300}} />
            <button onClick={onValidateRange} disabled={validateMut.isLoading} style={{marginLeft:8}}>
              {validateMut.isLoading ? 'Validating...' : 'Validate'}
            </button>
          </div>
        </div>
      )}

      {validateMut.isError && <div style={{color:'red', marginBottom:12}}>Validation failed</div>}
      {loadStatus && !loadStatus.loadStatus && (
        <div style={{color:'red', marginBottom:12}}>
          {loadStatus.error && <div><strong>Error:</strong> {loadStatus.error}</div>}
          {Object.keys(hdrErrors).length > 0 && Object.entries(hdrErrors).map(([k, v]) => (
            <div key={k}>[{k}]: <strong>{v}</strong></div>
          ))}
        </div>
      )}

      {/* Step 4: Key selection */}
      {loadStatus && loadStatus.loadStatus && hdrs.length > 0 && (
        <div style={{marginBottom:12}}>
          <label><strong>Step 4.</strong> Select key(s):</label>
          <div>
            <select multiple value={selectedKeys} onChange={onKeysChange} style={{minWidth:300, minHeight:100}}>
              {hdrs.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <div style={{fontSize:'0.85em', color:'var(--color-text-muted)'}}>Hold Ctrl/Cmd to select multiple</div>
          </div>
        </div>
      )}

      {/* Step 5: DS name and create */}
      {loadStatus && loadStatus.loadStatus && hdrs.length > 0 && (
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

export default function NewDsFromXlsPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    auth.logout();
    navigate('/login');
  }

  return (
    <SidebarLayout onLogout={handleLogout}>
      <div style={{ position: 'relative', width: '100%', margin: '0 auto', padding: '0 20px' }}>
        <NewDsFromXlsForm />
      </div>
    </SidebarLayout>
  );
}
