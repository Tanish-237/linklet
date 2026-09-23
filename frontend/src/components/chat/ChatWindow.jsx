import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { apiClient } from "../../api/apiClient";
import { generateClientId } from "../../utlis/clientId";

// Chat Subcomponents
import ChatHeader from "./header/ChatHeader";
import ChatSelectionBar from "./header/ChatSelectionBar";
import PinnedMessageBanner from "./header/PinnedMessageBanner";
import InChatSearchBar from "./search/InChatSearchBar";
import ChatMessagesList from "./messages/ChatMessagesList";
import ChatComposer from "./composer/ChatComposer";
import MessageContextMenu from "./actions/MessageContextMenu";
import ReactionPickerBar from "./actions/ReactionPickerBar";
import ScrollToBottomButton from "./controls/ScrollToBottomButton";
import MediaLightboxModal from "./modals/MediaLightboxModal";
import ConfirmDeleteModal from "../ConfirmDeleteModal";
import ForwardMessageModal from "../ForwardMessageModal";

// Custom Hooks
import { useChatMessages, upsertMessage } from "./hooks/useChatMessages";
import { useVoiceRecorder } from "./hooks/useVoiceRecorder";
import { useAudioPlayback } from "./hooks/useAudioPlayback";
import { useInChatSearch } from "./hooks/useInChatSearch";

