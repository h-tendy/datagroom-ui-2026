import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, Button, Spinner } from 'react-bootstrap';
import styles from './ModalEditor.module.css';

/**
 * DescriptionEditorModal - CodeMirror-based editor for DS descriptions
 * Opens in a modal with full-screen editing capabilities
 * 
 * @param {boolean} show - Whether the modal is visible
 * @param {string} initialValue - The initial description text
 * @param {function} onSave - Callback when user saves (receives edited text)
 * @param {function} onCancel - Callback when user cancels
 * @param {boolean} isLoading - Whether fresh config is being fetched
 * @param {boolean} isSaving - Whether save operation is in progress
 */
function DescriptionEditorModal({ show, initialValue, onSave, onCancel, isLoading, isSaving }) {
  const textareaRef = useRef(null);
  const codeMirrorRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!show) {
      // Clean up CodeMirror instance when modal closes
      if (codeMirrorRef.current) {
        codeMirrorRef.current.toTextArea();
        codeMirrorRef.current = null;
        setIsInitialized(false);
      }
      return;
    }

    // Initialize CodeMirror when modal opens and textarea is ready
    if (show && textareaRef.current && !codeMirrorRef.current && !isLoading) {
      // Small delay to ensure DOM is fully ready
      setTimeout(() => {
        if (!textareaRef.current || codeMirrorRef.current) return;

        // Initialize spell-checker mode (required before creating CodeMirror instance)
        if (window.CodeMirrorSpellChecker) {
          window.CodeMirrorSpellChecker({
            codeMirrorInstance: window.CodeMirror,
          });
        }

        // Determine CodeMirror theme based on app theme
        const appTheme = localStorage.getItem('theme') || 'light';
        const cmTheme = appTheme === 'dark' ? 'monokai' : 'eclipse';

        // Create CodeMirror instance
        codeMirrorRef.current = window.CodeMirror.fromTextArea(textareaRef.current, {
          lineNumbers: true,
          lineWrapping: true,
          mode: 'spell-checker',
          backdrop: 'markdown',
          highlightFormatting: true,
          theme: cmTheme,
          scrollbarStyle: 'null',
        });

        // Set initial value
        codeMirrorRef.current.setValue(initialValue || '');

        // Configure inline attachment for image uploads
        if (window.inlineAttachment && window.inlineAttachment.editors.codemirror4) {
          window.inlineAttachment.editors.codemirror4.attach(codeMirrorRef.current, {
            uploadUrl: '/uploadAttachments',
            urlText: '<img src="{filename}" alt="{filename}" width="100%" height="100%"/>',
            fileUrlText: '[{filename}]({filename})',
            allowedTypes: '*',
            extraParams: {
              dsName: 'system', // Description is system-level, not tied to specific DS
            },
          });
        }

        // Set editor height based on content
        const lineCount = codeMirrorRef.current.getDoc().lineCount();
        const height = Math.max(300, Math.min(600, (lineCount + 10) * 18));
        codeMirrorRef.current.setSize('100%', `${height}px`);

        // Refresh and focus the editor
        codeMirrorRef.current.refresh();
        codeMirrorRef.current.focus();

        // Add keyboard shortcuts
        codeMirrorRef.current.on('keydown', (cm, event) => {
          // Ctrl+Enter to save
          if (event.ctrlKey && event.keyCode === 13) {
            event.preventDefault();
            handleSave();
          }
          // ESC to cancel
          if (event.keyCode === 27) {
            event.preventDefault();
            handleCancel();
          }
        });

        // Dynamic height adjustment on content change
        codeMirrorRef.current.on('change', () => {
          const newLineCount = codeMirrorRef.current.getDoc().lineCount();
          const newHeight = Math.max(300, Math.min(600, (newLineCount + 10) * 18));
          codeMirrorRef.current.setSize('100%', `${newHeight}px`);
        });

        // Auto-resize on keyup as well
        codeMirrorRef.current.on('keyup', (cm, e) => {
          const h = (codeMirrorRef.current.getDoc().lineCount() + 10) * 18;
          codeMirrorRef.current.setSize('100%', `${h}px`);
          codeMirrorRef.current.scrollIntoView(codeMirrorRef.current.getDoc().getCursor(), 10);
        });

        setIsInitialized(true);
      }, 100);
    }
  }, [show, isLoading, initialValue]);

  const handleSave = () => {
    if (codeMirrorRef.current && onSave) {
      const editedValue = codeMirrorRef.current.getValue();
      onSave(editedValue);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  if (!show) {
    return null;
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <Modal.Header className={styles.header}>
          <Modal.Title className={styles.title}>Edit Dataset Description</Modal.Title>
        </Modal.Header>
        <div className={styles.body}>
          <Modal.Body>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Spinner animation="border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
                <p style={{ marginTop: '1rem' }}>Loading latest configuration...</p>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                defaultValue={initialValue || ''}
                style={{ width: '100%', minHeight: '300px' }}
              />
            )}
          </Modal.Body>
        </div>
        <Modal.Footer className={styles.footer}>
          <span>
            <b style={{ color: 'green' }}>ESC</b> to cancel.{' '}
            <b style={{ color: 'green' }}>Ctrl+Enter</b> to save and close.
          </span>
          <Button
            className={styles.cancel}
            variant="secondary"
            onClick={handleCancel}
            disabled={isLoading || isSaving}
          >
            Cancel
          </Button>
          <Button
            className={styles.primary}
            variant="primary"
            onClick={handleSave}
            disabled={isLoading || isSaving}
          >
            {isSaving ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  style={{ marginRight: '0.5rem' }}
                />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </Modal.Footer>
      </div>
    </div>
  );
}

DescriptionEditorModal.propTypes = {
  show: PropTypes.bool.isRequired,
  initialValue: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  isSaving: PropTypes.bool,
};

DescriptionEditorModal.defaultProps = {
  initialValue: '',
  isLoading: false,
  isSaving: false,
};

export default DescriptionEditorModal;
