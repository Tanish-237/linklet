import React, { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { apiClient } from "../../../api/apiClient";
import { optimizeImage, getVideoThumbnail } from "../../../utlis/cloudinary";
import MediaLightboxModal from "../modals/MediaLightboxModal";

const KINDS = [
  { id: "media", label: "Media", empty: "No photos or videos yet", icon: "photo_library" },
  { id: "docs", label: "Docs", empty: "No documents yet", icon: "description" },
  { id: "audio", label: "Voice", empty: "No voice messages yet", icon: "mic_none" },
];

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

const monthLabel = (date) => {
  const d = new Date(date);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return "This month";
  return monthFormatter.format(d);
};

/** Group newest-first items into [{ label, items }] by calendar month. */
const groupByMonth = (items) => {
  const groups = [];
  for (const item of items) {
    const label = monthLabel(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
};

const extensionOf = (item) => {
  const source = item.fileName || item.media || "";
  const match = source.split("?")[0].match(/\.([a-z0-9]{1,6})$/i);
  return match ? match[1].toLowerCase() : "";
};

const DOC_STYLES = {
  pdf: { icon: "picture_as_pdf", tone: "doc-tone-red" },
  doc: { icon: "description", tone: "doc-tone-blue" },
  docx: { icon: "description", tone: "doc-tone-blue" },
  txt: { icon: "article", tone: "doc-tone-slate" },
  xls: { icon: "table_chart", tone: "doc-tone-green" },
  xlsx: { icon: "table_chart", tone: "doc-tone-green" },
  csv: { icon: "table_chart", tone: "doc-tone-green" },
  ppt: { icon: "slideshow", tone: "doc-tone-orange" },
  pptx: { icon: "slideshow", tone: "doc-tone-orange" },
  zip: { icon: "folder_zip", tone: "doc-tone-amber" },
  rar: { icon: "folder_zip", tone: "doc-tone-amber" },
};

const docTitle = (item) => {
  if (item.fileName) return item.fileName;
  if (item.content) return item.content;
  const ext = extensionOf(item);
  return ext ? `${ext.toUpperCase()} document` : "Document";
};

const senderName = (item) => item.sender?.fullName || item.sender?.username || "Someone";

/**
 * Everything shared in a chat, loaded page by page from the server (only
 * attachments — not the whole message history), newest first and grouped by
 * month. Photos/videos open in the chat's lightbox; every item can jump to
 * its message in the conversation.
 */
const ChatMediaGallery = ({ chatId, onJumpToMessage }) => {
  const [kind, setKind] = useState("media");
  const [pages, setPages] = useState({}); // kind -> { items, nextCursor, hasMore, status }
  const [lightbox, setLightbox] = useState(null); // { url, type, messageId }
  const requestRef = useRef({});

  const state = pages[kind] || { items: [], nextCursor: null, hasMore: true, status: "idle" };

  const load = useCallback(
    async (targetKind, { reset = false } = {}) => {
      const current = pages[targetKind];
      if (!reset && (current?.status === "loading" || current?.hasMore === false)) return;
      const cursor = reset ? null : current?.nextCursor || null;
      const token = Symbol(targetKind);
      requestRef.current[targetKind] = token;

      setPages((prev) => ({
        ...prev,
        [targetKind]: { ...(reset ? { items: [] } : prev[targetKind] || { items: [] }), status: "loading" },
      }));

      try {
        const res = await apiClient.get(`/chat/message/media/${chatId}`, {
          params: { kind: targetKind, ...(cursor ? { cursor } : {}) },
        });
        if (requestRef.current[targetKind] !== token) return;
        const { items = [], nextCursor = null, hasMore = false } = res?.data?.data || {};
        setPages((prev) => {
          const existing = reset ? [] : prev[targetKind]?.items || [];
          const seen = new Set(existing.map((i) => i._id));
          return {
            ...prev,
            [targetKind]: {
              items: [...existing, ...items.filter((i) => !seen.has(i._id))],
              nextCursor,
              hasMore,
              status: "done",
            },
          };
        });
      } catch {
        if (requestRef.current[targetKind] !== token) return;
        setPages((prev) => ({
          ...prev,
          [targetKind]: { ...(prev[targetKind] || { items: [] }), status: "error" },
        }));
      }
    },
    [chatId, pages]
  );

  // First visit to a tab loads its first page
  useEffect(() => {
    if (!pages[kind]) load(kind, { reset: true });
  }, [kind, pages, load]);

  // A different chat: start over (not on mount — that would wipe the first
  // load and fire it twice)
  const loadedChatIdRef = useRef(chatId);
  useEffect(() => {
    if (loadedChatIdRef.current === chatId) return;
    loadedChatIdRef.current = chatId;
    requestRef.current = {};
    setPages({});
    setLightbox(null);
  }, [chatId]);

  const { ref: sentinelRef, inView } = useInView({ rootMargin: "200px" });
  useEffect(() => {
    if (inView && state.status === "done" && state.hasMore) load(kind);
  }, [inView, state.status, state.hasMore, kind, load]);

  const activeKind = KINDS.find((k) => k.id === kind);
  const isFirstLoad = state.status === "loading" && state.items.length === 0;

  return (
    <div className="chat-media-gallery">
      <div className="chat-media-tabs" role="tablist" aria-label="Shared content">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="tab"
            aria-selected={kind === k.id}
            className={kind === k.id ? "is-active" : ""}
            onClick={() => setKind(k.id)}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="chat-media-body" role="tabpanel">
        {isFirstLoad ? (
          kind === "media" ? (
            <div className="chat-media-grid" aria-busy="true" aria-label="Loading">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="chat-media-tile is-skeleton" />
              ))}
            </div>
          ) : (
            <div className="chat-media-list" aria-busy="true" aria-label="Loading">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="chat-media-row is-skeleton" />
              ))}
            </div>
          )
        ) : state.status === "error" && state.items.length === 0 ? (
          <div className="chat-media-empty">
            <span className="material-icons">cloud_off</span>
            <p>Couldn&apos;t load shared {activeKind.label.toLowerCase()}.</p>
            <button type="button" className="chat-media-retry" onClick={() => load(kind, { reset: true })}>
              Try again
            </button>
          </div>
        ) : state.items.length === 0 && state.status === "done" ? (
          <div className="chat-media-empty">
            <span className="material-icons">{activeKind.icon}</span>
            <p>{activeKind.empty}</p>
          </div>
        ) : (
          groupByMonth(state.items).map((group) => (
            <section key={group.label} className="chat-media-section">
              <h6 className="chat-media-month">{group.label}</h6>

              {kind === "media" && (
                <div className="chat-media-grid">
                  {group.items.map((item) => {
                    const isVideo = item.mediaType === "video";
                    const thumb = isVideo
                      ? getVideoThumbnail(item.media)
                      : optimizeImage(item.media, { width: 240, height: 240, crop: "fill" });
                    return (
                      <button
                        key={item._id}
                        type="button"
                        className="chat-media-tile"
                        onClick={() => setLightbox({ url: item.media, type: isVideo ? "video" : "image", messageId: item._id })}
                        aria-label={`${isVideo ? "Video" : "Photo"} from ${senderName(item)}, ${dayFormatter.format(new Date(item.createdAt))}`}
                      >
                        {thumb ? (
                          <img src={thumb} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <video src={item.media} preload="metadata" muted />
                        )}
                        {isVideo && (
                          <span className="chat-media-video-badge" aria-hidden="true">
                            <span className="material-icons">play_arrow</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {kind === "docs" && (
                <ul className="chat-media-list">
                  {group.items.map((item) => {
                    const ext = extensionOf(item);
                    const style = DOC_STYLES[ext] || { icon: "insert_drive_file", tone: "doc-tone-slate" };
                    return (
                      <li key={item._id} className="chat-media-row">
                        <span className={`chat-doc-icon ${style.tone}`} aria-hidden="true">
                          <span className="material-icons">{style.icon}</span>
                        </span>
                        <a
                          className="chat-doc-main"
                          href={item.media}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Open ${docTitle(item)}`}
                        >
                          <span className="chat-doc-name">{docTitle(item)}</span>
                          <span className="chat-doc-meta">
                            {ext && <span className="chat-doc-ext">{ext.toUpperCase()}</span>}
                            {dayFormatter.format(new Date(item.createdAt))} · {senderName(item)}
                          </span>
                        </a>
                        {onJumpToMessage && (
                          <button
                            type="button"
                            className="chat-media-row-action"
                            onClick={() => onJumpToMessage(item._id)}
                            title="Show in chat"
                            aria-label="Show in chat"
                          >
                            <span className="material-icons">forum</span>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {kind === "audio" && (
                <ul className="chat-media-list">
                  {group.items.map((item) => (
                    <li key={item._id} className="chat-media-row chat-voice-row">
                      <div className="chat-voice-head">
                        <span className="chat-doc-icon doc-tone-accent" aria-hidden="true">
                          <span className="material-icons">mic</span>
                        </span>
                        <span className="chat-doc-main">
                          <span className="chat-doc-name">{senderName(item)}</span>
                          <span className="chat-doc-meta">{dayFormatter.format(new Date(item.createdAt))}</span>
                        </span>
                        {onJumpToMessage && (
                          <button
                            type="button"
                            className="chat-media-row-action"
                            onClick={() => onJumpToMessage(item._id)}
                            title="Show in chat"
                            aria-label="Show in chat"
                          >
                            <span className="material-icons">forum</span>
                          </button>
                        )}
                      </div>
                      <audio controls preload="none" src={item.media} className="chat-voice-audio" />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))
        )}

        {state.items.length > 0 && state.hasMore && (
          <div ref={sentinelRef} className="chat-media-more" aria-live="polite">
            {state.status === "loading" ? (
              <span className="inchat-search-spinner" aria-label="Loading more" />
            ) : state.status === "error" ? (
              <button type="button" className="chat-media-retry" onClick={() => load(kind)}>
                Couldn&apos;t load more — retry
              </button>
            ) : null}
          </div>
        )}
      </div>

      <MediaLightboxModal
        media={lightbox}
        onClose={() => setLightbox(null)}
        onShowInChat={
          onJumpToMessage && lightbox
            ? () => {
                const id = lightbox.messageId;
                setLightbox(null);
                onJumpToMessage(id);
              }
            : undefined
        }
      />
    </div>
  );
};

export default ChatMediaGallery;