const ChatWindow = ({
  chat,
  currentUser,
  socket,
  onlineUsers = [],
  lastSeenMap = {},
  onToggleInfo,
  onBackToSidebar,
  onUpdateLastMessage,
  allChats = [],
  isBlocked = false,
  highlightMessageId = null,
  onClearHighlight,
  // Tells ChatPage a chat's pins changed so the sidebar/activeChat stay in sync
  onPinnedMessagesChange,
  // { count, lastReadAt } for this chat at the moment it was opened — where
  // the "N unread messages" divider goes and where the view opens.
  unreadSnapshot = null,
}) => {
  // Messages & Socket lifecycle hook
  const {
    messages,
    setMessages,
    loadingInitial,
    initialFetchDone,
    loadingOlder,
    hasMore,
    typingUsers,
    loadOlderMessages,
    emitTypingActivity,
    emitStopTypingImmediate,
    toggleReaction,
    togglePin,
    deleteMessage,
    bulkDeleteMessages,
    hideMessageForMe,
  } = useChatMessages({
    chat,
    currentUser,
    socket,
    onUpdateLastMessage,
    onPinnedMessagesChange: (pinned) => applyPinned(pinned),
  });

  // ── Pinned messages ───────────────────────────────────────────────────
  // Held locally so pin/unpin shows instantly (optimistic), then confirmed by
  // the server response and the "message pinned/unpinned" broadcast (which
  // also covers pins made by the other person). Rolled back on failure.
  const [pinnedMessages, setPinnedMessages] = useState(() => chat.pinnedMessages || []);
  const pinnedRef = useRef(pinnedMessages);
  useEffect(() => {
    pinnedRef.current = pinnedMessages;
  }, [pinnedMessages]);
  useEffect(() => {
    setPinnedMessages(chat.pinnedMessages || []);
  }, [chat.pinnedMessages]);

  const onPinnedChangeRef = useRef(onPinnedMessagesChange);
  useEffect(() => {
    onPinnedChangeRef.current = onPinnedMessagesChange;
  });

  const applyPinned = useCallback(
    (next) => {
      setPinnedMessages(next);
      onPinnedChangeRef.current?.(chat._id, next);
    },
    [chat._id]
  );

  const pinnedIds = useMemo(
    () => new Set(pinnedMessages.map((p) => String(p?._id || p))),
    [pinnedMessages]
  );

  // Audio Playback hook
  const { audioPlaybackState, toggleAudioPlay, seekAudio } = useAudioPlayback();

  // Composer and selections state
  const [newMessage, setNewMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [isSending, setIsSending] = useState(false);
  // Synchronous guard against a double-fire send (e.g. a fast double Enter, whose
  // second keypress can land before the `isSending` state update from the first
  // has re-rendered the disabled submit button). `isSending` state still drives
  // the UI; this ref exists purely to make the very first line of the handler
  // reject a same-tick re-entry that a stale closure over `isSending` would miss.
  const sendInFlightRef = useRef(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  // Floating Context Menu & Reaction picker state
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [reactionPosition, setReactionPosition] = useState({ top: 0, left: 0 });

  // Multi-selection & Modals state
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [reportingMessage, setReportingMessage] = useState(null);
  const [starredMessageIds, setStarredMessageIds] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = window.localStorage.getItem(
          `linklet_starred_msgs_${currentUser?._id}`
        );
        return saved ? JSON.parse(saved) : [];
      }
    } catch {
      return [];
    }
    return [];
  });

  // "Go to message" target: from the URL (Saved, notifications) or set locally
  // (pinned banner). Same load-older-until-found flow either way.
  const [jumpTargetId, setJumpTargetId] = useState(null);
  const targetMessageId = highlightMessageId || jumpTargetId;
  const highlightFromUrlRef = useRef(highlightMessageId);
  useEffect(() => {
    highlightFromUrlRef.current = highlightMessageId;
  });
  const clearTarget = useCallback(() => {
    setJumpTargetId(null);
    // Only touch the URL when the target actually came from it
    if (highlightFromUrlRef.current && onClearHighlight) onClearHighlight();
  }, [onClearHighlight]);

  // In-chat search (whole history, server-side) — jumps reuse the same
  // load-older-until-found flow as "go to message".
  const {
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    highlightQuery,
    matchCount,
    currentMatchIndex,
    activeMatchId,
    isSearching,
    hasSearched,
    olderMatch,
    newerMatch,
    closeSearch,
  } = useInChatSearch({
    chatId: chat?._id,
    messages,
    onJumpTo: (id) => setJumpTargetId(id),
  });

  // Scroll to bottom & unread badge state
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [scrolledUnreadCount, setScrolledUnreadCount] = useState(0);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const initialScrollDoneChatIdRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const prevLastMsgIdRef = useRef(null);

  // Close menus on outside click
  useEffect(() => {
    const handleWindowClick = () => {
      setActiveMenuMessageId(null);
      setActiveReactionMessageId(null);
    };
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  // Clean up object URLs on unmount or preview changes
  useEffect(() => {
    return () => {
      filePreviews.forEach((f) => {
        if (f.url) URL.revokeObjectURL(f.url);
      });
    };
  }, [filePreviews]);

  // Audio voice note recording handler
  const handleSendAudioFile = useCallback(
    async (audioFile) => {
      if (!audioFile || !chat?._id) return;
      setIsSending(true);

      const clientId = generateClientId();
      const optimisticId = `opt_${clientId}`;
      const optimisticAudioMsg = {
        _id: optimisticId,
        clientId,
        sender: currentUser,
        chat: chat._id,
        content: "",
        media: URL.createObjectURL(audioFile),
        mediaType: "audio",
        createdAt: new Date().toISOString(),
        status: "sending",
        readBy: [currentUser?._id],
        // Kept on the bubble so "Retry" can resend exactly this recording
        retryPayload: { kind: "audio", file: audioFile },
      };

      setMessages((prev) => upsertMessage(prev, optimisticAudioMsg));

      try {
        const formData = new FormData();
        formData.append("chatId", chat._id);
        // Exactly once: the server turns every uploaded file into its own
        // message, so a second copy under another field name was a second
        // voice note.
        formData.append("media", audioFile);
        formData.append("mediaType", "audio");
        formData.append("clientId", clientId);

        const res = await apiClient.post("/chat/message", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (res.data.success) {
          const confirmed = Array.isArray(res.data.data) ? res.data.data[0] : res.data.data;
          // upsertMessage matches by clientId, so this reconciles the optimistic
          // bubble whether or not the socket broadcast (same clientId) already beat
          // the HTTP response here and replaced it first — either order lands on
          // exactly one message, never two.
          setMessages((prev) => upsertMessage(prev, confirmed));
          // The server broadcasts "message received" to the chat room and every
          // participant's personal room right after persisting the message — the
          // client no longer relays this itself (see backend socket.js notifyNewMessage).
          if (onUpdateLastMessage) onUpdateLastMessage(chat._id, confirmed);
        }
      } catch (error) {
        console.error("Failed to send voice note:", error.response?.data || error.message);
        toast.error(error.response?.data?.message || "Failed to send voice note");
        setMessages((prev) =>
          prev.map((m) => (m._id === optimisticId ? { ...m, status: "failed" } : m))
        );
      } finally {
        setIsSending(false);
      }
    },
    [chat?._id, currentUser, setMessages, onUpdateLastMessage]
  );

  const {
    isRecordingAudio,
    recordingSeconds,
    startRecordingAudio,
    stopAndSendAudio,
    cancelRecordingAudio,
  } = useVoiceRecorder(handleSendAudioFile);

  const stickToBottomRef = useRef(true);

  // ── Scroll anchoring ──────────────────────────────────────────────────
  // Our own, instead of the browser's (disabled via overflow-anchor: none on
  // .chat-messages): remember which message is at the top of the viewport and
  // its offset, and after anything above it changes height — older messages
  // prepended, the "loading older" spinner appearing, an image finishing
  // loading — put that same message back at the same offset. Chrome's native
  // anchoring plus a manual scrollHeight correction on prepend adjusted
  // twice and threw the reader far down the chat; Safari has no native
  // anchoring at all. This behaves identically everywhere.
  const scrollAnchorRef = useRef(null); // { id, offset }
  const anchorFrameRef = useRef(0);

  const captureScrollAnchor = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const top = container.getBoundingClientRect().top;
    const rows = container.querySelectorAll('[id^="msg-"]');
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (rect.bottom > top + 1) {
        scrollAnchorRef.current = { id: row.id, offset: rect.top - top };
        return;
      }
    }
    scrollAnchorRef.current = null;
  }, []);

  const scheduleAnchorCapture = useCallback(() => {
    if (anchorFrameRef.current) return;
    anchorFrameRef.current = requestAnimationFrame(() => {
      anchorFrameRef.current = 0;
      captureScrollAnchor();
    });
  }, [captureScrollAnchor]);

  const restoreScrollAnchor = useCallback(() => {
    const container = chatContainerRef.current;
    const anchor = scrollAnchorRef.current;
    if (!container || !anchor) return;
    const row = document.getElementById(anchor.id);
    if (!row || !container.contains(row)) {
      captureScrollAnchor();
      return;
    }
    const offset = row.getBoundingClientRect().top - container.getBoundingClientRect().top;
    const delta = offset - anchor.offset;
    if (Math.abs(delta) >= 1) container.scrollTop += delta;
  }, [captureScrollAnchor]);

  useEffect(() => () => cancelAnimationFrame(anchorFrameRef.current), []);

  const handleLoadOlderClick = useCallback(() => {
    captureScrollAnchor();
    loadOlderMessages();
  }, [captureScrollAnchor, loadOlderMessages]);

  // Scroll listener: dismiss menus, show scroll-to-bottom button, infinite scroll
  const handleMessagesScroll = useCallback(
    (e) => {
      const container = e.currentTarget;
      if (!container) return;

      if (activeMenuMessageId || activeReactionMessageId) {
        setActiveMenuMessageId(null);
        setActiveReactionMessageId(null);
      }

      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 80;
      scheduleAnchorCapture();
      const isScrolledUp = distanceFromBottom > 180;
      setShowScrollBottom(isScrolledUp);

      if (!isScrolledUp) {
        setScrolledUnreadCount(0);
      }

      if (container.scrollTop <= 40 && hasMore && !loadingOlder) {
        // Pin the anchor now, not on the next frame — a fast response could
        // otherwise prepend before the deferred capture runs.
        captureScrollAnchor();
        loadOlderMessages();
      }
    },
    [activeMenuMessageId, activeReactionMessageId, hasMore, loadingOlder, loadOlderMessages, scheduleAnchorCapture, captureScrollAnchor]
  );

  const scrollToBottom = useCallback((behavior = "smooth") => {
    const container = chatContainerRef.current;
    if (container) {
      container.style.scrollBehavior = "auto";
      if (behavior === "smooth" && typeof container.scrollTo === "function") {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
    setShowScrollBottom(false);
    setScrolledUnreadCount(0);
  }, []);

  // Images and videos finish loading AFTER the chat has been positioned and
  // grow the content — which used to leave the view part-way up the chat
  // ("opened from the top"). While the user is at the bottom, stay there.
  // (Above-the-fold growth when parked at the unread divider is handled by
  // the browser's native scroll anchoring.)


  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const onMediaLoaded = (e) => {
      const el = e.target;
      if (!(el instanceof HTMLImageElement || el instanceof HTMLVideoElement)) return;
      const positioned = initialScrollDoneChatIdRef.current === chat?._id;
      if (!positioned || stickToBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      } else {
        restoreScrollAnchor();
      }
    };
    container.addEventListener("load", onMediaLoaded, true);
    container.addEventListener("loadedmetadata", onMediaLoaded, true);
    return () => {
      container.removeEventListener("load", onMediaLoaded, true);
      container.removeEventListener("loadedmetadata", onMediaLoaded, true);
    };
  }, [chat?._id, restoreScrollAnchor]);

  // Keep the reader's place whenever the list re-renders above them (older
  // page prepended, loader row toggled, reactions/edits resizing a bubble).
  // Layout effect: corrected before the browser paints, so nothing jumps.
  useLayoutEffect(() => {
    if (initialScrollDoneChatIdRef.current !== chat?._id) return;
    if (stickToBottomRef.current) return;
    restoreScrollAnchor();
  }, [messages, loadingOlder, hasMore, chat?._id, restoreScrollAnchor]);

  // Reset scroll anchoring tracking whenever active chat changes
  useEffect(() => {
    initialScrollDoneChatIdRef.current = null;
    prevMessagesLengthRef.current = 0;
    prevLastMsgIdRef.current = null;
  }, [chat?._id]);

  // ── Where the chat opens ──────────────────────────────────────────────
  // Resolved once per open, from the unread snapshot ChatPage took before it
  // cleared the badge — never from readBy, which the open chat itself is
  // busy updating. Waits for the real fetch (not the localStorage cache,
  // which can predate the unread messages), and pages further back if the
  // unread run starts before the first page.
  const MAX_UNREAD_BACKFILL = 200;
  const unreadTarget = Math.min(unreadSnapshot?.count || 0, 100);
  const [unreadAnchor, setUnreadAnchor] = useState(null); // { id, count }
  const [unreadResolved, setUnreadResolved] = useState(unreadTarget === 0);

  useEffect(() => {
    if (unreadResolved || !initialFetchDone) return;

    const me = currentUser?._id?.toString();
    const fromOthers = messages.filter(
      (m) =>
        !String(m._id).startsWith("opt_") &&
        (m.sender?._id || m.sender)?.toString() !== me
    );
    const lastReadAt = unreadSnapshot?.lastReadAt ? new Date(unreadSnapshot.lastReadAt) : null;
    const unreadLoaded = lastReadAt
      ? fromOthers.filter((m) => new Date(m.createdAt) > lastReadAt)
      : fromOthers.slice(-unreadTarget);

    if (unreadLoaded.length < unreadTarget && hasMore && messages.length < MAX_UNREAD_BACKFILL) {
      if (!loadingOlder) loadOlderMessages();
      return;
    }

    setUnreadAnchor(unreadLoaded[0] ? { id: unreadLoaded[0]._id, count: unreadSnapshot.count } : null);
    setUnreadResolved(true);
  }, [unreadResolved, initialFetchDone, messages, hasMore, loadingOlder, loadOlderMessages, currentUser?._id, unreadSnapshot, unreadTarget]);

  // Instant (no animation) positioning when a chat opens. Until the real
  // messages and the unread divider are settled it just holds the bottom, so
  // cached content never flashes at the top; then it places the view once:
  // a "go to message" target, else the unread divider, else the latest.
  useLayoutEffect(() => {
    if (!chat?._id || messages.length === 0) return;
    if (initialScrollDoneChatIdRef.current === chat._id) return;

    const container = chatContainerRef.current;
    if (!container) return;
    container.style.scrollBehavior = "auto";

    const markDone = () => {
      initialScrollDoneChatIdRef.current = chat._id;
      prevMessagesLengthRef.current = messages.length;
      prevLastMsgIdRef.current = messages[messages.length - 1]?._id;
      captureScrollAnchor();
    };

    if (!initialFetchDone || !unreadResolved) {
      container.scrollTop = container.scrollHeight;
      return;
    }

    if (targetMessageId && messages.some((m) => m._id === targetMessageId)) {
      const targetElem = document.getElementById(`msg-${targetMessageId}`);
      if (targetElem) {
        targetElem.scrollIntoView({ behavior: "auto", block: "center" });
        targetElem.classList.add("highlight-target-msg");
        setTimeout(() => targetElem.classList.remove("highlight-target-msg"), 2500);
        markDone();
        clearTarget();
        return;
      }
    }
    // A target that isn't loaded yet is handled by the backfill effect below;
    // open at the normal position meanwhile.

    const divider = unreadAnchor ? document.getElementById("unread-messages-separator") : null;
    if (divider) {
      const containerRect = container.getBoundingClientRect();
      const dividerRect = divider.getBoundingClientRect();
      container.scrollTop = Math.max(0, dividerRect.top - containerRect.top + container.scrollTop - 12);
      stickToBottomRef.current = false;
    } else {
      container.scrollTop = container.scrollHeight;
      stickToBottomRef.current = true;
    }
    markDone();
  }, [chat?._id, messages, initialFetchDone, unreadResolved, unreadAnchor, targetMessageId, clearTarget, captureScrollAnchor]);

  // Jump to a target once it's in the list (after the chat had already
  // opened, e.g. the pinned banner or a "go to message" link that needed
  // older pages loaded first).
  useEffect(() => {
    if (!targetMessageId || initialScrollDoneChatIdRef.current !== chat?._id) return;
    if (!messages.some((m) => m._id === targetMessageId)) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`msg-${targetMessageId}`);
      if (el) {
        // Instant, not smooth: a smooth scroll over a long distance gets
        // cancelled by the scroll-anchor corrections that run as the older
        // page settles and its images load, stopping short of the message.
        const container = chatContainerRef.current;
        if (container) container.style.scrollBehavior = "auto";
        el.scrollIntoView({ behavior: "auto", block: "center" });
        stickToBottomRef.current = false;
        captureScrollAnchor();
        el.classList.add("highlight-target-msg");
        setTimeout(() => el.classList.remove("highlight-target-msg"), 2500);
        clearTarget();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [targetMessageId, messages, chat?._id, clearTarget, captureScrollAnchor]);

  // Only the latest page is fetched up front. For a target older than that,
  // keep paginating backward until it's loaded or history runs out.
  // Gated on `initialFetchDone`, not `loadingInitial`: a localStorage cache
  // hit flips `loadingInitial` early, while `hasMore` is still a stale default.
  const notFoundToastShownRef = useRef(false);
  useEffect(() => {
    if (!targetMessageId || !initialFetchDone) return;
    if (messages.some((m) => m._id === targetMessageId)) return;

    if (hasMore) {
      if (!loadingOlder) loadOlderMessages(targetMessageId);
      return;
    }

    if (!notFoundToastShownRef.current) {
      notFoundToastShownRef.current = true;
      toast.error("Couldn't find that message — it may have been deleted.");
      clearTarget();
    }
  }, [targetMessageId, initialFetchDone, messages, hasMore, loadingOlder, loadOlderMessages, clearTarget]);

  useEffect(() => {
    notFoundToastShownRef.current = false;
  }, [targetMessageId]);

  // Real-time scroll handler for newly arriving or sent messages
  useEffect(() => {
    if (!chat?._id || messages.length === 0) return;

    // Baseline initialization: do not treat initial message load as new append
    if (prevMessagesLengthRef.current === 0) {
      prevMessagesLengthRef.current = messages.length;
      prevLastMsgIdRef.current = messages[messages.length - 1]?._id;
      return;
    }

    const lastMsg = messages[messages.length - 1];
    const isNewAppend =
      lastMsg &&
      lastMsg._id !== prevLastMsgIdRef.current &&
      messages.length > prevMessagesLengthRef.current;

    prevMessagesLengthRef.current = messages.length;
    prevLastMsgIdRef.current = lastMsg?._id;

    if (initialScrollDoneChatIdRef.current === chat._id && isNewAppend) {
      const isSentByMe =
        (lastMsg.sender?._id || lastMsg.sender)?.toString() ===
        currentUser?._id?.toString();

      if (isSentByMe) {
        scrollToBottom("smooth");
      } else {
        const container = chatContainerRef.current;
        if (container) {
          const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;
          if (distanceFromBottom <= 180) {
            scrollToBottom("smooth");
          } else {
            setScrolledUnreadCount((prev) => prev + 1);
          }
        }
      }
    }
  }, [messages, chat?._id, currentUser?._id, scrollToBottom]);

  // Multi-selection handler
  const toggleSelectMessage = useCallback((messageId) => {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId]
    );
  }, []);

  // The row callbacks below read live state through refs so their identity
  // never changes — MessageItem is memoized, and a callback that changed on
  // every new message or menu toggle would re-render every row anyway.
  const messagesRef = useRef(messages);
  const activeMenuIdRef = useRef(activeMenuMessageId);
  const activeReactionIdRef = useRef(activeReactionMessageId);
  useEffect(() => {
    messagesRef.current = messages;
    activeMenuIdRef.current = activeMenuMessageId;
    activeReactionIdRef.current = activeReactionMessageId;
  });

  // Viewport-clamped menu opener (anchored directly to chevron button like WhatsApp)
  const handleOpenMenu = useCallback(
    (e, msgId) => {
      e.stopPropagation();
      if (activeMenuIdRef.current === msgId) {
        setActiveMenuMessageId(null);
        return;
      }
      setActiveReactionMessageId(null);

      const rect = e.currentTarget?.getBoundingClientRect
        ? e.currentTarget.getBoundingClientRect()
        : { top: 150, bottom: 180, left: 200, right: 230, width: 28, height: 28 };

      const menuWidth = 190;
      const estimatedMenuHeight = 310;
      const viewportHeight = window.innerHeight || 800;
      const viewportWidth = window.innerWidth || 1200;

      const msg = messagesRef.current.find((m) => m._id === msgId);
      const isSent =
        (msg?.sender?._id || msg?.sender)?.toString() ===
        currentUser?._id?.toString();

      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // In WhatsApp Web, messages in the lower half of the screen or near composer always open UPWARDS
      const openUpward =
        spaceBelow < estimatedMenuHeight + 80 ||
        (rect.top > viewportHeight * 0.45 && spaceAbove > 240);

      // WhatsApp anchor: align left edge on received, align right edge on sent
      let left = isSent ? rect.right - menuWidth : rect.left;
      left = Math.max(12, Math.min(left, viewportWidth - menuWidth - 12));

      if (openUpward) {
        const bottom = Math.max(16, viewportHeight - rect.top + 6);
        const maxHeight = Math.max(200, rect.top - 80);
        setMenuPosition({ bottom, left, maxHeight });
      } else {
        const top = Math.max(76, rect.bottom + 6);
        const maxHeight = Math.max(200, viewportHeight - top - 16);
        setMenuPosition({ top, left, maxHeight });
      }

      setActiveMenuMessageId(msgId);
    },
    [currentUser]
  );

  // Viewport-clamped reaction picker opener
  const handleOpenReaction = useCallback(
    (e, msgId) => {
      e.stopPropagation();
      if (activeReactionIdRef.current === msgId) {
        setActiveReactionMessageId(null);
        return;
      }
      setActiveMenuMessageId(null);

      const rect = e.currentTarget?.getBoundingClientRect
        ? e.currentTarget.getBoundingClientRect()
        : { top: 150, bottom: 180, left: 200, right: 230, width: 28, height: 28 };

      const pickerWidth = 245;
      const pickerHeight = 44;
      const viewportHeight = window.innerHeight || 800;
      const viewportWidth = window.innerWidth || 1200;

      const openAbove = rect.top >= 72 + pickerHeight + 8;
      let top = openAbove ? rect.top - pickerHeight - 8 : rect.bottom + 8;
      top = Math.max(72, Math.min(top, viewportHeight - pickerHeight - 16));

      let left = rect.left - pickerWidth / 2 + (rect.width || 28) / 2;
      left = Math.max(12, Math.min(left, viewportWidth - pickerWidth - 12));

      setReactionPosition({ top, left });
      setActiveReactionMessageId(msgId);
    },
    []
  );


  // WhatsApp-style multi-selection trigger from context menu
  const handleSelectMessageFromMenu = useCallback((msg) => {
    if (!msg) return;
    setSelectedMessageIds([msg._id]);
  }, []);

  // File selection & preview generation
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    const newPreviews = files.map((file) => {
      const isImg = file.type.startsWith("image/");
      const isVid = file.type.startsWith("video/");
      const isAud = file.type.startsWith("audio/");
      return {
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        type: isImg ? "image" : isVid ? "video" : isAud ? "audio" : "document",
        size: (file.size / (1024 * 1024)).toFixed(1) + " MB",
      };
    });

    setSelectedFiles((prev) => [...prev, ...files]);
    setFilePreviews((prev) => [...prev, ...newPreviews]);
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => {
      const target = prev[index];
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Send message or edit message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && selectedFiles.length === 0) return;
    // Synchronous re-entry guard: a fast double Enter can fire this handler twice
    // before the `isSending` state (checked by the disabled submit button) has
    // re-rendered. The ref updates immediately, so the second call bails here
    // instead of issuing a second POST.
    if (sendInFlightRef.current) return;

    emitStopTypingImmediate();
    setIsEmojiPickerOpen(false);

    // Edit message flow
    if (editingMessage) {
      try {
        const res = await apiClient.put(`/chat/message/${editingMessage._id}`, {
          content: newMessage.trim(),
        });
        if (res.data.success) {
          const updated = res.data.data;
          setMessages((prev) =>
            prev.map((m) => (m._id === editingMessage._id ? updated : m))
          );
          // Server broadcasts "message updated" after persisting the edit.
          setEditingMessage(null);
          setNewMessage("");
        }
      } catch {
        toast.error("Failed to edit message");
      }
      return;
    }

    // Send new message flow
    sendInFlightRef.current = true;
    // Replying means you've caught up — drop the "N unread messages" divider,
    // as WhatsApp does, instead of leaving it wedged mid-conversation.
    setUnreadAnchor(null);
    const payload = {
      kind: "message",
      content: newMessage.trim(),
      replyTo: replyingTo,
      files: [...selectedFiles],
    };

    setNewMessage("");
    setReplyingTo(null);
    setSelectedFiles([]);
    setFilePreviews([]);

    try {
      await sendPayload(payload);
    } finally {
      sendInFlightRef.current = false;
    }
  };

  // Optimistically shows the message (clock icon), posts it, and reconciles.
  // On failure the bubble stays with its payload attached so "Retry" can send
  // exactly the same thing again under the same clientId (the server dedupes
  // on clientId, so a retry after a lost response can't double-post).
  const sendPayload = async ({ content, replyTo, files = [] }, reuseClientId = null) => {
    setIsSending(true);
    const clientId = reuseClientId || generateClientId();
    const optimisticId = `opt_${clientId}`;
    const optimisticMsg = {
      _id: optimisticId,
      clientId,
      sender: currentUser,
      chat: chat._id,
      content,
      replyTo,
      createdAt: new Date().toISOString(),
      status: "sending",
      readBy: [currentUser?._id],
      retryPayload: { kind: "message", content, replyTo, files },
    };

    setMessages((prev) => upsertMessage(prev, optimisticMsg));
    setTimeout(() => scrollToBottom("smooth"), 50);

    try {
      let res;
      if (files.length > 0) {
        const formData = new FormData();
        formData.append("chatId", chat._id);
        if (content) formData.append("content", content);
        if (replyTo) formData.append("replyTo", replyTo._id);
        formData.append("clientId", clientId);
        files.forEach((file) => formData.append("media", file));
        res = await apiClient.post("/chat/message", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await apiClient.post("/chat/message", {
          chatId: chat._id,
          content,
          replyTo: replyTo ? replyTo._id : undefined,
          clientId,
        });
      }

      if (res.data.success) {
        const confirmed = res.data.data;
        // upsertMessage matches on clientId, so whichever of the HTTP response or
        // the socket broadcast (see useChatMessages' handleMessageReceived) lands
        // first reconciles the optimistic bubble — the other is then a no-op
        // update instead of a second, duplicate entry.
        if (Array.isArray(confirmed)) {
          setMessages((prev) => {
            let next = prev.filter((m) => m._id !== optimisticId);
            for (const msg of confirmed) next = upsertMessage(next, msg);
            return next;
          });
          if (onUpdateLastMessage && confirmed.length > 0) {
            onUpdateLastMessage(chat._id, confirmed[confirmed.length - 1]);
          }
        } else {
          setMessages((prev) => upsertMessage(prev, confirmed));
          if (onUpdateLastMessage) onUpdateLastMessage(chat._id, confirmed);
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error.response?.data || error.message);
      toast.error(error.response?.data?.message || "Message not sent");
      setMessages((prev) =>
        prev.map((m) => (m._id === optimisticId ? { ...m, status: "failed" } : m))
      );
    } finally {
      setIsSending(false);
    }
  };

  // Latest-closure refs so the memoized message rows get stable callbacks.
  const sendPayloadRef = useRef(sendPayload);
  const handleSendAudioFileRef = useRef(handleSendAudioFile);
  useEffect(() => {
    sendPayloadRef.current = sendPayload;
    handleSendAudioFileRef.current = handleSendAudioFile;
  });

  // Tapping a reply's quote: same load-older-until-found jump as the pinned
  // banner and search. Stable identity so memoized rows don't re-render.
  const handleJumpToReply = useCallback((messageId) => setJumpTargetId(messageId), []);

  const handleDiscardFailed = useCallback(
    (msg) => {
      setMessages((prev) => prev.filter((m) => m._id !== msg._id));
      if (msg.mediaType === "audio" && msg.media?.startsWith("blob:")) URL.revokeObjectURL(msg.media);
    },
    [setMessages]
  );

  const handleRetryFailed = useCallback(
    (msg) => {
      const payload = msg.retryPayload;
      if (!payload) return;
      setMessages((prev) => prev.filter((m) => m._id !== msg._id));
      if (payload.kind === "audio") {
        handleSendAudioFileRef.current(payload.file);
      } else {
        sendPayloadRef.current(payload, msg.clientId);
      }
    },
    [setMessages]
  );

  // Forward message handler — supports multiple target chats (WhatsApp-style)
  const handleConfirmForward = async (targetChatIds) => {
    const targets = Array.isArray(targetChatIds) ? targetChatIds : [targetChatIds];
    if (targets.length === 0 || selectedMessageIds.length === 0) return;

    // Chronological order: Sort selectedMessageIds based on original messages' createdAt
    const sortedMessageIds = [...selectedMessageIds].sort((a, b) => {
      const msgA = messages.find((m) => m._id === a);
      const msgB = messages.find((m) => m._id === b);
      if (!msgA || !msgB) return 0;
      return new Date(msgA.createdAt).getTime() - new Date(msgB.createdAt).getTime();
    });

    try {
      let successCount = 0;
      for (const targetChatId of targets) {
        const res = await apiClient.post("/chat/message/forward", {
          messageIds: sortedMessageIds,
          targetChatId,
        });
        if (res.data.success) {
          successCount++;
          // Server broadcasts "message received" for each forwarded message.
        }
      }
      if (successCount > 0) {
        toast.success(
          `${sortedMessageIds.length} message${sortedMessageIds.length > 1 ? "s" : ""} forwarded to ${successCount} chat${successCount > 1 ? "s" : ""}`
        );
        setSelectedMessageIds([]);
        setIsForwardModalOpen(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to forward messages");
    }
  };

  // Derived variables for menus
  const activeMenuMessage = activeMenuMessageId
    ? messages.find((m) => m._id === activeMenuMessageId)
    : null;

  const activeMenuIsPinned = Boolean(activeMenuMessage && pinnedIds.has(String(activeMenuMessage._id)));

  const activeMenuIsStarred = Boolean(
    activeMenuMessage && starredMessageIds.includes(activeMenuMessage._id)
  );

  const activeMenuIsSent =
    activeMenuMessage &&
    (activeMenuMessage.sender?._id || activeMenuMessage.sender)?.toString() ===
      currentUser?._id?.toString();

  const handleToggleStar = useCallback(
    (msgId) => {
      setStarredMessageIds((prev) => {
        const isStarred = prev.includes(msgId);
        const next = isStarred
          ? prev.filter((id) => id !== msgId)
          : [...prev, msgId];
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem(
              `linklet_starred_msgs_${currentUser?._id}`,
              JSON.stringify(next)
            );

            // Sync starred chat media (only attachments, not plain messages) into saved section
            const msg = messages.find((m) => m._id === msgId);
            if (
              msg &&
              (msg.media ||
                ["image", "video", "document", "audio"].includes(msg.mediaType))
            ) {
              const savedMediaKey = `linklet_starred_chat_media_${currentUser?._id}`;
              const existingRaw = localStorage.getItem(savedMediaKey);
              const existingMedia = existingRaw ? JSON.parse(existingRaw) : [];
              let updatedMedia;
              if (isStarred) {
                // unstarring: remove
                updatedMedia = existingMedia.filter((item) => item._id !== msgId);
              } else {
                // starring: add attachment
                const otherUser = chat.isGroup
                  ? null
                  : chat.participants?.find(
                      (p) =>
                        (p._id || p)?.toString() !== currentUser?._id?.toString()
                    );
                const chatName = chat.isGroup
                  ? chat.chatName
                  : otherUser?.fullName || otherUser?.username || "Chat";
                const newItem = {
                  _id: msg._id,
                  chatId: chat._id,
                  chatName,
                  media: msg.media,
                  mediaType: msg.mediaType || "image",
                  content: msg.content || "",
                  sender: msg.sender,
                  createdAt: msg.createdAt,
                };
                updatedMedia = [
                  newItem,
                  ...existingMedia.filter((item) => item._id !== msgId),
                ];
              }
              localStorage.setItem(savedMediaKey, JSON.stringify(updatedMedia));
            }
          }
        } catch {}
        toast.success(isStarred ? "Message unstarred" : "Message starred");
        return next;
      });
    },
    [currentUser?._id, messages, chat]
  );

  const handleConfirmReport = useCallback(async () => {
    if (!reportingMessage) return;
    try {
      await apiClient.post("/chat/message/report", {
        messageId: reportingMessage._id,
        chatId: chat._id,
        senderId: reportingMessage.sender?._id || reportingMessage.sender,
        messageContent: reportingMessage.content || "",
        reason: "Reported by user",
      });
      toast.success("Message reported to moderators for review. Thank you.");
    } catch {
      toast.error("Failed to submit report. Please try again.");
    }
    setReportingMessage(null);
  }, [reportingMessage, chat._id]);

  // Pins may arrive as bare ids (optimistic, or an unpopulated payload) —
  // resolve them against loaded messages so the banner can show a preview.
  const resolvedPins = useMemo(
    () =>
      pinnedMessages.map((p) => {
        const id = String(p?._id || p);
        if (p && typeof p === "object" && (p.content || p.media)) return p;
        return messages.find((m) => String(m._id) === id) || { _id: id };
      }),
    [pinnedMessages, messages]
  );

  const handleTogglePin = useCallback(
    async (messageId, isPinned) => {
      const previous = pinnedRef.current;
      const msg = messagesRef.current.find((m) => m._id === messageId);
      const optimistic = isPinned
        ? previous.filter((p) => String(p?._id || p) !== String(messageId))
        : [...previous.filter((p) => String(p?._id || p) !== String(messageId)), msg || { _id: messageId }];
      applyPinned(optimistic);

      const updated = await togglePin(messageId, isPinned);
      if (updated && Array.isArray(updated.pinnedMessages)) {
        applyPinned(updated.pinnedMessages);
        toast.success(isPinned ? "Message unpinned" : "Message pinned", { duration: 1500 });
      } else if (!updated) {
        applyPinned(previous);
      }
    },
    [togglePin, applyPinned]
  );

  // One boolean for the whole list instead of handing every (memoized) row
  // the onlineUsers array, which changes on every presence event.
  const isRecipientOnline = useMemo(() => {
    const me = currentUser?._id?.toString();
    return (chat?.participants || []).some((p) => {
      const pid = (p?._id || p)?.toString();
      return pid && pid !== me && onlineUsers.includes(pid);
    });
  }, [chat?.participants, onlineUsers, currentUser?._id]);
  const readTarget = chat?.isGroup ? Math.max(2, chat.participants?.length || 2) : 2;

  return (
    <div className="chat-window relative bg-gray-950 flex flex-col h-full">
      {/* Header: Multi-Selection Bar OR Normal Header */}
      {selectedMessageIds.length > 0 ? (
        <ChatSelectionBar
          selectedCount={selectedMessageIds.length}
          onClearSelection={() => setSelectedMessageIds([])}
          onForward={() => setIsForwardModalOpen(true)}
          onDelete={() => setDeletingMessageId("BULK")}
        />
      ) : (
        <ChatHeader
          chat={chat}
          currentUser={currentUser}
          onlineUsers={onlineUsers}
          lastSeenMap={lastSeenMap}
          typingUsers={typingUsers}
          onToggleInfo={onToggleInfo}
          onBackToSidebar={onBackToSidebar}
          isSearchOpen={isSearchOpen}
          onToggleSearch={() => (isSearchOpen ? closeSearch() : setIsSearchOpen(true))}
        />
      )}

      {/* In-Chat Search Bar */}
      <InChatSearchBar
        isOpen={isSearchOpen}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        matchCount={matchCount}
        currentMatchIndex={currentMatchIndex}
        isSearching={isSearching}
        hasSearched={hasSearched}
        onOlderMatch={olderMatch}
        onNewerMatch={newerMatch}
        onClose={closeSearch}
      />

      {/* Pinned Messages Banner */}
      <PinnedMessageBanner
        pinnedMessages={resolvedPins}
        onJumpToPinned={(id) => setJumpTargetId(id)}
        onUnpin={(id) => handleTogglePin(id, true)}
      />

      {/* Messages Feed */}
      <ChatMessagesList
        messages={messages}
        currentUser={currentUser}
        chat={chat}
        isRecipientOnline={isRecipientOnline}
        readTarget={readTarget}
        unreadAnchorId={unreadAnchor?.id || null}
        unreadCount={unreadAnchor?.count || 0}
        loadingInitial={loadingInitial}
        loadingOlder={loadingOlder}
        hasMore={hasMore}
        onLoadOlder={handleLoadOlderClick}
        onScroll={handleMessagesScroll}
        chatContainerRef={chatContainerRef}
        messagesEndRef={messagesEndRef}
        selectedMessageIds={selectedMessageIds}
        starredMessageIds={starredMessageIds}
        activeMenuMessageId={activeMenuMessageId}
        activeReactionMessageId={activeReactionMessageId}
        searchQuery={highlightQuery}
        activeMatchId={activeMatchId}
        pinnedIds={pinnedIds}
        audioPlaybackState={audioPlaybackState}
        onToggleSelect={toggleSelectMessage}
        onOpenReaction={handleOpenReaction}
        onOpenMenu={handleOpenMenu}
        onToggleReaction={toggleReaction}
        onToggleAudioPlay={toggleAudioPlay}
        onSeekAudio={seekAudio}
        onOpenLightbox={setLightboxMedia}
        onRetryFailed={handleRetryFailed}
        onDiscardFailed={handleDiscardFailed}
        onJumpToMessage={handleJumpToReply}
      />

      {/* Floating Scroll-to-Bottom Button */}
      <ScrollToBottomButton
        isVisible={showScrollBottom}
        unreadCount={scrolledUnreadCount}
        onClick={() => scrollToBottom("smooth")}
      />

      {/* Composer Container */}
      {isBlocked ? (
        <div className="p-4 bg-gray-950/90 border-t border-gray-800/80 backdrop-blur-md flex items-center justify-center gap-2.5 text-sm text-gray-400">
          <span className="material-icons text-rose-400 text-base">block</span>
          <span>You have blocked this contact. Unblock them from the sidebar menu to send messages.</span>
        </div>
      ) : (
        <ChatComposer
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          selectedFiles={selectedFiles}
          filePreviews={filePreviews}
          replyingTo={replyingTo}
          editingMessage={editingMessage}
          isRecordingAudio={isRecordingAudio}
          recordingSeconds={recordingSeconds}
          isEmojiPickerOpen={isEmojiPickerOpen}
          setIsEmojiPickerOpen={setIsEmojiPickerOpen}
          isSending={isSending}
          onSendMessage={handleSendMessage}
          onFileSelect={handleFileSelect}
          onRemoveFile={handleRemoveFile}
          onCancelReply={() => setReplyingTo(null)}
          onCancelEdit={() => {
            setEditingMessage(null);
            setNewMessage("");
          }}
          onTyping={(e) => {
            setNewMessage(e.target.value);
            emitTypingActivity();
          }}
          onStartRecordAudio={startRecordingAudio}
          onCancelRecordAudio={cancelRecordingAudio}
          onStopAndSendAudio={stopAndSendAudio}
        />
      )}

      {/* Floating Quick Reaction Picker */}
      <ReactionPickerBar
        activeMessageId={activeReactionMessageId}
        position={reactionPosition}
        onSelectEmoji={(msgId, emoji) => {
          toggleReaction(msgId, emoji);
          setActiveReactionMessageId(null);
        }}
      />

      {/* Floating Message Context Menu */}
      <MessageContextMenu
        activeMessage={activeMenuMessage}
        position={menuPosition}
        isPinned={activeMenuIsPinned}
        isSent={activeMenuIsSent}
        isStarred={activeMenuIsStarred}
        onReply={(msg) => {
          setReplyingTo(msg);
          setEditingMessage(null);
          setTimeout(() => {
            document.querySelector(".chat-input")?.focus();
          }, 50);
        }}
        onTogglePin={handleTogglePin}
        onToggleStar={handleToggleStar}
        onForward={(msg) => {
          setSelectedMessageIds([msg._id]);
          setActiveMenuMessageId(null);
        }}
        onSelectMessage={handleSelectMessageFromMenu}
        onEdit={(msg) => {
          setEditingMessage(msg);
          setNewMessage(msg.content || "");
          setReplyingTo(null);
          setTimeout(() => {
            document.querySelector(".chat-input")?.focus();
          }, 50);
        }}
        onReport={(msg) => setReportingMessage(msg)}
        onDelete={(msgId) => setDeletingMessageId(msgId)}
        onClose={() => setActiveMenuMessageId(null)}
      />

      {/* Media Lightbox Modal */}
      <MediaLightboxModal
        media={lightboxMedia}
        onClose={() => setLightboxMedia(null)}
      />

      {/* Report Confirmation Modal */}
      {reportingMessage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setReportingMessage(null)}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-amber-400">
              <span className="material-icons text-2xl">report_problem</span>
              <h3 className="text-lg font-semibold text-fg">Report Message</h3>
            </div>
            <p className="text-sm text-gray-300">
              Are you sure you want to report this message? The message and author will be flagged for review by moderators.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReportingMessage(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-fg bg-gray-800/60 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReport}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-amber-700 hover:bg-amber-600 transition-colors flex items-center gap-1.5"
              >
                <span className="material-icons text-base">flag</span>
                Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {(() => {
        const activeDeletingMsg =
          deletingMessageId && deletingMessageId !== "BULK"
            ? messages.find((m) => m._id === deletingMessageId)
            : null;
        const isDeletingSentByMe =
          activeDeletingMsg &&
          (activeDeletingMsg.sender?._id || activeDeletingMsg.sender)?.toString() ===
            currentUser?._id?.toString();

        return (
          <ConfirmDeleteModal
            isOpen={!!deletingMessageId}
            title={
              deletingMessageId === "BULK"
                ? "Delete Messages"
                : isDeletingSentByMe
                ? "Delete Message"
                : "Delete Message for You"
            }
            message={
              deletingMessageId === "BULK"
                ? `Delete ${selectedMessageIds.length} selected message${selectedMessageIds.length === 1 ? "" : "s"}? Yours are deleted for everyone; other people's are removed from your view only.`
                : isDeletingSentByMe
                ? "Are you sure you want to delete this message? This action cannot be undone."
                : "Delete this message from your view? Other participants will still be able to see it."
            }
            confirmText="Delete"
            onConfirm={() => {
              if (deletingMessageId === "BULK") {
                bulkDeleteMessages(selectedMessageIds);
                setSelectedMessageIds([]);
              } else if (deletingMessageId) {
                if (isDeletingSentByMe) {
                  deleteMessage(deletingMessageId);
                } else {
                  hideMessageForMe(deletingMessageId);
                }
              }
              setDeletingMessageId(null);
            }}
            onCancel={() => setDeletingMessageId(null)}
          />
        );
      })()}

      {/* Forward Message Modal */}
      <ForwardMessageModal
        isOpen={isForwardModalOpen}
        chats={allChats}
        selectedMessageCount={selectedMessageIds.length}
        onConfirmForward={handleConfirmForward}
        onClose={() => setIsForwardModalOpen(false)}
      />
    </div>
  );
};

export default ChatWindow;
