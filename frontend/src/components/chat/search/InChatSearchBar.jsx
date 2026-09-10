import React from "react";

const InChatSearchBar = ({
  isOpen,
  searchQuery,
  onSearchChange,
  matchCount,
  currentMatchIndex,
  onNextMatch,
  onPrevMatch,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="inchat-search-bar flex items-center justify-between px-4 py-2 bg-slate-900/95 border-b border-violet-500/20 backdrop-blur-md z-20">
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <span className="material-icons text-violet-400 text-lg">search</span>
        <input
          type="text"
          placeholder="Search within this chat..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="bg-transparent text-sm text-gray-200 outline-none w-full placeholder-gray-500"
          autoFocus
        />
      </div>
      <div className="flex items-center gap-2">
        {searchQuery.trim() && (
          <span className="text-xs text-violet-300 font-medium mr-2">
            {matchCount > 0
              ? `${currentMatchIndex + 1} of ${matchCount}`
              : "No matches"}
          </span>
        )}
        <button
          type="button"
          onClick={onPrevMatch}
          disabled={matchCount === 0}
          className="text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer p-1"
          title="Previous match"
        >
          <span className="material-icons text-base">keyboard_arrow_up</span>
        </button>
        <button
          type="button"
          onClick={onNextMatch}
          disabled={matchCount === 0}
          className="text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer p-1"
          title="Next match"
        >
          <span className="material-icons text-base">keyboard_arrow_down</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white cursor-pointer p-1"
          title="Close search"
        >
          <span className="material-icons text-base">close</span>
        </button>
      </div>
    </div>
  );
};

export default InChatSearchBar;
