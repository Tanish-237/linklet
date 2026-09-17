import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "react-toastify";
import { apiClient } from "../api/apiClient";
import { getCollections, deleteCollection, toggleResourceInCollection, createCollection } from "../api/collection.api";
import PreviewModal, { getFileIcon } from "../components/PreviewModal";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import PostDetailModal from "../components/PostDetailModal";
import { isSafeHttpUrl, safeOpenUrl } from "../utlis/safeUrl";
import { useAuth } from "../context/AuthContext";
import "./Saved.css";
import "./Profile.css";

const timeAgo = (d) => {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/* ─────────────── Saved page component ─────────────── */
export default function Saved({ username }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [savedResources, setSavedResources] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewResource, setPreviewResource] = useState(null);
  const [previewChatMedia, setPreviewChatMedia] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [activeCollection, setActiveCollection] = useState(null); // null = overview, "all" = Saved Resources, "posts" = Saved Posts, "chatMedia" = Starred Chat Attachments, or collection Object
  const [collectionResources, setCollectionResources] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [starredChatMedia, setStarredChatMedia] = useState([]);

  const handleDownloadChatMedia = async (item) => {
    if (!item?.media) return;
    try {
      toast.info("Preparing download...");
      let fetchUrl = item.media;
      if (fetchUrl.includes("cloudinary.com") && !fetchUrl.includes("fl_attachment")) {
        fetchUrl = fetchUrl.replace("/upload/", "/upload/fl_attachment/");
      }

      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const filename = (item.fileName || item.media.split("/").pop() || "starred-media").split("?")[0];
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Download complete");
    } catch (err) {
      console.warn("Direct blob download failed, falling back to transformed URL", err);
      let fallbackUrl = item.media;
      if (fallbackUrl.includes("cloudinary.com") && !fallbackUrl.includes("fl_attachment")) {
        fallbackUrl = fallbackUrl.replace("/upload/", "/upload/fl_attachment/");
      }
      const link = document.createElement("a");
      link.href = fallbackUrl;
      link.download = item.fileName || "download";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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

  const isOwnProfile = !username;

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
    loadData();
    loadStarredChatMedia();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, user?._id]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (isOwnProfile) {
        const url = "/profile/me/bookmarks";
        const [bookmarksRes, cols] = await Promise.all([
          apiClient.get(url),
          getCollections(),
        ]);
        setSavedResources(bookmarksRes.data.data || []);
        setCollections(cols || []);
      } else {
        const url = `/profile/${username}/bookmarks`;
        const res = await apiClient.get(url);
        setSavedResources(res.data.data || []);
      }
    } catch {
      toast.error("Failed to load saved items");
    } finally {
      setLoading(false);
    }
  };

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
      toast("Removed from collection", { icon: "🗑️", autoClose: 1500 });
    } catch {
      toast.error("Failed to remove item");
    }
  };

  const handleDownload = async (resource) => {
    if (!isSafeHttpUrl(resource.fileUrl)) {
      toast.error("This resource's link is invalid and cannot be opened.");
      return;
    }
    try {
      await apiClient.patch(`/resources/${resource._id}/download`);
      let url = resource.fileUrl;
      if (url.includes("cloudinary.com") && !url.includes("fl_attachment"))
        url = url.replace("/upload/", "/upload/fl_attachment/");

      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = resource.title || resource.fileName || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      safeOpenUrl(resource.fileUrl);
    }
  };

  if (loading && !activeCollection && savedResources.length === 0 && collections.length === 0) {
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
          <title>{username ? `${username}'s Saves` : "Saved"} | Linklet</title>
        </Helmet>
        {savedResources.length === 0 ? (
          <div className="bm-empty">No saved resources found.</div>
        ) : (
          <div className="bm-list">
            {savedResources.map((r) => (
              <ResourceListItem key={r._id} resource={r} onOpen={setPreviewResource} onDownload={handleDownload} />
            ))}
          </div>
        )}
        {previewResource && <PreviewModal resource={previewResource} onClose={() => setPreviewResource(null)} />}
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
              <span className="material-icons">bookmark</span>
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
                <span className="material-icons">star</span>
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
          <button className="gs-icon-btn" onClick={() => setActiveCollection(null)}>
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
            <span className="material-icons" style={{ fontSize: "2.5rem", color: "#a78bfa", marginBottom: "10px", display: "block" }}>star_outline</span>
            No starred chat media yet. Star images, videos, voice notes or documents in a chat to save them here.
          </div>
        ) : (
          <div className="bm-chat-media-grid">
            {starredChatMedia.map((item) => (
              <ChatMediaCard
                key={item._id}
                item={item}
                onPreview={(m) => setPreviewChatMedia(m)}
                onDownload={(m) => handleDownloadChatMedia(m)}
                onJumpToMessage={(chatId, msgId) => navigate(`/dashboard/chat?chatId=${chatId}&messageId=${msgId}`)}
                onUnstar={() => handleUnstarMedia(item._id)}
              />
            ))}
          </div>
        )
      ) : loading ? (
        <div className="gs-spinner" style={{ margin: "40px auto" }} />
      ) : collectionResources.length === 0 ? (
        <div className="bm-empty">This collection is empty.</div>
      ) : activeCollection === "posts" ? (
        /* Instagram-style Post Grid for Saved Posts */
        <div className="profile-posts-grid" style={{ marginTop: "1rem" }}>
          {collectionResources.map((post) => (
            <div
              key={post._id}
              className="profile-post-card cursor-pointer"
              onClick={() => {
                setSelectedPost(post);
                setShowPostModal(true);
              }}
            >
              {/* Image or text placeholder */}
              {post.image ? (
                <img
                  src={post.image}
                  alt={post.caption || "Post"}
                  className="profile-post-image"
                  loading="lazy"
                />
              ) : (
                <div className="profile-post-text-placeholder">
                  <p>{post.caption}</p>
                </div>
              )}

              {/* Hover overlay: stats + caption */}
              <div className="profile-post-overlay">
                <div className="profile-post-stats">
                  <span className="profile-post-stat">
                    <span className="material-icons">arrow_upward</span>
                    {post.upvotes?.length || 0}
                  </span>
                  <span className="profile-post-stat">
                    <span className="material-icons">chat_bubble_outline</span>
                    {post.comments?.length || 0}
                  </span>
                </div>
                {post.caption && (
                  <p className="profile-post-caption-preview">{post.caption}</p>
                )}
              </div>

              {/* Unsave button */}
              {isOwnProfile && (
                <button
                  className="profile-post-delete-btn"
                  title="Remove from saved posts"
                  onClick={(e) => handleRemoveFromCollection(e, post._id)}
                >
                  <span className="material-icons">bookmark_remove</span>
                </button>
              )}
            </div>
          ))}
        </div>
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

      {/* Post Detail Modal for Saved Posts Grid */}
      <PostDetailModal
        isOpen={showPostModal}
        onClose={() => {
          setShowPostModal(false);
          setSelectedPost(null);
        }}
        post={selectedPost}
        user={user}
        onPostUpdated={(updated) => {
          setCollectionResources((prev) =>
            prev.map((p) => (p._id === updated._id ? updated : p))
          );
          setSelectedPost(updated);
        }}
      />

      {/* Starred Chat Media Lightbox / Preview Modal */}
      {previewChatMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setPreviewChatMedia(null)}
        >
          <div
            className="relative bg-gray-900 border border-violet-500/20 rounded-2xl max-w-2xl w-full p-5 shadow-2xl overflow-hidden flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full pb-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="material-icons text-amber-400">star</span>
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
            <div className="w-full flex items-center justify-center max-h-[60vh] overflow-auto rounded-xl bg-black/40 p-2">
              {previewChatMedia.mediaType === "image" ? (
                <img
                  src={previewChatMedia.media}
                  alt="Starred media"
                  className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-lg"
                />
              ) : previewChatMedia.mediaType === "video" ? (
                <video
                  src={previewChatMedia.media}
                  controls
                  autoPlay
                  className="max-h-[55vh] max-w-full rounded-lg shadow-lg"
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
                  <span>Document Attachment</span>
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
                    navigate(`/dashboard/chat?chatId=${chatId}&messageId=${_id}`);
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

// Starred Chat Media Card Component
function ChatMediaCard({ item, onUnstar, onPreview, onDownload, onJumpToMessage }) {
  const isImage = item.mediaType === "image";
  const isVideo = item.mediaType === "video";

  const iconMap = {
    video: { icon: "videocam", color: "#6366f1", label: "Video" },
    audio: { icon: "mic", color: "#a855f7", label: "Voice Note" },
    document: { icon: "insert_drive_file", color: "#3b82f6", label: "Document" },
  };

  const { icon = "attach_file", color = "#8b5cf6", label = "Media" } = iconMap[item.mediaType] || {};

  return (
    <div
      className="bm-chat-media-card"
      onClick={() => onPreview && onPreview(item)}
      title="Click anywhere to preview"
    >
      {/* Preview area */}
      <div className="bm-chat-media-preview">
        {isImage && item.media ? (
          <img
            src={item.media}
            alt="Starred media"
            className="bm-chat-media-img"
            loading="lazy"
          />
        ) : isVideo && item.media ? (
          <div className="bm-chat-media-video-container">
            <video
              src={item.media}
              className="bm-chat-media-img"
              preload="metadata"
            />
            <div className="bm-chat-media-badge-center">
              <span className="material-icons">play_circle_filled</span>
            </div>
          </div>
        ) : (
          <div className="bm-chat-media-icon-placeholder" style={{ background: `${color}18` }}>
            <span className="material-icons" style={{ color, fontSize: "2.4rem" }}>{icon}</span>
            <span className="bm-chat-media-label" style={{ color }}>{label}</span>
          </div>
        )}

        {/* Top-right floating actions (Download & Unstar) */}
        <div className="bm-chat-media-top-actions" onClick={(e) => e.stopPropagation()}>
          {item.media && (
            <button
              type="button"
              className="bm-media-action-btn"
              title="Download"
              onClick={() => onDownload && onDownload(item)}
            >
              <span className="material-icons">download</span>
            </button>
          )}
          <button
            type="button"
            className="bm-media-action-btn bm-media-unstar-btn"
            title="Unstar"
            onClick={() => onUnstar && onUnstar()}
          >
            <span className="material-icons">star</span>
          </button>
        </div>
      </div>

      {/* Info footer with chat info and clear full-width 'Go to message' button */}
      <div className="bm-chat-media-footer" onClick={(e) => e.stopPropagation()}>
        <div className="bm-chat-media-meta">
          <div className="bm-chat-media-chat-title" title={item.chatName}>
            <span className="material-icons bm-chat-media-meta-icon">forum</span>
            <span className="bm-chat-media-chat-name">{item.chatName || "Chat"}</span>
          </div>
          <span className="bm-chat-media-time">{timeAgo(item.createdAt)}</span>
        </div>

        {item.chatId && (
          <button
            type="button"
            className="bm-chat-media-goto-btn"
            onClick={() => onJumpToMessage && onJumpToMessage(item.chatId, item._id)}
            title="Go to original message in chat"
          >
            <span className="material-icons">chat</span>
            <span>Go to message</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Extracted Resource List Item Component
function ResourceListItem({ resource, onOpen, onDownload, onRemove }) {
  const { icon, color } = getFileIcon(resource.fileName, resource.fileType);
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
              <Link to={`/dashboard/profile/${resource.userId.username}`} className="bm-author" onClick={(e) => e.stopPropagation()}>
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
