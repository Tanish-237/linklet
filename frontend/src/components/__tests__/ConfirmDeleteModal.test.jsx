import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import ConfirmDeleteModal from '../ConfirmDeleteModal';

describe('ConfirmDeleteModal Component', () => {
  it('does not render when isOpen is false', () => {
    console.log('TRACE [ConfirmDeleteModal.test.jsx]: Testing modal hidden when isOpen=false');
    render(
      <ConfirmDeleteModal
        isOpen={false}
        title="Delete Item"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal dialog with modernized solid confirm button and handles actions', () => {
    console.log('TRACE [ConfirmDeleteModal.test.jsx]: Testing visible modal with solid confirm button');
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    render(
      <ConfirmDeleteModal
        isOpen={true}
        title="Delete Question"
        message="Are you sure you want to permanently remove this?"
        confirmText="Confirm Delete"
        cancelText="Keep Question"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Delete Question')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to permanently remove this?')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'Keep Question' });
    console.log('TRACE [ConfirmDeleteModal.test.jsx]: Found cancel button:', cancelBtn.className);
    expect(cancelBtn).toBeInTheDocument();
    expect(cancelBtn).toHaveClass('cd-btn-cancel');

    const confirmBtn = screen.getByRole('button', { name: /Confirm Delete/i });
    console.log('TRACE [ConfirmDeleteModal.test.jsx]: Found confirm button:', confirmBtn.className);
    expect(confirmBtn).toBeInTheDocument();
    expect(confirmBtn).toHaveClass('cd-btn-confirm');

    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
    console.log('TRACE [ConfirmDeleteModal.test.jsx]: Both cancel and confirm handlers verified');
  });
});
