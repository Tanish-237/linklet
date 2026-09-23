import React, { useState } from "react";

export const RELEASE_VERSION = "v2.1.0";
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
  // Extra classes for the trigger — e.g. hide it on mobile, where the panel
  // is opened from the Explore drawer instead.
  triggerClassName = "",
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
      {/* What's New Trigger Button (shown only when unread) — a full-width
          labelled row when the sidebar is extended, otherwise a compact
          icon matching theme + notifications. */}
      {showTrigger && (
        <button
          type="button"
          id="whats-new-btn"
          aria-label="What's New in Linklet"
          aria-expanded={isOpen}
          onClick={handleToggle}
          title="What's New"
          className={`relative flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full border border-line bg-surface-2 hover:bg-surface-3 text-fg-secondary hover:text-fg transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 group ${triggerClassName}`}
        >
          <span className="relative flex items-center justify-center w-5 h-5 shrink-0">
            <span className="material-icons text-[20px]">campaign</span>
            <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-accent ring-2 ring-surface" />
          </span>
          {/* Icon-only in the rail; keep the label + version reachable for
              screen readers (and matched by text in tests). */}
          <span className="sr-only">What's New</span>
          <span className="sr-only">{RELEASE_VERSION}</span>
        </button>
      )}

      {/* Release Notes Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="What's New release notes"
          className="fixed inset-x-3 bottom-[72px] md:inset-x-auto md:absolute md:bottom-0 md:left-full md:right-auto md:ml-3 w-auto md:w-88 max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-90px)] md:max-h-[70vh] bg-popover rounded-2xl shadow-popover border border-line-strong transition-all duration-200 z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-line bg-surface-2/70 flex items-center justify-between">
            <h3 className="font-semibold text-gray-100 text-sm">What's new in {RELEASE_VERSION}</h3>
            <span className="text-[10px] font-mono text-violet-300 bg-violet-950/70 border border-violet-800/50 px-1.5 py-0.5 rounded">
              {RELEASE_VERSION}
            </span>
          </div>

          {/* Clean, Human-Written Release Notes */}
          <ul className="p-4 space-y-3 text-xs text-gray-300 overflow-y-auto max-h-[50dvh] sm:max-h-none">
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">New navigation:</span> A menu drawer slides over the page on desktop, and on phones the bottom bar has Explore, which holds every page plus your account, notifications and settings.
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Pages open instantly:</span> Pages you’ve visited load from cache and refresh quietly in the background, and hovering a link starts loading it before you click.
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Truer online status:</span> You show as online only while Linklet is open in front of you, and groups say who is typing (“Asha and 2 others are typing...”).
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Jump to any message:</span> Tapping a reply’s quote, a pin or a search result takes you straight to the original, however far back it is. On phones the keyboard stays open between messages.
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Cleaner look:</span> New rounded icons, post cards with captions and stats on profiles and Saved, in-app confirmation dialogs, and a smooth light/dark switch.
            </li>
          </ul>

          {/* Footer */}
          <div className="p-3 border-t border-line bg-surface-2/70 flex items-center justify-between text-xs">
            <a
              href={`https://github.com/Tanish-237/linklet/releases/tag/${RELEASE_VERSION}`}
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
              className="px-2.5 py-1 rounded-lg text-gray-400 hover:text-fg hover:bg-surface-3 transition-all font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
