import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { apiClient } from "../api/apiClient";
import { deleteCollection, toggleResourceInCollection, createCollection } from "../api/collection.api";
import PreviewModal, { getFileIcon } from "../components/PreviewModal";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import PostDetailModal from "../components/PostDetailModal";
import { PostGrid, PostGridCard } from "../components/PostGridCard";
import { isSafeHttpUrl } from "../utlis/safeUrl";
import { downloadFile } from "../utlis/download";
import { useAuth } from "../context/AuthContext";
import useThemeStore from "../theme/useThemeStore";
import { getVideoThumbnail } from "../utlis/cloudinary";
import useCachedState from "../hooks/useCachedState";
import { savedBookmarksQuery, savedCollectionsQuery } from "../api/pageQueries";
import "./Saved.css";

const timeAgo = (d) => {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const EMPTY = [];

/* ─────────────── Saved page component ─────────────── */
export default function Saved({ username }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwnProfile = !username;
  // Cached per user, so coming back to Saved renders instantly instead of
  // re-fetching behind a skeleton every time.
  const [savedResources, setSavedResources, savedQuery] = useCachedState({
    ...savedBookmarksQuery(user?._id, username),
    initialValue: EMPTY,
  });
  const [collections, setCollections, collectionsQuery] = useCachedState({
    ...savedCollectionsQuery(user?._id),
    initialValue: EMPTY,
    enabled: Boolean(user?._id) && isOwnProfile,
  });
  // Only for opening a single collection's details below.
  const [loading, setLoading] = useState(false);
  const initialLoading = savedQuery.isPending || (isOwnProfile && collectionsQuery.isPending);
  const loadError = savedQuery.isError || collectionsQuery.isError;
  useEffect(() => {
    if (loadError) toast.error("Failed to load saved items");
  }, [loadError]);
  const [previewResource, setPreviewResource] = useState(null);
  const [previewChatMedia, setPreviewChatMedia] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [activeCollection, setActiveCollection] = useState(null); // null = overview, "all" = Saved Resources, "posts" = Saved Posts, "chatMedia" = Starred Chat Attachments, or collection Object
  const [collectionResources, setCollectionResources] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [starredChatMedia, setStarredChatMedia] = useState([]);
  const [mediaFilter, setMediaFilter] = useState("all");

  // Called straight from the tap — phones drop a download started after an await.
  const handleDownloadChatMedia = (item) => {
    if (!item?.media) return;
    downloadFile(item.media, item.fileName);
  };

  const handleUnstarMedia = (mediaId) => {
    if (!user?._id) return;
    const key = `linklet_starred_chat_media_${user._id}`;
    const starredMsgKey = `linklet_starred_msgs_${user._id}`;
    try {
      const updated = starredChatMedia.filter((m) => m._id !== mediaId);
      localStorage.setItem(key, JSON.stringify(updated));
      setStarredChatMedia(updated);
      const rawMsgs = localStorage.getItem(starredMsgKey);
      const starredMsgs = rawMsgs ? JSON.parse(rawMsgs) : [];
      localStorage.setItem(starredMsgKey, JSON.stringify(starredMsgs.filter((id) => id !== mediaId)));
      toast.success("Media unstarred");
    } catch {
      toast.error("Failed to unstar");
    }
  };

  const loadStarredChatMedia = () => {
    if (!user?._id) return;
    try {
      const raw = localStorage.getItem(`linklet_starred_chat_media_${user._id}`);
      setStarredChatMedia(raw ? JSON.parse(raw) : []);
    } catch {
      setStarredChatMedia([]);
    }
  };

  useEffect(() => {
    loadStarredChatMedia();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const savedPosts = savedResources.filter((item) => item.category === "Post");
  const savedResourceItems = savedResources.filter((item) => item.category !== "Post");

  const loadCollectionResources = async (collection) => {
    if (collection === "posts") {
      setActiveCollection("posts");
      setCollectionResources(savedPosts);
      return;
    }
    if (collection === "all") {
      setActiveCollection("all");
      setCollectionResources(savedResourceItems);
      return;
    }
    if (collection === "chatMedia") {
      loadStarredChatMedia();
      setActiveCollection("chatMedia");
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.get(`/profile/collections/${collection._id}`);
      setActiveCollection(res.data.data);
      setCollectionResources(res.data.data.resources || []);
    } catch {
      toast.error("Failed to load collection details");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    try {
      const newCol = await createCollection({ name: newCollectionName.trim() });
      setCollections([newCol, ...collections]);
      setNewCollectionName("");
      setIsCreating(false);
      toast.success("Collection created");
    } catch {
      toast.error("Failed to create collection");
    }
  };

  const [deleteConfirmCollectionId, setDeleteConfirmCollectionId] = useState(null);

  const promptDeleteCollection = (e, id) => {
    e.stopPropagation();
    setDeleteConfirmCollectionId(id);
  };

  const handleConfirmDeleteCollection = async () => {
    if (!deleteConfirmCollectionId) return;
    try {
      await deleteCollection(deleteConfirmCollectionId);
      setCollections((p) => p.filter((c) => c._id !== deleteConfirmCollectionId));
      toast.success("Collection deleted");
    } catch {
      toast.error("Failed to delete collection");
    } finally {
      setDeleteConfirmCollectionId(null);
    }
  };

  const handleRemoveFromCollection = async (e, resourceId) => {
    e.stopPropagation();
    try {
      if (activeCollection === "all" || activeCollection === "posts") {
        await apiClient.post(`/profile/bookmarks/${resourceId}`);
        setCollectionResources((p) => p.filter((r) => r._id !== resourceId));
        setSavedResources((p) => p.filter((r) => r._id !== resourceId));
      } else {
        await toggleResourceInCollection(activeCollection._id, resourceId);
        setCollectionResources((p) => p.filter((r) => r._id !== resourceId));
        setCollections((p) => p.map(c => {
          if (c._id === activeCollection._id) {
            return { ...c, resources: c.resources.filter(r => (r._id || r) !== resourceId) };
          }
          return c;
        }));
      }
      toast("Removed from collection", { duration: 2000 });
    } catch {
      toast.error("Failed to remove item");
    }
  };

  const handleDownload = (resource) => {
    if (!isSafeHttpUrl(resource.fileUrl)) {
      toast.error("This resource's link is invalid and cannot be opened.");
      return;
    }
    downloadFile(resource.fileUrl, resource.title || resource.fileName);
    apiClient.patch(`/resources/${resource._id}/download`).catch(() => {});
  };

  const openPost = (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
  };

  const postModal = (
    <PostDetailModal
      isOpen={showPostModal}
      onClose={() => {
        setShowPostModal(false);
        setSelectedPost(null);
      }}
      post={selectedPost}
      user={user}
      onPostUpdated={(updated) => {
        const swap = (prev) => prev.map((p) => (p._id === updated._id ? updated : p));
        setCollectionResources(swap);
        setSavedResources(swap);
        setSelectedPost(updated);
      }}
    />
  );

  if (initialLoading && !activeCollection) {
    return (
      <div className="bm-container">
        <Helmet>
          <title>Saved Collections | Linklet</title>
        </Helmet>
        <div className="bm-header-row">
          <h2 className="bm-title">Your Collections</h2>
        </div>
        <div className="bm-collections-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bm-collection-card bm-skeleton-card">
              <div className="bm-collection-cover bm-skeleton-cover" />
              <div className="bm-collection-info">
                <div className="bm-skeleton-text title" />
                <div className="bm-skeleton-text subtitle" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 1. Another user's profile view (flat list of resources)
  if (!isOwnProfile) {
    return (
      <div className="bm-container">
        <Helmet>
          <title>{`${username ? `${username}'s Saves` : "Saved"} | Linklet`}</title>
        </Helmet>
        {savedResources.length === 0 ? (
          <div className="bm-empty">Nothing saved yet.</div>
        ) : (
          <>
            {/* Posts and files are different things — posts get the post
                card grid, files the resource list (a post rendered as a file
                row had no title and a pointless download button). */}
            {savedPosts.length > 0 && (
              <section className="bm-section">
                <h3 className="bm-section-title">
                  Posts <span className="bm-section-count">{savedPosts.length}</span>
                </h3>
                <SavedPostGrid posts={savedPosts} onOpen={openPost} />
              </section>
            )}
            {savedResourceItems.length > 0 && (
              <section className="bm-section">
                <h3 className="bm-section-title">
                  Resources <span className="bm-section-count">{savedResourceItems.length}</span>
                </h3>
                <div className="bm-list">
                  {savedResourceItems.map((r) => (
                    <ResourceListItem key={r._id} resource={r} onOpen={setPreviewResource} onDownload={handleDownload} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        {previewResource && <PreviewModal resource={previewResource} onClose={() => setPreviewResource(null)} />}
        {postModal}
      </div>
    );
  }

  // 2. Own Profile - Collection Overview
  if (!activeCollection) {
    return (
      <div className="bm-container">
        <Helmet>
          <title>Saved Collections | Linklet</title>
        </Helmet>
        <div className="bm-header-row">
          <h2 className="bm-title">Your Collections</h2>
          <button className="bm-btn-create" onClick={() => setIsCreating(!isCreating)}>
            <span className="material-icons" style={{ fontSize: '1.1rem' }}>{isCreating ? "close" : "add"}</span>
            {isCreating ? "Cancel" : "New Collection"}
          </button>
        </div>

        {isCreating && (
          <form className="bm-create-form" onSubmit={handleCreateCollection}>
            <input 
              type="text" 
              placeholder="Collection Name..." 
              value={newCollectionName}
              onChange={e => setNewCollectionName(e.target.value)}
              autoFocus
            />
            <button type="submit" disabled={!newCollectionName.trim()}>Create</button>
          </form>
        )}

        <div className="bm-collections-grid">
          {/* Saved Posts Collection Card */}
          <div className="bm-collection-card saved-posts-card" onClick={() => loadCollectionResources("posts")}>
            <div className="bm-collection-cover" style={{ background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)" }}>
              <span className="material-icons">article</span>
            </div>
            <div className="bm-collection-info">
              <h3>Saved Posts</h3>
              <p>{savedPosts.length} {savedPosts.length === 1 ? "post" : "posts"}</p>
            </div>
          </div>

          {/* Saved Resources Collection Card */}
          <div className="bm-collection-card all-saves" onClick={() => loadCollectionResources("all")}>
            <div className="bm-collection-cover">
              <span className="material-icons icon-filled">bookmark</span>
            </div>
            <div className="bm-collection-info">
              <h3>Saved Resources</h3>
              <p>{savedResourceItems.length} {savedResourceItems.length === 1 ? "resource" : "resources"}</p>
            </div>
          </div>

          {/* Starred Chat Media Collection Card */}
          {isOwnProfile && (
            <div className="bm-collection-card chat-media-card" onClick={() => loadCollectionResources("chatMedia")}>
              <div className="bm-collection-cover" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>
                <span className="material-icons icon-filled">star</span>
              </div>
              <div className="bm-collection-info">
                <h3>Starred Chat Media</h3>
                <p>{starredChatMedia.length} {starredChatMedia.length === 1 ? "item" : "items"}</p>
              </div>
            </div>
          )}

          {/* User Collections */}
          {collections.map((c) => (
            <div key={c._id} className="bm-collection-card" onClick={() => loadCollectionResources(c)}>
              <div className="bm-collection-cover" style={{ backgroundColor: c.coverColor }}>
                <span className="material-icons">folder</span>
                <button className="bm-del-btn" onClick={(e) => promptDeleteCollection(e, c._id)}>
                  <span className="material-icons">delete</span>
                </button>
              </div>
              <div className="bm-collection-info">
                <h3>{c.name}</h3>
                <p>{c.resources?.length || 0} resources</p>
              </div>
            </div>
          ))}
        </div>

        {previewResource && <PreviewModal resource={previewResource} onClose={() => setPreviewResource(null)} />}

        <ConfirmDeleteModal
          isOpen={deleteConfirmCollectionId != null}
          title="Delete Collection"
          message="Are you sure you want to delete this collection? Saved resources will NOT be lost."
          confirmText="Delete Collection"
          onConfirm={handleConfirmDeleteCollection}
          onCancel={() => setDeleteConfirmCollectionId(null)}
        />
      </div>
    );
  }

  // 3. Inside a Collection
  return (
    <div className="bm-container">
      <Helmet>
        <title>
          {activeCollection === "posts"
            ? "Saved Posts"
            : activeCollection === "all"
            ? "Saved Resources"
            : activeCollection === "chatMedia"
            ? "Starred Chat Media"
            : activeCollection.name}{" "}
          | Linklet
        </title>
      </Helmet>

      <div className="bm-header-row">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button className="bm-back-btn" onClick={() => setActiveCollection(null)}>
            <span className="material-icons">arrow_back</span>
          </button>
          <h2 className="bm-title">
            {activeCollection === "posts"
              ? "Saved Posts"
              : activeCollection === "all"
              ? "Saved Resources"
              : activeCollection === "chatMedia"
              ? "Starred Chat Media"
              : activeCollection.name}
          </h2>
        </div>
      </div>

      {/* Starred Chat Media View */}
      {activeCollection === "chatMedia" ? (
        starredChatMedia.length === 0 ? (
          <div className="bm-empty">
            <span className="material-icons" style={{ fontSize: "2.5rem", color: "rgb(var(--accent-fg))", marginBottom: "10px", display: "block" }}>star_outline</span>
            No starred chat media yet. Star images, videos, voice notes or documents in a chat to save them here.
          </div>
        ) : (
          <>
          <div className="bm-media-filters" role="tablist" aria-label="Filter starred media">
            {MEDIA_FILTERS.map((f) => {
              const count = f.id === "all"
                ? starredChatMedia.length
                : starredChatMedia.filter((m) => mediaKind(m) === f.id).length;
              if (f.id !== "all" && count === 0) return null;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={mediaFilter === f.id}
                  className={`bm-media-filter ${mediaFilter === f.id ? "active" : ""}`}
                  onClick={() => setMediaFilter(f.id)}
                >
                  <span className="material-icons">{f.icon}</span>
                  {f.label}
                  <span className="bm-media-filter-count">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="bm-chat-media-grid">
            {starredChatMedia
              .filter((m) => mediaFilter === "all" || mediaKind(m) === mediaFilter)
              .map((item) => (
              <ChatMediaCard
                key={item._id}
                item={item}
                onPreview={(m) => setPreviewChatMedia(m)}
                onDownload={(m) => handleDownloadChatMedia(m)}
                onJumpToMessage={(chatId, msgId) => navigate(`/chat?chatId=${chatId}&messageId=${msgId}`)}
                onUnstar={() => handleUnstarMedia(item._id)}
              />
            ))}
          </div>
          </>
        )
      ) : loading ? (
        <div className="bm-spinner" style={{ margin: "40px auto" }} />
      ) : collectionResources.length === 0 ? (
        <div className="bm-empty">This collection is empty.</div>
      ) : activeCollection === "posts" ? (
        <SavedPostGrid
          posts={collectionResources}
          onOpen={openPost}
          onRemove={isOwnProfile ? (e, id) => handleRemoveFromCollection(e, id) : undefined}
        />
      ) : (
        /* Regular list for resources */
        <div className="bm-list">
          {collectionResources.map((r) => (
            <ResourceListItem 
              key={r._id} 
              resource={r} 
              onOpen={setPreviewResource} 
              onDownload={handleDownload}
              onRemove={(e) => handleRemoveFromCollection(e, r._id)}
            />
          ))}
        </div>
      )}

      {previewResource && <PreviewModal resource={previewResource} onClose={() => setPreviewResource(null)} />}

      {postModal}

      {/* Starred Chat Media Lightbox / Preview Modal */}
      {previewChatMedia && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setPreviewChatMedia(null)}
        >
          <div
            className="relative bg-gray-900 border border-violet-500/20 rounded-2xl max-w-2xl w-full p-5 shadow-2xl overflow-hidden flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full pb-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="material-icons icon-filled text-amber-400">star</span>
                <span className="text-white font-medium text-sm">
                  {previewChatMedia.chatName || "Starred Media"}
                </span>
                <span className="text-gray-400 text-xs">
                  {timeAgo(previewChatMedia.createdAt)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewChatMedia(null)}
                className="text-gray-400 hover:text-white transition-colors p-1"
                aria-label="Close"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            {/* Media Content */}
            <div className="w-full flex items-center justify-center max-h-[60dvh] overflow-auto rounded-xl bg-black/40 p-2">
              {previewChatMedia.mediaType === "image" ? (
                <img loading="lazy" decoding="async"
                  src={previewChatMedia.media}
                  alt="Starred media"
                  className="max-h-[55dvh] max-w-full object-contain rounded-lg shadow-lg"
                />
              ) : previewChatMedia.mediaType === "video" ? (
                <video
                  src={previewChatMedia.media}
                  controls
                  autoPlay
                  className="max-h-[55dvh] max-w-full rounded-lg shadow-lg"
                />
              ) : previewChatMedia.mediaType === "audio" ? (
                <audio
                  src={previewChatMedia.media}
                  controls
                  autoPlay
                  className="w-full my-4"
                />
              ) : (
                <div className="py-12 flex flex-col items-center gap-3 text-gray-300">
                  <span className="material-icons text-5xl text-violet-400">
                    insert_drive_file
                  </span>
                  <span className="text-sm text-center break-all px-6">{mediaFileName(previewChatMedia)}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 w-full pt-2">
              <button
                type="button"
                onClick={() => {
                  const id = previewChatMedia._id;
                  setPreviewChatMedia(null);
                  handleUnstarMedia(id);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors border border-red-500/20"
              >
                <span className="material-icons text-base">star_border</span>
                Unstar
              </button>
              {previewChatMedia.media && (
                <button
                  type="button"
                  onClick={() => handleDownloadChatMedia(previewChatMedia)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium transition-colors border border-gray-700"
                >
                  <span className="material-icons text-base">file_download</span>
                  Download
                </button>
              )}
              {previewChatMedia.chatId && (
                <button
                  type="button"
                  onClick={() => {
                    const { chatId, _id } = previewChatMedia;
                    setPreviewChatMedia(null);
                    navigate(`/chat?chatId=${chatId}&messageId=${_id}`);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors shadow-lg shadow-violet-600/20"
                >
                  <span className="material-icons text-base">chat</span>
                  Go to Message
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Saved posts ─────────────── */

function SavedPostGrid({ posts, onOpen, onRemove }) {
  return (
    <PostGrid>
      {posts.map((post) => (
        <PostGridCard
          key={post._id}
          post={post}
          onOpen={onOpen}
          showAuthor
          action={
            onRemove
              ? { icon: "bookmark", hoverIcon: "bookmark_remove", filled: true, label: "Remove from saved", onClick: (e, p) => onRemove(e, p._id) }
              : undefined
          }
        />
      ))}
    </PostGrid>
  );
}

/* ─────────────── Starred chat media ─────────────── */

const MEDIA_FILTERS = [
  { id: "all", label: "All", icon: "star" },
  { id: "image", label: "Photos", icon: "image" },
  { id: "video", label: "Videos", icon: "videocam" },
  { id: "audio", label: "Voice notes", icon: "mic" },
  { id: "document", label: "Files", icon: "description" },
];

const mediaKind = (item) => (["image", "video", "audio"].includes(item.mediaType) ? item.mediaType : "document");

// Starred items store the message's media URL, not a file name; recover a
// readable one from the URL (Cloudinary keeps the original name in the path).
const mediaFileName = (item) => {
  if (item.fileName) return item.fileName;
  try {
    const last = decodeURIComponent(new URL(item.media).pathname.split("/").pop() || "");
    if (last) return last;
  } catch {
    // Not a URL — fall through
  }
  return item.content || "Document";
};

const fileExtension = (name) => {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name || "");
  return m ? m[1].toUpperCase() : "FILE";
};

// Deterministic tint per chat, so the same conversation is recognisable at a glance.
const CHAT_TINTS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];
const chatTint = (key = "") => CHAT_TINTS[[...key].reduce((n, c) => n + c.charCodeAt(0), 0) % CHAT_TINTS.length];

const KIND_META = {
  image: { icon: "image", label: "Photo" },
  video: { icon: "videocam", label: "Video" },
  audio: { icon: "mic", label: "Voice note" },
  document: { icon: "description", label: "File" },
};

function ChatMediaCard({ item, onUnstar, onPreview, onDownload, onJumpToMessage }) {
  const kind = mediaKind(item);
  const [thumbFailed, setThumbFailed] = useState(false);
  const videoThumb = kind === "video" ? getVideoThumbnail(item.media) : undefined;
  const fileName = kind === "document" ? mediaFileName(item) : "";
  const chatName = item.chatName || "Chat";

  let preview;
  if (kind === "image" && item.media && !thumbFailed) {
    preview = (
      <img
        src={item.media}
        alt={`Photo from ${chatName}`}
        className="bm-sm-img"
        loading="lazy"
        onError={() => setThumbFailed(true)}
      />
    );
  } else if (kind === "video") {
    preview = (
      <>
        {videoThumb && !thumbFailed ? (
          <img src={videoThumb} alt={`Video from ${chatName}`} className="bm-sm-img" loading="lazy" onError={() => setThumbFailed(true)} />
        ) : (
          <div className="bm-sm-tile bm-sm-tile-video" />
        )}
        <span className="bm-sm-play">
          <span className="material-icons icon-filled">play_arrow</span>
        </span>
      </>
    );
  } else if (kind === "audio") {
    preview = (
      <div className="bm-sm-tile bm-sm-tile-audio">
        <span className="bm-sm-audio-btn">
          <span className="material-icons icon-filled">play_arrow</span>
        </span>
        <span className="bm-sm-wave" aria-hidden="true">
          {[5, 9, 14, 8, 17, 11, 6, 13, 18, 10, 7, 12, 16, 9, 5, 11, 14, 7].map((h, i) => (
            <i key={i} style={{ height: `${h * 1.6}px` }} />
          ))}
        </span>
      </div>
    );
  } else {
    preview = (
      <div className="bm-sm-tile bm-sm-tile-doc">
        <span className="bm-sm-doc-icon">
          <span className="material-icons">{kind === "image" ? "broken_image" : "description"}</span>
          <span className="bm-sm-doc-ext">{kind === "image" ? "IMG" : fileExtension(fileName)}</span>
        </span>
        {fileName && <span className="bm-sm-doc-name" title={fileName}>{fileName}</span>}
      </div>
    );
  }

  return (
    <article className="bm-sm-card">
      <button
        type="button"
        className="bm-sm-preview"
        onClick={() => onPreview?.(item)}
        aria-label={`Open ${KIND_META[kind].label.toLowerCase()} from ${chatName}`}
      >
        {preview}
        {/* File and voice-note tiles already show what they are. */}
        {(kind === "image" || kind === "video") && (
          <span className="bm-sm-kind">
            <span className="material-icons">{KIND_META[kind].icon}</span>
            {KIND_META[kind].label}
          </span>
        )}
      </button>

      <button
        type="button"
        className="bm-sm-star"
        title="Unstar"
        aria-label="Unstar"
        onClick={() => onUnstar?.()}
      >
        <span className="material-icons icon-filled">star</span>
      </button>

      <div className="bm-sm-footer">
        <span className="bm-sm-chat-dot" style={{ background: chatTint(item.chatId || chatName) }} aria-hidden="true">
          {chatName.trim().charAt(0).toUpperCase()}
        </span>
        <div className="bm-sm-meta">
          <span className="bm-sm-chat" title={chatName}>{chatName}</span>
          <span className="bm-sm-time">{timeAgo(item.createdAt)}</span>
        </div>
        <div className="bm-sm-actions">
          {item.media && (
            <button type="button" className="bm-sm-icon-btn" title="Download" aria-label="Download" onClick={() => onDownload?.(item)}>
              <span className="material-icons">download</span>
            </button>
          )}
          {item.chatId && (
            <button
              type="button"
              className="bm-sm-icon-btn"
              title="Go to message"
              aria-label="Go to message"
              onClick={() => onJumpToMessage?.(item.chatId, item._id)}
            >
              <span className="material-icons">chat</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// Extracted Resource List Item Component
function ResourceListItem({ resource, onOpen, onDownload, onRemove }) {
  const theme = useThemeStore((s) => s.theme);
  const { icon, color } = getFileIcon(resource.fileName, resource.fileType, theme);
  return (
    <div className="bm-item" onClick={() => onOpen(resource)}>
      <div className="bm-left">
        <div className="bm-icon-wrap" style={{ "--ic": color }}>
          <span className="material-icons" style={{ color }}>{icon}</span>
        </div>
        <div className="bm-info">
          <h4>{resource.title || resource.fileName}</h4>
          <div className="bm-meta">
            {resource.userId && (
              <Link to={`/profile/${resource.userId.username}`} className="bm-author" onClick={(e) => e.stopPropagation()}>
                {resource.userId.username}
              </Link>
            )}
            <span className="bm-dot" />
            <span>{timeAgo(resource.createdAt)}</span>
            <span className="bm-dot" />
            <span className="bm-cat">{resource.category}</span>
          </div>
        </div>
      </div>
      <div className="bm-actions">
        {resource.fileType !== "link" && (
          <button className="bm-action-btn" title="Download" onClick={(e) => { e.stopPropagation(); onDownload(resource); }}>
            <span className="material-icons">download</span>
          </button>
        )}
        {onRemove && (
          <button className="bm-action-btn bm-remove" title="Remove from Collection" onClick={onRemove}>
            <span className="material-icons">bookmark_remove</span>
          </button>
        )}
      </div>
    </div>
  );
}
