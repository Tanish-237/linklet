import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import AttendanceTracker from "../components/AttendanceTracker";
import DailySchedule from "../components/DailySchedule";
import Resource from "./Resource";
import HelpForum from "./HelpForum";
import QuestionDetail from "./QuestionDetail";
import { useAuth } from "../context/AuthContext";
import { fetchDashboardStats } from "../api/dashboard.api";
import { toast } from "react-toastify";

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("overview"); // 'overview', 'schedule', 'attendance'
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load real-time dashboard metrics
  const loadStats = useCallback(async () => {
    try {
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load dashboard metrics", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    if (hour >= 17 && hour < 22) return "Good evening";
    return "Good night";
  };

  const renderMainContent = () => {
    const path = location.pathname;

    if (path === "/dashboard/resources") {
      return <Resource />;
    }

    if (path.startsWith("/dashboard/help")) {
      return <HelpForum basePath="/dashboard" />;
    }

    if (path.startsWith("/dashboard/question/")) {
      return <QuestionDetail basePath="/dashboard" />;
    }

    const metrics = stats?.metrics || {
      questionsCount: 0,
      answersCount: 0,
      resourcesCount: 0,
      bookmarksCount: 0,
      pendingTasksCount: 0,
      overallAttendancePercentage: 0,
      totalLoggedClasses: 0,
      totalCoursesCount: 0,
    };

    const recentActivity = stats?.recentActivity || { questions: [], resources: [] };

    return (
      <div className="space-y-8 max-w-7xl mx-auto pb-12">
        {/* Top Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950/70 via-gray-900 to-black p-6 sm:p-8 md:p-10 border border-violet-800/40 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-violet-600/10 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-1/3 -mb-12 w-60 h-60 rounded-full bg-purple-600/10 blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-400">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {getTimeGreeting()},{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-purple-400">
                  {user?.fullName?.split(" ")[0] || user?.username || "Scholar"}
                </span>
              </h1>

              {(user?.department || user?.semester || user?.section) && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {user?.department && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-gray-800/80 text-gray-300 border border-gray-700/80 flex items-center gap-1">
                      <span className="material-icons text-[13px] text-gray-400">school</span>
                      {user.department}
                    </span>
                  )}
                  {user?.semester && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-violet-900/40 text-violet-300 border border-violet-700/40 flex items-center gap-1">
                      <span className="material-icons text-[13px] text-violet-400">auto_stories</span>
                      Sem {user.semester}
                    </span>
                  )}
                  {user?.section && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-purple-900/40 text-purple-300 border border-purple-700/40 flex items-center gap-1">
                      <span className="material-icons text-[13px] text-purple-400">groups</span>
                      Sec {user.section}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate("/dashboard/help")}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-violet-900/40 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <span className="material-icons text-base">help_outline</span>
                Ask Question
              </button>

              <button
                onClick={() => navigate("/dashboard/global-search")}
                className="flex items-center gap-2 bg-gray-800/90 hover:bg-gray-750 text-gray-200 border border-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                <span className="material-icons text-base text-violet-400">cloud_upload</span>
                Upload Notes
              </button>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1.5 bg-black/40 rounded-2xl border border-gray-800 w-fit">
          {[
            { id: "overview", label: "Overview & Highlights", icon: "space_dashboard" },
            { id: "schedule", label: "Daily Schedule", icon: "calendar_today" },
            { id: "attendance", label: "Attendance Guardian", icon: "how_to_reg" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-900/30"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              }`}
            >
              <span className="material-icons text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Real-time KPI Stats Grid (5 Cards) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            {
              icon: "quiz",
              title: "My Questions",
              count: metrics.questionsCount,
              badge: "Help Forum",
              color: "text-violet-400 border-violet-500/20 bg-violet-950/20",
              onClick: () => navigate("/dashboard/help"),
            },
            {
              icon: "forum",
              title: "My Answers",
              count: metrics.answersCount,
              badge: "Contributions",
              color: "text-blue-400 border-blue-500/20 bg-blue-950/20",
              onClick: () => navigate("/dashboard/help"),
            },
            {
              icon: "menu_book",
              title: "Resources",
              count: metrics.resourcesCount,
              badge: "Uploaded",
              color: "text-emerald-400 border-emerald-500/20 bg-emerald-950/20",
              onClick: () => navigate("/dashboard/global-search"),
            },
            {
              icon: "bookmark",
              title: "Bookmarks",
              count: metrics.bookmarksCount,
              badge: "Saved Items",
              color: "text-amber-400 border-amber-500/20 bg-amber-950/20",
              onClick: () => navigate("/dashboard/saved"),
            },
            {
              icon: "task_alt",
              title: "Tasks Today",
              count: metrics.pendingTasksCount,
              badge: "Pending",
              color: "text-pink-400 border-pink-500/20 bg-pink-950/20",
              onClick: () => setActiveTab("schedule"),
            },
          ].map(({ icon, title, count, badge, color, onClick }) => (
            <div
              key={title}
              onClick={onClick}
              className={`p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.03] cursor-pointer group flex flex-col justify-between ${color}`}
            >
              <div className="flex items-center justify-between">
                <span className="material-icons text-2xl group-hover:scale-110 transition-transform">
                  {icon}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-1.5 py-0.5 rounded bg-black/30">
                  {badge}
                </span>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-extrabold text-white font-mono">{count}</div>
                <div className="text-xs text-gray-400 font-medium mt-0.5 truncate">{title}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tab Content Display */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Side-by-side or stacked view of Today's Schedule & Attendance */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <DailySchedule onScheduleChanged={loadStats} />
              <AttendanceTracker onAttendanceChanged={loadStats} />
            </div>

            {/* Recent Contributions Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recent Questions */}
              <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="material-icons text-sm text-violet-400">help</span>
                    Recent Questions Asked
                  </h3>
                  <button
                    onClick={() => navigate("/dashboard/help")}
                    className="text-xs text-violet-400 hover:text-violet-300 transition"
                  >
                    View All
                  </button>
                </div>

                {recentActivity.questions.length === 0 ? (
                  <p className="text-xs text-gray-500 py-6 text-center">
                    No questions asked yet. Ask the community when in doubt!
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {recentActivity.questions.map((q) => (
                      <div
                        key={q._id}
                        onClick={() => navigate(`/dashboard/question/${q._id}`)}
                        className="p-3 rounded-xl bg-gray-800/40 hover:bg-gray-800/80 border border-gray-800/80 hover:border-violet-500/30 cursor-pointer transition flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-gray-200 truncate pr-2">{q.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-violet-900/40 text-violet-300 whitespace-nowrap">
                          {q.category || "General"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Resources */}
              <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="material-icons text-sm text-emerald-400">menu_book</span>
                    Recent Uploaded Resources
                  </h3>
                  <button
                    onClick={() => navigate("/dashboard/global-search")}
                    className="text-xs text-violet-400 hover:text-violet-300 transition"
                  >
                    Browse
                  </button>
                </div>

                {recentActivity.resources.length === 0 ? (
                  <p className="text-xs text-gray-500 py-6 text-center">
                    No resources uploaded yet. Share notes and papers with your batch!
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {recentActivity.resources.map((r) => (
                      <div
                        key={r._id}
                        onClick={() => navigate("/dashboard/global-search")}
                        className="p-3 rounded-xl bg-gray-800/40 hover:bg-gray-800/80 border border-gray-800/80 hover:border-emerald-500/30 cursor-pointer transition flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-gray-200 truncate pr-2">{r.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 uppercase font-mono">
                          {r.fileType || "doc"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="space-y-6">
            <DailySchedule onScheduleChanged={loadStats} />
          </div>
        )}

        {activeTab === "attendance" && (
          <div className="space-y-6">
            <AttendanceTracker onAttendanceChanged={loadStats} />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Dashboard | Linklet</title>
      </Helmet>
      {renderMainContent()}
    </>
  );
}