import React, { useEffect, useRef } from "react";

/**
 * Search strip under the chat header. Results come from the whole chat
 * history (newest first); ↑ / Enter steps to older matches, ↓ / Shift+Enter
 * to newer ones, Esc closes.
 */
const InChatSearchBar = ({
  isOpen,
  searchQuery,
  onSearchChange,
  matchCount,
  currentMatchIndex,
  isSearching,
  hasSearched,
  onOlderMatch,
  onNewerMatch,
  onClose,
}) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const hasQuery = searchQuery.trim().length > 0;
  const canGoOlder = matchCount > 0 && currentMatchIndex < matchCount - 1;
  const canGoNewer = matchCount > 0 && currentMatchIndex > 0;

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) onNewerMatch();
      else onOlderMatch();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      onOlderMatch();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onNewerMatch();
    }
  };

  let statusText = "";
  if (hasQuery) {
    if (isSearching) statusText = "Searching…";
    else if (hasSearched) statusText = matchCount > 0 ? `${currentMatchIndex + 1} of ${matchCount}` : "No results";
  }

  return (
    <div className="inchat-search-bar" role="search">
      <div className="inchat-search-field">
        <span className="material-icons inchat-search-field-icon" aria-hidden="true">search</span>
        <input
          ref={inputRef}
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search in this chat"
          aria-label="Search messages in this chat"
          enterKeyHint="search"
          autoComplete="off"
        />
        {isSearching && hasQuery ? (
          <span className="inchat-search-spinner" aria-hidden="true" />
        ) : (
          hasQuery && (
            <button
              type="button"
              className="inchat-search-clear"
              onClick={() => {
                onSearchChange("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              title="Clear"
            >
              <span className="material-icons">close</span>
            </button>
          )
        )}
      </div>

      <span className="inchat-search-count" aria-live="polite">
        {statusText}
      </span>

      <div className="inchat-search-nav">
        <button
          type="button"
          onClick={onOlderMatch}
          disabled={!canGoOlder}
          aria-label="Older match"
          title="Older match (Enter)"
        >
          <span className="material-icons">keyboard_arrow_up</span>
        </button>
        <button
          type="button"
          onClick={onNewerMatch}
          disabled={!canGoNewer}
          aria-label="Newer match"
          title="Newer match (Shift+Enter)"
        >
          <span className="material-icons">keyboard_arrow_down</span>
        </button>
      </div>

      <button type="button" className="inchat-search-close" onClick={onClose} aria-label="Close search" title="Close (Esc)">
        Done
      </button>
    </div>
  );
};

export default InChatSearchBar;
