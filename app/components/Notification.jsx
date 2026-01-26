import React, { useEffect } from 'react';
import { Alert } from 'react-bootstrap';
import './Notification.css';

/**
 * Short-lived notification component displayed in the top-right corner
 * 
 * @param {Object} props
 * @param {boolean} props.show - Whether to show the notification
 * @param {string} props.type - Notification type: "success", "error", "warning", "info"
 * @param {string} props.message - Message to display
 * @param {boolean} props.showIcon - Whether to show icon (default: false)
 * @param {Function} props.onClose - Callback when notification closes
 * @param {number} props.autoHideDuration - Auto-hide duration in ms (default: 3000)
 */
const Notification = ({ 
  show, 
  type = 'info', 
  message, 
  showIcon = false, 
  onClose,
  autoHideDuration = 3000 
}) => {
  useEffect(() => {
    if (show && autoHideDuration > 0 && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [show, autoHideDuration, onClose]);

  let faIcon = null;
  let defaultMessage = "";

  if (showIcon) {
    if (type === "success") {
      faIcon = <i className="fa fa-check"></i>;
    } else if (type === "error" || type === "failure") {
      faIcon = <i className="fa fa-times"></i>;
    } else if (type === "warning") {
      faIcon = <i className="fa fa-exclamation-triangle"></i>;
    } else if (type === "info") {
      faIcon = <i className="fa fa-info-circle"></i>;
    }
  }

  if (type === "success") {
    defaultMessage = "SUCCESS!";
  } else if (type === "error" || type === "failure") {
    defaultMessage = "FAILURE!";
  } else if (type === "warning") {
    defaultMessage = "WARNING!";
  } else if (type === "info") {
    defaultMessage = "INFO";
  }

  // Map type to bootstrap variant
  const variantMap = {
    success: 'success',
    error: 'danger',
    failure: 'danger',
    warning: 'warning',
    info: 'info'
  };

  return (
    <div className={`notification ${show ? 'show' : ''} ${type}`}>
      {show && (
        <Alert variant={variantMap[type] || 'info'} transition={false}>
          <span>
            {message || defaultMessage} {faIcon}
          </span>
        </Alert>
      )}
    </div>
  );
};

export default Notification;
