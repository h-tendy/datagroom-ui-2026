import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Row, Col, Form, Button } from 'react-bootstrap';
import { useMutation } from '@tanstack/react-query';

import { useAuth } from '../../auth/AuthProvider';
import SidebarLayout from '../../SidebarLayout';
import { uploadXlsFile, bulkEditFromXls } from '../../api/ds';

// Import existing styles from DsView
import '../DsView/DsViewSimple.css';
import '../DsView/simpleStyles.css';

const API_URL = import.meta.env.VITE_API_BASE || '/api';

function DsBulkEditForm() {
  const { dsName } = useParams();
  const auth = useAuth();
  const userId = auth.userId;
  
  // Step 1: File upload
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [sheetInfo, setSheetInfo] = useState([]);
  const [uploadError, setUploadError] = useState('');
  
  // Step 2: Sheet selection
  const [selectedSheet, setSelectedSheet] = useState('');
  
  // Step 3: Range specification
  const [selectedRange, setSelectedRange] = useState('');
  const [setDataRows, setSetDataRows] = useState(false);
  const [setDataColumns, setSetDataColumns] = useState(false);
  
  // Step 4: Validation/Execution
  const [loadStatus, setLoadStatus] = useState(null);
  const [isValidated, setIsValidated] = useState(false);
  
  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: uploadXlsFile,
    onSuccess: (data) => {
      if (data && Array.isArray(data)) {
        setSheetInfo(data);
        setUploadError('');
      } else {
        setSheetInfo([]);
        setUploadError('Invalid response from server');
      }
    },
    onError: (error) => {
      setUploadError(error.message || 'Upload failed');
      setSheetInfo([]);
    }
  });
  
  // Validation mutation (doit: 0)
  const validateMutation = useMutation({
    mutationFn: bulkEditFromXls,
    onSuccess: (data) => {
      setLoadStatus(data);
      setIsValidated(true);
    },
    onError: (error) => {
      setLoadStatus({ loadStatus: false, error: error.message || 'Validation failed' });
      setIsValidated(false);
    }
  });
  
  // Execution mutation (doit: 1)
  const executeMutation = useMutation({
    mutationFn: bulkEditFromXls,
    onSuccess: (data) => {
      setLoadStatus(data);
    },
    onError: (error) => {
      setLoadStatus({ loadStatus: false, error: error.message || 'Execution failed' });
    }
  });
  
  // File select handler
  const onFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    const remoteFileName = userId + '_' + selectedFile.name;
    const formData = new FormData();
    formData.append('file', selectedFile, remoteFileName);
    
    setFile(selectedFile);
    setFileName(remoteFileName);
    setSheetInfo([]);
    setSelectedSheet('');
    setSelectedRange('');
    setLoadStatus(null);
    setIsValidated(false);
    setUploadError('');
    
    uploadMutation.mutate(formData);
  };
  
  // Sheet change handler
  const onSheetChange = (e) => {
    setSelectedSheet(e.target.value);
    setSelectedRange('');
    setLoadStatus(null);
    setIsValidated(false);
  };
  
  // Range change handler
  const onRangeChange = (e) => {
    setSelectedRange(e.target.value);
    setLoadStatus(null);
    setIsValidated(false);
  };
  
  // Validate handler
  const onValidate = () => {
    if (!fileName || !selectedSheet || !selectedRange) {
      alert('Please complete all required fields');
      return;
    }
    
    validateMutation.mutate({
      dsName,
      dsUser: userId,
      fileName,
      selectedSheet,
      selectedRange,
      setDataRows,
      setDataColumns,
      doit: 0  // Validation only
    });
  };
  
  // Execute handler
  const onDoIt = () => {
    if (!isValidated) {
      alert('Please validate first');
      return;
    }
    
    if (!confirm('Are you sure you want to execute this bulk edit? This action cannot be undone.')) {
      return;
    }
    
    executeMutation.mutate({
      dsName,
      dsUser: userId,
      fileName,
      selectedSheet,
      selectedRange,
      setDataRows,
      setDataColumns,
      doit: 1  // Execute
    });
  };
  
  return (
    <div>
      <Row>
        <Col md={12} sm={12} xs={12}> 
          <h3 style={{ float: 'center' }}>
            <label className="underline">Bulk Edit: {dsName}</label>
          </h3>
        </Col>
      </Row>
      <br/>
      
      {/* Backup warning */}
      <Row>
        <Col md={12} sm={12} xs={12}>
          <div style={{ backgroundColor: '#fff3cd', padding: '10px', border: '1px solid #ffc107', marginBottom: '15px' }}>
            <strong>⚠️ Warning:</strong> Please take a backup before proceeding. 
            Do not make any other edits to this dataset while bulk edit is in progress.
            <br/>
            <a href={`${API_URL}/ds/view/xlsx/${dsName}/MAIN/${userId}`} target="_blank" rel="noopener noreferrer">
              <Button variant="warning" size="sm" style={{ marginTop: '5px' }}>
                Download Xlsx (Backup)
              </Button>
            </a>
          </div>
        </Col>
      </Row>
      
      {/* Step 1: File upload */}
      <Row style={{ marginBottom: '20px' }}>
        <Col md={12} sm={12} xs={12}>
          <h5><strong>Step 1.</strong> Select Excel file:</h5>
          <Form.Control 
            type="file" 
            accept=".xls,.xlsx"
            onChange={onFileSelect} 
          />
          {uploadMutation.isPending && <div style={{ color: 'blue', marginTop: '5px' }}>Uploading...</div>}
          {uploadError && <div style={{ color: 'red', marginTop: '5px' }}>{uploadError}</div>}
          {sheetInfo.length > 0 && (
            <div style={{ color: 'green', marginTop: '5px' }}>
              ✓ Upload successful! Found {sheetInfo.length} sheet(s).
            </div>
          )}
        </Col>
      </Row>
      
      {/* Step 2: Sheet selection */}
      {sheetInfo.length > 0 && (
        <Row style={{ marginBottom: '20px' }}>
          <Col md={12} sm={12} xs={12}>
            <h5><strong>Step 2.</strong> Select sheet:</h5>
            <Form.Select value={selectedSheet} onChange={onSheetChange}>
              <option value="">-- Select Sheet --</option>
              {sheetInfo.map((sheet, idx) => (
                <option key={idx} value={sheet.name}>{sheet.name}</option>
              ))}
            </Form.Select>
          </Col>
        </Row>
      )}
      
      {/* Step 3: Range specification */}
      {selectedSheet && (
        <Row style={{ marginBottom: '20px' }}>
          <Col md={12} sm={12} xs={12}>
            <h5><strong>Step 3.</strong> Specify range (must include headers):</h5>
            <Form.Control 
              type="text" 
              placeholder="e.g., A1:D100"
              value={selectedRange}
              onChange={onRangeChange}
            />
            <div style={{ marginTop: '10px' }}>
              <Form.Check 
                type="checkbox" 
                label="Set data rows (will delete all rows not in specified range)"
                checked={setDataRows}
                onChange={(e) => setSetDataRows(e.target.checked)}
              />
              <Form.Check 
                type="checkbox" 
                label="Set data columns (will delete all columns not in specified range)"
                checked={setDataColumns}
                onChange={(e) => setSetDataColumns(e.target.checked)}
              />
            </div>
            <Button 
              variant="primary" 
              onClick={onValidate}
              disabled={!selectedRange || validateMutation.isPending}
              style={{ marginTop: '10px' }}
            >
              {validateMutation.isPending ? 'Validating...' : 'Validate!'}
            </Button>
          </Col>
        </Row>
      )}
      
      {/* Step 4: Validation results and execution */}
      {loadStatus && (
        <Row style={{ marginBottom: '20px' }}>
          <Col md={12} sm={12} xs={12}>
            <h5><strong>Step 4.</strong> Validation Results:</h5>
            
            {loadStatus.loadStatus === false && loadStatus.error && (
              <div style={{ color: 'red', padding: '10px', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb' }}>
                <strong>Error:</strong> {loadStatus.error}
              </div>
            )}
            
            {loadStatus.hdrErrors && Object.keys(loadStatus.hdrErrors).length > 0 && (
              <div style={{ color: 'red', padding: '10px', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', marginBottom: '10px' }}>
                <strong>Header Errors:</strong>
                <ul>
                  {Object.entries(loadStatus.hdrErrors).map(([key, value]) => (
                    <li key={key}>{key}: {value}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {loadStatus.oprLog && loadStatus.oprLog.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <strong>Operations to be performed:</strong>
                <pre style={{ 
                  backgroundColor: '#f8f9fa', 
                  padding: '10px', 
                  border: '1px solid #dee2e6',
                  maxHeight: '300px',
                  overflow: 'auto'
                }}>
                  {loadStatus.oprLog.map((op, idx) => (
                    <div key={idx}>{op}</div>
                  ))}
                </pre>
              </div>
            )}
            
            {isValidated && !loadStatus.error && !executeMutation.isSuccess && (
              <Button 
                variant="danger" 
                onClick={onDoIt}
                disabled={executeMutation.isPending}
              >
                {executeMutation.isPending ? 'Executing...' : 'Do It!'}
              </Button>
            )}
            
            {executeMutation.isSuccess && (
              <div style={{ color: 'green', padding: '10px', backgroundColor: '#d4edda', border: '1px solid #c3e6cb', marginTop: '10px' }}>
                <strong>✓ Bulk edit completed successfully!</strong>
                <br/>
                <Link to={`/ds/${dsName}/MAIN`} style={{ marginTop: '10px', display: 'inline-block' }}>
                  View updated dataset →
                </Link>
              </div>
            )}
          </Col>
        </Row>
      )}
    </div>
  );
}

export default function DsBulkEditPage() {
  return (
    <SidebarLayout>
      <DsBulkEditForm />
    </SidebarLayout>
  );
}
