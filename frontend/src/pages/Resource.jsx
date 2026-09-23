import React, { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { apiClient } from "../api/apiClient";
import useAuthStore from "../store/useAuthStore";
import useThemeStore from "../theme/useThemeStore";
import PreviewModal, { getFileIcon } from "../components/PreviewModal";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import { isSafeHttpUrl, safeOpenUrl } from "../utlis/safeUrl";
import "./Resource.css";

/* ─────────────────────────── helpers ─────────────────────────── */
const formatCount = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n || 0);

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

/* ─────────────────────────── skeleton ─────────────────────────── */
const SkeletonCard = ({ view }) => (
  view === "grid"
    ? <div className="gs-skeleton gs-card-grid" />
    : <div className="gs-skeleton gs-card-list" />
);

/* ─────────────────────── upload modal ─────────────────────────── */
import SaveToCollectionModal from "../components/SaveToCollectionModal";

const CATEGORIES = [
  { id: "all",         label: "All",         icon: "folder" },
  { id: "notes",       label: "Notes",       icon: "description" },
  { id: "assignments", label: "Assignments", icon: "assignment" },
  { id: "papers",      label: "Papers",      icon: "library_books" },
  { id: "books",       label: "Books",       icon: "menu_book" },
  { id: "lectures",    label: "Lectures",    icon: "school" },
  { id: "other",       label: "Other",       icon: "more_horiz" },
];

const UploadModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ title: "", description: "", category: "notes" });
  const [uploadType, setUploadType] = useState("file");
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Any file type is accepted — the backend imposes no type restriction
  // (only a 25MB size / 10 file count limit), so the picker shouldn't either.
  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File is too large. Maximum size is 25MB.");
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploadType === "file" && !selectedFile) return;
    if (uploadType === "link" && !linkUrl) return;
    setUploading(true);
    try {
      const fd = new FormData();
      const fallbackName = uploadType === "file" ? selectedFile.name : linkUrl;
      const finalTitle = formData.title.trim() || fallbackName;
      fd.append("title", finalTitle);
      fd.append("description", formData.description);
      fd.append("category", formData.category);
      if (uploadType === "file") {
        fd.append("document", selectedFile);
      } else {
        fd.append("linkUrl", linkUrl);
      }
      const res = await apiClient.post("/resources", fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (res.status === 201) {
        toast.success("Resource shared successfully!");
        onSuccess();
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="gs-modal-backdrop" onClick={onClose}>
      <div className="gs-upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gs-modal-header">
          <h2 className="gs-modal-title">
            <span className="material-icons" style={{ color: "rgb(var(--accent-fg))" }}>upload_file</span>
            Share a Resource
          </h2>
          <button className="gs-icon-btn" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>
        
        <div className="gs-upload-type-toggle">
          <button type="button" className={`gs-toggle-btn ${uploadType === "file" ? "active" : ""}`} onClick={() => setUploadType("file")}>Upload File</button>
          <button type="button" className={`gs-toggle-btn ${uploadType === "link" ? "active" : ""}`} onClick={() => setUploadType("link")}>Share Link</button>
        </div>

        <form onSubmit={handleSubmit} className="gs-upload-form">
          <div className="gs-form-group">
            <label>Title</label>
            <input
              type="text" value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Data Structures Notes (Defaults to file name if empty)"
            />
          </div>
          <div className="gs-form-group">
            <label>Category *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
              required
            >
              {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="gs-form-group">
            <label>Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe what's in this resource…" rows={3} required
            />
          </div>

          {uploadType === "file" ? (
            <div
              className={`gs-dropzone ${dragOver ? "drag-active" : ""} ${selectedFile ? "has-file" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById("gs-file-input").click()}
            >
              <span className="material-icons gs-dropzone-icon">{selectedFile ? "check_circle" : "cloud_upload"}</span>
              {selectedFile ? (
                <p className="gs-dropzone-text selected">{formData.title || selectedFile.name}</p>
              ) : (
                <>
                  <p className="gs-dropzone-text">Drag & drop or click to choose</p>
                  <p className="gs-dropzone-sub">Any file type, up to 25MB</p>
                </>
              )}
              <input id="gs-file-input" type="file" onChange={(e) => handleFile(e.target.files[0])} style={{ display: "none" }} />
            </div>
          ) : (
            <div className="gs-form-group gs-link-group">
              <label>Resource Link *</label>
              <input 
                type="url" 
                value={linkUrl} 
                onChange={(e) => setLinkUrl(e.target.value)} 
                placeholder="https://..." 
                required={uploadType === "link"} 
              />
            </div>
          )}

          <button type="submit" className="gs-btn-primary gs-submit-btn" disabled={uploading || (uploadType === "file" && !selectedFile) || (uploadType === "link" && !linkUrl)}>
            {uploading ? <><div className="gs-spinner-sm" /><span>Sharing…</span></> : <><span className="material-icons">cloud_upload</span><span>Share Resource</span></>}
          </button>
        </form>
      </div>
    </div>
  );
};

/* ──────────────────────── resource card ──────────────────────── */
const ResourceCard = ({ resource, view, saved, onToggleSave, onOpen, onAction, onPromptDelete, currentUser }) => {
  const theme = useThemeStore((s) => s.theme);
  const { icon, color } = getFileIcon(resource.fileName, resource.fileType, theme);
  const [copying, setCopying] = useState(false);

  const ownerId = resource.userId?._id || resource.userId;
  const isOwner = currentUser?._id && (ownerId?.toString() === currentUser._id || currentUser.role === "admin");

  const copyLink = async (e) => {
    if (e) e.stopPropagation();
    try {
      const shareUrl = `${window.location.origin}/resource-hub?preview=${resource._id}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopying(true);
      setTimeout(() => setCopying(false), 1500);
    } catch { toast.error("Could not copy link"); }
  };

  /* ── List view ── */
  if (view === "list") {
    return (
      <div className="gs-card-list" onClick={() => onOpen(resource)} style={{ cursor: "pointer", position: "relative" }}>
        <div className="gs-list-left">
          <div className="gs-list-icon-wrap">
            <span className="material-icons gs-list-icon" style={{ color }}>{icon}</span>
          </div>
          <div className="gs-list-info">
            <div className="gs-list-top-row">
              <h3 className="gs-list-title">{resource.title || resource.fileName}</h3>
            </div>
            {resource.description && (
              <p className="gs-list-desc">{resource.description}</p>
            )}
            {resource.resourcetags?.length > 0 && (
              <div className="gs-tags">
                {resource.resourcetags.slice(0, 5).map((t, i) => (
                  <span key={i} className="gs-tag">#{t}</span>
                ))}
              </div>
            )}
            <div className="gs-list-meta">
              {resource.userId?.avatar
                ? <img loading="lazy" decoding="async" src={resource.userId.avatar} alt="" className="gs-avatar-sm" />
                : <div className="gs-avatar-sm gs-avatar-placeholder"><span className="material-icons">person</span></div>
              }
              <Link to={`/profile/${resource.userId?.username}`} className="gs-username" onClick={(e) => e.stopPropagation()}>
                {resource.userId?.username || "Anonymous"}
              </Link>
              <span className="gs-dot" />
              <span>{timeAgo(resource.createdAt)}</span>
              <span className="gs-dot" />
              <span className="gs-category-badge">{resource.category}</span>
              <span className="gs-dot" />
              <span className="gs-stat-chip">
                <span className="material-icons">download</span>
                {formatCount(resource.downloadsCount)}
              </span>
            </div>
          </div>
        </div>

        <div className="gs-list-actions" onClick={(e) => e.stopPropagation()}>
          <button className={`gs-icon-btn ${saved ? "saved" : ""}`} title={saved ? "Remove from Saved" : "Save"} onClick={(e) => { e.stopPropagation(); onToggleSave(resource._id); }}>
            <span className="material-icons">{saved ? "bookmark" : "bookmark_border"}</span>
          </button>
          <button className="gs-icon-btn" title={copying ? "Copied!" : "Copy link"} onClick={copyLink}>
            <span className="material-icons">{copying ? "check" : "link"}</span>
          </button>
          {isOwner && (
            <button
              className="gs-icon-btn"
              title="Delete Resource"
              style={{ color: "rgb(var(--danger-fg))" }}
              onClick={(e) => {
                e.stopPropagation();
                onPromptDelete(resource._id);
              }}
            >
              <span className="material-icons">delete</span>
            </button>
          )}
          {resource.fileType !== "link" && (
            <button className="gs-btn-primary-sm" onClick={(e) => { e.stopPropagation(); onAction(resource, "download"); }}>
              <span className="material-icons">download</span> Download
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── Grid view ── */
  return (
    <div className="gs-card-grid" onClick={() => onOpen(resource)} style={{ cursor: "pointer", position: "relative" }}>
      <div className="gs-card-top-row">
        <div className="gs-card-icon-wrap" style={{ "--ic": color }}>
          <span className="material-icons gs-card-icon" style={{ color }}>{icon}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isOwner && (
            <button
              className="bm-del-btn inline-del-btn"
              title="Delete Resource"
              onClick={(e) => {
                e.stopPropagation();
                onPromptDelete(resource._id);
              }}
            >
              <span className="material-icons">delete</span>
            </button>
          )}
          <button
            className={`gs-icon-btn ${saved ? "saved" : ""}`}
            title={saved ? "Remove from Saved" : "Save"}
            onClick={(e) => { e.stopPropagation(); onToggleSave(resource._id); }}
          >
            <span className="material-icons">{saved ? "bookmark" : "bookmark_border"}</span>
          </button>
        </div>
      </div>

      <h3 className="gs-card-title" title={resource.title || resource.fileName}>
        {resource.title || resource.fileName}
      </h3>

      {resource.description && (
        <p className="gs-card-desc">{resource.description}</p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", margin: "6px 0" }}>
        <span className="gs-category-badge">{resource.category}</span>
        {resource.resourcetags?.length > 0 && (
          <div className="gs-tags">
            {resource.resourcetags.slice(0, 3).map((t, i) => (
              <span key={i} className="gs-tag">#{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="gs-card-user-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {resource.userId?.avatar
            ? <img loading="lazy" decoding="async" src={resource.userId.avatar} alt="" className="gs-avatar-sm" />
            : <div className="gs-avatar-sm gs-avatar-placeholder"><span className="material-icons">person</span></div>
          }
          <Link to={`/profile/${resource.userId?.username}`} className="gs-username" onClick={(e) => e.stopPropagation()}>
            {resource.userId?.username || "Anonymous"}
          </Link>
        </div>
        <span className="gs-stat-chip">
          <span className="material-icons">download</span>
          {formatCount(resource.downloadsCount)}
        </span>
      </div>

      <div className="gs-card-actions" onClick={(e) => e.stopPropagation()}>
        <button className="gs-btn-ghost" style={{ flex: 1 }} onClick={copyLink}>
          <span className="material-icons">{copying ? "check" : "link"}</span>
          {copying ? "Copied" : "Copy Link"}
        </button>
        {resource.fileType !== "link" && (
          <button className="gs-btn-primary-sm" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); onAction(resource, "download"); }}>
            <span className="material-icons">download</span>
            Download
          </button>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────── constants ─────────────────────────── */
const SORT_OPTIONS = [
  { id: "most_downloaded", label: "Most Downloaded", icon: "trending_up" },
  { id: "newest",          label: "Newest First",     icon: "schedule" },
  { id: "oldest",          label: "Oldest First",     icon: "history" },
  { id: "az",              label: "A – Z",            icon: "sort_by_alpha" },
  { id: "za",              label: "Z – A",            icon: "sort_by_alpha" },
];

const PAGE_SIZE = 12;

/* ─────────────────────── deleted notice modal ───────────────────────── */
const DeletedNoticeModal = ({ onClose }) => (
  <div className="gs-modal-backdrop" onClick={onClose}>
    <div className="gs-deleted-modal" onClick={(e) => e.stopPropagation()}>
      <div className="gs-deleted-icon-wrap">
        <span className="material-icons" style={{ fontSize: 44, color: "rgb(var(--danger-fg))" }}>
          do_not_disturb_on
        </span>
      </div>
      <h2 className="gs-deleted-title">Content No Longer Available</h2>
      <p className="gs-deleted-desc">
        The resource you are looking for has been removed by its author or is no longer available.
      </p>
      <p className="gs-deleted-sub">
        If someone shared this link with you, the file may have been updated or deleted.
      </p>
      <div className="gs-deleted-actions">
        <button className="gs-btn-primary" onClick={onClose}>
          <span className="material-icons">search</span>
          Explore Resource Library
        </button>
      </div>
    </div>
  </div>
);

/* ─────────────────────── main component ─────────────────────────── */
export default function GlobalSearch() {
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm]         = useState("");
  const [debouncedTerm, setDebouncedTerm]   = useState("");
  const [resources, setResources]           = useState([]);
  const [loading, setLoading]               = useState(false);
  const [loadingMore, setLoadingMore]       = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSort, setSelectedSort]     = useState("most_downloaded");
  const [isSortOpen, setIsSortOpen]         = useState(false);
  const view = "grid";
  const [bookmarks, setBookmarks]           = useState(new Set());
  const [previewResource, setPreviewResource] = useState(null);
  const [showDeletedNotice, setShowDeletedNotice] = useState(false);
  const [showUpload, setShowUpload]         = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [showMyResourcesOnly, setShowMyResourcesOnly] = useState(false);
  const [savedResources, setBookmarkedResources] = useState([]);
  const [stats, setStats]                   = useState({ total: 0, categories: { all:0, notes:0, assignments:0, papers:0, books:0, lectures:0, other:0 } });
  const [pagination, setPagination]         = useState({ page: 1, totalPages: 1, totalDocs: 0, hasNextPage: false });
  const [searchParams, setSearchParams]     = useSearchParams();
  const [collectionModalResourceId, setCollectionModalResourceId] = useState(null);

  const sortRef = useRef(null);
  const debounceRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedTerm(searchTerm), 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  // Fetch bookmarks from backend on mount
  useEffect(() => {
    fetchMySaved();
    
    // Check for preview parameter in URL to auto-open modal
    const previewId = searchParams.get("preview");
    if (previewId) {
      apiClient.get(`/resources/${previewId}`)
        .then(res => {
          if (res.data.data) setPreviewResource(res.data.data);
        })
        .catch(() => {
          setShowDeletedNotice(true);
        });
      // Clear parameter to avoid re-triggering on refresh
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [deleteConfirmResourceId, setDeleteConfirmResourceId] = useState(null);

  const promptDeleteResource = (resourceId) => {
    setDeleteConfirmResourceId(resourceId);
  };

  const handleConfirmDeleteResource = async () => {
    if (!deleteConfirmResourceId) return;
    try {
      await apiClient.delete(`/resources/${deleteConfirmResourceId}`);
      toast.success("Resource deleted successfully");
      setResources((prev) => prev.filter((r) => r._id !== deleteConfirmResourceId));
      if (previewResource?._id === deleteConfirmResourceId) setPreviewResource(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete resource");
    } finally {
      setDeleteConfirmResourceId(null);
    }
  };

  // Fetch resources when filters change
  useEffect(() => {
    fetchResources(1, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTerm, selectedCategory, selectedSort, showMyResourcesOnly]);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setIsSortOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchMySaved = async () => {
    try {
      const res = await apiClient.get("/profile/me/bookmarks");
      const bms = res.data.data || [];
      setBookmarks(new Set(bms.map((r) => r._id?.toString())));
      setBookmarkedResources(bms);
    } catch {
      // Not logged in or error — silently ignore
    }
  };

  // Latest-request-wins: typing in search or switching filters fires overlapping
  // requests, and a slow older response must not overwrite (or be appended to) the
  // list for the newer view.
  const resourcesRequestRef = useRef(0);

  const fetchResources = async (page = 1, append = false) => {
    const stamp = ++resourcesRequestRef.current;
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await apiClient.get("/resources/library", {
        params: {
          search: debouncedTerm || undefined,
          category: selectedCategory !== "all" ? selectedCategory : undefined,
          sort: selectedSort,
          page,
          limit: PAGE_SIZE,
          onlyMe: showMyResourcesOnly || undefined,
        },
      });
      if (stamp !== resourcesRequestRef.current) return;
      const data = res.data.data || [];
      setResources((prev) => append ? [...prev, ...data] : data);
      setStats(res.data.stats || stats);
      setPagination(res.data.pagination || { page: 1, totalPages: 1, totalDocs: 0, hasNextPage: false });
    } catch (err) {
      if (stamp !== resourcesRequestRef.current) return;
      if (err.response?.status === 401) toast.error("Please log in to view resources");
      else toast.error("Failed to load resources.");
    } finally {
      if (stamp === resourcesRequestRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  const handleLoadMore = () => fetchResources(pagination.page + 1, true);

  // Infinite scroll observer for smooth automatic resource loading
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !pagination.hasNextPage || loading || loadingMore || showSavedOnly) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && pagination.hasNextPage && !loadingMore && !loading) {
          fetchResources(pagination.page + 1, true);
        }
      },
      { rootMargin: "250px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [pagination.hasNextPage, pagination.page, loading, loadingMore, showSavedOnly, debouncedTerm, selectedCategory, selectedSort, showMyResourcesOnly]);

  const handleResourceAction = async (resource, actionType) => {
    if (!isSafeHttpUrl(resource.fileUrl)) {
      toast.error("This resource's link is invalid and cannot be opened.");
      return;
    }
    try {
      setResources((prev) =>
        prev.map((r) => r._id === resource._id ? { ...r, downloadsCount: (r.downloadsCount || 0) + 1 } : r)
      );
      await apiClient.patch(`/resources/${resource._id}/download`);
      let url = resource.fileUrl;
      if (actionType === "download") {
        if (url.includes("cloudinary.com") && !url.includes("fl_attachment"))
          url = url.replace("/upload/", "/upload/fl_attachment/");
        const a = document.createElement("a");
        a.href = url; a.download = resource.title || resource.fileName || "download"; a.target = "_blank";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } else {
        safeOpenUrl(url);
      }
    } catch {
      safeOpenUrl(resource.fileUrl);
    }
  };

  const handleToggleBookmark = async (id) => {
    const wasBookmarked = bookmarks.has(id.toString());
    // Optimistic update
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (wasBookmarked) next.delete(id.toString()); else next.add(id.toString());
      return next;
    });
    try {
      const res = await apiClient.post(`/profile/bookmarks/${id}`);
      if (res.data.bookmarked) {
        setCollectionModalResourceId(id.toString());
      } else {
        toast("Removed from Saved", { duration: 2000 });
      }
      // Refresh bookmark list for sidebar view
      fetchMySaved();
    } catch {
      // Revert on error
      setBookmarks((prev) => {
        const next = new Set(prev);
        if (wasBookmarked) next.add(id.toString()); else next.delete(id.toString());
        return next;
      });
      toast.error("Failed to update saved item");
    }
  };

  const clearFilters = () => {
    setSearchTerm(""); setDebouncedTerm("");
    setSelectedCategory("all");
    setSelectedSort("most_downloaded");
    setShowSavedOnly(false);
  };

  const hasFilters = searchTerm || selectedCategory !== "all" || showSavedOnly;

  const displayedResources = showSavedOnly ? savedResources : resources;
  const activeSort = SORT_OPTIONS.find((o) => o.id === selectedSort);

  return (
    <div className="gs-root">
      <Helmet>
        <title>Resource Hub | Linklet</title>
      </Helmet>
      {/* ── Toolbar ── */}
      <div className="gs-toolbar">
        <div className="gs-toolbar-inner">
          {/* Search */}
          <div className="gs-search-wrap">
            <span className="material-icons gs-search-icon">search</span>
            <input
              className="gs-search-input"
              type="text" value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search resources…"
              autoComplete="off"
            />
            {searchTerm && (
              <button className="gs-search-clear" onClick={() => setSearchTerm("")}>
                <span className="material-icons">close</span>
              </button>
            )}
            {loading && <div className="gs-search-spinner" />}
          </div>

          {/* Actions */}
          <div className="gs-toolbar-actions">
            {/* Saved toggle */}
            <button
              className={`gs-icon-btn-lg ${showSavedOnly ? "active" : ""}`}
              title="Saved Items"
              onClick={() => setShowSavedOnly((p) => !p)}
            >
              <span className="material-icons">bookmark</span>
            </button>

            {/* My uploads toggle */}
            <button
              className={`gs-icon-btn-lg ${showMyResourcesOnly ? "active" : ""}`}
              title="My Uploads"
              onClick={() => setShowMyResourcesOnly((p) => !p)}
            >
              <span className="material-icons">folder_shared</span>
              My Uploads
            </button>

            {/* Upload */}
            <button className="gs-btn-upload" onClick={() => setShowUpload(true)}>
              <span className="material-icons">upload_file</span>
              Share
            </button>
          </div>
        </div>

        {/* Filter row — Type is the one filter; file format is already shown via the card icon */}
        <div className="gs-filter-row">
          <div className="gs-filter-scroll">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={`gs-filter-pill ${selectedCategory === cat.id ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span className="material-icons">{cat.icon}</span>
                {cat.label}
                {stats.categories[cat.id] > 0 && (
                  <span className="gs-pill-count">{stats.categories[cat.id]}</span>
                )}
              </button>
            ))}
          </div>
          <div className="gs-filter-right">
            <div className="gs-sort-wrap" ref={sortRef}>
              <button className="gs-sort-btn" onClick={() => setIsSortOpen((p) => !p)}>
                <span className="material-icons gs-sort-icon">{activeSort?.icon}</span>
                <span>{activeSort?.label}</span>
                <span className={`material-icons gs-sort-chevron ${isSortOpen ? "open" : ""}`}>expand_more</span>
              </button>
              {isSortOpen && (
                <div className="gs-sort-dropdown">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      className={`gs-sort-item ${selectedSort === opt.id ? "selected" : ""}`}
                      onClick={() => { setSelectedSort(opt.id); setIsSortOpen(false); }}
                    >
                      <span className="material-icons">{opt.icon}</span>
                      {opt.label}
                      {selectedSort === opt.id && <span className="material-icons gs-check">check</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="gs-stats-bar">
        <span className="gs-stats-text">
          {loading ? "Searching…" : (
            showSavedOnly
              ? `${displayedResources.length} saved item${displayedResources.length !== 1 ? "s" : ""}`
              : `${pagination.totalDocs} result${pagination.totalDocs !== 1 ? "s" : ""}${debouncedTerm ? ` for "${debouncedTerm}"` : ""}`
          )}
        </span>
        {hasFilters && (
          <button className="gs-clear-btn" onClick={clearFilters}>
            <span className="material-icons">filter_list_off</span>
            Clear filters
          </button>
        )}
      </div>

      {/* ── Results ── */}
      <div className="gs-results">
        {loading ? (
          <div className={view === "grid" ? "gs-grid" : "gs-list-container"}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} view={view} />)}
          </div>
        ) : displayedResources.length > 0 ? (
          <>
            <div className={view === "grid" ? "gs-grid" : "gs-list-container"}>
              {displayedResources.map((r) => (
                <ResourceCard
                  key={r._id}
                  resource={r}
                  view={view}
                  saved={bookmarks.has(r._id?.toString())}
                  onToggleSave={handleToggleBookmark}
                  onOpen={setPreviewResource}
                  onAction={handleResourceAction}
                  onPromptDelete={promptDeleteResource}
                  currentUser={user}
                />
              ))}
            </div>
            {!showSavedOnly && pagination.hasNextPage && (
              <div className="gs-load-more-row" ref={loadMoreSentinelRef}>
                <button className="gs-load-more-btn" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? <><div className="gs-spinner-sm" /> Loading…</> : <><span className="material-icons">expand_more</span> Load More</>}
                </button>
                <span className="gs-load-more-meta">{resources.length} of {pagination.totalDocs} items</span>
              </div>
            )}
          </>
        ) : (
          <div className="gs-empty">
            <div className="gs-empty-icon">
              <span className="material-icons">manage_search</span>
            </div>
            <h3 className="gs-empty-title">
              {showSavedOnly ? "No saved items yet" : "Nothing found"}
            </h3>
            <p className="gs-empty-sub">
              {showSavedOnly
                ? "Save resources to find them quickly later."
                : hasFilters ? "Try adjusting your filters or search term." : "Be the first to share a resource!"}
            </p>
            {hasFilters && <button className="gs-btn-primary" onClick={clearFilters}>Clear Filters</button>}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {previewResource && (
        <PreviewModal
          resource={previewResource}
          onClose={() => setPreviewResource(null)}
          onDelete={promptDeleteResource}
        />
      )}
      {showDeletedNotice && <DeletedNoticeModal onClose={() => setShowDeletedNotice(false)} />}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => fetchResources(1, false)} />}
      {collectionModalResourceId && (
        <SaveToCollectionModal
          resourceId={collectionModalResourceId}
          onClose={() => setCollectionModalResourceId(null)}
        />
      )}
      <ConfirmDeleteModal
        isOpen={deleteConfirmResourceId != null}
        title="Delete Resource"
        message="Are you sure you want to delete this resource? This action cannot be undone."
        confirmText="Delete Resource"
        onConfirm={handleConfirmDeleteResource}
        onCancel={() => setDeleteConfirmResourceId(null)}
      />
    </div>
  );
}
