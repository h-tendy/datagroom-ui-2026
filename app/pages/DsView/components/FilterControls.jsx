/**
 * FilterControls Component
 * 
 * UI for managing saved filters including:
 * - Dropdown to select/clear filters
 * - Save/Save-As-New/Delete operations
 * - Form inputs for filter name and description
 * 
 * Reference: FilterControls.js (complete implementation)
 */

import React, { useState, useEffect } from 'react';
import { Row, Col } from 'react-bootstrap';
import Select from 'react-select';
import { useAddFilter, useEditFilter, useDeleteFilter } from '../../../hooks/useDsFilters';
import { collectCurrentFilterState } from '../helpers/filterHelpers';

function FilterControls({ show, dsName, dsView, tableRef, onFilterChange, defaultValue, viewConfig }) {
  // Internal state for save/save-as-new/delete UI modes
  const [save, setSave] = useState(false);
  const [saveName, setSaveName] = useState(null);
  const [saveDescription, setSaveDescription] = useState(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  
  const [saveAsNew, setSaveAsNew] = useState(false);
  const [saveAsNewName, setSaveAsNewName] = useState('');
  const [saveAsNewDescription, setSaveAsNewDescription] = useState('');
  const [saveAsNewErrorMsg, setSaveAsNewErrorMsg] = useState('');
  
  const [deleteFilter, setDeleteFilter] = useState(false);
  const [deleteFilterErrorMsg, setDeleteFilterErrorMsg] = useState('');
  
  // Mutation hooks
  const addFilterMutation = useAddFilter(dsName, dsView, viewConfig?.dsUser);
  const editFilterMutation = useEditFilter(dsName, dsView, viewConfig?.dsUser);
  const deleteFilterMutation = useDeleteFilter(dsName, dsView, viewConfig?.dsUser);
  
  // When the panel is hidden, clear filter selection via effect
  // (avoid performing side-effects during render)
  useEffect(() => {
    if (!show && onFilterChange) {
      onFilterChange(null);
    }
  }, [show, onFilterChange]);

  if (!show) return null;
  
  // Build filter options from viewConfig
  const filters = viewConfig?.filters || {};
  const filterOptions = [];
  
  Object.keys(filters).forEach((key) => {
    if (key === '_id') return;
    filterOptions.push({ value: key, label: key });
  });
  
  // Find current selected filter
  const defaultValueIdx = filterOptions.findIndex(opt => opt.value === defaultValue);
  const selectedOption = defaultValueIdx >= 0 ? filterOptions[defaultValueIdx] : null;
  
  // Get description of selected filter
  const filterDescription = defaultValue && filters[defaultValue] ? filters[defaultValue].description : '';
  
  // Handler for filter dropdown change
  const handleFilterChange = (value) => {
    setSaveName(null);
    setSaveDescription(null);
    
    if (value) {
      onFilterChange(value.value);
    } else {
      setSaveAsNew(false);
      setSave(false);
      setDeleteFilter(false);
      onFilterChange(null);
    }
  };
  
  // Save existing filter
  const handleSave = () => {
    if (!defaultValue) return;
    
    const { hdrFilters, hdrSorters, filterColumnAttrs } = collectCurrentFilterState(tableRef);
    const description = saveDescription !== null ? saveDescription : (filters[defaultValue]?.description || '');
    
    editFilterMutation.mutate(
      {
        name: defaultValue,
        description,
        hdrFilters,
        hdrSorters,
        filterColumnAttrs,
      },
      {
        onSuccess: () => {
          setSaveErrorMsg('');
          setSave(false);
        },
        onError: (error) => {
          setSaveErrorMsg(`Save failed: ${error.message}`);
        },
      }
    );
  };
  
  // Save as new filter
  const handleSaveAsNew = () => {
    // Validate name
    if (!saveAsNewName) {
      setSaveAsNewErrorMsg('Filter name is required');
      return;
    }
    
    // Validate name format (alphanumeric, underscore, hyphen)
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(saveAsNewName)) {
      setSaveAsNewErrorMsg('Filter name can only contain letters, numbers, underscores, and hyphens');
      return;
    }
    
    // Check if name already exists
    if (filters[saveAsNewName]) {
      setSaveAsNewErrorMsg('Filter name already exists');
      return;
    }
    
    const { hdrFilters, hdrSorters, filterColumnAttrs } = collectCurrentFilterState(tableRef);
    
    addFilterMutation.mutate(
      {
        name: saveAsNewName,
        description: saveAsNewDescription,
        hdrFilters,
        hdrSorters,
        filterColumnAttrs,
      },
      {
        onSuccess: () => {
          setSaveAsNewErrorMsg('');
          setSaveAsNew(false);
          setSaveAsNewName('');
          setSaveAsNewDescription('');
          // Switch to the newly created filter
          onFilterChange(saveAsNewName);
        },
        onError: (error) => {
          setSaveAsNewErrorMsg(`Save failed: ${error.message}`);
        },
      }
    );
  };
  
  // Delete filter
  const handleDelete = () => {
    if (!defaultValue) return;
    
    deleteFilterMutation.mutate(
      defaultValue,
      {
        onSuccess: () => {
          setDeleteFilterErrorMsg('');
          setDeleteFilter(false);
          // Clear filter selection
          onFilterChange(null);
        },
        onError: (error) => {
          setDeleteFilterErrorMsg(`Delete failed: ${error.message}`);
        },
      }
    );
  };
  
  // Render helper: Delete filter confirmation panel
  const deleteFilterControls = () => {
    if (!deleteFilter || !defaultValue) return null;
    
    return (
      <Row style={{ marginTop: '15px', padding: '10px', backgroundColor: 'var(--color-bg, #fff)', border: '1px solid #ddd', borderRadius: '4px' }}>
        <Col md={12} sm={12} xs={12}>
          <div style={{ marginBottom: '10px' }}>
            <b>Are you sure you want to delete filter "{defaultValue}"?</b>
          </div>
          {deleteFilterErrorMsg && (
            <div style={{ color: 'red', marginBottom: '10px' }}>{deleteFilterErrorMsg}</div>
          )}
          <button 
            onClick={handleDelete} 
            disabled={deleteFilterMutation.isPending}
            style={{ backgroundColor: '#d9534f', color: 'white', border: 'none', padding: '5px 15px' }}
          >
            {deleteFilterMutation.isPending ? 'Deleting...' : 'Confirm delete'}
          </button>
          <button onClick={() => setDeleteFilter(false)} style={{ marginLeft: '10px' }}>
            Cancel
          </button>
        </Col>
      </Row>
    );
  };

  // Render helper: Save existing filter panel
  const saveControls = () => {
    if (!save || !defaultValue) return null;
    
    // Initialize description from viewConfig when opening save panel
    if (saveName !== defaultValue) {
      setSaveName(defaultValue);
      setSaveDescription(filters[defaultValue]?.description || '');
    }
    
    return (
      <Row style={{ marginTop: '15px', padding: '10px', backgroundColor: 'var(--color-bg, #fff)', border: '1px solid #ddd', borderRadius: '4px' }}>
        <Col md={12} sm={12} xs={12}>
          <div style={{ marginBottom: '10px' }}>
            <label><b>Filter Name:</b> {defaultValue}</label>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label><b>Description:</b></label>
            <textarea
              value={saveDescription !== null ? saveDescription : (filters[defaultValue]?.description || '')}
              onChange={(e) => setSaveDescription(e.target.value)}
              style={{ width: '100%', padding: '5px', minHeight: '60px' }}
              placeholder="Enter filter description..."
            />
          </div>
          {saveErrorMsg && (
            <div style={{ color: 'red', marginBottom: '10px' }}>{saveErrorMsg}</div>
          )}
          <button onClick={handleSave} disabled={editFilterMutation.isPending}>
            {editFilterMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => setSave(false)} style={{ marginLeft: '10px' }}>
            Cancel
          </button>
        </Col>
      </Row>
    );
  };

  // Render helper: Save as new filter panel
  const saveAsNewControls = () => {
    if (!saveAsNew) return null;
    
    return (
      <Row style={{ marginTop: '15px', padding: '10px', backgroundColor: 'var(--color-bg, #fff)', border: '1px solid #ddd', borderRadius: '4px' }}>
        <Col md={12} sm={12} xs={12}>
          <div style={{ marginBottom: '10px' }}>
            <label><b>New Filter Name:</b></label>
            <input
              type="text"
              value={saveAsNewName}
              onChange={(e) => {
                const value = e.target.value;
                // Validate input: start with letter, then allow letters, numbers, underscore, hyphen
                if (!value || (value.match(/^[a-zA-Z][a-zA-Z0-9_-]*$/g) && value.length <= 64)) {
                  setSaveAsNewName(value);
                }
              }}
              style={{ width: '100%', padding: '5px' }}
              placeholder="Enter filter name..."
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label><b>Description:</b></label>
            <textarea
              value={saveAsNewDescription}
              onChange={(e) => setSaveAsNewDescription(e.target.value)}
              style={{ width: '100%', padding: '5px', minHeight: '60px' }}
              placeholder="Enter filter description..."
            />
          </div>
          {saveAsNewErrorMsg && (
            <div style={{ color: 'red', marginBottom: '10px' }}>{saveAsNewErrorMsg}</div>
          )}
          <button onClick={handleSaveAsNew} disabled={addFilterMutation.isPending}>
            {addFilterMutation.isPending ? 'Creating...' : 'Create'}
          </button>
          <button onClick={() => setSaveAsNew(false)} style={{ marginLeft: '10px' }}>
            Cancel
          </button>
        </Col>
      </Row>
    );
  };
  
  return (
    <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: 'var(--color-bg-secondary, #f8f9fa)', borderRadius: '4px' }}>
      <br/>
      <Row style={{ marginBottom: '10px' }}>
        <Col md={1} sm={1} xs={1}>
          <b>Filters:</b>
        </Col>
        <Col md={8} sm={8} xs={8}>
          <Select
            key={`filter-select-${selectedOption?.value || 'none'}`}
            className="basic-single"
            classNamePrefix="select"
            isClearable={true}
            value={selectedOption}
            options={filterOptions}
            onChange={handleFilterChange}
            placeholder="Select a filter..."
          />
        </Col>
      </Row>
      
      {filterDescription && (
        <>
          <br/>
          <Row style={{ marginBottom: '10px' }}>
            <Col md={1} sm={1} xs={1}>
              <b>Filter Desc:</b>
            </Col>
            <Col md={8} sm={8} xs={8}>
              {filterDescription}
            </Col>
          </Row>
        </>
      )}
      
      {filterDescription && <br/>}
      
      <Row style={{ marginBottom: '10px' }}>
        <Col md={12} sm={12} xs={12}>
          <button 
            className="btn btn-link"
            onClick={() => {
              setSaveAsNew(!saveAsNew);
              setSave(false);
              setDeleteFilter(false);
              setSaveAsNewErrorMsg('');
            }}
          >
            <i className='fas fa-filter'></i> Save-as-new-filter
          </button>
          <span> | </span>
          <button 
            className="btn btn-link"
            onClick={() => {
              setSave(!save);
              setSaveAsNew(false);
              setDeleteFilter(false);
              setSaveErrorMsg('');
            }}
            disabled={!defaultValue}
          >
            <i className='fas fa-save'></i> Save
          </button>
          <span> | </span>
          <button 
            className="btn btn-link"
            onClick={() => {
              setDeleteFilter(!deleteFilter);
              setSave(false);
              setSaveAsNew(false);
              setDeleteFilterErrorMsg('');
            }}
            disabled={!defaultValue}
          >
            <i className='fas fa-trash-alt'></i> Delete-filter
          </button>
        </Col>
      </Row>
      
      {saveAsNewControls()}
      {saveControls()}
      {deleteFilterControls()}
    </div>
  );
}

export default FilterControls;
