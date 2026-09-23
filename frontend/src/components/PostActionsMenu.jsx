import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// The owner (or an admin) gets Edit/Delete; everyone else gets Report — same
// viewport-fixed, portaled dropdown pattern as SharePostMenu, for the same
// reason: `.feed-card` has `backdrop-filter` (and a hover `transform`), which
// makes it the containing block for a `position: fixed` descendant instead of
// the viewport, so a naive absolute/fixed menu nested inside the card would
// be badly misplaced.
const PostActionsMenu = ({ canManage, onEdit, onDelete, onReport, deleteTitle, className = "" }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = canManage ? 96 : 52;
      const menuWidth = 170;
      const openUp = window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight;
      const left = Math.min(Math.max(rect.right - menuWidth, 8), window.innerWidth - menuWidth - 8);
      setPos(openUp ? { bottom: window.innerHeight - rect.top + 6, left } : { top: rect.bottom + 6, left });
    }
    setOpen((o) => !o);
  };

  const run = (fn) => {
    setOpen(false);
    fn?.();
  };

  if (!canManage && !onReport) return null;

  return (
    <div className={`feed-card__share-wrap ${className}`} ref={wrapRef}>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        className="feed-card__actions-btn"
        aria-label="Post options"
        title="Post options"
      >
        <span className="material-icons">more_vert</span>
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          className="feed-card__share-menu"
          style={{ position: "fixed", ...pos }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {canManage ? (
            <>
              <button onClick={() => run(onEdit)} className="feed-card__share-option">
                <span className="material-icons">edit</span>
                Edit
              </button>
              <button
                onClick={() => run(onDelete)}
                className="feed-card__share-option feed-card__share-option--danger"
                title={deleteTitle}
              >
                <span className="material-icons">delete_outline</span>
                Delete
              </button>
            </>
          ) : (
            <button onClick={() => run(onReport)} className="feed-card__share-option feed-card__share-option--danger">
              <span className="material-icons">flag</span>
              Report
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default PostActionsMenu;
