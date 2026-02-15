import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, Form } from 'react-bootstrap';

/**
 * PerRowAccessCtrl - Component for managing per-row access control configuration
 * Reference: reference/common/routes/home/DsViewEditPerRowAccessCtrl.js
 * 
 * Features:
 * - Enable/disable per-row access control
 * - Specify which column contains user access information
 */
function PerRowAccessCtrl({ config, onChange }) {
  const debounceTimersRef = useRef({});

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimersRef.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  const handleDebounce = (key, callback, delay = 1000) => {
    if (debounceTimersRef.current[key]) {
      clearTimeout(debounceTimersRef.current[key]);
    }
    debounceTimersRef.current[key] = setTimeout(() => {
      delete debounceTimersRef.current[key];
      callback();
    }, delay);
  };

  const currentConfig = config || {};

  return (
    <>
      <Row>
        <Col md={3} sm={3} xs={3}>
          <Form.Check 
            inline 
            type="checkbox" 
            label="&nbsp;Per-row access-control" 
            checked={currentConfig.enabled} 
            onChange={(event) => {
              onChange({ ...currentConfig, enabled: event.target.checked });
            }} 
          />
        </Col>
        {currentConfig.enabled && (
          <Col md={9} sm={9} xs={9}>
            <Form.Control 
              type="text" 
              defaultValue={currentConfig.column} 
              placeholder="Column name to use for access control" 
              onChange={(event) => {
                const value = event.target.value;
                handleDebounce("__column", () => {
                  if (!value) return;
                  onChange({ ...currentConfig, column: value });
                });
              }} 
            />
          </Col>
        )}
      </Row>
    </>
  );
}

PerRowAccessCtrl.propTypes = {
  onChange: PropTypes.func.isRequired,
  config: PropTypes.object
};

export default PerRowAccessCtrl;
