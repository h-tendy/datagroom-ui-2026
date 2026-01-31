/**
 * DsView Page - Dataset Viewer and Editor
 * 
 * Main component for viewing and editing dataset records with:
 * - Interactive Tabulator table
 * - Real-time collaborative editing via Socket.io
 * - Cell-level locking
 * - Advanced filtering and sorting
 * - JIRA integration
 * - Excel export
 * - Presentation mode
 * 
 * Migration Note: This is a partial implementation framework.
 * The full 2,360-line reference implementation needs to be incrementally
 * migrated with all methods, handlers, and features.
 */

import React, { useState, useEffect, useRef, useReducer, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Row, Col } from 'react-bootstrap';
import styles from './DsViewPage.module.css';
import { useAuth } from '../../auth/AuthProvider';

// Hooks
import useDsView from '../../hooks/useDsView';
import useEditCell from '../../hooks/useEditCell';
import { useInsertRow, useDeleteRow, useDeleteManyRows, useAddColumn, useDeleteColumn } from '../../hooks/useDsOperations';
import useDatasetSocket from '../../hooks/useDatasetSocket';

// Components
import MyTabulator from '../../components/MyTabulator';
import Notification from '../../components/Notification';
// import FilterControls from './components/FilterControls.jsx'; // TODO: Refactor for hooks
import Modal from './components/Modal.jsx';
import ModalEditor from './components/ModalEditor.jsx';
import JiraForm from './components/jiraForm.jsx';

// Editors
import * as DateEditorModule from '@tabulator/react-tabulator/lib/editors/DateEditor';
const DateEditor = DateEditorModule.default;
import MyTextArea from '../../components/editors/MyTextArea.jsx';
import MyCodeMirror from '../../components/editors/MyCodeMirror.jsx';
import MyAutoCompleter from '../../components/editors/MyAutoCompleter.jsx';
import MySingleAutoCompleter from '../../components/editors/MySingleAutoCompleter.jsx';
import ColorPicker from '../../components/editors/ColorPicker.jsx';

// Helpers
import createClipboardHelpers from './helpers/clipboardHelpers';
import createDomHelpers from './helpers/domHelpers';
import createTabulatorConfig from './helpers/tabulatorConfig';
import createJiraHelpers from './helpers/jiraHelpers.jsx';

// Reducer
import { editReducer, initialEditState, EDIT_ACTION_TYPES } from './reducers/editReducer';

// Styles
import './DsView.css';
import './DsViewSimple.css';
import '@tabulator/styles/tabulator-custom.css';
import 'highlight.js/styles/default.css';

// API
const API_URL = import.meta.env.VITE_API_BASE || '';

