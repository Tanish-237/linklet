import React, { useState } from "react";

export const RELEASE_VERSION = "v2.0.0";
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
  expanded = false,
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
          className={
            expanded
              ? "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-fg-secondary hover:text-fg hover:bg-surface-2 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 group"
              : "relative flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full border border-line bg-surface-2 hover:bg-surface-3 text-fg-secondary hover:text-fg transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 group"
          }
        >
          <span className="relative flex items-center justify-center w-5 h-5 shrink-0">
            <span className="material-icons text-[20px]">campaign</span>
            {!expanded && (
              <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-accent ring-2 ring-surface" />
            )}
          </span>
          {expanded ? (
            <>
              <span className="text-[14.5px] font-medium">What's New</span>
              <span className="ml-auto text-[10px] font-semibold text-accent-fg bg-accent-soft border border-accent/30 px-1.5 py-0.5 rounded shrink-0">
                {RELEASE_VERSION}
              </span>
            </>
          ) : (
            <>
              {/* Icon-only in the collapsed rail; keep the label + version
                  reachable for screen readers (and matched by text in
                  tests) without showing a wide pill. */}
              <span className="sr-only">What's New</span>
              <span className="sr-only">{RELEASE_VERSION}</span>
            </>
          )}
        </button>
      )}

      {/* Release Notes Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="What's New release notes"
          className="fixed inset-x-3 bottom-[72px] md:inset-x-auto md:absolute md:bottom-0 md:left-full md:right-auto md:ml-3 w-auto md:w-88 max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-90px)] md:max-h-[70vh] bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-800 transition-all duration-200 z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-gray-800/80 bg-gray-950/50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-100 text-sm">What's new in {RELEASE_VERSION}</h3>
            <span className="text-[10px] font-mono text-violet-300 bg-violet-950/70 border border-violet-800/50 px-1.5 py-0.5 rounded">
              {RELEASE_VERSION}
            </span>
          </div>

          {/* Clean, Human-Written Release Notes */}
          <ul className="p-4 space-y-3 text-xs text-gray-300 overflow-y-auto max-h-[50dvh] sm:max-h-none">
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Chats open where you left off:</span> A chat with unread messages opens at the first unread one under an “unread messages” divider; everything else opens at the latest message. Unread counts are now exact and stay in sync across your devices.
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Search the whole conversation:</span> In-chat search now finds matches anywhere in the chat’s history, with “1 of N” and Enter / Shift+Enter to step through them.
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Pins, media & contact info:</span> Pinning is instant, with every pinned message reachable from the banner. The new Media & files tab shows photos, documents and voice notes, and contact details show real year, branch and class.
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Faster, smoother chat:</span> Switching chats is instant, scrolling back through history keeps your place, and failed messages can be retried in one tap.
            </li>
            <li className="leading-relaxed">
              <span className="text-gray-100 font-medium">Light & dark, polished:</span> Consistent colours and readable text in both themes, plus new, cleaner notifications everywhere in the app.
            </li>
          </ul>

          {/* Footer */}
          <div className="p-3 border-t border-gray-800/80 bg-gray-950/50 flex items-center justify-between text-xs">
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
              className="px-2.5 py-1 rounded-lg text-gray-400 hover:text-fg hover:bg-gray-800/80 transition-all font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
