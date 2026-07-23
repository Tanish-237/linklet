import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "react-toastify";
import { apiClient } from "../api/apiClient";
import { getCollections, deleteCollection, toggleResourceInCollection, createCollection } from "../api/collection.api";
import PreviewModal, { getFileIcon } from "../components/PreviewModal";
import "./Saved.css";

const timeAgo = (d) => {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/* ─────────────── Saved page component ─────────────── */
export default function Saved({ username }) {
  const [savedResources, setSavedResources] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewResource, setPreviewResource] = useState(null);
  const [activeCollection, setActiveCollection] = useState(null); // null = overview, "all" = All Saves, or collection Object
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
      // Load All Saves
      const url = username ? `/profile/${username}/bookmarks` : "/profile/me/bookmarks";
      const res = await apiClient.get(url);
      setSavedResources(res.data.data || []);

      // Load Collections if viewing own profile
      if (isOwnProfile) {
        const cols = await getCollections();
        setCollections(cols);
      }
    } catch {
      toast.error("Failed to load saved items");
    } finally {
      setLoading(false);
    }
  };

  const loadCollectionResources = async (collection) => {
    if (collection === "all") {
      setActiveCollection("all");
      setCollectionResources(savedResources);
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

  const handleDeleteCollection = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this collection? Resources will NOT be deleted.")) return;
    try {
      await deleteCollection(id);
      setCollections((p) => p.filter((c) => c._id !== id));
      toast.success("Collection deleted");
    } catch {
      toast.error("Failed to delete collection");
    }
  };

  const handleRemoveFromCollection = async (e, resourceId) => {
    e.stopPropagation();
    try {
      if (activeCollection === "all") {
        await apiClient.post(`/profile/bookmarks/${resourceId}`);
        setCollectionResources((p) => p.filter((r) => r._id !== resourceId));
        setSavedResources((p) => p.filter((r) => r._id !== resourceId));
      } else {
        await toggleResourceInCollection(activeCollection._id, resourceId);
        setCollectionResources((p) => p.filter((r) => r._id !== resourceId));
        // Update overview counts optimistically
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

  if (loading && !activeCollection && savedResources.length === 0) {
    return <div className="gs-spinner" style={{ margin: "40px auto" }} />;
  }

  // 1. Another user's profile view (just a flat list)
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
          <button className="gs-btn-primary-sm" onClick={() => setIsCreating(!isCreating)}>
            <span className="material-icons">{isCreating ? "close" : "add"}</span>
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
          {/* Default "All Saves" Collection Card */}
          <div className="bm-collection-card all-saves" onClick={() => loadCollectionResources("all")}>
            <div className="bm-collection-cover">
              <span className="material-icons">bookmark</span>
            </div>
            <div className="bm-collection-info">
              <h3>All Saves</h3>
              <p>{savedResources.length} resources</p>
            </div>
          </div>

          {/* User Collections */}
          {collections.map((c) => (
            <div key={c._id} className="bm-collection-card" onClick={() => loadCollectionResources(c)}>
              <div className="bm-collection-cover" style={{ backgroundColor: c.coverColor }}>
                <span className="material-icons">folder</span>
                <button className="bm-del-btn" onClick={(e) => handleDeleteCollection(e, c._id)}>
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
      </div>
    );
  }

  // 3. Inside a Collection
  return (
    <div className="bm-container">
      <Helmet>
        <title>{activeCollection === "all" ? "All Saves" : activeCollection.name} | Linklet</title>
      </Helmet>
      <div className="bm-header-row">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button className="gs-icon-btn" onClick={() => setActiveCollection(null)}>
            <span className="material-icons">arrow_back</span>
          </button>
          <h2 className="bm-title">
            {activeCollection === "all" ? "All Saves" : activeCollection.name}
          </h2>
        </div>
      </div>

      {loading ? (
        <div className="gs-spinner" style={{ margin: "40px auto" }} />
      ) : collectionResources.length === 0 ? (
        <div className="bm-empty">This collection is empty.</div>
      ) : (
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
