import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { toast } from 'react-toastify';
import {
  fetchAttendance,
  createAttendanceCourse,
  deleteAttendanceCourse,
  markAttendance,
  deleteAttendanceRecord,
} from '../api/dashboard.api';

ChartJS.register(ArcElement, Tooltip, Legend);

const TARGET = 75;

const getAttendanceColor = (percentage) => {
  if (percentage >= 75) return 'bg-emerald-500/20 border-emerald-500 text-emerald-400';
  if (percentage >= 65) return 'bg-amber-500/20 border-amber-500 text-amber-400';
  return 'bg-rose-500/20 border-rose-500 text-rose-400';
};

const getStatusBadge = (percentage, total = 0, skippable = 0) => {
  if (total === 0) {
    return {
      label: 'No logs yet',
      color: 'text-gray-400 border-gray-600 bg-gray-800/40',
    };
  }
  if (percentage >= 75) {
    return {
      label: skippable > 0 ? `Can leave ${skippable} class${skippable > 1 ? 'es' : ''} 👍` : 'On Track (75%) 👍',
      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    };
  }
  if (percentage >= 65) {
    return {
      label: 'Low Attendance ⚠️',
      color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    };
  }
  return {
    label: 'Critical Attendance 🚨',
    color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
  };
};

export default function AttendanceTracker({ onAttendanceChanged }) {
  const [courses, setCourses] = useState([]);
  const [overallStats, setOverallStats] = useState({ totalPresent: 0, totalAbsent: 0, percentage: 0 });
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [animateValue, setAnimateValue] = useState(0);

  // Modals
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendanceStatus, setAttendanceStatus] = useState('present');
  const [attendanceNote, setAttendanceNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Course Form State
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');

  const previousPercentage = useRef(0);

  // Load attendance data from backend
  const loadAttendanceData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAttendance();
      if (data) {
        setCourses(data.courses || []);
        setOverallStats(data.overall || { totalPresent: 0, totalAbsent: 0, percentage: 0 });

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
    } catch (err) {
      toast.error('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  // Selected course details
  const activeCourse = courses.find((c) => c._id === selectedCourseId) || courses[0];
  const activeStats = activeCourse?.stats || {
    present: 0,
    absent: 0,
    total: 0,
    percentage: 0,
    skippableClasses: 0,
    neededClasses: 0,
    isSafe: true,
  };
  const activeTarget = 75;

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

  // Handle Mark Attendance
  const handleMarkAttendance = async () => {
    if (!activeCourse) return;
    try {
      setIsSubmitting(true);
      await markAttendance({
        courseId: activeCourse._id,
        date: selectedDate,
        status: attendanceStatus,
        note: attendanceNote,
      });

      toast.success(`Marked ${attendanceStatus} for ${activeCourse.courseName}`);
      setShowMarkModal(false);
      setAttendanceNote('');
      await loadAttendanceData();
      if (onAttendanceChanged) onAttendanceChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Attendance Record
  const handleDeleteRecord = async (date) => {
    if (!activeCourse) return;
    try {
      await deleteAttendanceRecord(activeCourse._id, date);
      toast.info('Attendance record removed');
      await loadAttendanceData();
      if (onAttendanceChanged) onAttendanceChanged();
    } catch (err) {
      toast.error('Failed to remove record');
    }
  };

  // Handle Add New Course
  const handleAddCourse = async (e) => {
    e.preventDefault();
    if (!newCourseName.trim()) {
      toast.warn('Please enter a course name');
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await createAttendanceCourse({
        courseName: newCourseName.trim(),
        courseCode: newCourseCode.trim(),
        targetPercentage: 75,
      });

      toast.success(`Course "${created.courseName}" created!`);
      setShowAddCourseModal(false);
      setNewCourseName('');
      setNewCourseCode('');
      await loadAttendanceData();
      setSelectedCourseId(created._id);
      if (onAttendanceChanged) onAttendanceChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create course');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Course
  const handleDeleteCourse = async (courseId, courseName) => {
    if (!window.confirm(`Are you sure you want to delete "${courseName}" and its attendance logs?`)) {
      return;
    }

    try {
      await deleteAttendanceCourse(courseId);
      toast.success(`Deleted ${courseName}`);
      await loadAttendanceData();
      if (onAttendanceChanged) onAttendanceChanged();
    } catch (err) {
      toast.error('Failed to delete course');
    }
  };

  // Chart configuration
  const chartData = {
    labels: ['Present', 'Absent'],
    datasets: [
      {
        data:
          activeStats.total > 0
            ? [activeStats.present, activeStats.absent]
            : [1, 0], // placeholder ring when 0
        backgroundColor:
          activeStats.total > 0
            ? ['#10b981', '#f43f5e'] // Emerald & Rose
            : ['#374151', '#1f2937'], // Neutral dark ring
        borderWidth: 0,
        cutout: '76%',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: activeStats.total > 0,
        callbacks: {
          label: function (context) {
            const label = context.label;
            const value = context.formattedValue;
            const total = activeStats.total;
            const percentage = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
            return `${label}: ${value} classes (${percentage}%)`;
          },
        },
      },
    },
  };

  const statusInfo = getStatusBadge(activeStats.percentage, activeStats.total, activeStats.skippableClasses);

  return (
    <div className="bg-gray-900/60 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-gray-800 shadow-2xl relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-gray-800/80 pb-6">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 material-icons">
            how_to_reg
          </span>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-wide">Attendance Guardian</h2>
            <p className="text-sm text-gray-400">
              Track course attendance and leave allowances
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddCourseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition cursor-pointer"
          >
            <span className="material-icons text-sm text-violet-400">add</span>
            Add Subject
          </button>

          {activeCourse && (
            <button
              onClick={() => {
                setSelectedDate(new Date().toISOString().split('T')[0]);
                setAttendanceStatus('present');
                setAttendanceNote('');
                setShowMarkModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-900/30 transition hover:scale-[1.02] cursor-pointer"
            >
              <span className="material-icons text-sm">check</span>
              Mark Attendance
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-block w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-sm text-gray-400">Loading attendance data...</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="p-10 rounded-2xl bg-gray-950/40 border border-dashed border-gray-800 text-center">
          <span className="material-icons text-5xl text-violet-500/40 mb-3">school</span>
          <h4 className="text-lg font-bold text-gray-300">No courses tracked yet</h4>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Add your subjects to start tracking attendance, calculate bunk allowance, and ensure you
            stay comfortably above the 75% requirement.
          </p>
          <button
            onClick={() => setShowAddCourseModal(true)}
            className="mt-5 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold shadow-lg shadow-violet-900/40 transition cursor-pointer"
          >
            + Add Your First Course
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Controls: Course Selector & Quick Switch */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-black/40 p-3 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">Selected Course:</span>
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-750 text-white text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-700 transition"
                >
                  <span>{activeCourse.courseName}</span>
                  {activeCourse.courseCode && (
                    <span className="text-xs font-normal text-violet-300">
                      ({activeCourse.courseCode})
                    </span>
                  )}
                  <span className="material-icons text-sm text-gray-400">expand_more</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute left-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-2 z-50">
                    {courses.map((c) => (
                      <button
                        key={c._id}
                        onClick={() => {
                          setSelectedCourseId(c._id);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-violet-900/20 text-sm transition ${
                          c._id === selectedCourseId ? 'bg-violet-950/40 text-violet-300 font-bold' : 'text-gray-300'
                        }`}
                      >
                        <div className="truncate mr-2">
                          <div>{c.courseName}</div>
                          {c.courseCode && (
                            <div className="text-[11px] text-gray-400">{c.courseCode}</div>
                          )}
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${getAttendanceColor(
                            c.stats?.percentage || 0,
                            c.targetPercentage
                          )}`}
                        >
                          {c.stats?.percentage || 0}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDeleteCourse(activeCourse._id, activeCourse.courseName)}
                className="text-gray-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition"
                title="Delete this course"
                aria-label="Delete Course"
              >
                <span className="material-icons text-sm">delete_outline</span>
              </button>
            </div>
          </div>

          {/* Main Visual Section: Chart on Left, KPIs on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Doughnut Chart */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-4">
              <div className="relative h-60 w-60 md:h-64 md:w-64">
                <Doughnut data={chartData} options={chartOptions} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div
                    className={`text-4xl font-extrabold font-mono ${
                      activeStats.total === 0
                        ? 'text-gray-500'
                        : activeStats.percentage >= 85
                        ? 'text-emerald-400'
                        : activeStats.percentage >= 75
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {activeStats.total > 0 ? `${Math.round(animateValue)}%` : '0%'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-semibold">
                    Attendance
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {activeStats.present} / {activeStats.total} Classes
                  </div>
                </div>
              </div>

              {/* Status Alert Banner */}
              <div
                className={`mt-4 px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 ${statusInfo.color}`}
              >
                <span className="material-icons text-sm">
                  {activeStats.isSafe ? 'check_circle' : 'warning'}
                </span>
                <span>{statusInfo.label}</span>
              </div>
            </div>

            {/* Attendance Analytics & Leave Allowance Cards */}
            <div className="lg:col-span-7 space-y-4">
              {/* Critical / Low / Leave Allowance Advisory Card */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  activeStats.total === 0
                    ? 'bg-gray-800/40 border-gray-700 text-gray-300'
                    : activeStats.percentage >= 75
                    ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
                    : activeStats.percentage >= 65
                    ? 'bg-amber-950/20 border-amber-900/50 text-amber-300'
                    : 'bg-rose-950/20 border-rose-900/50 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                  <span className="material-icons text-base">
                    {activeStats.total === 0 ? 'info' : activeStats.percentage >= 75 ? 'event_available' : 'warning'}
                  </span>
                  <span>
                    {activeStats.total === 0
                      ? 'No attendance recorded yet'
                      : activeStats.percentage >= 75
                      ? activeStats.skippableClasses > 0
                        ? `You can leave ${activeStats.skippableClasses} class${activeStats.skippableClasses > 1 ? 'es' : ''}`
                        : 'On Track (75%)'
                      : activeStats.percentage >= 65
                      ? 'Low Attendance'
                      : 'Critical Attendance'}
                  </span>
                </div>

                <p className="text-xs text-gray-300">
                  {activeStats.total === 0 ? (
                    'Log your first class attendance using the "Mark Attendance" button above.'
                  ) : activeStats.percentage >= 75 ? (
                    activeStats.skippableClasses > 0 ? (
                      <>
                        Your attendance is <strong className="text-emerald-400">{activeStats.percentage}%</strong>. You can leave{' '}
                        <strong className="text-emerald-400 text-sm font-bold">{activeStats.skippableClasses}</strong>{' '}
                        class{activeStats.skippableClasses > 1 ? 'es' : ''} and still remain at or above the 75% requirement.
                      </>
                    ) : (
                      <>
                        Your attendance is at 75%. You cannot leave any classes without falling below 75%.
                      </>
                    )
                  ) : (
                    <>
                      Your attendance is <strong className={activeStats.percentage < 65 ? "text-rose-400 font-bold" : "text-amber-400 font-bold"}>{activeStats.percentage}%</strong> ({activeStats.percentage < 65 ? 'Critical' : 'Low'}). You need to attend the next{' '}
                      <strong className={activeStats.percentage < 65 ? "text-rose-400 font-bold text-sm" : "text-amber-400 font-bold text-sm"}>
                        {activeStats.neededClasses}
                      </strong>{' '}
                      consecutive class{activeStats.neededClasses > 1 ? 'es' : ''} to reach 75%.
                    </>
                  )}
                </p>
              </div>

              {/* 3 Metrics Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-400 font-medium">Total Classes</div>
                  <div className="text-2xl font-bold text-white mt-1 font-mono">
                    {activeStats.total}
                  </div>
                </div>

                <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-3 text-center">
                  <div className="text-xs text-emerald-400 font-medium">Attended</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
                    {activeStats.present}
                  </div>
                </div>

                <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-3 text-center">
                  <div className="text-xs text-rose-400 font-medium">Missed</div>
                  <div className="text-2xl font-bold text-rose-400 mt-1 font-mono">
                    {activeStats.absent}
                  </div>
                </div>
              </div>

              {/* Overall Profile Summary */}
              <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-gray-800 text-xs">
                <span className="text-gray-400">All Subjects Aggregate:</span>
                <span className="font-mono font-bold text-violet-300">
                  {overallStats.percentage}% across {overallStats.totalClasses || 0} classes
                </span>
              </div>
            </div>
          </div>

          {/* Attendance History Section */}
          <div className="border-t border-gray-800/80 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="material-icons text-sm text-violet-400">history</span>
                Attendance Log for {activeCourse.courseName}
              </h3>
              <span className="text-xs text-gray-400">
                {(activeCourse.records || []).length} records logged
              </span>
            </div>

            {(!activeCourse.records || activeCourse.records.length === 0) ? (
              <div className="p-6 bg-gray-950/30 rounded-xl text-center text-xs text-gray-500 border border-gray-800">
                No attendance entries logged for this course yet. Click "Mark Attendance" to begin.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {activeCourse.records.map((rec) => (
                  <div
                    key={rec.date}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-800/40 hover:bg-gray-800/70 border border-gray-800 transition text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          rec.status === 'present' ? 'bg-emerald-400 shadow-emerald-500/50 shadow-sm' : 'bg-rose-500'
                        }`}
                      ></span>
                      <div>
                        <span className="font-medium text-gray-200">
                          {new Date(rec.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        {rec.note && (
                          <span className="ml-2 text-gray-400 italic">"{rec.note}"</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          rec.status === 'present'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {rec.status}
                      </span>
                      <button
                        onClick={() => handleDeleteRecord(rec.date)}
                        className="text-gray-500 hover:text-rose-400 transition"
                        title="Delete log entry"
                        aria-label="Delete Record"
                      >
                        <span className="material-icons text-sm">close</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mark Attendance Modal */}
      {showMarkModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-violet-800/40 shadow-2xl">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-icons text-violet-400">event_available</span>
                Mark Attendance
              </h3>
              <button
                onClick={() => setShowMarkModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-gray-400 mb-1 font-medium">Subject</label>
                <div className="px-3 py-2 rounded-xl bg-gray-800 text-white font-semibold border border-gray-700">
                  {activeCourse?.courseName}
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-medium">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-medium">Attendance Status</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAttendanceStatus('present')}
                    className={`py-2.5 rounded-xl border text-center font-bold transition ${
                      attendanceStatus === 'present'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                    }`}
                  >
                    ✓ Present
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceStatus('absent')}
                    className={`py-2.5 rounded-xl border text-center font-bold transition ${
                      attendanceStatus === 'absent'
                        ? 'bg-rose-600/30 border-rose-500 text-rose-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                    }`}
                  >
                    ✕ Absent
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-medium">Note (Optional)</label>
                <input
                  type="text"
                  value={attendanceNote}
                  onChange={(e) => setAttendanceNote(e.target.value)}
                  placeholder="e.g. Lab experiment, Proxy, Guest lecture"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-sm"
                />
              </div>

              <button
                onClick={handleMarkAttendance}
                disabled={isSubmitting}
                className="w-full mt-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-violet-900/40 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Course Modal */}
      {showAddCourseModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleAddCourse}
            className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-violet-800/40 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-icons text-violet-400">library_add</span>
                Add Course / Subject
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCourseModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div>
              <label className="block text-gray-400 mb-1 text-sm font-medium">Subject Name</label>
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="e.g. Compiler Design"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 mb-1 text-sm font-medium">
                Course Code (Optional)
              </label>
              <input
                type="text"
                value={newCourseCode}
                onChange={(e) => setNewCourseCode(e.target.value)}
                placeholder="e.g. CS301"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !newCourseName.trim()}
              className="w-full mt-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-violet-900/40 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Add Subject'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}