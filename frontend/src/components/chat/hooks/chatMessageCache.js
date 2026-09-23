import { apiClient } from "../../../api/apiClient";
import { upsertMessage } from "./upsertMessage";

/**
 * In-memory cache of the latest page of messages per chat, shared by every
 * ChatWindow for the lifetime of the page. Switching back to a chat renders
 * straight from here — no localStorage parse, no skeleton — while the window
 * revalidates in the background.
 *
 * ChatPage feeds every incoming socket message into it (the user's personal
 * room receives messages for all their chats), so an entry stays current even
 * while its chat isn't open. Hovering a chat in the sidebar prefetches it.
 */
const MAX_CACHED_MESSAGES = 60;
const PREFETCH_FRESH_MS = 60 * 1000;

const cache = new Map(); // chatId -> { messages, hasMore, nextCursor, fetchedAt }
const inflight = new Map(); // chatId -> Promise

export const getCachedChat = (chatId) => (chatId ? cache.get(String(chatId)) || null : null);

export const setCachedChat = (chatId, { messages, hasMore, nextCursor, fetchedAt }) => {
  if (!chatId || !Array.isArray(messages)) return;
  const key = String(chatId);
  const prev = cache.get(key);
  const confirmed = messages.filter((m) => !String(m._id).startsWith("opt_"));
  const trimmed = confirmed.slice(-MAX_CACHED_MESSAGES);
  cache.set(key, {
    messages: trimmed,
    // If older messages were trimmed off, the cached page no longer reaches
    // back to the stored cursor — drop it and let the window refetch it.
    hasMore: trimmed.length < confirmed.length ? true : hasMore ?? prev?.hasMore ?? false,
    nextCursor: trimmed.length < confirmed.length ? null : nextCursor ?? prev?.nextCursor ?? null,
    fetchedAt: fetchedAt ?? prev?.fetchedAt ?? 0,
  });
};

/** Apply a live message to a cached chat (no-op if the chat isn't cached yet). */
export const applyIncomingMessage = (message) => {
  const chatId = (message?.chat?._id || message?.chat)?.toString();
  const entry = getCachedChat(chatId);
  if (!entry) return;
  setCachedChat(chatId, { ...entry, messages: upsertMessage(entry.messages, message) });
};

/** Warm the cache for a chat the user is about to open (sidebar hover). */
const prefetchChat = (chatId) => {
  if (!chatId) return Promise.resolve();
  const key = String(chatId);
  const entry = cache.get(key);
  if (entry && Date.now() - entry.fetchedAt < PREFETCH_FRESH_MS) return Promise.resolve();
  if (inflight.has(key)) return inflight.get(key);

  const request = apiClient
    .get(`/chat/message/${key}`, { params: { limit: 25 } })
    .then((res) => {
      if (res?.data?.success) {
        const { messages, hasMore, nextCursor } = res.data.data;
        setCachedChat(key, { messages, hasMore, nextCursor, fetchedAt: Date.now() });
      }
    })
    .catch(() => {})
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
};

/**
 * Hover-intent prefetch: only fires if the pointer rests on a chat for a
 * moment, so sweeping down the list doesn't fetch every row it crosses.
 * Pass null to cancel (pointer left the row).
 */
let pendingPrefetch = null;
export const prefetchChatOnIntent = (chatId, delayMs = 120) => {
  clearTimeout(pendingPrefetch);
  pendingPrefetch = null;
  if (!chatId) return;
  pendingPrefetch = setTimeout(() => {
    pendingPrefetch = null;
    prefetchChat(chatId);
  }, delayMs);
};

/** Forget everything (sign-out). */
export const clearChatMessageCache = () => {
  cache.clear();
  inflight.clear();
};

if (typeof window !== "undefined") {
  window.addEventListener("linklet:signed-out", clearChatMessageCache);
}
