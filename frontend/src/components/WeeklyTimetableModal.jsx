import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { fetchTimetable, deleteTimetable } from "../api/timetable.api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function WeeklyTimetableModal({ isOpen, onClose, onTimetableAbandoned }) {
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTimetable();
      setShowAbandonConfirm(false);
    }
  }, [isOpen]);

  const loadTimetable = async () => {
    setLoading(true);
    try {
      const data = await fetchTimetable();
      setTimetable(data);

      // Default to today's day if it has classes
      const todayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
        new Date().getDay()
      ];
      if (data?.classes?.some((c) => c.day === todayName)) {
        setSelectedDay(todayName);
      } else {
        const firstDay = DAYS.find((d) => data?.classes?.some((c) => c.day === d));
        if (firstDay) setSelectedDay(firstDay);
      }
    } catch (err) {
      console.error("Error loading timetable:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAbandonTimetable = async () => {
    setIsAbandoning(true);
    try {
      await deleteTimetable();
      toast.success("Timetable removed. You can re-upload anytime.");
      setTimetable(null);
      setShowAbandonConfirm(false);
      if (onTimetableAbandoned) onTimetableAbandoned();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove timetable.");
    } finally {
      setIsAbandoning(false);
    }
  };

  if (!isOpen) return null;

  const classes = timetable?.classes || [];
  const dayClasses = classes.filter((c) => c.day === selectedDay);
  const daysWithClasses = DAYS.filter((d) => classes.some((c) => c.day === d));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-gray-900 border border-violet-500/20 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <span className="material-icons">calendar_view_week</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Weekly Timetable</h2>
              <p className="text-xs text-gray-400">
                {timetable
                  ? `${timetable.branch} • Sem ${timetable.semester} • Sec ${timetable.section}`
                  : "Your active recurring timetable"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition"
          >
            <span className="material-icons text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <span className="material-icons animate-spin text-3xl text-violet-400 mb-2">sync</span>
              <p className="text-sm">Loading your weekly timetable...</p>
            </div>
          ) : !timetable || classes.length === 0 ? (
            <div className="p-12 text-center text-gray-400 space-y-3">
              <span className="material-icons text-4xl text-gray-600">event_busy</span>
              <p className="text-sm font-medium">No timetable imported yet</p>
              <p className="text-xs text-gray-500">
                Click "Import Timetable" in Daily Schedule to upload your official MNNIT PDF.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Abandon Confirmation Inline */}
              {showAbandonConfirm && (
                <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-rose-300">
                    <span className="material-icons text-base">warning</span>
                    Remove this timetable?
                  </div>
                  <p className="text-xs text-gray-400">
                    This will remove all recurring classes from your daily schedule. Your attendance records
                    will be kept. You can re-upload a new timetable anytime.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAbandonTimetable}
                      disabled={isAbandoning}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {isAbandoning ? (
                        <>
                          <span className="material-icons animate-spin text-sm">sync</span>
                          Removing...
                        </>
                      ) : (
                        "Yes, Remove Timetable"
                      )}
                    </button>
                    <button
                      onClick={() => setShowAbandonConfirm(false)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Day selection tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-gray-800">
                {daysWithClasses.map((day) => {
                  const count = classes.filter((c) => c.day === day).length;
                  const isActive = selectedDay === day;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                        isActive
                          ? "bg-violet-600 text-white shadow-lg shadow-violet-900/30"
                          : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                      }`}
                    >
                      <span>{day}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isActive ? "bg-white/20 text-white" : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Classes List */}
              <div className="space-y-2.5">
                {dayClasses.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-500 bg-gray-950/30 rounded-xl border border-gray-800">
                    No classes on {selectedDay}.
                  </div>
                ) : (
                  dayClasses.map((item, idx) => {
                    const isLab = item.classType === "Lab";
                    const isTutorial = item.classType === "Tutorial";
                    return (
                      <div
                        key={`${item.day}-${item.startTime}-${idx}`}
                        className="p-4 rounded-xl border border-gray-800 bg-gray-850/60 hover:border-gray-700 transition flex items-center gap-4"
                      >
                        <div
                          className={`w-14 h-14 shrink-0 rounded-xl flex flex-col items-center justify-center font-mono text-xs font-bold border ${
                            isLab
                              ? "bg-pink-950/20 text-pink-300 border-pink-500/20"
                              : isTutorial
                              ? "bg-amber-950/20 text-amber-300 border-amber-500/20"
                              : "bg-violet-950/20 text-violet-300 border-violet-500/20"
                          }`}
                        >
                          <span>{item.startTime}</span>
                          <span className="text-[10px] text-gray-400 font-normal">{item.endTime}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold text-white flex items-center gap-2 flex-wrap">
                            <span className="truncate">{item.subjectName}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-semibold shrink-0 ${
                                isLab
                                  ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                                  : isTutorial
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                              }`}
                            >
                              {item.classType}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 flex flex-wrap items-center gap-3 mt-1.5">
                            {item.courseCode && (
                              <span className="font-mono text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
                                {item.courseCode}
                              </span>
                            )}
                            {item.location && (
                              <span className="flex items-center gap-1">
                                <span className="material-icons text-[13px] text-gray-500">room</span>
                                {item.location}
                              </span>
                            )}
                            {item.professor && (
                              <span className="flex items-center gap-1">
                                <span className="material-icons text-[13px] text-gray-500">person</span>
                                {item.professor}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/80 flex items-center justify-between">
          {timetable && classes.length > 0 && (
            <button
              onClick={() => setShowAbandonConfirm(true)}
              disabled={showAbandonConfirm}
              className="px-4 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-icons text-sm">delete_forever</span>
              Abandon Timetable
            </button>
          )}
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-750 text-gray-200 border border-gray-700 rounded-xl text-sm font-semibold transition cursor-pointer ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
