import React, { useState } from "react";

export default function Dashboard() {
  const [dropdownStates, setDropdownStates] = useState({
    notifications: false,
    profile: false
  });

  const toggleDropdown = (dropdown) => {
    setDropdownStates(prev => ({
      ...prev,
      [dropdown]: !prev[dropdown]
    }));
  };

  return (
    <div className="flex min-h-screen w-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-gray-900/50 backdrop-blur-md text-gray-300 flex flex-col shadow-lg border-r border-violet-700/20">
        <div className="p-6 border-b border-violet-700/30">
          <h1 className="text-3xl font-extrabold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-purple-600">
            Linklet
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto">
          <ul className="space-y-4 p-6">
            {["Feed", "Resources", "Clubs & Committees", "Question Forums", "Chat"].map((item) => (
              <li key={item} className="p-4 bg-gray-800/50 rounded-lg hover:bg-violet-900/30 transition-all duration-300 cursor-pointer border border-violet-500/10 hover:border-violet-500/30 group">
                <span className="group-hover:text-violet-400 transition-colors">{item}</span>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-black/50 backdrop-blur-md shadow-lg p-6 flex justify-between items-center border-b border-violet-700/20">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-purple-600">
            Dashboard
          </h1>
          <div className="flex items-center space-x-6">
            {/* Notification Icon */}
            <div className="relative">
              <button
                className="p-2 rounded-full hover:bg-violet-900/30 transition-all duration-300 cursor-pointer group"
                onMouseEnter={() => toggleDropdown('notifications')}
                onMouseLeave={() => toggleDropdown('notifications')}
              >
                <span className="material-icons text-2xl group-hover:text-violet-400">notifications</span>
                <span className="absolute -top-1 -right-1 bg-violet-600 text-xs rounded-full w-5 h-5 flex items-center justify-center">3</span>
              </button>
              
              {dropdownStates.notifications && (
                <div 
                  className="absolute right-0 mt-2 w-80 bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-violet-500/20 transition-all duration-300"
                  onMouseEnter={() => toggleDropdown('notifications')}
                  onMouseLeave={() => toggleDropdown('notifications')}
                >
                  <div className="p-4 border-b border-violet-700/30">
                    <h3 className="text-lg font-semibold text-violet-400">Notifications</h3>
                  </div>
                  <ul className="py-2">
                    <li className="px-4 py-3 hover:bg-violet-900/30 cursor-pointer transition-all duration-200">
                      <p className="text-sm">New resource added in DSA</p>
                      <span className="text-xs text-violet-400">2 minutes ago</span>
                    </li>
                    <li className="px-4 py-3 hover:bg-violet-900/30 cursor-pointer transition-all duration-200">
                      <p className="text-sm">Question answered in Forum</p>
                      <span className="text-xs text-violet-400">1 hour ago</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                className="group"
                onMouseEnter={() => toggleDropdown('profile')}
                onMouseLeave={() => toggleDropdown('profile')}
              >
                <img
                  src="https://cdn-icons-png.flaticon.com/512/1326/1326382.png"
                  alt="Avatar"
                  className="w-12 h-12 rounded-full border-2 border-violet-500/30 cursor-pointer group-hover:border-violet-500 transition-all duration-300"
                />
              </button>
              
              {dropdownStates.profile && (
                <div 
                  className="absolute right-0 mt-2 w-56 bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-violet-500/20 transition-all duration-300"
                  onMouseEnter={() => toggleDropdown('profile')}
                  onMouseLeave={() => toggleDropdown('profile')}
                >
                  <ul className="py-2">
                    <li className="px-4 py-3 hover:bg-violet-900/30 cursor-pointer transition-all duration-200 flex items-center space-x-2">
                      <span className="material-icons text-lg text-violet-400">person</span>
                      <span>Profile</span>
                    </li>
                    <li className="px-4 py-3 hover:bg-violet-900/30 cursor-pointer transition-all duration-200 flex items-center space-x-2">
                      <span className="material-icons text-lg text-violet-400">logout</span>
                      <span>Logout</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="p-8 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-violet-900/20 backdrop-blur-md rounded-lg shadow-lg p-6 hover:scale-102 transform transition-all duration-300 border border-violet-500/20 hover:border-violet-500/40">
              <h2 className="text-2xl font-bold mb-2 text-violet-400">Recent Questions</h2>
              <p className="text-sm">15 new questions today</p>
            </div>
            <div className="bg-violet-900/20 backdrop-blur-md rounded-lg shadow-lg p-6 hover:scale-102 transform transition-all duration-300 border border-violet-500/20 hover:border-violet-500/40">
              <h2 className="text-2xl font-bold mb-2 text-violet-400">Resources</h2>
              <p className="text-sm">25 learning materials available</p>
            </div>
            <div className="bg-violet-900/20 backdrop-blur-md rounded-lg shadow-lg p-6 hover:scale-102 transform transition-all duration-300 border border-violet-500/20 hover:border-violet-500/40">
              <h2 className="text-2xl font-bold mb-2 text-violet-400">Active Forums</h2>
              <p className="text-sm">5 discussions ongoing</p>
            </div>
            <div className="bg-violet-900/20 backdrop-blur-md rounded-lg shadow-lg p-6 hover:scale-102 transform transition-all duration-300 border border-violet-500/20 hover:border-violet-500/40">
              <h2 className="text-2xl font-bold mb-2 text-violet-400">Club Activities</h2>
              <p className="text-sm">3 upcoming events</p>
            </div>
            <div className="bg-violet-900/20 backdrop-blur-md rounded-lg shadow-lg p-6 hover:scale-102 transform transition-all duration-300 border border-violet-500/20 hover:border-violet-500/40">
              <h2 className="text-2xl font-bold mb-2 text-violet-400">Study Groups</h2>
              <p className="text-sm">8 active groups</p>
            </div>
            <div className="bg-violet-900/20 backdrop-blur-md rounded-lg shadow-lg p-6 hover:scale-102 transform transition-all duration-300 border border-violet-500/20 hover:border-violet-500/40">
              <h2 className="text-2xl font-bold mb-2 text-violet-400">Your Activity</h2>
              <p className="text-sm">12 contributions this week</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}