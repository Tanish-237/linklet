import React from "react";
import { toast } from "react-toastify";

const MessageContextMenu = ({
  activeMessage,
  position = { top: 0, left: 0 },
  isPinned,
  isSent,
  onReply,
  onTogglePin,
  onForward,
  onEdit,
  onDelete,
  onClose,
}) => {
  if (!activeMessage) return null;

  const handleCopy = () => {
    if (activeMessage.content) {
      navigator.clipboard.writeText(activeMessage.content);
      toast.info("Copied to clipboard");
    }
    onClose();
  };

  const isEditable =
    isSent &&
    !activeMessage.media &&
    Date.now() - new Date(activeMessage.createdAt).getTime() <= 15 * 60 * 1000;

  return (
    <div
      className="msg-context-menu"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          onReply(activeMessage);
          onClose();
        }}
        className="msg-menu-item"
      >
        <span className="material-icons">reply</span> Reply
      </button>

      <button
        type="button"
        onClick={() => {
          onTogglePin(activeMessage._id, isPinned);
          onClose();
        }}
        className="msg-menu-item"
      >
        <span className="material-icons">push_pin</span>{" "}
        {isPinned ? "Unpin Message" : "Pin Message"}
      </button>

      {activeMessage.content && (
        <button type="button" onClick={handleCopy} className="msg-menu-item">
          <span className="material-icons">content_copy</span> Copy
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          onForward(activeMessage);
          onClose();
        }}
        className="msg-menu-item"
      >
        <span className="material-icons">shortcut</span> Forward
      </button>

      {isEditable && (
        <button
          type="button"
          onClick={() => {
            onEdit(activeMessage);
            onClose();
          }}
          className="msg-menu-item"
        >
          <span className="material-icons">edit</span> Edit
        </button>
      )}

      {isSent && (
        <button
          type="button"
          onClick={() => {
            onDelete(activeMessage._id);
            onClose();
          }}
          className="msg-menu-item text-red-400 hover:bg-red-500/20"
        >
          <span className="material-icons text-red-400">delete</span> Delete
        </button>
      )}
    </div>
  );
};

export default MessageContextMenu;
