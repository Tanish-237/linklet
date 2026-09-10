import React, { useState, useEffect } from "react";

export const RELEASE_VERSION = "v1.5.0";
// 24-hour display window from rollout timestamp
export const RELEASE_DATE = "2026-09-10T12:00:00.000Z";
export const DISPLAY_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function WhatsNewDropdown({
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  onClose: controlledOnClose,
  forceShow = false,
} = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const isControlled = typeof controlledIsOpen === "boolean";
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(`linklet_whats_new_seen_${RELEASE_VERSION}`);
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    } catch {
      // localStorage may not be available in private browsing or tests
    }
  }, []);

  const handleToggle = () => {
    if (isControlled && controlledOnToggle) {
      controlledOnToggle();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  const handleClose = () => {
    if (isControlled && controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(`linklet_whats_new_seen_${RELEASE_VERSION}`, "true");
    } catch {
      // ignore
    }
    setIsDismissed(true);
    handleClose();
  };

  const isExpired = Date.now() - new Date(RELEASE_DATE).getTime() > DISPLAY_DURATION_MS;

  // Display only within the 24-hour window from rollout, unless forceShow is set
  if (!forceShow && (isExpired || isDismissed)) {
    return null;
  }

  return (
    <div className="relative">
      {/* What's New Trigger Button */}
      <button
        type="button"
        id="whats-new-btn"
        aria-label="What's New in Linklet"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 hover:border-gray-600 text-gray-300 hover:text-white text-xs font-medium transition-all duration-200 cursor-pointer shadow-sm group focus:outline-none focus:ring-2 focus:ring-violet-500/40"
      >
        <span>What's New</span>
        <span className="text-[10px] font-mono text-violet-300 bg-violet-950/80 border border-violet-800/60 px-1.5 py-0.5 rounded">
          v1.5
        </span>
      </button>

      {/* Release Notes Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="What's New release notes"
          className="absolute right-0 mt-2 w-80 sm:w-88 bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-800 transition-all duration-200 z-50 overflow-hidden animate-in fade-in zoom-in-95"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-gray-800/80 bg-gray-950/50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-100 text-sm">What's new in v1.5</h3>
            <span className="text-[10px] font-mono text-violet-300 bg-violet-950/70 border border-violet-800/50 px-1.5 py-0.5 rounded">
              v1.5.0
            </span>
          </div>

          {/* Clean, Human-Written Release Notes */}
          <ul className="p-4 space-y-3 text-xs text-gray-300">
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Live notifications:</span> Instant alerts for question answers, comment replies, upvotes, and new followers.
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Threaded reply notices:</span> When someone replies to your comment on a forum answer, you'll be notified directly.
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Moderation alerts:</span> Clear notifications if a post or resource was removed during content moderation.
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Faster load times:</span> Better caching across feeds and discussions so pages open quicker.
            </li>
          </ul>

          {/* Footer */}
          <div className="p-3 border-t border-gray-800/80 bg-gray-950/50 flex items-center justify-between text-xs">
            <a
              href="https://github.com/Tanish-237/linklet/releases/tag/v1.5.0"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-violet-300 transition-colors flex items-center gap-1 font-medium"
            >
              GitHub release
              <span className="material-icons text-xs">open_in_new</span>
            </a>
            <button
              type="button"
              id="whats-new-dismiss-btn"
              onClick={handleDismiss}
              className="px-2.5 py-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/80 transition-all font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
