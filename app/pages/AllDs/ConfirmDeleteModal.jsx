import React from 'react';
import { Modal, Button } from 'react-bootstrap';

export default function ConfirmDeleteModal({ visible, dsName, onConfirm, onCancel }) {
  return (
    <Modal show={visible} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Confirm Delete</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {dsName ? (
          <p>Are you sure you want to delete the dataset <strong>{dsName}</strong>? This action cannot be undone.</p>
        ) : (
          <p>Are you sure?</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>Delete</Button>
      </Modal.Footer>
    </Modal>
  );
}
