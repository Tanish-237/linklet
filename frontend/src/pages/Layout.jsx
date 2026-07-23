import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { apiClient } from '../api/apiClient';
import linkletLogo from '../assets/linklet-logo.png';
import defaultAvatar from '../assets/default-avatar.png';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();
  const [dropdownStates, setDropdownStates] = React.useState({
    notifications: false,
    profile: false
  });
  const dropdownRef = React.useRef(null);

  const menuItems = [
    { icon: "dynamic_feed", label: "Feed", path: "/home" },
    { icon: "library_books", label: "Resource Library", path: "/dashboard/resources" },
    { icon: "help", label: "Help Forum", path: "/dashboard/help" },
    { icon: "groups", label: "Clubs", path: "/dashboard/clubs" },
    { icon: "chat", label: "Chat", path: "/dashboard/chat" }
  ];

  const toggleDropdown = (dropdown) => {
    setDropdownStates(prev => ({
      ...prev,
      [dropdown]: !prev[dropdown],
      [dropdown === 'notifications' ? 'profile' : 'notifications']: false
    }));
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

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownStates({
          notifications: false,
          profile: false
        });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      </aside>

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-[73px] bg-black/50 backdrop-blur-md shadow-lg flex justify-between items-center border-b border-gray-800 z-20">
          <h1 className="px-6 text-3xl font-extrabold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-purple-600">
            {location.pathname === "/home" ? "Home" : location.pathname.startsWith("/dashboard/profile") ? "Profile" : "Dashboard"}
          </h1>
          <div className="flex items-center space-x-6 pr-6" ref={dropdownRef}>
            {/* Notification Icon */}
            <div className="relative">
              <button
                className="p-2 rounded-full hover:bg-violet-900/30 transition-all duration-300 cursor-pointer group flex items-center justify-center"
                onClick={() => toggleDropdown('notifications')}
              >
                <span className="material-icons text-2xl group-hover:text-violet-400 leading-none">notifications</span>
                <span className="absolute -top-1 -right-1 bg-violet-600 text-xs rounded-full w-5 h-5 flex items-center justify-center">3</span>
              </button>

              {dropdownStates.notifications && (
                <div className="absolute right-0 mt-1 w-80 bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-800 transition-all duration-300 z-50">
                  <div className="p-4 border-b border-gray-800">
                    <h3 className="text-lg font-semibold text-violet-400">Notifications</h3>
                  </div>
                  <ul className="py-2 max-h-[400px] overflow-y-auto">
                    <li className="px-4 py-3 hover:bg-violet-900/30 cursor-pointer transition-all duration-200">
                      <div className="flex items-start gap-3">
                        <span className="material-icons text-violet-400">school</span>
                        <div>
                          <p className="text-sm text-gray-300">New resource available in DSA</p>
                          <span className="text-xs text-gray-500">2 hours ago</span>
                        </div>
                      </div>
                    </li>
                    <li className="px-4 py-3 hover:bg-violet-900/30 cursor-pointer transition-all duration-200">
                      <div className="flex items-start gap-3">
                        <span className="material-icons text-violet-400">forum</span>
                        <div>
                          <p className="text-sm text-gray-300">Your question received a new answer</p>
                          <span className="text-xs text-gray-500">5 hours ago</span>
                        </div>
                      </div>
                    </li>
                  </ul>
                  <div className="p-3 border-t border-gray-800">
                    <button className="w-full text-center text-sm text-violet-400 hover:text-violet-300 transition-colors">
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                className="group flex items-center gap-2"
                onClick={() => toggleDropdown('profile')}
              >
                <img
                  src={user?.avatar || defaultAvatar}
                  alt="Avatar"
                  className="w-12 h-12 rounded-full border-2 border-gray-800 cursor-pointer group-hover:border-violet-500 transition-all duration-300 object-cover"
                />
                <span className="material-icons text-gray-400 group-hover:text-violet-400 transition-colors">
                  expand_more
                </span>
              </button>

              {dropdownStates.profile && (
                <div className="absolute right-0 mt-2 w-64 bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-800 transition-all duration-300 z-50">
                  <div className="p-4 border-b border-gray-800">
                    <div className="flex flex-col">
                      <h4 className="font-medium text-violet-400 truncate">{user?.username || "User"}</h4>
                      <p className="text-sm text-gray-400 truncate" title={user?.email || "email@example.com"}>{user?.email || "email@example.com"}</p>
                    </div>
                  </div>
                  <ul className="py-2">
                    <li>
                      <button 
                        onClick={() => navigate('/dashboard')}
                        className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-violet-900/30 transition-all duration-200"
                      >
                        <span className="material-icons text-violet-400">dashboard</span>
                        <span className="text-gray-300">Dashboard</span>
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => navigate('/dashboard/profile')}
                        className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-violet-900/30 transition-all duration-200"
                      >
                        <span className="material-icons text-violet-400">person</span>
                        <span className="text-gray-300">Profile</span>
                      </button>
                    </li>
                    <li>
                      <button 
                        className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-violet-900/30 transition-all duration-200"
                      >
                        <span className="material-icons text-violet-400">settings</span>
                        <span className="text-gray-300">Settings</span>
                      </button>
                    </li>
                    <li className="border-t border-gray-800 mt-2">
                      <button 
                        onClick={handleLogout}
                        className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-violet-900/30 transition-all duration-200"
                      >
                        <span className="material-icons text-red-400">logout</span>
                        <span className="text-red-400">Logout</span>
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto no-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}