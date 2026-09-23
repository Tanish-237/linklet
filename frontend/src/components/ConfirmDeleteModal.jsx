import React from 'react';
import './ConfirmDeleteModal.css';

/**
 * Reusable Custom Delete Confirmation Modal
 */
const ConfirmDeleteModal = ({
  isOpen,
  title = 'Confirm Delete',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  icon = 'delete_forever',
  confirmIcon = 'delete',
  loadingText = 'Deleting...',
}) => {
  if (!isOpen) return null;

  return (
    <div className="cd-backdrop" onClick={onCancel}>
      <div className="cd-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Warning Icon Badge */}
        <div className="cd-icon-badge">
          <span className="material-icons cd-icon" aria-hidden="true">{icon}</span>
        </div>

        {/* Header Content */}
        <h3 className="cd-title">{title}</h3>
        <p className="cd-message">{message}</p>

        {/* Action Buttons */}
        <div className="cd-actions">
          <button className="cd-btn cd-btn-cancel" onClick={onCancel} disabled={loading}>
            {cancelText}
          </button>
          <button className="cd-btn cd-btn-confirm" onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <span className="cd-spinner" />
                <span>{loadingText}</span>
              </>
            ) : (
              <>
                <span className="material-icons" style={{ fontSize: '1.1rem' }} aria-hidden="true">{confirmIcon}</span>
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
