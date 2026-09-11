import React from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";

const MessageContextMenu = ({
  activeMessage,
  position = { top: 0, left: 0 },
  isPinned,
  isSent,
  isStarred,
  onReply,
  onReact,
  onTogglePin,
  onToggleStar,
  onForward,
  onSelectMessage,
  onEdit,
  onReport,
  onDelete,
  onClose,
}) => {
  if (!activeMessage) return null;

  const handleCopy = () => {
    const textToCopy = activeMessage.content || activeMessage.media || "";
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      toast.info(
        activeMessage.content ? "Copied to clipboard" : "Link copied to clipboard"
      );
    }
    onClose();
  };

  const isEditable =
    isSent &&
    !activeMessage.media &&
    Date.now() - new Date(activeMessage.createdAt).getTime() <= 15 * 60 * 1000;

  const menuContent = (
    <div
      className="msg-context-menu"
      style={{
        top: position.top !== undefined ? `${position.top}px` : "auto",
        bottom: position.bottom !== undefined ? `${position.bottom}px` : "auto",
        left: `${position.left}px`,
        maxHeight: position.maxHeight ? `${position.maxHeight}px` : undefined,
        overflowY: position.maxHeight ? "auto" : undefined,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Reply */}
      <button
        type="button"
        aria-label="Reply"
        onClick={() => {
          onReply(activeMessage);
          onClose();
        }}
        className="msg-menu-item"
      >
        <span className="material-icons">reply</span> Reply
      </button>

      {/* 2. Star / Unstar (Only for media messages) */}
      {Boolean(activeMessage?.media || activeMessage?.mediaType) && (
        <button
          type="button"
          aria-label={isStarred ? "Unstar message" : "Star message"}
          onClick={() => {
            if (onToggleStar) onToggleStar(activeMessage._id);
            onClose();
          }}
          className="msg-menu-item"
        >
          <span className={`material-icons ${isStarred ? "text-amber-400" : ""}`}>
            {isStarred ? "star" : "star_outline"}
          </span>{" "}
          <span>{isStarred ? "Unstar" : "Star"}</span>
        </button>
      )}

      {/* 4. Pin / Unpin */}
      <button
        type="button"
        aria-label={isPinned ? "Unpin message" : "Pin message"}
        onClick={() => {
          onTogglePin(activeMessage._id, isPinned);
          onClose();
        }}
        className="msg-menu-item"
      >
        <span className="material-icons">push_pin</span>{" "}
        <span>{isPinned ? "Unpin" : "Pin"}</span>
      </button>

      {/* 5. Forward */}
      <button
        type="button"
        aria-label="Forward"
        onClick={() => {
          onForward(activeMessage);
          onClose();
        }}
        className="msg-menu-item"
      >
        <span className="material-icons">shortcut</span> Forward
      </button>

      {/* 6. Copy */}
      <button
        type="button"
        aria-label="Copy"
        onClick={handleCopy}
        className="msg-menu-item"
      >
        <span className="material-icons">content_copy</span> Copy
      </button>

      {/* 7. Edit (if sent text message within 15 min) */}
      {isEditable && (
        <button
          type="button"
          aria-label="Edit"
          onClick={() => {
            onEdit(activeMessage);
            onClose();
          }}
          className="msg-menu-item"
        >
          <span className="material-icons">edit</span> Edit
        </button>
      )}

      {/* Divider */}
      <div className="msg-menu-divider" />

      {/* 8. Report */}
      <button
        type="button"
        aria-label="Report"
        onClick={() => {
          if (onReport) onReport(activeMessage);
          onClose();
        }}
        className="msg-menu-item"
      >
        <span className="material-icons text-amber-400/90">report_problem</span> Report
      </button>

      {/* 9. Delete (selects message to enter multi-selection mode) */}
      <button
        type="button"
        aria-label="Delete"
        onClick={() => {
          if (onSelectMessage) {
            onSelectMessage(activeMessage);
          } else if (onDelete) {
            onDelete(activeMessage._id);
          }
          onClose();
        }}
        className="msg-menu-item text-red-400 hover:bg-red-500/20"
      >
        <span className="material-icons text-red-400">delete</span> Delete
      </button>

      {/* Divider */}
      <div className="msg-menu-divider" />

      {/* 10. Select messages */}
      <button
        type="button"
        aria-label="Select messages"
        onClick={() => {
          if (onSelectMessage) onSelectMessage(activeMessage);
          onClose();
        }}
        className="msg-menu-item"
      >
        <span className="material-icons">check_circle_outline</span> Select messages
      </button>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(menuContent, document.body)
    : menuContent;
};

export default MessageContextMenu;
