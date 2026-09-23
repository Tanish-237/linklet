import React, { useState } from "react";
import { toast } from "sonner";
import { isSafeHttpUrl, safeOpenUrl } from "../utlis/safeUrl";
import useThemeStore from "../theme/useThemeStore";
import "./PreviewModal.css";

// Each type has a lighter/brighter `dark` shade (reads well on the app's
// near-black surfaces) and a deliberately darker, more saturated `light`
// shade — the same pastel otherwise washes out against a white/cream
// background and a pale tinted chip (see Posts.css's photo/video icon pair
// for the same fix applied elsewhere).
const FILE_ICON_TYPES = {
  link:  { icon: "link",            dark: "#818cf8", light: "#4338ca" },
  image: { icon: "image",           dark: "#22d3ee", light: "#0e7490" },
  video: { icon: "movie",           dark: "#f472b6", light: "#db2777" },
  pdf:   { icon: "picture_as_pdf",  dark: "#f87171", light: "#dc2626" },
  doc:   { icon: "description",     dark: "#60a5fa", light: "#1d4ed8" },
  ppt:   { icon: "slideshow",       dark: "#fb923c", light: "#c2410c" },
  xls:   { icon: "table_chart",     dark: "#4ade80", light: "#047857" },
  zip:   { icon: "folder_zip",      dark: "#facc15", light: "#b45309" },
  txt:   { icon: "article",         dark: "#a78bfa", light: "#6d28d9" },
  other: { icon: "insert_drive_file", dark: "#94a3b8", light: "#475569" },
};

const resolveFileIconType = (fileName, fileType) => {
  if (fileType === "link") return "link";
  const ext = (fileName?.split(".").pop() || fileType || "").toLowerCase();
  if (["jpg","jpeg","png","gif","svg","webp"].includes(ext) || ext.includes("image")) return "image";
  if (["mp4","mkv","avi","mov","webm","ogg"].includes(ext) || ext.includes("video")) return "video";
  if (ext === "pdf") return "pdf";
  if (["doc","docx"].includes(ext)) return "doc";
  if (["ppt","pptx"].includes(ext)) return "ppt";
  if (["xls","xlsx","csv"].includes(ext)) return "xls";
  if (["zip","rar","tar","gz"].includes(ext)) return "zip";
  if (ext === "txt") return "txt";
  return "other";
};

export const getFileIcon = (fileName, fileType, theme = "dark") => {
  const entry = FILE_ICON_TYPES[resolveFileIconType(fileName, fileType)];
  return { icon: entry.icon, color: theme === "light" ? entry.light : entry.dark };
};

