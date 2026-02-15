import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, Form } from 'react-bootstrap';
import { useAuth } from '../../../auth/AuthProvider';

/**
 * AccessCtrl - Component for managing access control lists (ACL) for dataset views
 * Reference: reference/common/routes/home/DsViewEditAccessCtrl.js
 * 
 * Features:
 * - Enable/disable access control for a view
 * - Configure list of users who can access the view
 * - Automatically includes current user in ACL
 */
function AccessCtrl({ dsName, dsView, viewData, onChange }) {
  const auth = useAuth();
  const userId = auth.userId;
  
  const [accessCtrl, setAccessCtrl] = useState(false);
  const [acl, setAcl] = useState("");
  const [initialized, setInitialized] = useState(false);
  
  const debounceTimersRef = useRef({});

  // Initialize from viewData - only once
  useEffect(() => {
    if (!initialized && viewData?.aclConfig) {
      let aclStr = "";
      if (typeof viewData.aclConfig.acl === "string") {
        aclStr = viewData.aclConfig.acl;
      } else if (Array.isArray(viewData.aclConfig.acl)) {
        aclStr = viewData.aclConfig.acl.join(", ");
      }
      setAccessCtrl(viewData.aclConfig.accessCtrl || false);
      setAcl(aclStr);
      setInitialized(true);
    }
  }, [viewData, initialized]);

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

  const handleAccessCtrlChange = (checked) => {
    setAccessCtrl(checked);
    
    let aclArray = [];
    const tmpArr = (acl || "").split(',');
    for (let i = 0; i < tmpArr.length; i++) {
      const item = tmpArr[i].trim();
      if (item) aclArray.push(item);
    }
    
    if (!checked) {
      aclArray = [userId];
    } else {
      if (!aclArray.includes(userId)) aclArray.push(userId);
    }
    
    onChange({ accessCtrl: checked, acl: aclArray });
  };

  const handleAclChange = (value) => {
    handleDebounce("__accessCtrl", () => {
      if (!value) return;
      setAcl(value);
      
      const aclArray = [];
      const tmpArr = value.split(',');
      for (let i = 0; i < tmpArr.length; i++) {
        const item = tmpArr[i].trim();
        if (item) aclArray.push(item);
      }
      
      onChange({ accessCtrl: accessCtrl, acl: aclArray });
    });
  };

  return (
    <>
      <Row>
        <Col md={3} sm={3} xs={3}>
          <Form.Check 
            inline 
            type="checkbox" 
            label="&nbsp;Add access-control" 
            checked={accessCtrl} 
            onChange={(event) => handleAccessCtrlChange(event.target.checked)}
          />
        </Col>
        {accessCtrl && (
          <Col md={9} sm={9} xs={9}>
            <Form.Control 
              type="text" 
              defaultValue={acl} 
              onChange={(event) => handleAclChange(event.target.value)} 
            />
          </Col>
        )}
      </Row>
    </>
  );
}

AccessCtrl.propTypes = {
  onChange: PropTypes.func.isRequired,
  dsName: PropTypes.string.isRequired,
  dsView: PropTypes.string.isRequired,
  viewData: PropTypes.object
};

export default AccessCtrl;
