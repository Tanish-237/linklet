import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "react-toastify";
import { apiClient } from "../api/apiClient";
import { getCollections, deleteCollection, toggleResourceInCollection, createCollection } from "../api/collection.api";
import PreviewModal, { getFileIcon } from "../components/PreviewModal";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import PostDetailModal from "../components/PostDetailModal";
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
  const { user } = useAuth();
  const [savedResources, setSavedResources] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewResource, setPreviewResource] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [activeCollection, setActiveCollection] = useState(null); // null = overview, "all" = Saved Resources, "posts" = Saved Posts, or collection Object
  const [collectionResources, setCollectionResources] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  const isOwnProfile = !username;

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

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

  const savedPosts = savedResources.filter(
    (item) => item.category === "Post" || item.caption !== undefined || item.upvotes !== undefined
  );
  const savedResourceItems = savedResources.filter(
    (item) => item.category !== "Post" && item.caption === undefined && item.upvotes === undefined
  );

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
    try {
      await apiClient.patch(`/resources/${resource._id}/download`);
      let url = resource.fileUrl;
      if (url.includes("cloudinary.com") && !url.includes("fl_attachment"))
        url = url.replace("/upload/", "/upload/fl_attachment/");
      const a = document.createElement("a");
      a.href = url; a.download = resource.title || "download"; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch {
      window.open(resource.fileUrl, "_blank");
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
              : activeCollection.name}
          </h2>
        </div>
      </div>

      {loading ? (
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
