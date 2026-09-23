import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "../../../api/apiClient";

const DEBOUNCE_MS = 250;

/**
 * In-chat search over the WHOLE conversation (server-side), not just the page
 * of messages currently loaded.
 *
 * Results are newest-first. Opening a result calls `onJumpTo(messageId)`,
 * which loads older history until that message is on screen and flashes it.
 * "Older" walks back through time (↑ / Enter), "Newer" forward (↓ / Shift+Enter).
 *
 * If the search request fails (offline), it falls back to matching the
 * messages already loaded, so the box still does something useful.
 */
export const useInChatSearch = ({ chatId, messages = [], onJumpTo }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState([]); // [{ _id, createdAt }] newest first
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | loading | done

  const requestIdRef = useRef(0);
  const onJumpToRef = useRef(onJumpTo);
  const messagesRef = useRef(messages);
  useEffect(() => {
    onJumpToRef.current = onJumpTo;
    messagesRef.current = messages;
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (!isSearchOpen || !chatId || !debouncedQuery) {
      setResults([]);
      setCurrentMatchIndex(0);
      setStatus("idle");
      return;
    }

    const requestId = ++requestIdRef.current;
    setStatus("loading");

    const apply = (list) => {
      if (requestId !== requestIdRef.current) return; // a newer query won
      setResults(list);
      setCurrentMatchIndex(0);
      setStatus("done");
      if (list[0]?._id) onJumpToRef.current?.(list[0]._id);
    };

    apiClient
      .get(`/chat/message/search/${chatId}`, { params: { query: debouncedQuery } })
      .then((res) => apply(Array.isArray(res?.data?.data) ? res.data.data : []))
      .catch(() => {
        const q = debouncedQuery.toLowerCase();
        apply(
          messagesRef.current
            .filter((m) => m.content && m.content.toLowerCase().includes(q))
            .reverse()
        );
      });
  }, [isSearchOpen, chatId, debouncedQuery]);

  const goTo = useCallback(
    (index) => {
      if (index < 0 || index >= results.length) return;
      setCurrentMatchIndex(index);
      onJumpToRef.current?.(results[index]._id);
    },
    [results]
  );

  const olderMatch = useCallback(() => goTo(currentMatchIndex + 1), [goTo, currentMatchIndex]);
  const newerMatch = useCallback(() => goTo(currentMatchIndex - 1), [goTo, currentMatchIndex]);

  const closeSearch = useCallback(() => {
    requestIdRef.current++;
    setIsSearchOpen(false);
    setSearchQuery("");
    setDebouncedQuery("");
    setResults([]);
    setCurrentMatchIndex(0);
    setStatus("idle");
  }, []);

  return {
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    // What bubbles should highlight: the settled query, only while searching —
    // so memoized message rows don't re-render on every keystroke.
    highlightQuery: isSearchOpen ? debouncedQuery : "",
    results,
    matchCount: results.length,
    currentMatchIndex,
    activeMatchId: results[currentMatchIndex]?._id || null,
    isSearching: status === "loading" || (isSearchOpen && searchQuery.trim() !== debouncedQuery),
    hasSearched: status === "done",
    olderMatch,
    newerMatch,
    closeSearch,
  };
};
