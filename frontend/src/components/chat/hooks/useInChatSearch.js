import { useState, useEffect, useCallback } from "react";

/**
 * Hook for managing in-chat search query, matches, and navigation
 * @param {Array} messages List of chat messages
 */
export const useInChatSearch = (messages = []) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchedIndices, setMatchedIndices] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setMatchedIndices([]);
      setCurrentMatchIndex(0);
      return;
    }

    const q = searchQuery.toLowerCase();
    const indices = [];
    messages.forEach((msg, idx) => {
      if (msg.content && msg.content.toLowerCase().includes(q)) {
        indices.push(idx);
      }
    });

    setMatchedIndices(indices);
    setCurrentMatchIndex(indices.length > 0 ? indices.length - 1 : 0);
  }, [searchQuery, messages]);

  const jumpToMatch = useCallback(
    (index) => {
      if (matchedIndices.length === 0) return;
      const targetMsgIdx = matchedIndices[index];
      const targetMsg = messages[targetMsgIdx];
      if (targetMsg?._id) {
        const el = document.getElementById(`msg-${targetMsg._id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
      setCurrentMatchIndex(index);
    },
    [matchedIndices, messages]
  );

  const nextMatch = useCallback(() => {
    if (matchedIndices.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matchedIndices.length;
    jumpToMatch(nextIdx);
  }, [currentMatchIndex, matchedIndices.length, jumpToMatch]);

  const prevMatch = useCallback(() => {
    if (matchedIndices.length === 0) return;
    const prevIdx =
      (currentMatchIndex - 1 + matchedIndices.length) % matchedIndices.length;
    jumpToMatch(prevIdx);
  }, [currentMatchIndex, matchedIndices.length, jumpToMatch]);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setMatchedIndices([]);
    setCurrentMatchIndex(0);
  }, []);

  return {
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    matchedIndices,
    currentMatchIndex,
    jumpToMatch,
    nextMatch,
    prevMatch,
    closeSearch,
  };
};
