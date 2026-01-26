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

  // Helper modules
  const clipboardHelpers = useRef(null);
  const domHelpers = useRef(null);
  const tabulatorConfigHelper = useRef(null);
  const jiraHelpers = useRef(null);
  const [columns, setColumns] = useState([]);

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

  // Cell edited handler
  const handleCellEdited = useCallback((cell) => {
    const _id = cell.getRow().getData()._id;
    const field = cell.getField();
    const newVal = cell.getValue();
    const oldVal = cell.getOldValue();

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
    editCellMutation.mutate(
      {
        dsName,
        dsView,
        dsUser: userId,
        _id,
        field,
        newVal,
        oldVal,
      },
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
        },
        onError: (error) => {
          dispatchEdit({
            type: EDIT_ACTION_TYPES.EDIT_FAILURE,
            _id,
            editTracker: { _id, field, oldVal, newVal },
            error: error.message,
          });

          // Revert cell value
          cell.setValue(oldVal);
          
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
    cellEditCheck: handleCellEditing,
    cellForceEditTrigger: () => false, // TODO
    isKey: (field) => viewConfig?.keys?.includes(field) || false,
    toggleSingleFilter: () => {}, // TODO
    freezeColumn: () => {}, // TODO
    unfreezeColumn: () => {}, // TODO
    hideColumn: () => {}, // TODO
    hideColumnFromCell: () => {}, // TODO
    showAllCols: () => {}, // TODO
    copyCellToClipboard: () => {}, // TODO
    startPreso: () => {}, // Deferred
    urlGeneratorFunction: () => {}, // TODO
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
  }), [handleCellEditing, handleAddRow, viewConfig, showAllFilters]);

  // Initialize helper modules and generate columns
  useEffect(() => {
    if (!viewConfig) return;

    const helperContext = {
      tabulatorRef,
      viewConfig,
      dsName,
      dsView,
      userId,
      handlers,
      cellImEditingRef,
      frozenCol,
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
  }, [viewConfig, dsName, dsView, userId]);

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
    return <div className="loading">Loading dataset view...</div>;
  }

  if (isError) {
    return <div className="error">Error loading view: {error?.message}</div>;
  }

  if (!viewConfig) {
    return <div className="error">No view configuration found</div>;
  }

  return (
    <div className="ds-view-page">
      <Row>
        <Col>
          <h2>{dsName} - {dsView}</h2>
          <div className="connectivity-status">
            Socket: {connectedState ? '🟢' : '🔴'} | 
            DB: {dbConnectivityState ? '🟢' : '🔴'}
          </div>

          {/* TODO: Add FilterControls component */}
          {/* TODO: Add toolbar with buttons */}

          <MyTabulator
            innerref={(ref) => (tabulatorRef.current = ref)}
            columns={columns.length > 0 ? columns : viewConfig.columnAttrs || []}
            data={[]}
            options={{
              height: '600px',
              layout: 'fitDataStretch',
              pagination: 'remote',
              paginationSize: pageSize,
              ajaxURL: `${API_URL}/ds/view/${dsName}/${dsView}/${userId}`,
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
              ajaxResponse: (url, params, response) => {
                console.log('ajaxResponse', url, params, response);
                return response;
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
