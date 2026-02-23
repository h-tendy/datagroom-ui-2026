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
  
  // When the panel is hidden, reset only the *local UI* state.
  // IMPORTANT: Do not call onFilterChange(null) here.
  // Hiding "Show filters" should not mutate the current URL/view.
  useEffect(() => {
    if (show) return;
    setSave(false);
    setSaveName(null);
    setSaveDescription(null);
    setSaveErrorMsg('');
    setSaveAsNew(false);
    setSaveAsNewName('');
    setSaveAsNewDescription('');
    setSaveAsNewErrorMsg('');
    setDeleteFilter(false);
    setDeleteFilterErrorMsg('');
  }, [show]);

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
  
  // Custom styles for react-select to match theme
  const customSelectStyles = {
    control: (provided, state) => ({
      ...provided,
      backgroundColor: 'var(--color-bg)',
      borderColor: 'var(--color-border)',
      color: 'var(--color-text)',
      '&:hover': {
        borderColor: 'var(--color-primary)',
      },
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: 'var(--color-bg)',
      border: '1px solid var(--color-border)',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected 
        ? 'var(--color-primary)' 
        : state.isFocused 
          ? 'var(--color-bg-light)' 
          : 'var(--color-bg)',
      color: state.isSelected ? 'white' : 'var(--color-text)',
      '&:hover': {
        backgroundColor: 'var(--color-bg-light)',
      },
    }),
    singleValue: (provided) => ({
      ...provided,
      color: 'var(--color-text)',
    }),
    input: (provided) => ({
      ...provided,
      color: 'var(--color-text)',
    }),
    placeholder: (provided) => ({
      ...provided,
      color: 'var(--color-text-muted)',
    }),
  };
  
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
      <Row style={{ marginTop: '15px', padding: '10px', backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
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
            style={{ backgroundColor: '#d9534f', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer' }}
          >
            {deleteFilterMutation.isPending ? 'Deleting...' : 'Confirm delete'}
          </button>
          <button onClick={() => setDeleteFilter(false)} style={{ marginLeft: '10px', padding: '5px 15px', borderRadius: '4px', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', cursor: 'pointer' }}>
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
      <Row style={{ marginTop: '15px', padding: '10px', backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
        <Col md={12} sm={12} xs={12}>
          <div style={{ marginBottom: '10px' }}>
            <label><b>Filter Name:</b> {defaultValue}</label>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label><b>Description:</b></label>
            <textarea
              value={saveDescription !== null ? saveDescription : (filters[defaultValue]?.description || '')}
              onChange={(e) => setSaveDescription(e.target.value)}
              style={{ width: '100%', padding: '5px', minHeight: '60px', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
              placeholder="Enter filter description..."
            />
          </div>
          {saveErrorMsg && (
            <div style={{ color: 'red', marginBottom: '10px' }}>{saveErrorMsg}</div>
          )}
          <button onClick={handleSave} disabled={editFilterMutation.isPending} style={{ padding: '5px 15px', borderRadius: '4px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
            {editFilterMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => setSave(false)} style={{ marginLeft: '10px', padding: '5px 15px', borderRadius: '4px', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', cursor: 'pointer' }}>
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
      <Row style={{ marginTop: '15px', padding: '10px', backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
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
              style={{ width: '100%', padding: '5px', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
              placeholder="Enter filter name..."
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label><b>Description:</b></label>
            <textarea
              value={saveAsNewDescription}
              onChange={(e) => setSaveAsNewDescription(e.target.value)}
              style={{ width: '100%', padding: '5px', minHeight: '60px', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
              placeholder="Enter filter description..."
            />
          </div>
          {saveAsNewErrorMsg && (
            <div style={{ color: 'red', marginBottom: '10px' }}>{saveAsNewErrorMsg}</div>
          )}
          <button onClick={handleSaveAsNew} disabled={addFilterMutation.isPending} style={{ padding: '5px 15px', borderRadius: '4px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
            {addFilterMutation.isPending ? 'Creating...' : 'Create'}
          </button>
          <button onClick={() => setSaveAsNew(false)} style={{ marginLeft: '10px', padding: '5px 15px', borderRadius: '4px', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', cursor: 'pointer' }}>
            Cancel
          </button>
        </Col>
      </Row>
    );
  };
  
  return (
    <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: 'var(--color-bg)' }}>
      <br/>
      <Row style={{ marginBottom: '10px' }}>
        <Col md={1} sm={1} xs={1}>
          <b style={{ fontSize: 'var(--info-main-size, 1.45rem)', fontWeight: 700, color: 'var(--color-text)' }}>Filters:</b>
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
            styles={customSelectStyles}
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
          {(() => {
            const controlStyle = { fontSize: 'var(--info-main-size, 1.45rem)', color: 'var(--color-text)', cursor: 'pointer', fontWeight: 700, lineHeight: '1', padding: '0 6px', display: 'inline-flex', alignItems: 'center' };
            const iconStyle = { fontSize: 'var(--info-main-size, 1.45rem)', marginRight: '6px', verticalAlign: 'middle' };
            const textStyle = { fontSize: 'var(--info-main-size, 1.45rem)', fontWeight: 700 };
            return (
              <>
                <button
                  className="btn btn-link"
                  style={controlStyle}
                  onClick={() => {
                    setSaveAsNew(!saveAsNew);
                    setSave(false);
                    setDeleteFilter(false);
                    setSaveAsNewErrorMsg('');
                  }}
                >
                  <i className='fas fa-filter' style={iconStyle}></i>
                  <span style={textStyle}>Save-as-new-filter</span>
                </button>
                <span style={{ padding: '0 6px' }}> | </span>
                <button
                  className="btn btn-link"
                  style={controlStyle}
                  onClick={() => {
                    setSave(!save);
                    setSaveAsNew(false);
                    setDeleteFilter(false);
                    setSaveErrorMsg('');
                  }}
                  disabled={!defaultValue}
                >
                  <i className='fas fa-save' style={iconStyle}></i>
                  <span style={textStyle}>Save</span>
                </button>
                <span style={{ padding: '0 6px' }}> | </span>
                <button
                  className="btn btn-link"
                  style={controlStyle}
                  onClick={() => {
                    setDeleteFilter(!deleteFilter);
                    setSave(false);
                    setSaveAsNew(false);
                    setDeleteFilterErrorMsg('');
                  }}
                  disabled={!defaultValue}
                >
                  <i className='fas fa-trash-alt' style={iconStyle}></i>
                  <span style={textStyle}>Delete-filter</span>
                </button>
              </>
            );
          })()}
        </Col>
      </Row>
      
      {saveAsNewControls()}
      {saveControls()}
      {deleteFilterControls()}
    </div>
  );
}

export default FilterControls;
