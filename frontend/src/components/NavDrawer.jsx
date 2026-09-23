import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import linkletLogo from "../assets/linklet-logo.webp";
import ThemeToggle from "../theme/ThemeToggle";
import Icon from "./Icon";

const CLOSE_MS = 300;

/**
 * Navigation drawer — the same pattern as YouTube's guide: it slides OVER the
 * page with a soft shadow and a faint scrim instead of pushing content aside.
 *
 * Desktop: opened from the rail's menu button; its own menu button sits at
 * exactly the rail button's position, so the icon stays put while it slides in.
 * Phones: opened from "Explore" in the bottom bar, and also carries what the
 * bar has no room for — account, notifications, what's new, settings, log out
 * (`account`; those rows are phone-only since the desktop rail has them).
 */
export default function NavDrawer({ open, onClose, items, activePath, unreadChatCount = 0, onNavigate, onPrefetch, account }) {
  const panelRef = useRef(null);
  // Mounted only while open or animating closed; `shown` flips after the
  // off-screen panel is committed so the slide-in transitions from there.
  const [rendered, setRendered] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      return undefined;
    }
    setShown(false);
    const t = setTimeout(() => setRendered(false), CLOSE_MS);
    return () => clearTimeout(t);
  }, [open]);

  // Runs once the panel is actually in the DOM at -translate-x-full. Timing
  // the flip with animation frames alone was racy: on a busy main thread (e.g.
  // right after a page switch) React's mount and those frames could land in
  // the same frame, the browser never computed the off-screen start, and the
  // drawer popped open with no slide. Forcing a layout read here commits the
  // start position, so the transition always has somewhere to run from.
  useEffect(() => {
    if (!open || !rendered) return undefined;
    void panelRef.current?.getBoundingClientRect();
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [open, rendered]);

  useEffect(() => {
    if (!open || !shown) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    // Move focus into the drawer for keyboard users
    panelRef.current?.querySelector("[data-drawer-autofocus]")?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, shown, onClose]);

  if (!rendered) return null;

  const footerLinks = [
    { to: "/about", label: "About" },
    { to: "/contact", label: "Contact" },
    { to: "/privacy", label: "Privacy" },
    { to: "/terms", label: "Terms" },
  ];

  return (
    <div>
      {/* Scrim — just enough to separate the drawer from the page */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300 motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <div
        ref={panelRef}
        id="app-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        inert={!shown}
        className={`fixed inset-y-0 left-0 z-[61] w-72 max-w-[85vw] md:w-64 flex flex-col bg-popover border-r border-line shadow-popover transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
          shown ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 h-16 px-5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex items-center justify-center w-10 h-10 rounded-full text-fg-secondary hover:text-fg hover:bg-surface-2 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <Icon name="menu" size={22} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate("/home")}
            className="flex items-center gap-2 min-w-0 rounded-lg cursor-pointer hover:opacity-85 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <img src={linkletLogo} alt="Linklet Logo" className="h-8 w-8 rounded-full object-cover shrink-0" />
            <span className="text-base font-semibold text-fg truncate">Linklet</span>
          </button>
        </div>

        {account?.user && (
          <button
            type="button"
            onClick={() => onNavigate("/profile")}
            className="md:hidden mx-3 mb-2 flex items-center gap-3 p-3 rounded-2xl bg-surface-2/70 hover:bg-surface-2 text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <img src={account.avatar} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-line shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-fg truncate">{account.user.fullName || account.user.username}</span>
              <span className="block text-xs text-fg-muted truncate">@{account.user.username} · View profile</span>
            </span>
            <Icon name="chevron_right" size={20} className="text-fg-subtle" />
          </button>
        )}

        <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-2">
          <ul className="space-y-1">
            {items.map((item, i) => {
              const active = activePath === item.path;
              return (
                <li
                  key={item.path}
                  // Items drift in just after the panel, one after another
                  style={{ transitionDelay: shown ? `${80 + i * 30}ms` : "0ms" }}
                  className={`transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
                    shown ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                  }`}
                >
                  <button
                    type="button"
                    data-drawer-autofocus={i === 0 ? "" : undefined}
                    onClick={() => onNavigate(item.path)}
                    onMouseEnter={() => onPrefetch?.(item.path)}
                    onFocus={() => onPrefetch?.(item.path)}
                    aria-current={active ? "page" : undefined}
                    className={`w-full flex items-center gap-4 h-11 px-3 rounded-xl text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                      active ? "bg-accent-soft text-accent-fg font-semibold" : "text-fg-secondary font-medium hover:bg-surface-2 hover:text-fg"
                    }`}
                  >
                    <Icon name={item.icon} size={22} filled={active} />
                    <span className="text-[14.5px] truncate">{item.label}</span>
                    {item.path === "/chat" && unreadChatCount > 0 && (
                      <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[11px] font-bold bg-accent text-on-accent rounded-full shrink-0">
                        {unreadChatCount > 99 ? "99+" : unreadChatCount}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="my-3 mx-3 border-t border-line" />

          {account?.user && (
            <ul className="md:hidden space-y-1 mb-1">
              <DrawerRow icon="notifications" label="Notifications" onClick={account.onOpenNotifications}
                badge={account.unreadNotifications > 0 ? (account.unreadNotifications > 9 ? "9+" : String(account.unreadNotifications)) : null} />
              <DrawerRow icon="campaign" label="What's New" onClick={account.onOpenWhatsNew} badge={account.hasNewRelease ? "New" : null} subtle />
              <DrawerRow icon="settings" label="Settings" onClick={() => onNavigate("/settings")} active={activePath === "/settings"} />
              {account.isAdmin && (
                <DrawerRow icon="admin_panel_settings" label="Admin Panel" onClick={() => onNavigate("/admin")} active={activePath === "/admin"} />
              )}
            </ul>
          )}
          <ThemeToggle expanded id="drawer-theme-toggle-btn" />
          {account?.user && (
            <ul className="md:hidden mt-1">
              <DrawerRow icon="logout" label="Log out" onClick={account.onLogout} danger />
            </ul>
          )}
        </nav>

        <div className="px-6 py-4 border-t border-line text-[12px] text-fg-subtle shrink-0">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {footerLinks.map((l) => (
              <Link key={l.to} to={l.to} onClick={onClose} className="hover:text-fg transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
          <p className="mt-2">© {new Date().getFullYear()} Linklet</p>
        </div>
      </div>
    </div>
  );
}

function DrawerRow({ icon, label, onClick, badge, subtle = false, active = false, danger = false }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={`w-full flex items-center gap-4 h-11 px-3 rounded-xl text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
          danger
            ? "text-red-400 font-medium hover:bg-red-500/10"
            : active
              ? "bg-accent-soft text-accent-fg font-semibold"
              : "text-fg-secondary font-medium hover:bg-surface-2 hover:text-fg"
        }`}
      >
        <Icon name={icon} size={22} filled={active} />
        <span className="text-[14.5px] truncate">{label}</span>
        {badge && (
          <span
            className={`ml-auto shrink-0 ${
              subtle
                ? "text-[10px] font-semibold text-accent-fg bg-accent-soft border border-accent/30 px-1.5 py-0.5 rounded"
                : "min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[11px] font-bold bg-accent text-on-accent rounded-full"
            }`}
          >
            {badge}
          </span>
        )}
      </button>
    </li>
  );
}
