import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { apiClient } from '../api/apiClient';
import linkletLogo from '../assets/linklet-logo.png';
import defaultAvatar from '../assets/default-avatar.png';
import AcademicOnboardingModal from '../components/AcademicOnboardingModal';
import NotificationDropdown from '../components/NotificationDropdown';
import WhatsNewDropdown, { isReleaseSeen, markReleaseSeen, RELEASE_VERSION } from '../components/WhatsNewDropdown';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();
  const [hasSeenRelease, setHasSeenRelease] = React.useState(() => isReleaseSeen(RELEASE_VERSION));
  const [dropdownStates, setDropdownStates] = React.useState({
    whatsNew: false,
    notifications: false,
    profile: false
  });
  const dropdownRef = React.useRef(null);

  const handleMarkReleaseSeen = () => {
    markReleaseSeen(RELEASE_VERSION);
    setHasSeenRelease(true);
  };

  const menuItems = [
    { icon: "dynamic_feed", label: "Feed", path: "/home" },
    { icon: "dashboard", label: "Dashboard", path: "/dashboard" },
    { icon: "chat", label: "Chat", path: "/dashboard/chat" },
    { icon: "search", label: "Global Search", path: "/dashboard/global-search" },
    { icon: "bookmark", label: "Saved", path: "/dashboard/saved" },
    { icon: "help", label: "Help Forum", path: "/dashboard/help" }
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
      setUser(null);
      toast.success("Logged out successfully");
      navigate("/");
    } catch (error) {
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
    <div className="fixed inset-0 flex overflow-hidden bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      {/* Sidebar */}
      <aside className="w-72 bg-black/50 backdrop-blur-md text-gray-300 flex flex-col border-r border-gray-800">
        <div 
          className="h-[73px] flex items-center justify-center gap-3 border-b border-gray-800 bg-black/50 backdrop-blur-md cursor-pointer hover:bg-violet-900/10 transition-all"
          onClick={() => navigate('/home')}
        >
          <img src={linkletLogo} alt="Linklet Logo" className="h-10 w-10 rounded-full object-cover" />
          <h1 className="text-3xl font-extrabold tracking-wide">
            Linklet
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto no-scrollbar">
          <ul className="space-y-4 p-6">
            {menuItems.map((item) => (
              <li 
                key={item.label} 
                onClick={() => navigate(item.path)}
                className={`p-4 rounded-lg transition-all duration-300 cursor-pointer border border-violet-500/10 hover:border-violet-500/30 group
                  ${location.pathname === item.path ? 'bg-violet-900/30 border-violet-500/30' : 'bg-gray-800/50 hover:bg-violet-900/30'}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`material-icons text-2xl transition-colors ${location.pathname === item.path ? 'text-violet-400' : 'group-hover:text-violet-400'}`}>
                    {item.icon}
                  </span>
                  <span className={`transition-colors ${location.pathname === item.path ? 'text-violet-400' : 'group-hover:text-violet-400'}`}>
                    {item.label}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-800 flex flex-col gap-2.5">
          <button
            onClick={handleLogout}
            className="w-full p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer"
          >
            <span className="material-icons text-lg">logout</span>
            Logout
          </button>

          <div className="flex items-center justify-between text-[11px] text-gray-500 px-1 pt-1">
            <span>Linklet</span>
            <button
              type="button"
              id="sidebar-version-btn"
              onClick={() => toggleDropdown('whatsNew')}
              className="text-gray-500 hover:text-violet-400 font-mono transition-colors cursor-pointer flex items-center gap-1"
              title={`View ${RELEASE_VERSION} release notes`}
            >
              <span>{RELEASE_VERSION}</span>
              {!hasSeenRelease && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
              )}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-[73px] bg-black/50 backdrop-blur-md shadow-lg flex justify-between items-center border-b border-gray-800 z-40 relative">
          <h1 className="px-6 text-2xl font-bold tracking-tight text-white">
            {(() => {
              const currentMenuItem = menuItems.find(item => location.pathname === item.path);
              if (currentMenuItem) return currentMenuItem.label;
              if (location.pathname.startsWith("/dashboard/profile")) return "Profile";
              if (location.pathname.startsWith("/dashboard/settings") || location.pathname.startsWith("/settings")) return "Settings";
              if (location.pathname.startsWith("/dashboard/question/")) return "Question Detail";
              if (location.pathname === "/posts") return "Feed";
              if (location.pathname.startsWith("/posts/")) return "Post";
              return "Dashboard";
            })()}
          </h1>
          <div className="flex items-center gap-3 pr-6 relative z-50" ref={dropdownRef}>
            {/* What's New Dropdown (Production-grade: transient announcement trigger until seen, permanent menu access) */}
            <WhatsNewDropdown
              isOpen={dropdownStates.whatsNew}
              onToggle={() => toggleDropdown('whatsNew')}
              onClose={() => setDropdownStates(prev => ({ ...prev, whatsNew: false }))}
              hasSeen={hasSeenRelease}
              onMarkAsSeen={handleMarkReleaseSeen}
            />

            {/* Real-time Notification Dropdown */}
            <NotificationDropdown
              isOpen={dropdownStates.notifications}
              onToggle={() => toggleDropdown('notifications')}
              onClose={() => setDropdownStates(prev => ({ ...prev, notifications: false }))}
            />

            {/* Profile */}
            <div className="relative">
              <button
                id="layout-avatar-dropdown-btn"
                className="group flex items-center gap-2 cursor-pointer p-1 rounded-full hover:bg-violet-950/40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                onClick={() => toggleDropdown('profile')}
                aria-expanded={dropdownStates.profile}
                aria-label="User menu"
              >
                <img
                  src={user?.avatar || defaultAvatar}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full border-2 border-gray-800 group-hover:border-violet-500 transition-all duration-200 object-cover"
                />
                <span className={`material-icons text-gray-400 group-hover:text-violet-400 transition-all duration-200 ${
                  dropdownStates.profile ? "rotate-180 text-violet-400" : "group-hover:translate-y-0.5"
                }`}>
                  expand_more
                </span>
              </button>

              {dropdownStates.profile && (
                <div className="absolute right-0 mt-2 w-64 bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-800 transition-all duration-200 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="p-4 border-b border-gray-800/80 bg-gray-950/50">
                    <div className="flex flex-col">
                      <h4 className="font-medium text-violet-400 truncate text-[15px]">
                        {user?.username || "User"}
                      </h4>
                      <p className="text-sm text-gray-400 truncate mt-0.5" title={user?.email || "email@example.com"}>
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
                          navigate('/dashboard/profile');
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3.5 text-left hover:bg-violet-900/30 transition-all duration-200 cursor-pointer group"
                      >
                        <span className="material-icons text-xl text-violet-400">person</span>
                        <span className="text-[15px] font-medium text-gray-200 group-hover:text-white transition-colors">Profile</span>
                      </button>
                    </li>
                    <li>
                      <button 
                        id="layout-dropdown-settings-btn"
                        onClick={() => {
                          setDropdownStates(prev => ({ ...prev, profile: false }));
                          navigate('/dashboard/settings');
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3.5 text-left hover:bg-violet-900/30 transition-all duration-200 cursor-pointer group"
                      >
                        <span className="material-icons text-xl text-violet-400">settings</span>
                        <span className="text-[15px] font-medium text-gray-200 group-hover:text-white transition-colors">Settings</span>
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
                        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-violet-900/30 transition-all duration-200 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3.5">
                          <span className="material-icons text-xl text-violet-400">new_releases</span>
                          <span className="text-[15px] font-medium text-gray-200 group-hover:text-white transition-colors">What's New</span>
                        </div>
                        {!hasSeenRelease && (
                          <span className="text-[10px] font-semibold text-violet-300 bg-violet-950/80 border border-violet-800/60 px-1.5 py-0.5 rounded">
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
                            navigate('/dashboard/admin');
                          }}
                          className="w-full px-4 py-2.5 flex items-center gap-3.5 text-left hover:bg-amber-500/10 transition-all duration-200 cursor-pointer group"
                        >
                          <span className="material-icons text-xl text-amber-400">admin_panel_settings</span>
                          <span className="text-[15px] font-medium text-amber-300 group-hover:text-amber-200 transition-colors">Admin Panel</span>
                        </button>
                      </li>
                    )}
                    <li className="border-t border-gray-800/80 mt-1 pt-1">
                      <button 
                        id="layout-dropdown-logout-btn"
                        onClick={() => {
                          setDropdownStates(prev => ({ ...prev, profile: false }));
                          handleLogout();
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3.5 text-left hover:bg-violet-900/30 transition-all duration-200 cursor-pointer group"
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
        </header>

        {/* Main Content */}
        <main className={`flex-1 ${location.pathname === '/dashboard/chat' ? 'p-0 overflow-hidden' : 'p-8 overflow-y-auto no-scrollbar'}`}>
          {children}
        </main>
      </div>

      {/* Global Academic Onboarding Modal (for users with unset department) */}
      <AcademicOnboardingModal />
    </div>
  );
}