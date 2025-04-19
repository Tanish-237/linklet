import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import defaultAvatar from './assets/default-avatar.png';
import linkletLogo from './assets/linklet-logo.png';
import AttendanceTracker from './components/AttendanceTracker';
import DailySchedule from './components/DailySchedule';
import Resource from './pages/Resource';

export default function Dashboard() {
  const [dropdownStates, setDropdownStates] = useState({
    notifications: false,
    profile: false
  });
  
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
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

  const toggleDropdown = (dropdown) => {
    setDropdownStates(prev => ({
      ...prev,
      [dropdown]: !prev[dropdown],
      [dropdown === 'notifications' ? 'profile' : 'notifications']: false
    }));
  };

  const menuItems = [
    { icon: "dynamic_feed", label: "Feed", path: "/dashboard" },
    { icon: "library_books", label: "Resource Library", path: "/dashboard/resources" },
    { icon: "groups", label: "Clubs", path: "/dashboard/clubs" },
    { icon: "forum", label: "Forums", path: "/dashboard/forums" },
    { icon: "chat", label: "Chat", path: "/dashboard/chat" }
  ];

  const renderMainContent = () => {
    const path = location.pathname;
    
    if (path === '/dashboard/resources') {
      return <Resource />;
    }

    // Default dashboard content
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: "help", title: "Questions", count: 15 },
            { icon: "library_books", title: "Resources", count: 25 },
            { icon: "forum", title: "Forums", count: 5 },
            { icon: "groups", title: "Clubs", count: 3 },
            { icon: "school", title: "Study", count: 8 },
            { icon: "stars", title: "Activity", count: 12 },
          ].map(({ icon, title, count }) => (
            <div key={title} className="bg-violet-900/20 backdrop-blur-md rounded-lg shadow-lg p-6 hover:scale-[1.02] transform transition-all duration-300 border border-gray-800">
              <div className="flex items-center space-x-3">
                <span className="material-icons text-2xl text-violet-400">{icon}</span>
                <h2 className="text-2xl font-bold text-violet-400">{title}</h2>
              </div>
              <p className="text-4xl font-bold mt-4 text-right">{count}</p>
            </div>
          ))}
        </div>
        
        <div className="mt-8 space-y-8">
          <DailySchedule />
          <AttendanceTracker />
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      {/* Sidebar */}
      <aside className="w-72 bg-black/50 backdrop-blur-md text-gray-300 flex flex-col border-r border-gray-800">
        <div className="h-[73px] flex items-center justify-center gap-3 border-b border-gray-800 bg-black/50 backdrop-blur-md">
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-[73px] bg-black/50 backdrop-blur-md shadow-lg flex justify-between items-center border-b border-gray-800 z-20">
          <h1 className="px-6 text-3xl font-extrabold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-purple-600">
            {menuItems.find(item => item.path === location.pathname)?.label || "Dashboard"}
          </h1>
          <div className="flex items-center space-x-6 pr-6" ref={dropdownRef}>
            {/* Notification Icon */}
            <div className="relative">
              <button
                className="p-2 rounded-full hover:bg-violet-900/30 transition-all duration-300 cursor-pointer group"
                onClick={() => toggleDropdown('notifications')}
              >
                <span className="material-icons text-2xl group-hover:text-violet-400">notifications</span>
                <span className="absolute -top-1 -right-1 bg-violet-600 text-xs rounded-full w-5 h-5 flex items-center justify-center">3</span>
              </button>

              {dropdownStates.notifications && (
                <div 
                  className="absolute right-0 mt-1 w-48 bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-800 transition-all duration-300 z-50"
                >
                  <ul className="py-2">
                    <li className="px-4 py-3 hover:bg-violet-900/30 cursor-pointer transition-all duration-200">DSA</li>
                    <li className="px-4 py-3 hover:bg-violet-900/30 cursor-pointer transition-all duration-200">Forums</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                className="group"
                onClick={() => toggleDropdown('profile')}
              >
                <img
                  src={defaultAvatar}
                  alt="Avatar"
                  className="w-12 h-12 rounded-full border-2 border-gray-800 cursor-pointer group-hover:border-violet-500 transition-all duration-300"
                />
              </button>

              {dropdownStates.profile && (
                <div 
                  className="absolute right-0 mt-1 w-48 bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-800 transition-all duration-300 z-50"
                >
                  <ul className="py-2">
                    <li className="px-4 py-3 hover:bg-violet-900/30 cursor-pointer transition-all duration-200">Profile</li>
                    <li className="px-4 py-3 hover:bg-violet-900/30 cursor-pointer transition-all duration-200">Settings</li>
                    <li className="px-4 py-3 hover:bg-violet-900/30 cursor-pointer transition-all duration-200">Logout</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-8 overflow-y-auto no-scrollbar">
          {renderMainContent()}
        </main>
      </div>
    </div>
  );
}