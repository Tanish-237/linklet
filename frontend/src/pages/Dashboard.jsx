import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import AttendanceTracker from "../components/AttendanceTracker";
import DailySchedule from "../components/DailySchedule";
import { useAuth } from "../context/AuthContext";
import { fetchDashboardStats } from "../api/dashboard.api";
import { fetchTimetable } from "../api/timetable.api";

// The three timetable modals are only ever opened on demand, so they're split
// out of the Dashboard chunk and fetched the first time one is opened.
const TimetableUploadModal = lazy(() => import("../components/TimetableUploadModal"));
const WeeklyTimetableModal = lazy(() => import("../components/WeeklyTimetableModal"));
const SubjectInfoModal = lazy(() => import("../components/SubjectInfoModal"));

export default function Dashboard() {
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
        <div className="relative overflow-hidden rounded-3xl bg-surface p-4 sm:p-8 md:p-10 border border-line shadow-sm">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-accent/10 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-1/3 -mb-12 w-60 h-60 rounded-full bg-accent/10 blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5 sm:gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-fg-muted">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-fg tracking-tight">
                {getTimeGreeting()},{" "}
                <span className="text-accent-fg font-bold">
                  {user?.fullName?.split(" ")[0] || user?.username || "Scholar"}
                </span>
              </h1>

              {(user?.department || user?.semester || user?.section) && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {user?.department && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-surface-2 text-fg-secondary border border-line flex items-center gap-1.5">
                      <span className="material-icons text-[13px] text-accent-fg">school</span>
                      {user.department}
                    </span>
                  )}
                  {user?.semester && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-surface-2 text-fg-secondary border border-line flex items-center gap-1.5">
                      <span className="material-icons text-[13px] text-accent-fg">auto_stories</span>
                      Sem {user.semester}
                    </span>
                  )}
                  {user?.section && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-surface-2 text-fg-secondary border border-line flex items-center gap-1.5">
                      <span className="material-icons text-[13px] text-accent-fg">groups</span>
                      Sec {user.section}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate("/help")}
                className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-on-accent px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors duration-150 cursor-pointer"
              >
                <span className="material-icons text-base">help_outline</span>
                Ask Question
              </button>

              <button
                onClick={() => navigate("/resource-hub")}
                className="flex items-center gap-2 bg-surface-2 hover:bg-surface-3 text-fg-secondary border border-line px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors duration-150 cursor-pointer"
              >
                <span className="material-icons text-base text-accent-fg">cloud_upload</span>
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
              onClick: () => navigate("/help"),
            },
            {
              icon: "forum",
              title: "My Answers",
              count: metrics.answersCount,
              badge: "Contributions",
              color: "text-blue-400 border-blue-500/20 bg-blue-950/20",
              onClick: () => navigate("/help"),
            },
            {
              icon: "menu_book",
              title: "Resources",
              count: metrics.resourcesCount,
              badge: "Uploaded",
              color: "text-emerald-400 border-emerald-500/20 bg-emerald-950/20",
              onClick: () => navigate("/resource-hub"),
            },
            {
              icon: "bookmark",
              title: "Bookmarks",
              count: metrics.bookmarksCount,
              badge: "Saved Items",
              color: "text-amber-400 border-amber-500/20 bg-amber-950/20",
              onClick: () => navigate("/saved"),
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
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-fg-muted px-1.5 py-0.5 rounded bg-surface-3">
                  {badge}
                </span>
              </div>
              <div className="mt-3 sm:mt-4">
                <div className="text-xl sm:text-2xl font-extrabold text-fg font-mono">{count}</div>
                <div className="text-[11px] sm:text-xs text-fg-muted font-medium mt-0.5 truncate">{title}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Onboarding: Upload Timetable Notice (Shown only for users who have never uploaded a timetable) */}
        {hasTimetable === false && (
          <div
            data-testid="timetable-onboarding-banner"
            className="relative overflow-hidden rounded-2xl bg-surface border border-line hover:border-accent/30 p-5 sm:p-6 shadow-sm transition-colors duration-200"
          >
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                  <span className="material-icons text-2xl sm:text-3xl text-violet-400">auto_awesome</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-base sm:text-lg font-semibold text-fg tracking-tight">
                      Upload your timetable to get started
                    </h3>
                    <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      Quick Setup
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-fg-muted leading-relaxed max-w-2xl">
                    Scan your semester timetable (PDF or image) to automatically populate your Daily Schedule with lectures, labs, and tutorials, and unlock one-tap attendance tracking and bunk safety alerts.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                <button
                  type="button"
                  id="onboarding-upload-timetable-btn"
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-on-accent font-medium text-xs sm:text-sm px-5 py-2.5 sm:py-3 rounded-xl shadow-sm transition-colors duration-150 cursor-pointer"
                >
                  <span className="material-icons text-base">upload_file</span>
                  <span>Upload Timetable</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Bar: Subject Info and Timetable Options */}
        <div className="relative z-30 flex flex-wrap items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-surface border border-line shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              id="dashboard-subject-info-btn"
              onClick={() => setShowSubjectInfoModal(true)}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-surface-2 hover:bg-surface-3 text-fg-secondary border border-line hover:border-accent/40 transition-colors cursor-pointer shadow-sm"
            >
              <span className="material-icons text-base text-accent-fg">auto_stories</span>
              <span>Subject Info</span>
            </button>
          </div>

          {/* Timetable Options Dropdown. z-[60], not z-50 — the rail's own
              bottom cluster (profile/theme/notifications) is also z-50 in
              Layout.jsx, and since the rail is a DOM sibling of this page's
              content (not an ancestor), a tied z-index falls back to DOM
              order — the rail comes later in the tree, so it was always
              winning and rendering on top of this dropdown regardless of
              which one was actually open.

              The panel itself dropped `backdrop-blur-xl` in favour of a
              fully opaque `bg-surface` + `isolate`: combined with this
              element's own enter animation (`animate-in slide-in-from-top-2`,
              which drives a CSS transform), the backdrop-filter was causing
              some browsers to blur far more of the page than this ~14rem
              panel's own box — the rail buttons stayed sharp only because
              they render in a separate layer on top, while everything else
              behind them visibly blurred. `isolate` pins this dropdown to
              its own stacking context so it can't leak into siblings either
              way. */}
          <div className="relative z-[60]" ref={timetableDropdownRef}>
            <button
              id="dashboard-timetable-options-btn"
              onClick={() => setIsTimetableMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-surface-2 hover:bg-surface-3 text-fg-secondary border border-line hover:border-accent/40 transition-colors cursor-pointer shadow-sm"
            >
              <span className="material-icons text-base text-accent-fg">calendar_month</span>
              <span>Timetable Options</span>
              <span
                className={`material-icons text-sm text-fg-muted transition-transform duration-200 ${
                  isTimetableMenuOpen ? "rotate-180" : ""
                }`}
              >
                expand_more
              </span>
            </button>

            {isTimetableMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-2xl bg-surface isolate border border-violet-800/40 shadow-2xl z-[60] py-2 divide-y divide-line/80 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-1">
                  <button
                    id="dashboard-view-timetable-option"
                    onClick={() => {
                      setIsTimetableMenuOpen(false);
                      setShowWeeklyTimetableModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-fg-secondary hover:text-fg hover:bg-violet-600/20 rounded-xl transition cursor-pointer"
                  >
                    <span className="material-icons text-base text-violet-400">calendar_view_week</span>
                    <div className="text-left">
                      <div className="font-semibold">View Timetable</div>
                      <div className="text-[11px] text-fg-muted">View & edit weekly schedule</div>
                    </div>
                  </button>

                  <button
                    id="dashboard-upload-timetable-option"
                    onClick={() => {
                      setIsTimetableMenuOpen(false);
                      setShowUploadWarningModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-fg-secondary hover:text-fg hover:bg-violet-600/20 rounded-xl transition cursor-pointer"
                  >
                    <span className="material-icons text-base text-purple-400">upload_file</span>
                    <div className="text-left">
                      <div className="font-semibold">Upload New Timetable</div>
                      <div className="text-[11px] text-fg-muted">Scan & sync PDF timetable</div>
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
          <div className="bg-surface rounded-2xl p-6 border border-line">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-fg flex items-center gap-2">
                <span className="material-icons text-sm text-accent-fg">help</span>
                Recent Questions Asked
              </h3>
              <button
                onClick={() => navigate("/help")}
                className="text-xs text-accent-fg hover:text-accent-hover transition"
              >
                View All
              </button>
            </div>

            {recentActivity.questions.length === 0 ? (
              <p className="text-xs text-fg-subtle py-6 text-center">
                No questions asked yet. Ask the community when in doubt!
              </p>
            ) : (
              <div className="space-y-2.5">
                {recentActivity.questions.map((q) => (
                  <div
                    key={q._id}
                    onClick={() => navigate(`/help/question/${q._id}`)}
                    className="p-3 rounded-xl bg-surface-2 hover:bg-surface-3 border border-line hover:border-accent/30 cursor-pointer transition flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-fg-secondary truncate pr-2">{q.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-accent-soft text-accent-fg whitespace-nowrap">
                      {q.category || "General"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Resources */}
          <div className="bg-surface rounded-2xl p-6 border border-line">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-fg flex items-center gap-2">
                <span className="material-icons text-sm text-emerald-400">menu_book</span>
                Recent Uploaded Resources
              </h3>
              <button
                onClick={() => navigate("/resource-hub")}
                className="text-xs text-accent-fg hover:text-accent-hover transition"
              >
                Browse
              </button>
            </div>

            {recentActivity.resources.length === 0 ? (
              <p className="text-xs text-fg-subtle py-6 text-center">
                No resources uploaded yet. Share notes and papers with your batch!
              </p>
            ) : (
              <div className="space-y-2.5">
                {recentActivity.resources.map((r) => (
                  <div
                    key={r._id}
                    onClick={() => navigate("/resource-hub")}
                    className="p-3 rounded-xl bg-surface-2 hover:bg-surface-3 border border-line hover:border-emerald-500/30 cursor-pointer transition flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-fg-secondary truncate pr-2">{r.title}</span>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-surface border border-amber-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <span className="material-icons text-2xl">warning</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-fg">Upload New Timetable?</h3>
                  <p className="text-xs text-amber-400/90 font-medium">Important: Data Reset Notice</p>
                </div>
              </div>

              <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-200/90 space-y-2 leading-relaxed">
                <p>
                  Uploading a new timetable will <strong>permanently wipe</strong> all current <strong>Daily Schedule</strong> events and reset all <strong>Attendance Guardian</strong> records.
                </p>
                <p className="text-[11px] text-fg-muted">
                  This ensures a clean start with your new semester subjects and prevents conflicting schedule items.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadWarningModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-fg-secondary hover:text-fg hover:bg-surface-2 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadWarningModal(false);
                    setShowUploadModal(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-on-accent bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-900/30 transition cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-icons text-sm">upload_file</span>
                  Proceed to Upload
                </button>
              </div>
            </div>
          </div>
        )}

        <Suspense fallback={null}>
        {/* Timetable Upload & Verification Modal */}
        {showUploadModal && (
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
        )}

        {/* Full Weekly Timetable Modal */}
        {showWeeklyTimetableModal && (
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
        )}

        {/* Subject Information Management Modal */}
        {showSubjectInfoModal && (
        <SubjectInfoModal
          isOpen={showSubjectInfoModal}
          onClose={() => setShowSubjectInfoModal(false)}
          onSubjectsChanged={() => {
            loadStats();
            setScheduleRefreshTrigger((prev) => prev + 1);
            setAttendanceRefreshTrigger((prev) => prev + 1);
          }}
        />
        )}
        </Suspense>
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