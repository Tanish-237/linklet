import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { fetchTimetable, confirmTimetable } from "../api/timetable.api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DAY_INDEX = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const DEFAULT_NEW_CLASS = {
  subjectName: "",
  courseCode: "",
  professor: "",
  classType: "Lecture",
  location: "",
  startTime: "09:00",
  endTime: "10:00",
};

export default function WeeklyTimetableModal({
  isOpen,
  onClose,
  onTimetableChanged,
  onTimetableAbandoned,
}) {
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClass, setNewClass] = useState({ ...DEFAULT_NEW_CLASS });
  const [editingIndex, setEditingIndex] = useState(null);
  const [editClass, setEditClass] = useState(null);
  const [deleteTargetClass, setDeleteTargetClass] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadTimetable();
      setShowAddForm(false);
      setEditingIndex(null);
      setEditClass(null);
    }
  }, [isOpen]);

  const loadTimetable = async () => {
    setLoading(true);
    try {
      const data = await fetchTimetable();
      setTimetable(data);

      // Default to today's day
      const todayName = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ][new Date().getDay()];

      if (DAYS.includes(todayName)) {
        setSelectedDay(todayName);
      } else {
        setSelectedDay("Monday");
      }
    } catch (err) {
      console.error("Error loading timetable:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const classes = timetable?.classes || [];
  const dayClasses = classes.filter((c) => c.day === selectedDay);

  const notifyChange = () => {
    if (onTimetableChanged) onTimetableChanged();
    if (onTimetableAbandoned) onTimetableAbandoned();
  };

  const persistClasses = async (updatedClasses, successMsg) => {
    setIsSaving(true);
    try {
      const branch = timetable?.branch || "General";
      const semester = timetable?.semester || 1;
      const section = timetable?.section || "A1";

      await confirmTimetable({
        branch,
        semester,
        section,
        classes: updatedClasses,
        wipeExisting: false,
      });

      setTimetable((prev) => ({
        ...(prev || {}),
        branch,
        semester,
        section,
        classes: updatedClasses,
      }));

      toast.success(successMsg);
      notifyChange();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save timetable changes");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Add new class to selectedDay
  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!newClass.subjectName.trim()) {
      toast.warn("Subject name is required");
      return;
    }
    if (!newClass.startTime || !newClass.endTime) {
      toast.warn("Start time and End time are required");
      return;
    }

    const classToAdd = {
      day: selectedDay,
      dayOfWeek: DAY_INDEX[selectedDay] ?? 1,
      subjectName: newClass.subjectName.trim(),
      courseCode: (newClass.courseCode || "").trim(),
      professor: (newClass.professor || "").trim(),
      classType: newClass.classType || "Lecture",
      location: (newClass.location || "").trim(),
      startTime: newClass.startTime,
      endTime: newClass.endTime,
      title: `${newClass.subjectName.trim()} (${newClass.classType || "Lecture"})`,
    };

    const updatedClasses = [...classes, classToAdd];
    const success = await persistClasses(updatedClasses, `Added ${classToAdd.subjectName} to ${selectedDay}`);
    if (success) {
      setNewClass({ ...DEFAULT_NEW_CLASS });
      setShowAddForm(false);
    }
  };

  // Start editing a class
  const startEditing = (idxInAllClasses) => {
    const target = classes[idxInAllClasses];
    if (!target) return;
    setEditingIndex(idxInAllClasses);
    setEditClass({
      day: target.day,
      dayOfWeek: target.dayOfWeek ?? DAY_INDEX[target.day] ?? 1,
      subjectName: target.subjectName || "",
      courseCode: target.courseCode || "",
      professor: target.professor || "",
      classType: target.classType || "Lecture",
      location: target.location || "",
      startTime: target.startTime || "09:00",
      endTime: target.endTime || "10:00",
    });
  };

  // Save edited class
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (editingIndex === null || !editClass) return;
    if (!editClass.subjectName.trim()) {
      toast.warn("Subject name is required");
      return;
    }
    if (!editClass.startTime || !editClass.endTime) {
      toast.warn("Start time and End time are required");
      return;
    }

    const updatedItem = {
      ...classes[editingIndex],
      day: editClass.day,
      dayOfWeek: DAY_INDEX[editClass.day] ?? 1,
      subjectName: editClass.subjectName.trim(),
      courseCode: (editClass.courseCode || "").trim(),
      professor: (editClass.professor || "").trim(),
      classType: editClass.classType || "Lecture",
      location: (editClass.location || "").trim(),
      startTime: editClass.startTime,
      endTime: editClass.endTime,
      title: `${editClass.subjectName.trim()} (${editClass.classType || "Lecture"})`,
    };

    const updatedClasses = [...classes];
    updatedClasses[editingIndex] = updatedItem;

    const success = await persistClasses(updatedClasses, "Class updated successfully");
    if (success) {
      setEditingIndex(null);
      setEditClass(null);
    }
  };

  const handleDeleteClass = (idxInAllClasses, subjectName) => {
    setDeleteTargetClass({ idx: idxInAllClasses, name: subjectName, day: selectedDay });
  };

  const confirmDeleteClass = async () => {
    if (!deleteTargetClass) return;
    const { idx, name } = deleteTargetClass;
    setDeleteTargetClass(null);
    const updatedClasses = classes.filter((_, i) => i !== idx);
    await persistClasses(updatedClasses, `Removed ${name}`);
    if (editingIndex === idx) {
      setEditingIndex(null);
      setEditClass(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-gray-900 border border-violet-500/20 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <span className="material-icons">calendar_view_week</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Weekly Timetable</h2>
              <p className="text-xs text-gray-400">
                {timetable?.branch
                  ? `${timetable.branch} • Sem ${timetable.semester} • Sec ${timetable.section}`
                  : "View & customize your weekly class schedule (Monday – Sunday)"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition cursor-pointer"
            aria-label="Close"
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
          ) : (
            <div className="space-y-5">
              {/* Day selection tabs (All 7 days: Monday to Sunday) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-800 scrollbar-thin">
                {DAYS.map((day) => {
                  const count = classes.filter((c) => c.day === day).length;
                  const isActive = selectedDay === day;
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        setSelectedDay(day);
                        setShowAddForm(false);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
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

              {/* Action Bar for the Day */}
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-300">
                  {selectedDay} Schedule ({dayClasses.length} {dayClasses.length === 1 ? "class" : "classes"})
                </div>
                {!showAddForm && (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 transition hover:scale-[1.02] cursor-pointer"
                  >
                    <span className="material-icons text-sm">add</span>
                    Add Class to {selectedDay}
                  </button>
                )}
              </div>

              {/* Add Class Form */}
              {showAddForm && (
                <form
                  onSubmit={handleAddClass}
                  className="p-5 rounded-2xl bg-violet-950/20 border border-violet-700/40 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-violet-300 flex items-center gap-2">
                      <span className="material-icons text-sm text-violet-400">add_circle</span>
                      Add Class to {selectedDay}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-gray-400 hover:text-gray-200 text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">
                        Subject Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Distributed Systems"
                        value={newClass.subjectName}
                        onChange={(e) => setNewClass({ ...newClass, subjectName: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">
                        Course Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CS14402"
                        value={newClass.courseCode}
                        onChange={(e) => setNewClass({ ...newClass, courseCode: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">
                        Professor / Faculty Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dr. A. K. Singh"
                        value={newClass.professor}
                        onChange={(e) => setNewClass({ ...newClass, professor: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">
                        Class Type
                      </label>
                      <select
                        value={newClass.classType}
                        onChange={(e) => setNewClass({ ...newClass, classType: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                      >
                        <option value="Lecture">Lecture</option>
                        <option value="Lab">Lab</option>
                        <option value="Tutorial">Tutorial</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">
                        Location / Classroom
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. GS6 / Lab 2"
                        value={newClass.location}
                        onChange={(e) => setNewClass({ ...newClass, location: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">
                          Start Time *
                        </label>
                        <input
                          type="time"
                          required
                          value={newClass.startTime}
                          onChange={(e) => setNewClass({ ...newClass, startTime: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-2.5 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">
                          End Time *
                        </label>
                        <input
                          type="time"
                          required
                          value={newClass.endTime}
                          onChange={(e) => setNewClass({ ...newClass, endTime: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-2.5 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-750 text-gray-300 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving || !newClass.subjectName.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white transition shadow-md shadow-violet-900/30 cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Add Class"}
                    </button>
                  </div>
                </form>
              )}

              {/* Classes List */}
              <div className="space-y-3">
                {dayClasses.length === 0 ? (
                  <div className="p-8 text-center bg-gray-950/40 rounded-2xl border border-dashed border-gray-800 flex flex-col items-center justify-center">
                    <span className="material-icons text-4xl text-gray-600 mb-2">event_available</span>
                    <p className="text-sm font-semibold text-gray-300">No classes scheduled on {selectedDay}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Click "+ Add Class to {selectedDay}" above to add a lecture or lab.
                    </p>
                  </div>
                ) : (
                  dayClasses.map((item) => {
                    const idxInAll = classes.findIndex((c) => c === item);
                    const isEditingThis = editingIndex === idxInAll;

                    if (isEditingThis && editClass) {
                      return (
                        <form
                          key={`edit-${idxInAll}`}
                          onSubmit={handleSaveEdit}
                          className="p-5 rounded-2xl bg-gray-800/80 border border-violet-600/50 space-y-4 shadow-xl"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-violet-300">
                              Edit Class Details
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-400 mb-1">
                                Subject Name *
                              </label>
                              <input
                                type="text"
                                required
                                value={editClass.subjectName}
                                onChange={(e) =>
                                  setEditClass({ ...editClass, subjectName: e.target.value })
                                }
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-gray-400 mb-1">
                                Course Code
                              </label>
                              <input
                                type="text"
                                value={editClass.courseCode}
                                onChange={(e) =>
                                  setEditClass({ ...editClass, courseCode: e.target.value })
                                }
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-gray-400 mb-1">
                                Professor / Faculty
                              </label>
                              <input
                                type="text"
                                value={editClass.professor}
                                onChange={(e) =>
                                  setEditClass({ ...editClass, professor: e.target.value })
                                }
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-gray-400 mb-1">
                                Day
                              </label>
                              <select
                                value={editClass.day}
                                onChange={(e) =>
                                  setEditClass({ ...editClass, day: e.target.value })
                                }
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                              >
                                {DAYS.map((d) => (
                                  <option key={d} value={d}>
                                    {d}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-gray-400 mb-1">
                                Class Type
                              </label>
                              <select
                                value={editClass.classType}
                                onChange={(e) =>
                                  setEditClass({ ...editClass, classType: e.target.value })
                                }
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                              >
                                <option value="Lecture">Lecture</option>
                                <option value="Lab">Lab</option>
                                <option value="Tutorial">Tutorial</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-gray-400 mb-1">
                                Location / Room
                              </label>
                              <input
                                type="text"
                                value={editClass.location}
                                onChange={(e) =>
                                  setEditClass({ ...editClass, location: e.target.value })
                                }
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-gray-400 mb-1">
                                Start Time *
                              </label>
                              <input
                                type="time"
                                required
                                value={editClass.startTime}
                                onChange={(e) =>
                                  setEditClass({ ...editClass, startTime: e.target.value })
                                }
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-2.5 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-gray-400 mb-1">
                                End Time *
                              </label>
                              <input
                                type="time"
                                required
                                value={editClass.endTime}
                                onChange={(e) =>
                                  setEditClass({ ...editClass, endTime: e.target.value })
                                }
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-2.5 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2 border-t border-gray-700/80">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingIndex(null);
                                setEditClass(null);
                              }}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-700 hover:bg-gray-650 text-gray-300 transition cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSaving || !editClass.subjectName.trim()}
                              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white transition shadow-md shadow-violet-900/30 cursor-pointer disabled:opacity-50"
                            >
                              {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                          </div>
                        </form>
                      );
                    }

                    const isLab = item.classType === "Lab";
                    const isTutorial = item.classType === "Tutorial";

                    return (
                      <div
                        key={`${item.day}-${item.startTime}-${idxInAll}`}
                        className="p-4 rounded-xl border border-gray-800 bg-gray-850/60 hover:border-gray-750 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                      >
                        <div className="flex items-center gap-4 min-w-0">
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

                        {/* Edit and Delete Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => startEditing(idxInAll)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-700/80 hover:bg-gray-700 text-gray-200 border border-gray-600/50 transition cursor-pointer"
                            title="Edit class"
                          >
                            <span className="material-icons text-xs text-violet-400">edit</span>
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteClass(idxInAll, item.subjectName)}
                            className="p-1.5 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Delete class"
                            aria-label={`Delete ${item.subjectName}`}
                          >
                            <span className="material-icons text-base">delete</span>
                          </button>
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
        <div className="p-4 border-t border-gray-800 bg-gray-900/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-750 text-gray-200 border border-gray-700 rounded-xl text-sm font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Delete Class Confirmation Modal */}
        {deleteTargetClass && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-rose-900/60 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 mb-2 text-rose-400">
                <span className="material-icons text-xl">delete_sweep</span>
                <h3 className="text-lg font-bold text-white">Remove Class?</h3>
              </div>
              <p className="text-sm text-gray-300 mb-5">
                Are you sure you want to remove <strong className="text-white">"{deleteTargetClass.name}"</strong> from <strong className="text-white">{deleteTargetClass.day}</strong>?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteTargetClass(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-750 text-gray-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteClass}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg shadow-rose-900/30 cursor-pointer"
                >
                  Remove Class
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
