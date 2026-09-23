import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from "sonner";
import { apiClient } from '../api/apiClient';
import linkletLogo from '../assets/linklet-logo.webp';
import defaultAvatar from '../assets/default-avatar.webp';
import AcademicOnboardingModal from '../components/AcademicOnboardingModal';
import { useSocket } from '../hooks/useSocket';
import NotificationDropdown from '../components/NotificationDropdown';
import WhatsNewDropdown, { isReleaseSeen, markReleaseSeen, RELEASE_VERSION } from '../components/WhatsNewDropdown';
import { optimizeAvatar } from "../utlis/cloudinary";
import ThemeToggle from "../theme/ThemeToggle";
import useThemeStore from "../theme/useThemeStore";
import { chatAlertsEnabled } from "../utlis/notificationPrefs";
import { clearUserCaches } from "../store/useAuthStore";

// There is no top navbar in the authenticated app shell. Every persistent
// control — navigation, theme, notifications, release notes, profile —
// lives in a single rail: a left icon rail on desktop (like YouTube's
// collapsed sidebar) that reshapes, via responsive classes only, into a
// bottom tab bar on mobile (like YouTube's own mobile app). It's one DOM
// tree the whole way — not a separate mobile drawer — so there's nothing
// to open or close on small screens.
export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();
  const socket = useSocket();
  const [unreadChatCount, setUnreadChatCount] = React.useState(0);
  const [hasSeenRelease, setHasSeenRelease] = React.useState(() => isReleaseSeen(RELEASE_VERSION));
  // Desktop-only: click the rail's top toggle to extend it into a full
  // labelled sidebar, like YouTube's own collapsed <-> expanded rail.
  // Ignored on mobile, where the rail is always the bottom tab bar.
  const [isRailExpanded, setIsRailExpanded] = React.useState(() => {
    try {
      return localStorage.getItem("linklet_rail_expanded") === "true";
    } catch {
      return false;
    }
  });

  const toggleRailExpanded = () => {
    setIsRailExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("linklet_rail_expanded", String(next));
      } catch {
        // Storage unavailable — the toggle still works for this session.
      }
      return next;
    });
  };

  // The bottom cluster's sub-components (theme/notifications/release notes)
  // render fully different markup when "expanded" rather than just
  // switching a few `md:` classes, so track viewport width here and only
  // treat the rail as expanded when it can actually show as one — otherwise
  // a desktop session resized narrower than md (with a previously expanded
  // rail saved) would leak full sidebar rows into the mobile tab bar.
  const [isDesktopViewport, setIsDesktopViewport] = React.useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
    return window.matchMedia("(min-width: 768px)").matches;
  });
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e) => setIsDesktopViewport(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  const showExpandedRail = isRailExpanded && isDesktopViewport;
  const [dropdownStates, setDropdownStates] = React.useState({
    whatsNew: false,
    notifications: false,
    profile: false
  });
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const dropdownRef = React.useRef(null);
  const mainRef = React.useRef(null);

  // <main> is a single persistent scroll container across route changes
  // (it isn't remounted, just re-filled), so without this a page opened
  // while still scrolled down on the previous one would render already
  // scrolled down instead of at the top.
  React.useEffect(() => {
    if (typeof mainRef.current?.scrollTo === "function") {
      mainRef.current.scrollTo(0, 0);
    } else if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  // Clear unread chat count when user visits chat page
  React.useEffect(() => {
    if (location.pathname.startsWith("/chat")) {
      setUnreadChatCount(0);
    }
  }, [location.pathname]);

  // Seed the muted-chats cache from the server on every app load. The toast
  // listener below reads it from localStorage (ChatSidebar keeps it current
  // when the user mutes/unmutes during the session), but on a new device or
  // after cleared storage that cache would be empty until /chat is opened —
  // and muted chats would still toast everywhere else in the app.
  React.useEffect(() => {
    const currentUserId = (user?._id || user?.id)?.toString();
    if (!currentUserId) return;
    let cancelled = false;
    apiClient
      .get("/chat/chat-settings/muted")
      .then((res) => {
        if (cancelled || !Array.isArray(res?.data?.data)) return;
        try {
          localStorage.setItem(`linklet_muted_chats_${currentUserId}`, JSON.stringify(res.data.data));
        } catch {
          // Storage unavailable — fall back to whatever the cache already had
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?._id, user?.id]);

  // Global socket listener for chat message notifications across the entire app
  React.useEffect(() => {
    if (!socket || !user?._id) return;

    const handleGlobalMessageReceived = (newMessage) => {
      const senderId = (newMessage?.sender?._id || newMessage?.sender)?.toString();
      const currentUserId = (user?._id || user?.id)?.toString();

      // Don't notify sender of their own messages
      if (senderId && senderId === currentUserId) return;

      // If user is currently on the chat page, let ChatPage handle in-chat alerts
      if (location.pathname.startsWith("/chat")) return;

      // A muted chat should produce neither the badge count nor the toast — this
      // mirrors ChatPage.jsx's own in-chat alert suppression, which only applies
      // while the user is actually on /chat. Without this check here too, muting
      // a chat did nothing for the far more common case of being elsewhere in the app.
      const msgChatId = (newMessage?.chat?._id || newMessage?.chat)?.toString();
      try {
        const rawMuted = localStorage.getItem(`linklet_muted_chats_${currentUserId}`);
        const mutedChatIds = rawMuted ? JSON.parse(rawMuted) : [];
        if (msgChatId && mutedChatIds.includes(msgChatId)) return;
      } catch {
        // Safe fallback — treat as unmuted if the cache is unreadable
      }

      // Increment sidebar chat badge
      setUnreadChatCount((prev) => prev + 1);

      // Show toast notification
      try {
        if (chatAlertsEnabled()) {
          const senderName =
            newMessage?.sender?.fullName || newMessage?.sender?.username || "New message";
          const previewText =
            newMessage?.content ||
            (newMessage?.mediaType ? `sent a ${newMessage.mediaType}` : "sent a message");

          const chatId = (newMessage?.chat?._id || newMessage?.chat)?.toString();
          // Same id per sender: a burst of messages updates one toast in
          // place instead of stacking a new one per message.
          toast.message(senderName, {
            id: `global_chat_${senderId || "msg"}`,
            description: previewText,
            duration: 5000,
            action: {
              label: "Open",
              onClick: () => navigate(`/chat${chatId ? `?chatId=${chatId}` : ""}`),
            },
          });
        }
      } catch {
        // Safe fallback
      }
    };

    socket.on("message received", handleGlobalMessageReceived);
    return () => {
      socket.off("message received", handleGlobalMessageReceived);
    };
  }, [socket, user?._id, location.pathname, navigate]);

  const handleMarkReleaseSeen = () => {
    markReleaseSeen(RELEASE_VERSION);
    setHasSeenRelease(true);
  };

  const menuItems = [
    { icon: "dynamic_feed", label: "Feed", path: "/home" },
    { icon: "dashboard", label: "Dashboard", path: "/dashboard" },
    { icon: "chat", label: "Chat", path: "/chat" },
    { icon: "folder_open", label: "Resource Hub", path: "/resource-hub" },
    { icon: "bookmark", label: "Saved", path: "/saved" },
    { icon: "help", label: "Help Forum", path: "/help" }
  ];

  const toggleDropdown = (dropdown) => {
    setDropdownStates(prev => ({
      whatsNew: dropdown === 'whatsNew' ? !prev.whatsNew : false,
      notifications: dropdown === 'notifications' ? !prev.notifications : false,
      profile: dropdown === 'profile' ? !prev.profile : false
    }));
  };

  const closeDropdowns = () => {
    setDropdownStates({
      whatsNew: false,
      notifications: false,
      profile: false
    });
  };

  const handleLogout = async () => {
    try {
      await apiClient.post(`/auth/logout`);
      try {
        window.localStorage.removeItem("accessToken");
      } catch {
        // Storage unavailable — nothing to remove
      }
      clearUserCaches();
      setUser(null);
      toast.success("Logged out successfully");
      navigate("/");
    } catch {
      toast.error("Logout failed");
    }
  };

  // Close dropdowns when clicking outside or pressing Escape
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeDropdowns();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeDropdowns();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row bg-canvas text-fg overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 min-h-0 order-1 md:order-2 overflow-hidden">
        <main id="app-main-scroll" ref={mainRef} className={`flex-1 min-h-0 ${location.pathname === '/chat' ? 'p-0 overflow-hidden' : 'p-3 sm:p-6 md:p-8 overflow-y-auto no-scrollbar bg-canvas'}`}>
          {children}
        </main>
      </div>

      {/* The Rail — a left icon rail on desktop, a bottom tab bar on mobile.
          One nav list, one bottom cluster (theme / release notes /
          notifications / profile), reshaped purely with responsive classes.
          A normal flex sibling (not `fixed`) so it reserves its own space —
          nothing above it needs manual bottom-padding to avoid overlap. */}
      <aside
        id="app-sidebar"
        className={`order-2 md:order-1 h-16 md:h-full w-full ${isRailExpanded ? "md:w-60" : "md:w-20"} bg-surface border-t md:border-t-0 md:border-r border-line flex flex-row md:flex-col shrink-0`}
      >
        {/* Toggle (desktop rail only — a bottom tab bar has no room for it).
            Collapsed: just the hamburger, centered. Expanded: the hamburger
            plus logo + wordmark, properly spaced — the logo only appears
            once there's room for it, so it's never cramped next to the
            toggle. Click the toggle to extend the rail into a full
            labelled sidebar, same as YouTube's own collapsed <-> expanded
            rail. */}
        <div className={`hidden md:flex items-center h-16 shrink-0 ${showExpandedRail ? "justify-start px-3 gap-3" : "justify-center px-2"}`}>
          <button
            type="button"
            id="rail-expand-toggle-btn"
            onClick={toggleRailExpanded}
            aria-label={isRailExpanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={isRailExpanded}
            className="p-2.5 rounded-full text-fg-secondary hover:text-fg hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
          >
            <span className="material-icons text-[22px]">menu</span>
          </button>
          {showExpandedRail && (
            <div
              className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity min-w-0"
              onClick={() => navigate('/home')}
            >
              <img src={linkletLogo} alt="Linklet Logo" className="h-8 w-8 rounded-full object-cover shrink-0" />
              <span className="text-base font-semibold text-fg truncate">Linklet</span>
            </div>
          )}
        </div>

        <nav className="flex-1 min-w-0 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto no-scrollbar md:py-2">
          <ul className="flex flex-row md:flex-col h-full md:h-auto items-stretch md:space-y-1 px-1 md:px-2">
            {menuItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <li
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  aria-label={item.label}
                  title={item.label}
                  className={`flex-1 md:flex-auto flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 my-1 md:my-0 rounded-xl cursor-pointer transition-colors duration-150 group min-w-[56px] ${
                    showExpandedRail
                      ? "md:flex-row md:w-full md:justify-start md:gap-3 md:px-3 md:py-2.5"
                      : "md:flex-col md:justify-start md:gap-1 md:px-1 md:py-2.5 md:rounded-2xl md:min-w-0"
                  } ${active ? "bg-accent-soft" : "hover:bg-surface-2"}`}
                >
                  <span className="relative flex items-center justify-center shrink-0">
                    <span className={`material-icons text-[23px] md:text-[22px] transition-colors ${active ? "text-accent-fg" : "text-fg-secondary group-hover:text-fg"}`}>
                      {item.icon}
                    </span>
                    {item.path === "/chat" && unreadChatCount > 0 && !showExpandedRail && (
                      <span className="absolute -top-1.5 -right-2 md:-top-1 md:-right-2 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold bg-accent text-on-accent rounded-full shadow-sm">
                        {unreadChatCount > 99 ? "99+" : unreadChatCount}
                      </span>
                    )}
                  </span>
                  {/* Icon-only on mobile — a bottom tab bar has no room for
                      six labels plus the notification/profile cluster, and
                      production apps (Instagram, X, YouTube) all drop labels
                      at this width. Desktop keeps them (icon rail always
                      shows a label; the expanded sidebar just grows it). */}
                  <span className={`hidden md:block leading-tight transition-colors text-center md:text-[10px] ${showExpandedRail ? "md:text-[14.5px] md:text-left" : ""} ${active ? "text-accent-fg font-semibold" : "text-fg-secondary font-medium group-hover:text-fg"}`}>
                    {item.label}
                  </span>
                  {item.path === "/chat" && unreadChatCount > 0 && showExpandedRail && (
                    <span className="hidden md:flex ml-auto min-w-[20px] h-5 px-1.5 items-center justify-center text-[11px] font-bold bg-accent text-on-accent rounded-full shadow-sm shrink-0">
                      {unreadChatCount > 99 ? "99+" : unreadChatCount}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom cluster: theme, release notes, notifications, profile+logout.
            Every item shares the same gap and, on mobile / collapsed
            desktop, the same fixed circle size, so spacing reads evenly
            instead of each control sizing itself independently. */}
        <div
          className={`flex flex-row md:flex-col items-center gap-1.5 md:gap-2 border-l md:border-l-0 md:border-t border-line px-1.5 md:px-2 py-1.5 md:py-2.5 shrink-0 relative z-50 ${showExpandedRail ? "md:items-stretch md:w-full" : ""}`}
          ref={dropdownRef}
        >
          {/* Mobile's bottom row only has room for the nav icons plus
              notifications + profile — theme and release notes move into
              the profile menu below (mobile-only rows there) instead of
              competing for space here. Desktop keeps its own dedicated
              buttons, where there's room; wrapping each in a plain
              `hidden md:contents` span (rather than a new flex container)
              keeps it a no-op for the existing desktop alignment classes. */}
          <span className="hidden md:contents">
            <ThemeToggle expanded={showExpandedRail} />
          </span>

          <span className="hidden md:contents">
            <WhatsNewDropdown
              isOpen={dropdownStates.whatsNew}
              onToggle={() => toggleDropdown('whatsNew')}
              onClose={() => setDropdownStates(prev => ({ ...prev, whatsNew: false }))}
              hasSeen={hasSeenRelease}
              onMarkAsSeen={handleMarkReleaseSeen}
              expanded={showExpandedRail}
            />
          </span>

          <NotificationDropdown
            isOpen={dropdownStates.notifications}
            onToggle={() => toggleDropdown('notifications')}
            onClose={() => setDropdownStates(prev => ({ ...prev, notifications: false }))}
            expanded={showExpandedRail}
          />

          {/* Profile */}
          <div className={`relative ${showExpandedRail ? "md:w-full" : ""}`}>
            <button
              id="layout-avatar-dropdown-btn"
              className={`group flex items-center cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                showExpandedRail
                  ? "md:w-full md:gap-2.5 md:px-2 md:py-1.5 md:rounded-xl md:hover:bg-surface-2 p-0.5 rounded-full hover:ring-2 hover:ring-accent/40"
                  : "p-0.5 rounded-full hover:ring-2 hover:ring-accent/40"
              }`}
              onClick={() => toggleDropdown('profile')}
              aria-expanded={dropdownStates.profile}
              aria-label="User menu"
            >
              <img
                src={optimizeAvatar(user?.avatar, 40) || defaultAvatar}
                alt="Avatar"
                className="w-9 h-9 md:w-10 md:h-10 rounded-full border-2 border-line group-hover:border-accent transition-all duration-200 object-cover shrink-0"
              />
              {showExpandedRail && (
                <span className="hidden md:block text-[13.5px] font-medium text-fg-secondary truncate min-w-0">
                  {user?.username || "Account"}
                </span>
              )}
            </button>

            {dropdownStates.profile && (
              <div className="fixed right-2 left-auto bottom-[72px] md:absolute md:bottom-0 md:left-full md:right-auto md:top-auto md:ml-3 w-64 max-w-[calc(100vw-1rem)] bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-800 transition-all duration-200 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-4 border-b border-gray-800/80 bg-gray-950/50">
                  <div className="flex flex-col">
                    <h4 className="font-medium text-accent-fg truncate text-[15px]">
                      {user?.username || "User"}
                    </h4>
                    <p className="text-sm text-fg-muted truncate mt-0.5" title={user?.email || "email@example.com"}>
                      {user?.email || "email@example.com"}
                    </p>
                  </div>
                </div>
                <ul className="py-2">
                  <li>
                    <button
                      id="layout-dropdown-profile-btn"
                      onClick={() => {
                        setDropdownStates(prev => ({ ...prev, profile: false }));
                        navigate('/profile');
                      }}
                      className="w-full px-4 py-2.5 flex items-center gap-3.5 text-left hover:bg-accent-soft transition-all duration-200 cursor-pointer group"
                    >
                      <span className="material-icons text-xl text-accent-fg">person</span>
                      <span className="text-[15px] font-medium text-fg-secondary group-hover:text-fg transition-colors">Profile</span>
                    </button>
                  </li>
                  {/* Theme has its own dedicated button on desktop (hidden
                      here via md:hidden below) — on mobile it's only
                      reachable from this menu since the standalone toggle
                      is hidden from the bottom row to save space. */}
                  <li className="md:hidden">
                    <button
                      id="layout-dropdown-theme-btn"
                      onClick={() => {
                        toggleTheme();
                        setDropdownStates(prev => ({ ...prev, profile: false }));
                      }}
                      className="w-full px-4 py-2.5 flex items-center gap-3.5 text-left hover:bg-accent-soft transition-all duration-200 cursor-pointer group"
                    >
                      <span className="material-icons text-xl text-accent-fg">
                        {theme === "dark" ? "dark_mode" : "light_mode"}
                      </span>
                      <span className="text-[15px] font-medium text-fg-secondary group-hover:text-fg transition-colors">
                        {theme === "dark" ? "Dark mode" : "Light mode"}
                      </span>
                    </button>
                  </li>
                  <li>
                    <button
                      id="layout-dropdown-settings-btn"
                      onClick={() => {
                        setDropdownStates(prev => ({ ...prev, profile: false }));
                        navigate('/settings');
                      }}
                      className="w-full px-4 py-2.5 flex items-center gap-3.5 text-left hover:bg-accent-soft transition-all duration-200 cursor-pointer group"
                    >
                      <span className="material-icons text-xl text-accent-fg">settings</span>
                      <span className="text-[15px] font-medium text-fg-secondary group-hover:text-fg transition-colors">Settings</span>
                    </button>
                  </li>
                  <li>
                    <button
                      id="layout-dropdown-whats-new-btn"
                      onClick={() => {
                        setDropdownStates({ profile: false, notifications: false, whatsNew: true });
                        if (!hasSeenRelease) {
                          handleMarkReleaseSeen();
                        }
                      }}
                      className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-accent-soft transition-all duration-200 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="material-icons text-xl text-accent-fg">new_releases</span>
                        <span className="text-[15px] font-medium text-fg-secondary group-hover:text-fg transition-colors">What's New</span>
                      </div>
                      {!hasSeenRelease && (
                        <span className="text-[10px] font-semibold text-accent-fg bg-accent-soft border border-accent/30 px-1.5 py-0.5 rounded">
                          New
                        </span>
                      )}
                    </button>
                  </li>
                  {user?.role === "admin" && (
                    <li>
                      <button
                        id="layout-dropdown-admin-btn"
                        onClick={() => {
                          setDropdownStates(prev => ({ ...prev, profile: false }));
                          navigate('/admin');
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3.5 text-left hover:bg-amber-500/10 transition-all duration-200 cursor-pointer group"
                      >
                        <span className="material-icons text-xl text-amber-400">admin_panel_settings</span>
                        <span className="text-[15px] font-medium text-amber-400 group-hover:text-amber-300 transition-colors">Admin Panel</span>
                      </button>
                    </li>
                  )}
                  <li className="border-t border-line mt-1 pt-1">
                    <button
                      id="layout-dropdown-logout-btn"
                      onClick={() => {
                        setDropdownStates(prev => ({ ...prev, profile: false }));
                        handleLogout();
                      }}
                      className="w-full px-4 py-2.5 flex items-center gap-3.5 text-left hover:bg-accent-soft transition-all duration-200 cursor-pointer group"
                    >
                      <span className="material-icons text-xl text-red-400">logout</span>
                      <span className="text-[15px] font-medium text-red-400">Logout</span>
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Global Academic Onboarding Modal (for users with unset department) */}
      <AcademicOnboardingModal />
    </div>
  );
}