export const getPreviewUrl = (resource) => {
  const ext = (resource.fileName?.split(".").pop() || resource.fileType || "").toLowerCase();

  // The backend now rejects non-http(s) fileUrl/linkUrl values at write time,
  // but this guards against any legacy data — every branch below eventually
  // renders `url` as an iframe/img/video src or an <a>/window.open target, any
  // of which would execute a `javascript:` URL in the viewer's browser.
  if (!isSafeHttpUrl(resource.fileUrl)) {
    return { type: "invalid", url: "" };
  }

  // ensure url doesn't force download
  let url = resource.fileUrl || "";
  if (url.includes("fl_attachment")) {
     url = url.replace("fl_attachment/", "");
     url = url.replace("fl_attachment", ""); 
  }
  
  // Cloudinary forces downloads for /raw/upload/ even without fl_attachment.
  // We can bypass this for PDFs by changing it to /image/upload/ which serves them inline.
  if (ext === "pdf" && url.includes("/raw/upload/")) {
     url = url.replace("/raw/upload/", "/image/upload/");
  }
  
  if (ext === "pdf") return { type: "pdf", url };
  if (["jpg","jpeg","png","gif","svg","webp"].includes(ext) || ext.includes("image")) return { type: "image", url };
  if (["mp4","mkv","avi","mov","webm","ogg"].includes(ext) || ext.includes("video")) return { type: "video", url };
  
  if (ext === "link" || resource.fileType === "link") {
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      let videoId = "";
      if (url.includes("youtube.com/watch")) {
        videoId = new URL(url).searchParams.get("v");
      } else {
        videoId = url.split("/").pop().split("?")[0];
      }
      return { type: "youtube", url: `https://www.youtube.com/embed/${videoId}` };
    }
    return { type: "link", url };
  }

  // Microsoft Office Web Viewer is better for office docs
  if (["doc","docx","ppt","pptx","xls","xlsx","csv"].includes(ext)) {
    return { type: "ms-office", url: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}` };
  }
  
  // Google Docs Viewer for other document types
  if (["txt", "rtf"].includes(ext)) {
    return { type: "gdocs", url: `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true` };
  }
  
  return { type: "external", url };
};

import ConfirmDeleteModal from "./ConfirmDeleteModal";
import useAuthStore from "../store/useAuthStore";

const PreviewModal = ({ resource, onClose, onDelete }) => {
  const { user } = useAuthStore();
  const theme = useThemeStore((s) => s.theme);
  const preview = getPreviewUrl(resource);
  const { icon, color } = getFileIcon(resource.fileName, resource.fileType, theme);
  const [copying, setCopying] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const ownerId = resource.userId?._id || resource.userId;
  const isOwner = user?._id && (ownerId?.toString() === user._id || user.role === "admin");

  const copyLink = async () => {
    try {
      const shareUrl = `${window.location.origin}/resource-hub?preview=${resource._id}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopying(true);
      setTimeout(() => setCopying(false), 1500);
    } catch { toast.error("Could not copy link"); }
  };

  const handleConfirmDelete = () => {
    setShowConfirmDelete(false);
    if (onDelete) {
      onDelete(resource._id);
    }
  };

  return (
    <div className="gs-modal-backdrop" onClick={onClose}>
      <div className="gs-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gs-preview-header">
          <div className="gs-preview-title-row">
            <span className="material-icons" style={{ color, fontSize: 28 }}>{icon}</span>
            <div>
              <h2 className="gs-preview-title">{resource.title || resource.fileName}</h2>
              <p className="gs-preview-sub">by {resource.userId?.username || "Anonymous"}</p>
            </div>
          </div>
          <div className="gs-preview-header-actions">
            <button className="gs-icon-btn" title={copying ? "Copied!" : "Copy link"} onClick={copyLink}>
              <span className="material-icons">{copying ? "check" : "link"}</span>
            </button>
            {isOwner && (
              <button
                className="gs-icon-btn gs-delete-btn"
                title="Delete Resource"
                onClick={() => setShowConfirmDelete(true)}
                style={{ color: "rgb(var(--danger-fg))" }}
              >
                <span className="material-icons">delete</span>
              </button>
            )}
            <button className="gs-icon-btn" title="Close" onClick={onClose}>
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>
        <div className="gs-preview-body">
          {preview.type === "pdf" && <iframe src={preview.url} title="PDF Preview" className="gs-preview-iframe" allow="fullscreen" />}
          {preview.type === "image" && <img src={preview.url} alt={resource.title || "Preview"} className="gs-preview-image" />}
          {preview.type === "video" && <video src={preview.url} controls className="gs-preview-video" style={{ width: "100%", height: "100%", backgroundColor: "#000" }} />}
          {preview.type === "youtube" && <iframe src={preview.url} title="YouTube Video" className="gs-preview-iframe" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />}
          {preview.type === "ms-office" && <iframe src={preview.url} title="Office Document Preview" className="gs-preview-iframe" />}
          {preview.type === "gdocs" && <iframe src={preview.url} title="Document Preview" className="gs-preview-iframe" />}
          {preview.type === "link" && (
            <div className="gs-preview-fallback">
              <span className="material-icons" style={{ color, fontSize: 64 }}>link</span>
              <p>This is an external link resource.</p>
              <button className="gs-btn-primary" onClick={() => safeOpenUrl(resource.fileUrl)}>
                <span className="material-icons">open_in_new</span> Visit Website
              </button>
            </div>
          )}
          {preview.type === "external" && (
            <div className="gs-preview-fallback">
              <span className="material-icons" style={{ color, fontSize: 64 }}>{icon}</span>
              <p>Preview not available for this file type.</p>
              <button className="gs-btn-primary" onClick={() => safeOpenUrl(resource.fileUrl)}>
                <span className="material-icons">open_in_new</span> Download File
              </button>
            </div>
          )}
          {preview.type === "invalid" && (
            <div className="gs-preview-fallback">
              <span className="material-icons" style={{ color: "rgb(var(--danger-fg))", fontSize: 64 }}>error_outline</span>
              <p>This resource's link is invalid and cannot be opened.</p>
            </div>
          )}
        </div>
      </div>
      <ConfirmDeleteModal
        isOpen={showConfirmDelete}
        title="Delete Resource"
        message="Are you sure you want to delete this resource? This action cannot be undone."
        confirmText="Delete Resource"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </div>
  );
};

export default PreviewModal;
