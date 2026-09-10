import React from "react";

const ChatSelectionBar = ({
  selectedCount,
  onClearSelection,
  onForward,
  onDelete,
}) => {
  return (
    <div className="chat-header bg-slate-900 border-b border-violet-500/30 flex items-center justify-between px-6 py-3 z-20 shadow-lg">
      <div className="flex items-center gap-3">
        <button
          type="button"
          id="chat-multi-select-close-btn"
          onClick={onClearSelection}
          className="text-gray-400 hover:text-white cursor-pointer flex items-center"
          aria-label="Cancel selection"
        >
          <span className="material-icons">close</span>
        </button>
        <span className="font-bold text-violet-300 text-sm">
          {selectedCount} Selected
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onForward}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/30 border border-violet-500/40 text-violet-200 rounded-lg text-xs font-semibold hover:bg-violet-600/50 transition-colors cursor-pointer"
        >
          <span className="material-icons text-sm">shortcut</span> Forward
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold hover:bg-red-500/30 transition-colors cursor-pointer"
        >
          <span className="material-icons text-sm">delete</span> Delete
        </button>
      </div>
    </div>
  );
};

export default ChatSelectionBar;
