import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Row, Col, Form } from 'react-bootstrap';
import { useMutation } from '@tanstack/react-query';
import MarkdownIt from 'markdown-it';
import mditBracketedSpans from 'markdown-it-bracketed-spans';
import mditAttrs from 'markdown-it-attrs';
import mditContainer from 'markdown-it-container';
import mditHighlightjs from 'markdown-it-highlightjs';

import { useAuth } from '../../auth/AuthProvider';
import SidebarLayout from '../../SidebarLayout';
import MyTabulator from '../../components/MyTabulator';
import Modal from '../DsView/components/Modal';
import { uploadAttachment, deleteOneAttachment } from '../../api/uploads';

// Import existing styles from DsView
import '../DsView/DsViewSimple.css';
import '../DsView/simpleStyles.css';

// Initialize markdown-it with plugins (matching reference DsAttachments.js lines 12-34)
const md = new MarkdownIt({
  linkify: true,
  html: true
})
  .use(mditBracketedSpans)
  .use(mditAttrs)
  .use(mditContainer, 'code')
  .use(mditHighlightjs);

// Custom link renderer - open in new tab
const defaultLinkOpen = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
};
md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
  const aIndex = tokens[idx].attrIndex('target');
  if (aIndex < 0) {
    tokens[idx].attrPush(['target', '_blank']);
  } else {
    tokens[idx].attrs[aIndex][1] = '_blank';
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

const API_URL = import.meta.env.VITE_API_BASE || '/api';

function DsAttachmentsForm() {
  const { dsName } = useParams();
  const auth = useAuth();
  const userId = auth.userId;
  
  // Get dsView from params (will be undefined since route doesn't include it - for backward compatibility)
  const dsView = useParams().dsView;
  
  const [pageSize] = useState(30);
  const [totalRecs, setTotalRecs] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [initialHeaderFilter, setInitialHeaderFilter] = useState([]);
  const [initialSort, setInitialSort] = useState([{column: "time", dir: "desc"}]);
  const [showAllFilters, setShowAllFilters] = useState(() => {
    // Initialize from localStorage
    try {
      const saved = localStorage.getItem("showAllFilters");
      return saved ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
    }
  });
  const [columns, setColumns] = useState([]);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalQuestion, setModalQuestion] = useState('');
  const [modalCallback, setModalCallback] = useState(null);
  
  const tabulatorRef = useRef(null);
  const fileInputFormRef = useRef(null);
  
  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: uploadAttachment,
    onSuccess: () => {
      // Preserve filters and sorters before refresh
      if (tabulatorRef.current?.table) {
        const currentFilters = tabulatorRef.current.table.getHeaderFilters();
        setInitialHeaderFilter(currentFilters);
        
        const sorters = tabulatorRef.current.table.getSorters();
        const sortersArray = sorters.map(s => ({
          column: s.field,
          dir: s.dir
        }));
        setInitialSort(sortersArray);
      }
      
      // Force table refresh
      setRefresh(prev => prev + 1);
    },
    onError: (error) => {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + error.message);
    }
  });
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteOneAttachment,
    onSuccess: () => {
      setTotalRecs(prev => prev - 1);
    },
    onError: (error) => {
      console.error('Delete failed:', error);
      alert('Delete failed: ' + error.message);
    }
  });
  
  // File select handler - Reference: DsAttachments.js lines 102-138
  const onFileSelect = useCallback(async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Process all selected files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) {
        // Replace spaces with underscores in filename
        const remoteFileName = file.name.replaceAll(" ", "_");
        const formData = new FormData();
        formData.append("file", file, remoteFileName);
        formData.append("dsName", dsName);
        
        await uploadMutation.mutateAsync(formData);
      }
    }
  }, [dsName, uploadMutation]);
  
  // Delete row handler - Reference: DsAttachments.js lines 183-193
  const deleteRowHandler = useCallback((e, cell, confirmed) => {
    if (confirmed) {
      const rowData = cell.getRow().getData();
      const _id = rowData['_id'];
      
      if (!_id) {
        // No _id, just delete from UI
        cell.getRow().delete();
        return;
      }
      
      // Delete from server
      deleteMutation.mutate(
        { dsName, dsView, user: userId, _id },
        {
          onSuccess: () => {
            cell.getRow().delete();
          }
        }
      );
    }
    setShowModal(false);
  }, [dsName, dsView, userId, deleteMutation]);
  
  // Delete row question - Reference: DsAttachments.js lines 195-203
  const deleteRowQuestion = useCallback((e, cell) => {
    setModalTitle("Delete current row?");
    setModalQuestion("This will delete the current row. Please confirm. Undoing support is not yet available!");
    setModalCallback(() => (confirmed) => deleteRowHandler(e, cell, confirmed));
    setShowModal(true);
  }, [deleteRowHandler]);
  
  // Toggle single filter - Reference: DsAttachments.js lines 205-231
  const toggleSingleFilter = useCallback((e, column) => {
    if (!tabulatorRef.current?.table) return;
    
    const currentDefs = tabulatorRef.current.table.getColumnDefinitions();
    for (let j = 0; j < currentDefs.length; j++) {
      if (currentDefs[j].field === column.getField()) {
        const newVal = currentDefs[j].headerFilter ? false : 'input';
        tabulatorRef.current.table.updateColumnDefinition(currentDefs[j].field, {headerFilter: newVal});
        break;
      }
    }
  }, []);
  
  // Toggle all filters - Reference: DsAttachments.js lines 151-178
  const toggleFilters = useCallback(() => {
    if (!tabulatorRef.current?.table) return;
    
    const currentDefs = tabulatorRef.current.table.getColumnDefinitions();
    
    // Determine newVal based on first column's current state
    let newVal = currentDefs[0]?.headerFilter ? false : 'input';
    
    // Modify all column definitions
    for (let j = 0; j < currentDefs.length; j++) {
      currentDefs[j].headerFilter = newVal;
    }
    
    // Apply changes using setColumns (not updateColumnDefinition)
    tabulatorRef.current.table.setColumns(currentDefs);
  }, []);
  
  // AJAX response handler - Reference: DsAttachments.js lines 319-322
  const ajaxResponse = useCallback((url, params, response) => {
    console.log('ajaxResponse:', response);
    setTotalRecs(response.total || 0);
    return response;
  }, []);
  
  // Render complete handler - Reference: DsAttachments.js lines 89-93
  const renderComplete = useCallback(() => {
    setTimeout(() => {
      if (window.highlightJsBadge) {
        window.highlightJsBadge();
      }
    }, 1000);
  }, []);
  
  // Cell edit check - always return false (no editing) - Reference: DsAttachments.js lines 95-97
  const cellEditCheck = useCallback((cell) => {
    return false;
  }, []);
  
  // Set column definitions - Reference: DsAttachments.js lines 233-317
  const setColumnDefinitions = useCallback(() => {
    const headerMenu = [
      {
        label: "Toggle Filters",
        action: toggleSingleFilter
      }
    ];
    
    const cellContextMenu = [
      {
        label: "Delete row...",
        action: deleteRowQuestion
      }
    ];
    
    const columnAttrs = [
      {field: '_id', title: 'file', width: 800, formatter: "textarea", headerTooltip: true, hozAlign: 'left', vertAlign: 'top'}, 
      {field: 'size', title: 'size', width: 100, formatter: "textarea", headerTooltip: true, hozAlign: 'center', vertAlign: 'middle'}, 
      {field: 'time', title: 'time', width: 160, formatter: "textarea", headerTooltip: true, hozAlign: 'center', vertAlign: 'middle'}, 
    ];
    
    const cols = [];
    for (let i = 0; i < columnAttrs.length; i++) {
      const col = JSON.parse(JSON.stringify(columnAttrs[i]));
      col.headerMenu = headerMenu;
      col.contextMenu = cellContextMenu;
      col.editable = cellEditCheck;
      
      // Set headerFilter based on showAllFilters or initialHeaderFilter
      if (showAllFilters || initialHeaderFilter.length) {
        col.headerFilter = "input";
      }
      
      // Custom formatter for _id (file path) - Reference: DsAttachments.js lines 290-308
      if (col.field === '_id') {
        col.formatter = (cell, formatterParams) => {
          let value = cell.getValue();
          if (value === undefined) return "";
          if (typeof value !== "string") return value;
          
          value = '/' + value;
          const origValue = value;
          value = `Click to view: [${value}](${value})`;
          value += `\n\nTo use this image, copy the text below and paste into your cell!:\n`;
          
          if (/(\.png$)|(\.jpg$)|(\.gif$)|(\.jpeg$)/i.test(origValue)) {
            value += "\n\n``` md\n\n" + `<img src="${origValue}" alt="${origValue}" width="100%" height="100%" />` + `\n` + "```\n"; 
          } else {
            value += "\n\n``` md\n\n" + `[Modify link text](${origValue})` + `\n` + "```\n"; 
          }
          
          value = md.render(value);
          return `<div style="white-space:normal;word-wrap:break-word;margin-bottom:-12px;">${value}</div>`;
        };
      }
      
      cols.push(col);
    }
    
    return cols;
  }, [showAllFilters, initialHeaderFilter, toggleSingleFilter, deleteRowQuestion, cellEditCheck]);
  
  // Initialize columns on mount
  useEffect(() => {
    const generatedColumns = setColumnDefinitions();
    setColumns(generatedColumns);
  }, []); // Only run once on mount
  
  // Update table columns when showAllFilters changes (but not on initial mount)
  useEffect(() => {
    if (!tabulatorRef.current?.table || columns.length === 0) return;
    
    const generatedColumns = setColumnDefinitions();
    tabulatorRef.current.table.setColumns(generatedColumns);
  }, [showAllFilters]); // Only when showAllFilters changes
  
  return (
    <div>
      <Row>
        <Col md={12} sm={12} xs={12}> 
          <h3 style={{ float: 'center' }}>
            <label className="underline">Attachments in: {dsName}</label>
          </h3>
        </Col>
      </Row>
      <br/>
      
      <Row>
        <Col md={2} sm={2} xs={2}> 
          <b>Select files to upload: </b>
        </Col>
        <Col md={4} sm={4} xs={4}> 
          <Form ref={fileInputFormRef} onClick={() => fileInputFormRef.current?.reset()}>
            <Form.Control 
              type="file" 
              name="file" 
              id="fileInput" 
              multiple 
              onChange={onFileSelect} 
            /> 
          </Form>
        </Col>
      </Row>
      <br/>
      
      <Row>
        <Col md={12} sm={12} xs={12}> 
          <Form>
            <Form.Check 
              inline 
              type="checkbox" 
              label="Show all filters" 
              checked={showAllFilters} 
              onChange={(event) => {
                const checked = event.target.checked;
                setShowAllFilters(checked);
                localStorage.setItem("showAllFilters", JSON.stringify(checked));
              }}
            />
          </Form>
        </Col>
      </Row>
      
      <Row>
        <Col md={4} sm={4} xs={4}> 
          <b>Total records: {totalRecs}</b>
        </Col>
      </Row>
      
      <Row>
        <div>
          <MyTabulator
            columns={columns}
            data={[]}
            options={{
              ajaxURL: `${API_URL}/ds/view/attachments/${dsName}/${dsView}/${userId}`,
              ajaxConfig: {
                headers: {
                  'x-access-token': localStorage.getItem('accessToken') || '',
                  'x-session-token': localStorage.getItem('sessionToken') || '',
                  "Content-Type": "application/json",
                },
                credentials: 'include'
              },
              pagination: "remote",
              paginationDataSent: {
                page: 'page',
                size: 'per_page'
              },
              paginationDataReceived: {
                last_page: 'total_pages'
              },
              current_page: 1,
              initialHeaderFilter: initialHeaderFilter,
              initialSort: JSON.parse(JSON.stringify(initialSort)),
              paginationSize: pageSize,
              paginationSizeSelector: [10, 25, 50, 100, 500, true],
              ajaxResponse: ajaxResponse,
              ajaxError: function (error) {
                console.log('ajaxError', error);
              },
              forceRefresh: refresh,
              index: "_id",
              ajaxSorting: true,
              ajaxFiltering: true,
              clipboard: true,
              renderComplete: renderComplete
            }}
            innerref={(ref) => (tabulatorRef.current = ref)}
          />
        </div>
      </Row>
      
      {showModal && (
        <Modal 
          show={true}
          title={modalTitle}
          ok="OK"
          cancel="Cancel"
          onClose={(confirmed) => {
            if (confirmed && modalCallback) {
              modalCallback(confirmed);
            } else {
              setShowModal(false);
            }
          }}
        >
          {modalQuestion}
        </Modal>
      )}
    </div>
  );
}

export default function DsAttachmentsPage() {
  return (
    <SidebarLayout>
      <DsAttachmentsForm />
    </SidebarLayout>
  );
}
