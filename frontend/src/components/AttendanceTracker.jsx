import React, { useState, useEffect, useRef, useCallback } from 'react';
import DonutChart from './DonutChart';
import { toast } from "sonner";
import { fetchAttendance } from '../api/dashboard.api';

const getAttendanceColor = (percentage) => {
  if (percentage >= 75) return 'bg-emerald-500/20 border-emerald-500 text-emerald-400';
  if (percentage >= 65) return 'bg-amber-500/20 border-amber-500 text-amber-400';
  return 'bg-rose-500/20 border-rose-500 text-rose-400';
};

export default function AttendanceTracker({ refreshTrigger }) {
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [activeTrack, setActiveTrack] = useState('class'); // 'class' | 'lab'
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [animateValue, setAnimateValue] = useState(0);

  const previousPercentage = useRef(0);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const isInitialMount = useRef(true);

  // Load attendance data from backend
  const loadAttendanceData = useCallback(async (showLoadingSpinner = false) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      const data = await fetchAttendance();
      if (data) {
        setCourses(data.courses || []);

        // Select first course if none selected or selected was deleted
        if (data.courses && data.courses.length > 0) {
          setSelectedCourseId((prev) => {
            const exists = data.courses.some((c) => c._id === prev);
            return exists ? prev : data.courses[0]._id;
          });
        } else {
          setSelectedCourseId(null);
        }
      }
    } catch {
      toast.error('Failed to load attendance records');
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      loadAttendanceData(true);
    } else {
      loadAttendanceData(false);
    }
  }, [loadAttendanceData, refreshTrigger]);

  // Selected course details
  const activeCourse = courses.find((c) => c._id === selectedCourseId) || courses[0];

  // Reset activeTrack to 'class' if active course changes or does not have lab
  useEffect(() => {
    if (!activeCourse?.hasLab) {
      setActiveTrack('class');
    }
  }, [selectedCourseId, activeCourse?.hasLab]);

  // Active track stats (Class vs Lab)
  const activeTrackStats =
    activeTrack === 'lab' && activeCourse?.hasLab
      ? activeCourse?.stats?.lab
      : activeCourse?.stats?.class || activeCourse?.stats;

  const activeStats = activeTrackStats || {
    present: 0,
    absent: 0,
    total: 0,
    percentage: 0,
    skippableClasses: 0,
    neededClasses: 0,
    isSafe: true,
  };

  // Smooth doughnut percentage animation
  useEffect(() => {
    const targetVal = activeStats.percentage || 0;
    const startVal = previousPercentage.current;
    let currentVal = startVal;
    const duration = 600;
    const steps = 30;
    const stepVal = (targetVal - startVal) / steps;

    const timer = setInterval(() => {
      if ((stepVal >= 0 && currentVal >= targetVal) || (stepVal < 0 && currentVal <= targetVal)) {
        setAnimateValue(targetVal);
        clearInterval(timer);
      } else {
        currentVal += stepVal;
        setAnimateValue(currentVal);
      }
    }, duration / steps);

    previousPercentage.current = targetVal;
    return () => clearInterval(timer);
  }, [activeStats.percentage]);

  // Chart configuration
  return (
    <div className="bg-surface/60 backdrop-blur-xl rounded-2xl p-4 sm:p-6 md:p-8 border border-line shadow-2xl relative h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 border-b border-line/80 pb-6">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 material-icons">
            how_to_reg
          </span>
          <div>
            <h2 className="text-2xl font-bold text-fg tracking-wide">Attendance Guardian</h2>
            <p className="text-sm text-fg-muted">
              Track course attendance and leave allowances
            </p>
          </div>
        </div>
      </div>

      {/* This card gets stretched to match Daily Schedule's height in
          Dashboard's grid (default align-items: stretch), which is usually
          much taller (a scrollable timeline) — without this, the content
          below just sat at the top, leaving a large dead gap at the
          bottom instead of using that extra height. */}
      <div className="flex-1 flex flex-col justify-center">
      {loading ? (
        <div className="space-y-6" aria-busy="true" aria-label="Loading attendance data">
          {/* Course selector skeleton */}
          <div className="flex items-center gap-3 bg-surface-2 p-3 rounded-xl border border-line">
            <div className="h-3 w-24 bg-surface-3 rounded animate-pulse shrink-0" />
            <div className="flex-1 h-9 bg-surface-3 rounded-lg animate-pulse" />
          </div>

          {/* Class/Lab segmented control skeleton */}
          <div className="flex justify-center -mt-2">
            <div className="inline-flex p-1 bg-canvas border border-line rounded-xl gap-1 shadow-inner">
              <div className="h-7 w-36 bg-surface-3 rounded-lg animate-pulse" />
              <div className="h-7 w-20 bg-surface-3 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Donut chart + stats skeleton */}
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="relative h-60 w-60 md:h-64 md:w-64 rounded-full bg-surface-2 animate-pulse" />
            <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto w-full">
              <div className="h-16 bg-surface-2 border border-line rounded-xl animate-pulse" />
              <div className="h-16 bg-surface-2 border border-line rounded-xl animate-pulse" />
              <div className="h-16 bg-surface-2 border border-line rounded-xl animate-pulse" />
            </div>
          </div>

          {/* Advisory banner skeleton */}
          <div className="h-10 bg-surface-2 border border-line rounded-xl animate-pulse" />
        </div>
      ) : courses.length === 0 ? (
        <div className="p-10 rounded-2xl bg-canvas/40 border border-dashed border-line text-center">
          <span className="material-icons text-5xl text-violet-500/40 mb-3">school</span>
          <h4 className="text-lg font-bold text-fg-secondary">No courses tracked yet</h4>
          <p className="text-sm text-fg-muted mt-1 max-w-md mx-auto">
            Add subjects from Subject Info on the dashboard to track attendance and leave allowances.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Controls: Course Selector stretched across */}
          <div className="flex items-center gap-3 bg-surface-2 p-3 rounded-xl border border-line">
            <span className="text-xs text-fg-muted font-medium whitespace-nowrap shrink-0">
              Selected Course:
            </span>
            <div ref={dropdownRef} className="relative flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between bg-surface-2 hover:bg-surface-3 text-fg text-sm font-semibold px-3.5 py-2 rounded-lg border border-line transition cursor-pointer min-w-0"
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <span className="truncate">{activeCourse.courseName}</span>
                  {activeCourse.courseCode && (
                    <span className="text-xs font-normal text-violet-300 shrink-0">
                      ({activeCourse.courseCode})
                    </span>
                  )}
                  {activeCourse.hasLab && activeTrack === 'lab' && (
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border shrink-0 bg-pink-500/20 text-pink-300 border-pink-500/40">
                      <span className="material-icons text-xs">science</span>
                      Lab
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${getAttendanceColor(
                      activeStats.percentage || 0
                    )}`}
                  >
                    {activeStats.percentage || 0}%
                  </span>
                  <span
                    className={`material-icons text-sm text-fg-muted transition-transform ${
                      dropdownOpen ? 'rotate-180' : ''
                    }`}
                  >
                    expand_more
                  </span>
                </div>
              </button>

              {dropdownOpen && (
                <div className="absolute left-0 right-0 mt-2 bg-surface border border-line-strong/80 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="max-h-[420px] overflow-y-auto overflow-x-hidden py-1.5 divide-y divide-line/70 custom-scrollbar">
                    {courses.map((c) => {
                      const isSelectedCourse = c._id === selectedCourseId;
                      const hasLab = Boolean(c.hasLab);
                      const classStats = c.stats?.class || c.stats;
                      const labStats = c.stats?.lab;
                      const classPercentage = classStats?.percentage ?? 0;
                      const labPercentage = labStats?.percentage ?? 0;
                      const isClassActive = isSelectedCourse && activeTrack === 'class';
                      const isLabActive = isSelectedCourse && activeTrack === 'lab';

                      return (
                        <div key={c._id} className="p-1.5 space-y-1">
                          {/* Subject Row (Default / Class attendance) */}
                          <button
                            type="button"
                            data-testid={`dropdown-course-${c._id}`}
                            onClick={() => {
                              setSelectedCourseId(c._id);
                              setActiveTrack('class');
                              setDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-xs transition cursor-pointer ${
                              isClassActive
                                ? 'bg-violet-950/60 border border-violet-500/50 text-violet-200 font-semibold'
                                : 'text-fg-secondary hover:bg-surface-3/70 border border-transparent'
                            }`}
                          >
                            <div className="truncate mr-2 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="material-icons text-sm text-violet-400 shrink-0">menu_book</span>
                                <span className="font-semibold text-fg truncate">{c.courseName}</span>
                                {hasLab && (
                                  <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 shrink-0 ml-1">
                                    Has Lab
                                  </span>
                                )}
                              </div>
                              {c.courseCode && (
                                <div className="text-[11px] text-fg-muted pl-5 truncate">{c.courseCode}</div>
                              )}
                            </div>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold shrink-0 ${getAttendanceColor(
                                classPercentage
                              )}`}
                            >
                              {classPercentage}%
                            </span>
                          </button>

                          {/* Lab Row (Only if subject has lab) */}
                          {hasLab && (
                            <div className="pl-5 pr-1">
                              <button
                                type="button"
                                data-testid={`dropdown-lab-${c._id}`}
                                onClick={() => {
                                  setSelectedCourseId(c._id);
                                  setActiveTrack('lab');
                                  setDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center justify-between text-xs transition cursor-pointer ${
                                  isLabActive
                                    ? 'bg-pink-950/60 border border-pink-500/50 text-pink-200 font-semibold'
                                    : 'text-fg-secondary hover:bg-surface-3/70 border border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 truncate">
                                  <span className="material-icons text-sm text-pink-400 shrink-0">science</span>
                                  <span className="truncate font-medium">Lab</span>
                                </div>
                                <span
                                  className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold shrink-0 ${getAttendanceColor(
                                    labPercentage
                                  )}`}
                                >
                                  {labPercentage}%
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Segmented Class / Lab Switcher - Strictly for subjects with lab */}
          {activeCourse?.hasLab && (
            <div className="flex justify-center -mt-2">
              <div className="inline-flex p-1 bg-canvas border border-line rounded-xl gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setActiveTrack('class')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTrack === 'class'
                      ? 'bg-violet-600 text-on-accent shadow-sm'
                      : 'text-fg-muted hover:text-fg-secondary'
                  }`}
                >
                  <span className="material-icons text-sm">menu_book</span>
                  <span>Class (Lecture + Tutorial)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTrack('lab')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTrack === 'lab'
                      ? 'bg-pink-600 text-on-accent shadow-sm'
                      : 'text-fg-muted hover:text-fg-secondary'
                  }`}
                >
                  <span className="material-icons text-sm">science</span>
                  <span>Lab</span>
                </button>
              </div>
            </div>
          )}

          {/* Centered Chart and Metrics Section */}
          <div className="flex flex-col items-center justify-center space-y-6">
            {/* Doughnut Chart Centered */}
            <div className="relative h-60 w-60 md:h-64 md:w-64">
              <DonutChart present={activeStats.present} absent={activeStats.absent} unit={activeTrack === 'lab' ? 'labs' : 'classes'} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div
                  className={`text-4xl font-extrabold font-mono ${
                    activeStats.total === 0
                      ? 'text-fg-muted'
                      : activeStats.percentage >= 85
                      ? 'text-emerald-400'
                      : activeStats.percentage >= 75
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {activeStats.total > 0 ? `${Math.round(animateValue)}%` : '0%'}
                </div>
                <div className="text-xs text-fg-muted mt-1 uppercase tracking-wider font-semibold">
                  {activeTrack === 'lab' ? 'Lab Attendance' : 'Class Attendance'}
                </div>
                <div className="text-[11px] text-fg-muted mt-0.5">
                  {activeStats.present} / {activeStats.total} {activeTrack === 'lab' ? 'Labs' : 'Classes'}
                </div>
              </div>
            </div>

            {/* 3 Metrics Cards Down the Chart: Total, Attended, Missed */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto w-full">
              <div className="bg-surface-2/50 border border-line/60 rounded-xl p-2.5 sm:p-3 text-center">
                <div className="text-[11px] sm:text-xs text-fg-muted font-medium">Total</div>
                <div className="text-xl sm:text-2xl font-bold text-fg mt-1 font-mono">
                  {activeStats.total}
                </div>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-2.5 sm:p-3 text-center">
                <div className="text-[11px] sm:text-xs text-emerald-400 font-medium">Attended</div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-400 mt-1 font-mono">
                  {activeStats.present}
                </div>
              </div>

              <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-2.5 sm:p-3 text-center">
                <div className="text-[11px] sm:text-xs text-rose-400 font-medium">Missed</div>
                <div className="text-xl sm:text-2xl font-bold text-rose-400 mt-1 font-mono">
                  {activeStats.absent}
                </div>
              </div>
            </div>
          </div>

          {/* Single-line Advisory Banner */}
          <div
            className={`px-4 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
              activeStats.total === 0
                ? 'bg-surface-2/40 border-line/80 text-fg-secondary'
                : activeStats.percentage >= 75
                ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
                : activeStats.percentage >= 65
                ? 'bg-amber-950/20 border-amber-900/50 text-amber-300'
                : 'bg-rose-950/20 border-rose-900/50 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="material-icons text-base shrink-0">
                {activeStats.total === 0
                  ? 'info'
                  : activeStats.percentage >= 75
                  ? 'check_circle'
                  : 'warning'}
              </span>
              <div className="truncate">
                {activeStats.total === 0 ? (
                  <span>
                    No {activeTrack === 'lab' ? 'lab' : 'class'} attendance recorded yet. Mark attendance using your{' '}
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('daily-schedule');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="text-violet-400 hover:text-violet-300 font-semibold underline underline-offset-2 cursor-pointer inline"
                    >
                      Daily Schedule
                    </button>
                    .
                  </span>
                ) : activeStats.percentage >= 75 ? (
                  activeStats.skippableClasses > 0 ? (
                    <span>
                      Attendance is <strong className="text-emerald-400">{activeStats.percentage}%</strong>. You can leave{' '}
                      <strong className="text-emerald-400 font-bold">{activeStats.skippableClasses}</strong> {activeTrack === 'lab' ? 'lab' : 'class'}{activeStats.skippableClasses > 1 ? (activeTrack === 'lab' ? 's' : 'es') : ''} and remain above 75%.
                    </span>
                  ) : (
                    <span>
                      Attendance is at <strong className="text-emerald-400">75%</strong> (On track). You cannot miss any upcoming {activeTrack === 'lab' ? 'labs' : 'classes'}.
                    </span>
                  )
                ) : (
                  <span>
                    Attendance is <strong className={activeStats.percentage < 65 ? "text-rose-400 font-bold" : "text-amber-400 font-bold"}>{activeStats.percentage}%</strong> ({activeStats.percentage < 65 ? 'Critical' : 'Low'}). Attend next{' '}
                    <strong className={activeStats.percentage < 65 ? "text-rose-400 font-bold" : "text-amber-400 font-bold"}>{activeStats.neededClasses}</strong> consecutive {activeTrack === 'lab' ? 'lab' : 'class'}{activeStats.neededClasses > 1 ? (activeTrack === 'lab' ? 's' : 'es') : ''} to reach 75%.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}