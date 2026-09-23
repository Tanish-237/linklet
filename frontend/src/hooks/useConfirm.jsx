import React, { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";

/**
 * In-app replacement for window.confirm.
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title, message, confirmText }))) return;
 *   ...
 *   return <>{...}{confirmDialog}</>;
 *
 * `options` are passed straight to ConfirmDeleteModal (title, message,
 * confirmText, icon, confirmIcon).
 */
export default function useConfirm() {
  const [options, setOptions] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setOptions(opts);
      }),
    []
  );

  const settle = (result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOptions(null);
  };

  // Portalled to <body>: callers often sit inside dropdowns/modals with a
  // transform or backdrop-filter, which would clip a position:fixed overlay.
  const dialog = options
    ? createPortal(
        <ConfirmDeleteModal
          {...options}
          isOpen
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />,
        document.body
      )
    : null;

  return [confirm, dialog];
}
