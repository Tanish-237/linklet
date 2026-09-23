import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

// A share dropdown anchored to its trigger button via a JS-computed
// `position: fixed` placement (viewport coordinates) instead of a static
// CSS `position: absolute`. It opens downward by default and flips upward
// only when there isn't room below, and is never clipped by a scrollable or
// rounded-corner ancestor (position: fixed escapes those, unlike absolute).
//
// Rendered through a portal into document.body rather than staying a DOM
// descendant of the post card: `.feed-card` has `backdrop-filter` (and a
// hover `transform`), and per the CSS spec either of those on an ancestor
// makes IT the containing block for a `position: fixed` descendant instead
// of the viewport — so the JS-computed viewport coordinates were silently
// being applied relative to the card, badly misplacing the menu. Portaling
// out from under that ancestor is what actually fixes it.
const SharePostMenu = ({ getUrl, shareText, className = "" }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 190;
      const menuWidth = 170;
      const openUp = window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight;
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - menuWidth / 2, 8),
        window.innerWidth - menuWidth - 8
      );
      setPos(
        openUp
          ? { bottom: window.innerHeight - rect.top + 6, left }
          : { top: rect.bottom + 6, left }
      );
    }
    setOpen((o) => !o);
  };

  const handleShare = async (platform) => {
    const url = getUrl();
    const text = shareText || "Check out this post on Linklet:";
    switch (platform) {
      case "twitter":
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
        break;
      case "linkedin":
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`);
        break;
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`);
        break;
      case "copy":
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard!");
        break;
      default:
        break;
    }
    setOpen(false);
  };

  return (
    <div className={`feed-card__share-wrap ${className}`} ref={wrapRef}>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        className="feed-card__share-btn"
        aria-label="Share"
      >
        <span className="material-icons">share</span>
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          className="feed-card__share-menu"
          style={{ position: "fixed", ...pos }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button onClick={() => handleShare("copy")} className="feed-card__share-option">
            <span className="material-icons">link</span>
            Copy Link
          </button>
          <button onClick={() => handleShare("twitter")} className="feed-card__share-option">
            <span className="material-icons">tag</span>
            Twitter / X
          </button>
          <button onClick={() => handleShare("linkedin")} className="feed-card__share-option">
            <span className="material-icons">work</span>
            LinkedIn
          </button>
          <button onClick={() => handleShare("whatsapp")} className="feed-card__share-option">
            <span className="material-icons">chat</span>
            WhatsApp
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SharePostMenu;
