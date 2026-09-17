import React, { useState } from "react";

export const RELEASE_VERSION = "v1.6.4";
export const STORAGE_KEY = "linklet_last_seen_version";

export const isReleaseSeen = (version = RELEASE_VERSION) => {
  try {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (lastSeen === version) return true;
    const legacy = localStorage.getItem(`linklet_whats_new_seen_${version}`);
    if (legacy === "true") return true;
  } catch {
    // localStorage may be restricted or unavailable
  }
  return false;
};

export const markReleaseSeen = (version = RELEASE_VERSION) => {
  try {
    localStorage.setItem(STORAGE_KEY, version);
    localStorage.setItem(`linklet_whats_new_seen_${version}`, "true");
  } catch {
    // ignore
  }
};

export default function WhatsNewDropdown({
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  onClose: controlledOnClose,
  hasSeen: controlledHasSeen,
  onMarkAsSeen,
  forceShow = false,
} = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [internalHasSeen, setInternalHasSeen] = useState(() => isReleaseSeen(RELEASE_VERSION));

  const isControlled = typeof controlledIsOpen === "boolean";
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const hasSeen = typeof controlledHasSeen === "boolean" ? controlledHasSeen : internalHasSeen;

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
    markReleaseSeen(RELEASE_VERSION);
    setInternalHasSeen(true);
    if (onMarkAsSeen) {
      onMarkAsSeen();
    }
    handleClose();
  };

  const showTrigger = forceShow || !hasSeen;

  // If already seen and not open, don't occupy layout space
  if (!showTrigger && !isOpen) {
    return null;
  }

  return (
    <div className="relative">
      {/* What's New Trigger Button (shown only when unread) */}
      {showTrigger && (
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
            v1.6.4
          </span>
        </button>
      )}

      {/* Release Notes Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="What's New release notes"
          className="fixed inset-x-3 top-[76px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-88 max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-90px)] sm:max-h-none bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-800 transition-all duration-200 z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-gray-800/80 bg-gray-950/50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-100 text-sm">What's new in v1.6.4</h3>
            <span className="text-[10px] font-mono text-violet-300 bg-violet-950/70 border border-violet-800/50 px-1.5 py-0.5 rounded">
              v1.6.4
            </span>
          </div>

          {/* Clean, Human-Written Release Notes */}
          <ul className="p-4 space-y-3 text-xs text-gray-300 overflow-y-auto max-h-[50dvh] sm:max-h-none">
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">In-profile followers & following:</span> View followers and following lists directly inside the profile header and dedicated in-profile tabs with rich user cards and instant profile navigation.
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">WhatsApp-style double delivery ticks:</span> Sent messages now show double grey ticks when the recipient opens the website, transitioning to double blue ticks upon reading, with pixel-perfect normalized sizing.
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Cross-app real-time notifications:</span> Incoming messages now immediately trigger interactive toast alerts and sidebar count badges, even while browsing posts, questions, or resources.
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Optimized attachments & voice notes:</span> Streamlined media tray preview and voice recording with live waveform feedback, parallel uploading, and instant cancellation.
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Instant 0ms emoji reactions:</span> Reactions trigger optimistic UI updates with immediate feedback and background synchronization.
            </li>
          </ul>

          {/* Footer */}
          <div className="p-3 border-t border-gray-800/80 bg-gray-950/50 flex items-center justify-between text-xs">
            <a
              href="https://github.com/Tanish-237/linklet/releases/tag/v1.6.4"
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
