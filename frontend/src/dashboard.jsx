import React, { useState } from "react";

export default function Dashboard() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-screen bg-gradient-to-b from-purple-900 via-gray-800 to-black text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-gray-900 text-gray-300 flex flex-col shadow-lg">
        <div className="p-6 text-3xl font-extrabold tracking-wide border-b border-gray-700">
          Linklet
        </div>
        <nav className="flex-1 overflow-y-auto">
          <ul className="space-y-4 p-6">
            <li className="flex items-center space-x-4 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition">
              <span className="material-icons">dynamic_feed</span>
              <span>Feed</span>
            </li>
            <li className="flex items-center space-x-4 p-4 bg-purple-700 bg-opacity-40 rounded-lg hover:bg-purple-600 transition">
              <span className="material-icons">folder</span>
              <span>Resources</span>
            </li>
            <li className="flex items-center space-x-4 p-4 bg-purple-700 bg-opacity-40 rounded-lg hover:bg-purple-600 transition">
              <span className="material-icons">groups</span>
              <span>Clubs & Committees</span>
            </li>
            <li className="flex items-center space-x-4 p-4 bg-purple-700 bg-opacity-40 rounded-lg hover:bg-purple-600 transition">
              <span className="material-icons">help</span>
              <span>Questions</span>
            </li>
            <li className="flex items-center space-x-4 p-4 bg-purple-700 bg-opacity-40 rounded-lg hover:bg-purple-600 transition">
              <span className="material-icons">chat</span>
              <span>Chat</span>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-purple-800 bg-opacity-30 backdrop-blur-md shadow-md p-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex items-center space-x-6">
            {/* Notification Dropdown */}
            <div className="relative">
              <div
                className="flex items-center space-x-2 cursor-pointer"
                onClick={() => setNotificationOpen(!notificationOpen)}
              >
                <span className="material-icons">notifications</span>
              </div>
              {notificationOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-gray-900 bg-opacity-80 rounded-lg shadow-lg">
                  <ul className="py-2">
                    <li className="px-4 py-2 hover:bg-gray-700 cursor-pointer">
                      New message from John
                    </li>
                    <li className="px-4 py-2 hover:bg-gray-700 cursor-pointer">
                      Assignment deadline approaching
                    </li>
                    <li className="px-4 py-2 hover:bg-gray-700 cursor-pointer">
                      System update scheduled
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Avatar Dropdown */}
            <div className="relative">
              <div
                className="flex items-center space-x-4 cursor-pointer"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span className="text-lg">Welcome, User</span>
                <img
                  src="https://cdn-icons-png.flaticon.com/512/1326/1326382.png"
                  alt="Avatar"
                  className="w-12 h-12 rounded-full border-2 border-white"
                />
              </div>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-900 bg-opacity-80 rounded-lg shadow-lg">
                  <ul className="py-2">
                    <li className="px-4 py-2 hover:bg-gray-700 cursor-pointer">
                      Profile
                    </li>
                    <li className="px-4 py-2 hover:bg-gray-700 cursor-pointer">
                      Logout
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="p-8 flex-1 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Cards */}
            <div className="bg-purple-800 bg-opacity-40 backdrop-blur-md rounded-lg shadow-lg p-6 hover:scale-105 transform transition">
              <h2 className="text-2xl font-bold mb-2">Active Students</h2>
              <p className="text-sm">342</p>
            </div>
            <div className="bg-purple-800 bg-opacity-40 backdrop-blur-md rounded-lg shadow-lg p-6 hover:scale-105 transform transition">
              <h2 className="text-2xl font-bold mb-2">Lesson Revenue</h2>
              <p className="text-sm">$584k</p>
            </div>
            <div className="bg-purple-800 bg-opacity-40 backdrop-blur-md rounded-lg shadow-lg p-6 hover:scale-105 transform transition">
              <h2 className="text-2xl font-bold mb-2">Upcoming Lessons</h2>
              <p className="text-sm">View your schedule here.</p>
            </div>
            <div className="bg-purple-800 bg-opacity-40 backdrop-blur-md rounded-lg shadow-lg p-6 hover:scale-105 transform transition">
              <h2 className="text-2xl font-bold mb-2">Notifications</h2>
              <p className="text-sm">Check recent updates.</p>
            </div>
            <div className="bg-purple-800 bg-opacity-40 backdrop-blur-md rounded-lg shadow-lg p-6 hover:scale-105 transform transition">
              <h2 className="text-2xl font-bold mb-2">Ratings and Reviews</h2>
              <p className="text-sm">See user feedback.</p>
            </div>
            <div className="bg-purple-800 bg-opacity-40 backdrop-blur-md rounded-lg shadow-lg p-6 hover:scale-105 transform transition">
              <h2 className="text-2xl font-bold mb-2">Payments</h2>
              <p className="text-sm">Manage transactions here.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}