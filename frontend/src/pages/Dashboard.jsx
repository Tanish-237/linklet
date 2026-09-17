import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import AttendanceTracker from "../components/AttendanceTracker";
import DailySchedule from "../components/DailySchedule";
import TimetableUploadModal from "../components/TimetableUploadModal";
import WeeklyTimetableModal from "../components/WeeklyTimetableModal";
import SubjectInfoModal from "../components/SubjectInfoModal";
import Resource from "./Resource";
import HelpForum from "./HelpForum";
import QuestionDetail from "./QuestionDetail";
import { useAuth } from "../context/AuthContext";
import { fetchDashboardStats } from "../api/dashboard.api";
import { fetchTimetable } from "../api/timetable.api";

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // In-memory cached dashboard stats & timetable status (0ms instant tab switching)
  const {
    data: dashboardData,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["dashboard", "stats", user?._id || user?.username || "me"],
    queryFn: async () => {
      const [data, timetableData] = await Promise.all([
        fetchDashboardStats(),
        fetchTimetable().catch(() => null),
      ]);
      const ttExists = Boolean(
        (data?.metrics?.hasTimetable !== undefined ? data.metrics.hasTimetable : false) ||
        (timetableData && Array.isArray(timetableData.classes) && timetableData.classes.length > 0)
      );
      return { stats: data, hasTimetable: ttExists };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const stats = dashboardData?.stats || null;
  const hasTimetable = dashboardData?.hasTimetable ?? null;

  // Triggers for child components & modals
  const [addEventTrigger] = useState(0);
  const [scheduleRefreshTrigger, setScheduleRefreshTrigger] = useState(0);
  const [attendanceRefreshTrigger, setAttendanceRefreshTrigger] = useState(0);

  // Subject Info Modal state
  const [showSubjectInfoModal, setShowSubjectInfoModal] = useState(false);

  // Timetable Options dropdown & modal states
  const [isTimetableMenuOpen, setIsTimetableMenuOpen] = useState(false);
  const [showUploadWarningModal, setShowUploadWarningModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showWeeklyTimetableModal, setShowWeeklyTimetableModal] = useState(false);
  const timetableDropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (timetableDropdownRef.current && !timetableDropdownRef.current.contains(event.target)) {
        setIsTimetableMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadStats = useCallback(() => {
    return refetchStats();
  }, [refetchStats]);


  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    return "Good evening";
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
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950/70 via-gray-900 to-black p-4 sm:p-8 md:p-10 border border-violet-800/40 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-violet-600/10 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-1/3 -mb-12 w-60 h-60 rounded-full bg-purple-600/10 blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5 sm:gap-6">
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

              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {getTimeGreeting()},{" "}
                <span className="text-violet-400 font-bold">
                  {user?.fullName?.split(" ")[0] || user?.username || "Scholar"}
                </span>
              </h1>

              {(user?.department || user?.semester || user?.section) && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {user?.department && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-gray-800/70 text-gray-300 border border-gray-700/60 flex items-center gap-1.5">
                      <span className="material-icons text-[13px] text-violet-400">school</span>
                      {user.department}
                    </span>
                  )}
                  {user?.semester && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-gray-800/70 text-gray-300 border border-gray-700/60 flex items-center gap-1.5">
                      <span className="material-icons text-[13px] text-violet-400">auto_stories</span>
                      Sem {user.semester}
                    </span>
                  )}
                  {user?.section && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-gray-800/70 text-gray-300 border border-gray-700/60 flex items-center gap-1.5">
                      <span className="material-icons text-[13px] text-violet-400">groups</span>
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
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors duration-150 cursor-pointer"
              >
                <span className="material-icons text-base">help_outline</span>
                Ask Question
              </button>

              <button
                onClick={() => navigate("/dashboard/global-search")}
                className="flex items-center gap-2 bg-gray-800/90 hover:bg-gray-750 text-gray-200 border border-gray-700/80 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors duration-150 cursor-pointer"
              >
                <span className="material-icons text-base text-violet-400">cloud_upload</span>
                Upload Notes
              </button>
            </div>
          </div>
        </div>

        {/* Real-time KPI Stats Grid (4 Cards - Tasks Banner Removed) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
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
          ].map(({ icon, title, count, badge, color, onClick }) => (
            <div
              key={title}
              onClick={onClick}
              className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.03] cursor-pointer group flex flex-col justify-between ${color}`}
            >
              <div className="flex items-center justify-between">
                <span className="material-icons text-xl sm:text-2xl group-hover:scale-110 transition-transform">
                  {icon}
                </span>
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-1.5 py-0.5 rounded bg-black/30">
                  {badge}
                </span>
              </div>
              <div className="mt-3 sm:mt-4">
                <div className="text-xl sm:text-2xl font-extrabold text-white font-mono">{count}</div>
                <div className="text-[11px] sm:text-xs text-gray-400 font-medium mt-0.5 truncate">{title}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Onboarding: Upload Timetable Notice (Shown only for users who have never uploaded a timetable) */}
        {hasTimetable === false && (
          <div
            data-testid="timetable-onboarding-banner"
            className="relative overflow-hidden rounded-2xl bg-gray-900/60 border border-gray-800 hover:border-violet-500/30 p-5 sm:p-6 shadow-lg backdrop-blur-md transition-colors duration-200"
          >
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                  <span className="material-icons text-2xl sm:text-3xl text-violet-400">auto_awesome</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight">
                      Upload your timetable to get started
                    </h3>
                    <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      Quick Setup
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-2xl">
                    Scan your semester timetable (PDF or image) to automatically populate your Daily Schedule with lectures, labs, and tutorials, and unlock one-tap attendance tracking and bunk safety alerts.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                <button
                  type="button"
                  id="onboarding-upload-timetable-btn"
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-medium text-xs sm:text-sm px-5 py-2.5 sm:py-3 rounded-xl shadow-sm transition-colors duration-150 cursor-pointer"
                >
                  <span className="material-icons text-base">upload_file</span>
                  <span>Upload Timetable</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Bar: Subject Info and Timetable Options */}
        <div className="relative z-30 flex flex-wrap items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-gray-900/50 backdrop-blur-md border border-gray-800/80 shadow-lg">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              id="dashboard-subject-info-btn"
              onClick={() => setShowSubjectInfoModal(true)}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-gray-800/90 hover:bg-gray-750 text-gray-200 border border-gray-700/80 hover:border-violet-500/40 transition-colors cursor-pointer shadow-sm"
            >
              <span className="material-icons text-base text-violet-400">auto_stories</span>
              <span>Subject Info</span>
            </button>
          </div>

          {/* Timetable Options Dropdown */}
          <div className="relative z-50" ref={timetableDropdownRef}>
            <button
              id="dashboard-timetable-options-btn"
              onClick={() => setIsTimetableMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-gray-800/90 hover:bg-gray-750 text-gray-200 border border-gray-700/80 hover:border-violet-500/40 transition-colors cursor-pointer shadow-sm"
            >
              <span className="material-icons text-base text-violet-400">calendar_month</span>
              <span>Timetable Options</span>
              <span
                className={`material-icons text-sm text-gray-400 transition-transform duration-200 ${
                  isTimetableMenuOpen ? "rotate-180" : ""
                }`}
              >
                expand_more
              </span>
            </button>

            {isTimetableMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-2xl bg-gray-900/95 backdrop-blur-xl border border-violet-800/40 shadow-2xl z-50 py-2 divide-y divide-gray-800/80 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-1">
                  <button
                    id="dashboard-view-timetable-option"
                    onClick={() => {
                      setIsTimetableMenuOpen(false);
                      setShowWeeklyTimetableModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-gray-200 hover:text-white hover:bg-violet-600/20 rounded-xl transition cursor-pointer"
                  >
                    <span className="material-icons text-base text-violet-400">calendar_view_week</span>
                    <div className="text-left">
                      <div className="font-semibold">View Timetable</div>
                      <div className="text-[11px] text-gray-400">View & edit weekly schedule</div>
                    </div>
                  </button>

                  <button
                    id="dashboard-upload-timetable-option"
                    onClick={() => {
                      setIsTimetableMenuOpen(false);
                      setShowUploadWarningModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-gray-200 hover:text-white hover:bg-violet-600/20 rounded-xl transition cursor-pointer"
                  >
                    <span className="material-icons text-base text-purple-400">upload_file</span>
                    <div className="text-left">
                      <div className="font-semibold">Upload New Timetable</div>
                      <div className="text-[11px] text-gray-400">Scan & sync PDF timetable</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Daily Schedule & Attendance Guardian */}
        <div className="relative z-10 grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
          <DailySchedule
            onScheduleChanged={() => {
              loadStats();
              setScheduleRefreshTrigger((prev) => prev + 1);
            }}
            onAttendanceChanged={() => {
              loadStats();
              setAttendanceRefreshTrigger((prev) => prev + 1);
            }}
            addEventTrigger={addEventTrigger}
            refreshTrigger={scheduleRefreshTrigger}
          />
          <AttendanceTracker
            onAttendanceChanged={loadStats}
            refreshTrigger={attendanceRefreshTrigger}
          />
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

        {/* Warning Confirmation Modal before Uploading New Timetable */}
        {showUploadWarningModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-gray-900 border border-amber-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <span className="material-icons text-2xl">warning</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Upload New Timetable?</h3>
                  <p className="text-xs text-amber-400/90 font-medium">Important: Data Reset Notice</p>
                </div>
              </div>

              <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-200/90 space-y-2 leading-relaxed">
                <p>
                  Uploading a new timetable will <strong>permanently wipe</strong> all current <strong>Daily Schedule</strong> events and reset all <strong>Attendance Guardian</strong> records.
                </p>
                <p className="text-[11px] text-gray-400">
                  This ensures a clean start with your new semester subjects and prevents conflicting schedule items.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadWarningModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadWarningModal(false);
                    setShowUploadModal(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-900/30 transition cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-icons text-sm">upload_file</span>
                  Proceed to Upload
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Timetable Upload & Verification Modal */}
        <TimetableUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onTimetableSynced={() => {
            loadStats();
            setScheduleRefreshTrigger((prev) => prev + 1);
            setAttendanceRefreshTrigger((prev) => prev + 1);
          }}
          userSection={user?.section}
          userSubSection={user?.subSection}
        />

        {/* Full Weekly Timetable Modal */}
        <WeeklyTimetableModal
          isOpen={showWeeklyTimetableModal}
          onClose={() => setShowWeeklyTimetableModal(false)}
          onTimetableChanged={() => {
            loadStats();
            setScheduleRefreshTrigger((prev) => prev + 1);
            setAttendanceRefreshTrigger((prev) => prev + 1);
          }}
          onTimetableAbandoned={() => {
            loadStats();
            setScheduleRefreshTrigger((prev) => prev + 1);
            setAttendanceRefreshTrigger((prev) => prev + 1);
          }}
        />

        {/* Subject Information Management Modal */}
        <SubjectInfoModal
          isOpen={showSubjectInfoModal}
          onClose={() => setShowSubjectInfoModal(false)}
          onSubjectsChanged={() => {
            loadStats();
            setScheduleRefreshTrigger((prev) => prev + 1);
            setAttendanceRefreshTrigger((prev) => prev + 1);
          }}
        />
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