function DsViewPage() {
  const { dsName, dsView } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const userId = auth.userId;

  // Refs
  const tabulatorRef = useRef(null);
  const timersRef = useRef({});
  const cellImEditingRef = useRef(null);
  const reqCount = useRef(0);
  
  // Store edit-related state in refs so cellEditCheck can access current values
  const singleClickEditRef = useRef(false);
  const disableEditingRef = useRef(false);
  const originalColumnAttrsRef = useRef(null);

  // Fetch view configuration
  const { data: viewConfig, isLoading, isError, error } = useDsView(dsName, dsView, userId);

  // Mutations
  const editCellMutation = useEditCell(dsName, dsView, userId);
  const insertRowMutation = useInsertRow(dsName, dsView, userId);
  const deleteRowMutation = useDeleteRow(dsName, dsView, userId);
  const deleteManyRowsMutation = useDeleteManyRows(dsName, dsView, userId);
  const addColumnMutation = useAddColumn(dsName, dsView, userId);
  const deleteColumnMutation = useDeleteColumn(dsName, dsView, userId);

  // Edit state
  const [editState, dispatchEdit] = useReducer(editReducer, initialEditState);

  // UI State
  const [pageSize, setPageSize] = useState(30);
  const [filter, setFilter] = useState('');
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [frozenCol, setFrozenCol] = useState(null);
  const [chronologyDescending, setChronologyDescending] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0); // Counter to force table refresh
  const [fetchAllMatchingRecords, setFetchAllMatchingRecords] = useState(false);
  const [totalRecs, setTotalRecs] = useState(0);
  const [moreMatchingDocs, setMoreMatchingDocs] = useState(false);
  
  // Initialize singleClickEdit from localStorage
  const [singleClickEdit, setSingleClickEdit] = useState(() => {
    try {
      const saved = localStorage.getItem('singleClickEdit');
      const value = saved ? JSON.parse(saved) : false;
      singleClickEditRef.current = value; // Sync ref
      return value;
    } catch {
      return false;
    }
  });
  const [disableEditing, setDisableEditing] = useState(() => {
    try {
      const saved = localStorage.getItem('disableEditing');
      const value = saved ? JSON.parse(saved) : false;
      disableEditingRef.current = value; // Sync ref
      return value;
    } catch {
      return false;
    }
  });
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalQuestion, setModalQuestion] = useState('');
  const [modalCallback, setModalCallback] = useState(null);
  const [showModalEditor, setShowModalEditor] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState('success');
  const [notificationMessage, setNotificationMessage] = useState('');

  // Memoize user object to prevent socket reconnections
  const socketUser = useMemo(() => ({ user: userId }), [userId]);

  // Handle cell unlock callback from socket (defined early to be used in socket hook)
  const handleCellUnlocked = useCallback((unlockedObj) => {
    // Additional processing after cell unlock
    if (tabulatorRef.current && !cellImEditingRef.current) {
      if (timersRef.current['post-cell-edited']) {
        clearTimeout(timersRef.current['post-cell-edited']);
      }
      timersRef.current['post-cell-edited'] = setTimeout(() => {
        if (!cellImEditingRef.current && tabulatorRef.current) {
          tabulatorRef.current.table.rowManager.adjustTableSize(false);
          // Call DOM helpers for rendering
          if (domHelpers.current) {
            domHelpers.current.normalizeAllImgRows();
            domHelpers.current.applyHighlightJsBadge();
            domHelpers.current.renderPlotlyInCells();
          }
        }
      }, 500);
    }
  }, []);

  // Socket.io for real-time collaboration
  // Use empty string for socket to connect to same origin (Vite proxy handles WebSocket)
  const { 
    connectedState, 
    dbConnectivityState, 
    lockedCells, 
    emitLock, 
    emitUnlock,
    isCellLocked 
  } = useDatasetSocket(dsName, dsView, socketUser, tabulatorRef, {
    apiUrl: '', // Connect to same origin, Vite proxy will forward WebSocket
    onCellUnlocked: handleCellUnlocked,
  });

  const clipboardHelpers = useRef(null);
  const domHelpers = useRef(null);
  const tabulatorConfigHelper = useRef(null);
  const jiraHelpers = useRef(null);
  const [columns, setColumns] = useState([]);

  // Initialize chronologyDescending from localStorage on mount
  // Reference: DsView.js lines 138-143
  // Default to true if never set (matching reference implementation)
  useEffect(() => {
    const chronologyDescendingFromLocal = localStorage.getItem('chronologyDescending');
    if (chronologyDescendingFromLocal === 'false') {
      setChronologyDescending(false);
    } else {
      // Default to true if null/undefined or any other value
      setChronologyDescending(true);
    }
  }, []);

  // Process URL parameters for chronologyDescending
  // Reference: DsView.js lines 343-345, 439
  // URL params override localStorage
  useEffect(() => {
    const chronologyDescendingParam = searchParams.get('chronologyDescending');
    if (chronologyDescendingParam !== null) {
      const value = chronologyDescendingParam.toLowerCase() === 'true';
      setChronologyDescending(value);
      localStorage.setItem('chronologyDescending', JSON.stringify(value));
    }
  }, [searchParams]);

  // Ajax helper functions (from reference implementation)
  const generateParamsList = useCallback((data, prefix = "") => {
    let output = [];
    
    if (Array.isArray(data)) {
      data.forEach((item, i) => {
        output = output.concat(generateParamsList(item, prefix ? prefix + "[" + i + "]" : i));
      });
    } else if (typeof data === "object" && data !== null) {
      for (let key in data) {
        output = output.concat(generateParamsList(data[key], prefix ? prefix + "[" + key + "]" : key));
      }
    } else {
      output.push({ key: prefix, value: data });
    }
    
    return output;
  }, []);

  const serializeParams = useCallback((params) => {
    const output = generateParamsList(params);
    const encoded = [];
    
    output.forEach((item) => {
      encoded.push(encodeURIComponent(item.key) + "=" + encodeURIComponent(item.value));
    });
    
    return encoded.join("&");
  }, [generateParamsList]);

  const ajaxURLGenerator = useCallback((url, config, params) => {
    if (url) {
      if (params && Object.keys(params).length) {
        params.fetchAllMatchingRecords = fetchAllMatchingRecords;
        params.chronology = chronologyDescending ? 'desc' : 'asc';
        params.reqCount = ++(reqCount.current);
        
        if (!config.method || config.method.toLowerCase() === "get") {
          config.method = "get";
          url += (url.includes("?") ? "&" : "?") + serializeParams(params);
        }
      }
    }
    return url;
  }, [fetchAllMatchingRecords, chronologyDescending, serializeParams]);

  const ajaxResponse = useCallback((url, params, response) => {
    console.log('ajaxResponse', url, params, response);
    if ((response.reqCount === reqCount.current) || (response.reqCount === 0)) {
      setTotalRecs(response.total || 0);
      setMoreMatchingDocs(response.moreMatchingDocs || false);
    } else {
      console.log('ajaxResponse: avoided stale setting of response.total');
    }
    return response;
  }, []);

  // Cell edit check - controls single-click editing based on checkbox state
  // Reference: DsView.js lines 1014-1020
  // Uses refs to always check current state, not captured closure values
  const cellEditCheck = useCallback((cell) => {
    if (!singleClickEditRef.current) return false;  // Checkbox unchecked = no single-click edit
    if (disableEditingRef.current) return false;
    if (!connectedState) return false;      // Not connected to socket
    if (!dbConnectivityState) return false; // No DB connectivity
    // TODO: Add concurrent edit conflict checks (cellEditCheckForConflicts)
    // TODO: Check for mouseDownOnHtmlLink, mouseDownOnBadgeCopyIcon
    return true;
  }, [connectedState, dbConnectivityState]);

  // Cell force edit trigger - called when user clicks/focuses a cell
  // This should check if editing is allowed and then force the edit
  const cellForceEditTrigger = useCallback((cell, e) => {
    // Check all conditions using same logic as cellEditCheck
    if (!singleClickEditRef.current) return;  // Checkbox unchecked = no single-click edit
    if (disableEditingRef.current) return;
    if (!connectedState) return;      // Not connected to socket
    if (!dbConnectivityState) return; // No DB connectivity
    if (cellImEditingRef.current === cell) return;
    // TODO: Add concurrent edit conflict checks (cellEditCheckForConflicts)
    // TODO: Check for mouseDownOnHtmlLink, mouseDownOnBadgeCopyIcon
    // Force the edit by calling cell.edit(true)
    cell.edit(true, e);
  }, [connectedState, dbConnectivityState]);

  // Handle cell click/double-click events
  // Reference: DsView.js lines 906-912
  const cellClickEvents = useCallback((e, cell) => {
    if (!connectedState || !dbConnectivityState) return;

    // Double-click editing when single-click edit is OFF
    if (e.type === 'dblclick' && !singleClickEditRef.current && !disableEditingRef.current) {
      if (cellImEditingRef.current === cell) return;
      // TODO: Add cellEditCheckForConflicts check
      // Force edit on double-click bypassing cellEditCheck
      cell.edit(true, e);
    }
  }, [connectedState, dbConnectivityState]);

  // Handler for checkbox change
  const handleSingleClickEditToggle = useCallback((event) => {
    const checked = event.target.checked;
    singleClickEditRef.current = checked; // Sync ref
    setSingleClickEdit(checked);
    localStorage.setItem('singleClickEdit', JSON.stringify(checked));
  }, []);

  // Toggle functions for checkboxes
  const toggleFilters = useCallback(() => {
    setShowAllFilters(prev => {
      const newValue = !prev;
      localStorage.setItem('showAllFilters', JSON.stringify(newValue));
      return newValue;
    });
  }, []);

  const toggleEditing = useCallback((shouldDisable) => {
    // Dynamically toggle column editors based on shouldDisable parameter
    // Reference: DsView.js lines 726-755
    if (tabulatorRef.current?.table && originalColumnAttrsRef.current) {
      const currentDefs = tabulatorRef.current.table.getColumnDefinitions();
      
      // Modify column definitions in place
      for (let j = 0; j < currentDefs.length; j++) {
        const originalCol = originalColumnAttrsRef.current[j];
        
        if (shouldDisable) {
          // Disabling: Set all editors to false
          currentDefs[j].editor = false;
        } else {
          // Enabling: Restore original editor from viewConfig
          if (originalCol && originalCol.editor) {
            let restoredEditor = originalCol.editor;
            
            // Map string editor names to function references
            if (restoredEditor === 'textarea') {
              restoredEditor = MyTextArea;
            } else if (restoredEditor === 'codemirror') {
              restoredEditor = MyCodeMirror;
            } else if (restoredEditor === 'date') {
              restoredEditor = DateEditor;
            } else if (restoredEditor === 'autocomplete') {
              // Check for multiselect in editorParams
              if (originalCol.editorParams?.multiselect) {
                restoredEditor = MyAutoCompleter;
              } else {
                restoredEditor = MySingleAutoCompleter;
              }
            }
            
            currentDefs[j].editor = restoredEditor;
          }
        }
      }
      
      // Directly update Tabulator columns without triggering React re-render
      // This avoids backend calls that would happen with setColumns(updatedDefs)
      tabulatorRef.current.table.setColumns(currentDefs);
    }
  }, []);

  const toggleFetchAllRecords = useCallback(() => {
    setFetchAllMatchingRecords(prev => !prev);
    // Trigger table refresh
    tabulatorRef.current?.table?.setData();
  }, []);

  // Cell editing handler
  const handleCellEditing = useCallback((cell) => {
    const _id = cell.getRow().getData()._id;
    const field = cell.getField();

    // Check if cell is locked by another user
    if (isCellLocked(_id, field)) {
      return false; // Cancel edit
    }

    // Emit lock event
    emitLock({ dsName, _id, field, user: auth.user?.user });
    cellImEditingRef.current = cell;

    return true; // Allow edit
  }, [dsName, isCellLocked, emitLock, auth.user]);

  // Cell edit cancelled handler
  const handleCellEditCancelled = useCallback((cell) => {
    const _id = cell.getRow().getData()._id;
    const field = cell.getField();
    const oldVal = cell.getOldValue();

    // Emit unlock when edit is cancelled (e.g., Escape key)
    emitUnlock({ dsName, _id, field, newVal: oldVal, user: auth.user?.user });
    cellImEditingRef.current = null;
  }, [dsName, emitUnlock, auth.user]);

  // Cell edited handler
  const handleCellEdited = useCallback((cell) => {
    const _id = cell.getRow().getData()._id;
    const field = cell.getField();
    const newVal = cell.getValue();
    const oldVal = cell.getOldValue();

    // Normalize row height immediately (synchronously)
    cell.getRow().normalizeHeight();

    if (newVal === oldVal) {
      // No change, just unlock
      emitUnlock({ dsName, _id, field, newVal, user: auth.user?.user });
      cellImEditingRef.current = null;
      return;
    }

    // Dispatch edit start action
    dispatchEdit({
      type: EDIT_ACTION_TYPES.EDIT_START,
      _id,
      editTracker: { _id, field, oldVal, newVal },
    });

    // Call API to save edit
    // Match reference implementation payload shape
    const selectorObj = { _id, [field]: oldVal };
    const editObj = { [field]: newVal };
    const payload = {
      dsName,
      dsView,
      dsUser: userId,
      column: field,
      selectorObj,
      editObj,
    };
    
    // Store cell reference to check later if still valid
    const editedCell = cell;
    
    editCellMutation.mutate(
      payload,
      {
        onSuccess: (result) => {
          dispatchEdit({
            type: EDIT_ACTION_TYPES.EDIT_SUCCESS,
            _id,
            serverStatus: result,
            editTracker: { _id, field, oldVal, newVal },
          });
          
          // Emit unlock with new value
          emitUnlock({ dsName, _id, field, newVal, user: auth.user?.user });
          cellImEditingRef.current = null;

          // Show success notification
          setNotificationType('success');
          setNotificationMessage('Cell updated successfully');
          setShowNotification(true);
          
          // Note: Do NOT call cell.setValue() or other cell methods here
          // The cell is no longer in edit mode by the time this async callback runs
        },
        onError: (error) => {
          console.error('editCell API error', error);
          dispatchEdit({
            type: EDIT_ACTION_TYPES.EDIT_FAILURE,
            _id,
            editTracker: { _id, field, oldVal, newVal },
            error: error.message,
          });

          // Only try to restore value if cell is still being edited
          // Check if this is still the current cell being edited
          if (cellImEditingRef.current === editedCell) {
            // Cell is still in edit mode, safe to restore
            if (typeof editedCell.restoreOldValue === 'function') {
              editedCell.restoreOldValue();
            } else {
              editedCell.setValue(oldVal);
            }
          }
          // If cell is no longer being edited, the table state already has the old value
          // so we don't need to do anything

          // Emit unlock
          emitUnlock({ dsName, _id, field, newVal: oldVal, user: auth.user?.user });
          cellImEditingRef.current = null;

          // Show error notification
          setNotificationType('error');
          setNotificationMessage(`Edit failed: ${error.message}`);
          setShowNotification(true);
        },
      }
    );
  }, [dsName, dsView, userId, editCellMutation, emitUnlock, auth.user]);

  // Add row handler
  const handleAddRow = useCallback(() => {
    const newRow = {}; // Create empty row based on columns
    
    insertRowMutation.mutate(
      {
        dsName,
        dsView,
        dsUser: userId,
        doc: newRow,
      },
      {
        onSuccess: () => {
          setNotificationType('success');
          setNotificationMessage('Row added successfully');
          setShowNotification(true);
          // Table will refresh via query invalidation
        },
        onError: (error) => {
          setNotificationType('error');
          setNotificationMessage(`Failed to add row: ${error.message}`);
          setShowNotification(true);
        },
      }
    );
  }, [dsName, dsView, userId, insertRowMutation]);

  // Copy to clipboard handler
  const handleCopyToClipboard = useCallback(() => {
    if (tabulatorRef.current && clipboardHelpers.current) {
      clipboardHelpers.current.copyToClipboard(tabulatorRef.current);
    }
  }, []);

  // Delete row handler
  const handleDeleteRow = useCallback((_id) => {
    setModalTitle('Confirm Delete');
    setModalQuestion('Are you sure you want to delete this row?');
    setModalCallback(() => () => {
      deleteRowMutation.mutate(
        {
          dsName,
          dsView,
          dsUser: userId,
          _id,
        },
        {
          onSuccess: () => {
            setNotificationType('success');
            setNotificationMessage('Row deleted successfully');
            setShowNotification(true);
            setShowModal(false);
          },
          onError: (error) => {
            setNotificationType('error');
            setNotificationMessage(`Failed to delete row: ${error.message}`);
            setShowNotification(true);
            setShowModal(false);
          },
        }
      );
    });
    setShowModal(true);
  }, [dsName, dsView, userId, deleteRowMutation]);

  // Handlers object for tabulatorConfig (defined after all handler functions)
  const handlers = useMemo(() => ({
    cellEditCheck: cellEditCheck,
    cellForceEditTrigger: cellForceEditTrigger, // Separate function that triggers edit
    isKey: (field) => viewConfig?.keys?.includes(field) || false,
    toggleSingleFilter: () => {}, // TODO
    freezeColumn: () => {}, // TODO
    unfreezeColumn: () => {}, // TODO
    hideColumn: () => {}, // TODO
    hideColumnFromCell: () => {}, // TODO
    showAllCols: () => {}, // TODO
    copyCellToClipboard: () => {}, // TODO
    startPreso: () => {}, // Deferred
    urlGeneratorFunction: () => window.location.href,
    duplicateAndAddRowHandler: () => {}, // TODO
    addRow: handleAddRow,
    deleteAllRowsInViewQuestion: () => {}, // TODO
    deleteAllRowsInQuery: () => {}, // TODO
    deleteRowQuestion: () => {}, // TODO
    deleteColumnQuestion: () => {}, // TODO
    addColumnQuestion: () => {}, // TODO
    downloadXlsx: () => {}, // TODO
    convertToJiraRow: () => {}, // Deferred
    addJiraRow: () => {}, // Deferred
    isJiraRow: () => false, // Deferred
    showAllFilters: showAllFilters,
  }), [handleCellEditing, handleAddRow, viewConfig, showAllFilters, cellEditCheck, cellForceEditTrigger]);

  // Initialize helper modules and generate columns
  useEffect(() => {
    if (!viewConfig) return;

    // Store original columnAttrs for editor restoration when toggling editing
    if (!originalColumnAttrsRef.current && viewConfig.columnAttrs) {
      originalColumnAttrsRef.current = JSON.parse(JSON.stringify(viewConfig.columnAttrs));
    }

    const helperContext = {
      tabulatorRef,
      viewConfig,
      dsName,
      dsView,
      userId,
      handlers,
      cellImEditingRef,
      frozenCol,
      // Editor functions for Tabulator columns
      MyTextArea,
      MyCodeMirror,
      DateEditor,
      MyAutoCompleter,
      MySingleAutoCompleter,
    };

    clipboardHelpers.current = createClipboardHelpers(helperContext);
    domHelpers.current = createDomHelpers(helperContext);
    tabulatorConfigHelper.current = createTabulatorConfig(helperContext);
    jiraHelpers.current = createJiraHelpers(helperContext);
    
    // Generate columns using tabulatorConfig
    if (tabulatorConfigHelper.current) {
      const generatedColumns = tabulatorConfigHelper.current.setColumnDefinitions();
      setColumns(generatedColumns);
    }
  }, [viewConfig, dsName, dsView, userId, connectedState, dbConnectivityState]);

  // TODO: Implement remaining handlers:
  // - handleAddColumn
  // - handleDeleteColumn
  // - handleDownloadXlsx
  // - handleRefreshJira
  // - handleConvertToJira
  // - URL filtering
  // - Filter controls
  // - And all other methods from the original 2,360-line component

  if (isLoading) {
    return <div className={styles.loading}>Loading dataset view...</div>;
  }

  if (isError) {
    return <div className={styles.error}>Error loading view: {error?.message}</div>;
  }

  if (!viewConfig) {
    return <div className={styles.error}>No view configuration found</div>;
  }

  return (
    <div className={styles.container}>
      <Row>
        <Col>
          <div className={styles.header}>
            <h2 className={styles.title}>{dsName} - {dsView}</h2>
            <div className={styles.connectivityStatus}>
              <span className={styles.statusIndicator}>Socket: {connectedState ? '🟢' : '🔴'}</span>
              <span className={styles.statusIndicator}>DB: {dbConnectivityState ? '🟢' : '🔴'}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className={styles.actionBar}>
            <button className={styles.btnLink} onClick={handleCopyToClipboard}>
              Copy-to-clipboard <i className='fas fa-clipboard'></i>
            </button>
            <span className={styles.separator}>|</span>
            <button className={styles.btnLink} onClick={handleAddRow}>
              Add Row <i className='fas fa-plus'></i>
            </button>
          </div>

          {/* Settings checkboxes */}
          <div className={styles.settingsBar}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={chronologyDescending}
                onChange={(e) => {
                  setChronologyDescending(e.target.checked);
                  localStorage.setItem('chronologyDescending', JSON.stringify(e.target.checked));
                  setForceRefresh(prev => prev + 1); // Increment counter to trigger table refresh
                }}
              />
              Desc order <i className='fas fa-level-down-alt'></i>
            </label>
            <span className={styles.separator}>|</span>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showAllFilters}
                onChange={(e) => {
                  setShowAllFilters(e.target.checked);
                  localStorage.setItem('showAllFilters', JSON.stringify(e.target.checked));
                  toggleFilters();
                }}
              />
              Show filters <i className='fas fa-filter'></i>
            </label>
            <span className={styles.separator}>|</span>
            <label className={styles.checkboxLabel}>
              <input 
                type="checkbox" 
                checked={singleClickEdit} 
                onChange={handleSingleClickEditToggle}
              />
              &nbsp;1-click editing <i className='fas fa-bolt'></i>
            </label>
            <span className={styles.separator}>|</span>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={disableEditing}
                onChange={(e) => {
                  const checked = e.target.checked;
                  disableEditingRef.current = checked; // Sync ref
                  setDisableEditing(checked);
                  localStorage.setItem('disableEditing', JSON.stringify(checked));
                  toggleEditing(checked);
                }}
              />
              Disable Editing <i className='fas fa-ban'></i>
            </label>
          </div>

          {/* TODO: Add FilterControls component */}

          {/* Total records display */}
          <div className={styles.infoBar}>
            {tabulatorRef.current?.table?.getHeaderFilters()?.length > 0 ? (
              fetchAllMatchingRecords ? (
                <b><i className='fas fa-clone'></i> Total matching records: {totalRecs}</b>
              ) : (
                moreMatchingDocs ? (
                  <b><i className='fas fa-clone'></i> Top matching records: {totalRecs - 1}+</b>
                ) : (
                  <b><i className='fas fa-clone'></i> Top matching records: {totalRecs}</b>
                )
              )
            ) : (
              <b><i className='fas fa-clone'></i> Total records: {totalRecs}</b>
            )}
            
            {tabulatorRef.current?.table?.getHeaderFilters()?.length > 0 && (
              <>
                <span className={styles.separator}>|</span>
                <button className={styles.btnLink} onClick={toggleFetchAllRecords}>
                  <i className='fa fa-download'></i>
                  {fetchAllMatchingRecords ? 'Fetch top matches only' : 'Fetch all matches'}
                </button>
              </>
            )}
            
            <span className={styles.separator}>|</span>
            <button className={styles.btnLink} onClick={() => tabulatorRef.current?.table?.setData()}>
              <i className='fas fa-redo'></i> Refresh
            </button>
          </div>

          <MyTabulator
            innerref={(ref) => (tabulatorRef.current = ref)}
            columns={columns}
            data={[]}
            options={{
              height: '600px',
              layout: 'fitDataStretch',
              pagination: 'remote',
              paginationSize: pageSize,
              chronology: chronologyDescending ? 'desc' : 'asc', // Triggers shouldComponentUpdate
              cellClick: cellClickEvents,
              cellDblClick: cellClickEvents,
              forceRefresh: forceRefresh, // Triggers shouldComponentUpdate
              ajaxURL: `${API_URL}/ds/view/${dsName}/${dsView}/${userId}`,
              ajaxURLGenerator: ajaxURLGenerator,
              ajaxResponse: ajaxResponse,
              ajaxConfig: {
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include'
              },
              paginationDataSent: {
                page: 'page',
                size: 'per_page'
              },
              paginationDataReceived: {
                last_page: 'total_pages'
              },
              ajaxError: (error) => {
                console.error('ajaxError', error);
              },
              ajaxSorting: true,
              ajaxFiltering: true,
              // TODO: Add more options from original
            }}
            cellEditing={handleCellEditing}
            cellEdited={handleCellEdited}
            cellEditCancelled={handleCellEditCancelled}
          />

          {/* Notification */}
          <Notification
            show={showNotification}
            type={notificationType}
            message={notificationMessage}
            onClose={() => setShowNotification(false)}
            autoHideDuration={3000}
          />

          {/* Confirmation Modal */}
          {showModal && (
            <Modal
              title={modalTitle}
              message={modalQuestion}
              onConfirm={() => {
                if (modalCallback) modalCallback();
              }}
              onCancel={() => setShowModal(false)}
            />
          )}

          {/* TODO: Add ModalEditor */}
          {/* TODO: Add JiraForm */}
          {/* TODO: Add ColorPicker */}
        </Col>
      </Row>
    </div>
  );
}

export default DsViewPage;
