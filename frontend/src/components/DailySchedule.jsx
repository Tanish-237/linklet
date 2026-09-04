import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import {
  fetchSchedule,
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
  fetchAttendance,
  markAttendance,
  deleteAttendanceRecord,
} from '../api/dashboard.api';

// ─── Date helpers ────────────────────────────────────────────────────────────
const getTodayDateStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDateStr = (dateStr) => {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Convert "HH:MM" → fractional hours (e.g. "09:30" → 9.5)
const timeToHours = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
};

// Return the effective start hour for an event
const eventStartHour = (ev) => {
  if (ev.type === 'task') return timeToHours(ev.deadline);
  return timeToHours(ev.startTime);
};

// Return the effective end hour for an event
const eventEndHour = (ev) => {
  if (ev.type === 'task') return (timeToHours(ev.deadline) ?? 0) + 0.5;
  return timeToHours(ev.endTime) ?? ((timeToHours(ev.startTime) ?? 0) + 1);
};

// ─── Type configuration & helpers ─────────────────────────────────────────────
const TYPE_CONFIG = {
  Lab: {
    label: 'Lab',
    style: 'bg-pink-500/20 text-pink-300 border border-pink-500/40',
    accent: 'border-l-pink-500 bg-pink-500/5 hover:bg-pink-500/10',
    dot: 'bg-pink-400',
  },
  Tutorial: {
    label: 'Tutorial',
    style: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    accent: 'border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10',
    dot: 'bg-amber-400',
  },
  Lecture: {
    label: 'Lecture',
    style: 'bg-violet-500/20 text-violet-300 border border-violet-500/40',
    accent: 'border-l-violet-500 bg-violet-500/5 hover:bg-violet-500/10',
    dot: 'bg-violet-400',
  },
  Class: {
    label: 'Class',
    style: 'bg-violet-500/20 text-violet-300 border border-violet-500/40',
    accent: 'border-l-violet-500 bg-violet-500/5 hover:bg-violet-500/10',
    dot: 'bg-violet-400',
  },
  Task: {
    label: 'Task',
    style: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
    accent: 'border-l-blue-500 bg-blue-500/5 hover:bg-blue-500/10',
    dot: 'bg-blue-400',
  },
  Event: {
    label: 'Event',
    style: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
    accent: 'border-l-cyan-500 bg-cyan-500/5 hover:bg-cyan-500/10',
    dot: 'bg-cyan-400',
  },
};

const getClassType = (ev) => {
  if (ev.classType) {
    const ct = ev.classType.charAt(0).toUpperCase() + ev.classType.slice(1).toLowerCase();
    if (TYPE_CONFIG[ct]) return ct;
  }
  const match = ev.title?.match(/\b(Lab|Tutorial|Lecture)\b/i);
  if (match) {
    const word = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    if (TYPE_CONFIG[word]) return word;
  }
  if (ev.type === 'class') return 'Lecture';
  if (ev.type === 'task') return 'Task';
  if (ev.type === 'event') return 'Event';
  return 'Lecture';
};

const getCleanTitle = (ev) => {
  if (ev.subjectName && ev.subjectName.trim()) return ev.subjectName.trim();
  if (!ev.title) return '';
  return ev.title.replace(/\s*\((Lab|Lecture|Tutorial|Class)\)/gi, '').trim();
};

/**
 * Group events into "overlap clusters".
 * Events whose time ranges overlap are placed in the same cluster.
 * Returns: Array<{ events: Event[], start: number, end: number }>
 */
const buildOverlapGroups = (evList) => {
  const sorted = [...evList].sort((a, b) => (eventStartHour(a) ?? 0) - (eventStartHour(b) ?? 0));
  const groups = [];
  for (const ev of sorted) {
    const start = eventStartHour(ev) ?? 0;
    const end = eventEndHour(ev);
    let placed = false;
    for (const g of groups) {
      if (start < g.end - 0.01) {
        g.events.push(ev);
        g.end = Math.max(g.end, end);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push({ events: [ev], start, end });
  }
  return groups;
};

// ─── Attendance button configs ────────────────────────────────────────────────
const ATTENDANCE_STYLES = {
  present: {
    active: 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-900/40',
    idle: 'bg-emerald-500/15 border-emerald-600/50 text-emerald-400 hover:bg-emerald-500/25',
    icon: 'check_circle',
    short: 'P',
    label: 'Present',
  },
  absent: {
    active: 'bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-900/40',
    idle: 'bg-rose-500/15 border-rose-600/50 text-rose-400 hover:bg-rose-500/25',
    icon: 'cancel',
    short: 'A',
    label: 'Absent',
  },
  off: {
    active: 'bg-amber-600 border-amber-500 text-white shadow-md shadow-amber-900/40',
    idle: 'bg-amber-500/15 border-amber-600/50 text-amber-400 hover:bg-amber-500/25',
    icon: 'block',
    short: 'Off',
    label: 'Class Off',
  },
};

function AttendanceBtn({ which, current, onClick }) {
  const s = ATTENDANCE_STYLES[which];
  const isActive = current === which;
  return (
    <button
      onClick={() => onClick(which)}
      title={s.label}
      aria-label={s.label}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${
        isActive ? s.active : s.idle
      }`}
    >
      <span className="material-icons text-sm">{s.icon}</span>
      <span>{s.label}</span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DailySchedule({ onScheduleChanged, onAttendanceChanged, addEventTrigger, refreshTrigger }) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr);
  const [schedule, setSchedule] = useState([]);
  const [courses, setCourses] = useState([]); // Loaded from Attendance Guardian (Subject Info)
  const [loading, setLoading] = useState(true);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // { id, title, type }
  const [editingEvent, setEditingEvent] = useState(null);
  const [currentTime, setCurrentTime] = useState('');
  const [nowHours, setNowHours] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attendanceState, setAttendanceState] = useState({}); // { [eventId]: 'present'|'absent'|'off'|null }
  const dateInputRef = useRef(null);
  const nowLineRef = useRef(null);

  // New Event Form State
  const [newEvent, setNewEvent] = useState({
    type: 'class',
    classType: 'Lecture',
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    deadline: '17:00',
    location: '',
    professor: '',
  });

  // Edit Event Form State
  const [editForm, setEditForm] = useState({
    type: 'class',
    classType: 'Lecture',
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    deadline: '17:00',
    location: '',
    professor: '',
  });

  // Load courses from Attendance Guardian (Subject Info)
  const loadCourses = useCallback(async () => {
    try {
      const data = await fetchAttendance();
      if (data && Array.isArray(data.courses)) {
        setCourses(data.courses);
      } else {
        setCourses([]);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses, refreshTrigger]);

  // Live clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = now.getHours();
      const min = now.getMinutes();
      setCurrentTime(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
      setNowHours(h + min / 60);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  // Scroll now-line into view on today
  useEffect(() => {
    if (selectedDate === getTodayDateStr() && nowLineRef.current) {
      if (typeof nowLineRef.current.scrollIntoView === 'function') {
        nowLineRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [selectedDate, loading]);

  // Fetch schedule
  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSchedule(selectedDate);
      setSchedule(data || []);
    } catch {
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { loadSchedule(); }, [loadSchedule, refreshTrigger]);

  useEffect(() => {
    if (addEventTrigger) setShowAddEventModal(true);
  }, [addEventTrigger]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const changeDateByDays = (offset) => {
    const current = parseDateStr(selectedDate);
    current.setDate(current.getDate() + offset);
    setSelectedDate(formatDateStr(current));
  };

  const isToday = selectedDate === getTodayDateStr();

  const formattedSelectedDate = parseDateStr(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });

  const surroundingDays = (() => {
    const center = parseDateStr(selectedDate);
    const todayStr = getTodayDateStr();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(center);
      d.setDate(d.getDate() + (i - 3));
      const dateStr = formatDateStr(d);
      return {
        dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        isDayToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
      };
    });
  })();

  // ── Attendance toggle directly linked with Attendance Guardian ────────────
  const handleAttendance = async (event, status) => {
    const prev = attendanceState[event._id] ?? event.attendanceStatus ?? null;
    const next = prev === status ? null : status; // toggle off if same
    setAttendanceState((s) => ({ ...s, [event._id]: next }));

    try {
      // 1. Update on schedule event
      await updateScheduleEvent(event._id, { attendanceStatus: next });

      // 2. Direct sync with Attendance Guardian
      const eventSubject = (event.subjectName || getCleanTitle(event))?.toLowerCase().trim();
      const matchedCourse = courses.find((c) => {
        const cName = c.courseName?.toLowerCase().trim();
        return cName === eventSubject || cName?.includes(eventSubject) || eventSubject?.includes(cName);
      });

      if (matchedCourse) {
        if (!next || next === 'off') {
          // Off or untoggled: remove record from attendance guardian
          await deleteAttendanceRecord(matchedCourse._id, selectedDate);
        } else {
          // Present or Absent
          await markAttendance({
            courseId: matchedCourse._id,
            date: selectedDate,
            status: next,
          });
        }
      }

      if (onScheduleChanged) onScheduleChanged();
      if (onAttendanceChanged) onAttendanceChanged();
    } catch {
      toast.error('Failed to save attendance');
      setAttendanceState((s) => ({ ...s, [event._id]: prev }));
    }
  };

  // ── Add event ─────────────────────────────────────────────────────────────
  const handleAddEvent = async () => {
    if (!newEvent.title.trim()) {
      toast.warn('Please select a subject or enter a title');
      return;
    }
    try {
      setIsSubmitting(true);
      const isClass = newEvent.type === 'class';
      const payload = {
        ...newEvent,
        subjectName: isClass ? newEvent.title.trim() : '',
        title: isClass ? `${newEvent.title.trim()} (${newEvent.classType || 'Lecture'})` : newEvent.title.trim(),
        date: selectedDate,
      };
      const created = await createScheduleEvent(payload);
      setSchedule((prev) =>
        [...prev, created].sort((a, b) => (eventStartHour(a) ?? 99) - (eventStartHour(b) ?? 99))
      );
      toast.success('Event added successfully');
      setShowAddEventModal(false);
      setNewEvent({
        type: 'class',
        classType: 'Lecture',
        title: '',
        startTime: '09:00',
        endTime: '10:00',
        deadline: '17:00',
        location: '',
        professor: '',
      });
      if (onScheduleChanged) onScheduleChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add event');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Edit event ────────────────────────────────────────────────────────────
  const handleEditEventClick = (event) => {
    setEditingEvent(event);
    const cType = getClassType(event);
    const cleanTitle = getCleanTitle(event);
    setEditForm({
      type: event.type || 'class',
      classType: ['Lab', 'Tutorial', 'Lecture'].includes(cType) ? cType : 'Lecture',
      title: cleanTitle || event.title || '',
      startTime: event.startTime || '09:00',
      endTime: event.endTime || '10:00',
      deadline: event.deadline || '17:00',
      location: event.location || '',
      professor: event.professor || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) {
      toast.warn('Please select a subject or enter a title');
      return;
    }
    try {
      setIsSubmitting(true);
      const isClass = editForm.type === 'class';
      const payload = {
        ...editForm,
        subjectName: isClass ? editForm.title.trim() : '',
        title: isClass ? `${editForm.title.trim()} (${editForm.classType || 'Lecture'})` : editForm.title.trim(),
      };
      const updated = await updateScheduleEvent(editingEvent._id, payload);
      setSchedule((prev) =>
        prev.map((item) => (item._id === editingEvent._id ? { ...item, ...updated, ...payload } : item))
      );
      toast.success('Event updated successfully');
      setEditingEvent(null);
      if (onScheduleChanged) onScheduleChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update event');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete event ──────────────────────────────────────────────────────────
  const handleDeleteEventClick = (event) => {
    setShowDeleteConfirm({ id: event._id, title: getCleanTitle(event) || event.title, type: event.type });
  };

  const confirmDelete = async () => {
    const id = showDeleteConfirm.id;
    setShowDeleteConfirm(null);
    try {
      await deleteScheduleEvent(id);
      setSchedule((prev) => prev.filter((item) => item._id !== id));
      toast.success('Removed from schedule');
      if (onScheduleChanged) onScheduleChanged();
    } catch {
      toast.error('Failed to remove event');
    }
  };

  // ── Build overlap groups and dynamic hour range ───────────────────────────
  const overlapGroups = buildOverlapGroups(schedule);

  // Map: startHour (floor) → overlap groups that start in that hour
  const groupsByHour = {};
  for (const g of overlapGroups) {
    const h = Math.floor(g.start);
    if (!groupsByHour[h]) groupsByHour[h] = [];
    groupsByHour[h].push(g);
  }

  // Only render hours that have events, ±1 buffer hour
  let minHour = 8;
  let maxHour = 17;
  if (schedule.length > 0) {
    const starts = schedule.map((ev) => Math.floor(eventStartHour(ev) ?? 8));
    const ends   = schedule.map((ev) => Math.ceil(eventEndHour(ev)));
    minHour = Math.max(0, Math.min(...starts) - 1);
    maxHour = Math.min(23, Math.max(...ends));
  }
  // Always include current hour when viewing today
  if (isToday) {
    minHour = Math.min(minHour, Math.max(0, Math.floor(nowHours) - 1));
    maxHour = Math.max(maxHour, Math.min(23, Math.floor(nowHours) + 1));
  }

  const HOURS = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-900/60 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-gray-800 shadow-2xl relative">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-gray-800/80 pb-6">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 material-icons">
            calendar_today
          </span>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-wide">Daily Schedule</h2>
            <p className="text-sm text-gray-400">{formattedSelectedDate}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="daily-schedule-add-event-btn"
            onClick={() => setShowAddEventModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition cursor-pointer shadow-sm shadow-violet-900/30"
          >
            <span className="material-icons text-sm">add</span>
            <span>Add Event</span>
          </button>

          <div className="relative">
            <button
              type="button"
              id="daily-schedule-pick-date-btn"
              onClick={() => {
                if (dateInputRef.current) {
                  try { dateInputRef.current.showPicker(); } catch { dateInputRef.current.focus(); }
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white border border-gray-700 text-xs font-medium cursor-pointer transition shadow-sm"
              title="Pick any date from calendar"
            >
              <span className="material-icons text-sm text-violet-400">event</span>
              <span>Pick Date</span>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value); }}
              className="sr-only pointer-events-none"
              aria-label="Pick Date"
            />
          </div>
        </div>
      </div>

      {/* ── 7-Day Strip ── */}
      <div className="mb-6 p-2 rounded-2xl bg-black/40 border border-gray-800/80 flex items-center justify-between gap-1.5 sm:gap-2 overflow-x-auto">
        <button
          onClick={() => changeDateByDays(-1)}
          className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition flex-shrink-0 cursor-pointer"
          title="Previous Day"
          aria-label="Previous Day"
        >
          <span className="material-icons text-base">chevron_left</span>
        </button>

        <div className="flex items-center justify-between flex-1 gap-1 sm:gap-2">
          {surroundingDays.map((day) => (
            <button
              key={day.dateStr}
              onClick={() => setSelectedDate(day.dateStr)}
              className={`flex-1 flex flex-col items-center py-2 px-1.5 sm:px-2 rounded-xl transition-all cursor-pointer min-w-[42px] ${
                day.isSelected
                  ? 'bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-900/50 scale-[1.03] font-bold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 font-medium'
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider opacity-80">{day.dayName}</span>
              <span className="text-sm sm:text-base font-mono mt-0.5">{day.dayNum}</span>
              {day.isDayToday && (
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-0.5 ${day.isSelected ? 'bg-white' : 'bg-violet-400'}`}
                  title="Today"
                />
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => changeDateByDays(1)}
          className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition flex-shrink-0 cursor-pointer"
          title="Next Day"
          aria-label="Next Day"
        >
          <span className="material-icons text-base">chevron_right</span>
        </button>
      </div>

      {/* ── Current Time & Switch to Today ── */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-violet-950/40 border border-violet-800/40 text-violet-300">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping flex-shrink-0" />
          <span>Current Time: {currentTime}</span>
        </div>
        {!isToday && (
          <button
            onClick={() => setSelectedDate(getTodayDateStr())}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-violet-900/40 hover:bg-violet-900/70 text-violet-300 border border-violet-700/50 transition-all hover:scale-[1.02] cursor-pointer shadow-sm"
          >
            <span className="material-icons text-sm">today</span>
            <span>Switch to Today</span>
          </button>
        )}
      </div>

      {/* ── Timeline ── */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-block w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-gray-400">Loading schedule...</p>
        </div>
      ) : (
        <div className="relative">
          <div className="max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700">
            <div className="relative pt-3">
              {HOURS.map((hour, idx) => {
                const groups = groupsByHour[hour] || [];
                const hasStartingEvents = groups.length > 0;

                // Find events that started earlier and are STILL ongoing during this hour
                const ongoingEvents = schedule.filter((ev) => {
                  const s = Math.floor(eventStartHour(ev) ?? 0);
                  const e = Math.ceil(eventEndHour(ev));
                  return s < hour && e > hour;
                });
                const hasOngoingEvents = ongoingEvents.length > 0;
                const hasAnyEvents = hasStartingEvents || hasOngoingEvents;

                const isNowHour = isToday && Math.floor(nowHours) === hour;
                const hourLabel = `${String(hour).padStart(2, '0')}:00`;
                const fracInHour = Math.min(Math.max(nowHours - hour, 0), 1);
                const isLastHour = idx === HOURS.length - 1;

                return (
                  <div
                    key={hour}
                    className={`flex relative ${
                      hasAnyEvents ? 'min-h-[84px]' : 'min-h-[26px]'
                    }`}
                  >
                    {/* ── Left: time label ── */}
                    <div className="w-[52px] flex-shrink-0 select-none flex justify-end pr-2">
                      <span
                        className={`text-[10px] font-mono leading-none -translate-y-[5px] tabular-nums ${
                          isNowHour
                            ? 'text-violet-400 font-bold'
                            : hasAnyEvents
                              ? 'text-gray-400'
                              : 'text-gray-600'
                        }`}
                      >
                        {hourLabel}
                      </span>
                    </div>

                    {/* ── Centre: axis ── */}
                    <div className="relative flex flex-col w-[18px] flex-shrink-0 items-center">
                      {/* Tick mark */}
                      <div
                        className={`h-px flex-shrink-0 ${
                          hasAnyEvents ? 'w-[10px] bg-gray-500' : 'w-[6px] bg-gray-700'
                        }`}
                      />
                      {/* Connector */}
                      {!isLastHour && (
                        <div
                          className={`flex-1 w-px ${
                            hasAnyEvents ? 'bg-gray-600' : 'bg-gray-800'
                          }`}
                          style={!hasAnyEvents ? { backgroundImage: 'repeating-linear-gradient(to bottom, #374151 0, #374151 3px, transparent 3px, transparent 7px)', backgroundSize: '1px 7px', width: '1px', background: 'none' } : {}}
                        />
                      )}

                      {/* Now dot */}
                      {isNowHour && (
                        <div
                          ref={nowLineRef}
                          className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                          style={{ top: `${fracInHour * 100}%` }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full bg-violet-400 ring-2 ring-violet-300/40 shadow-lg shadow-violet-500/50 -translate-x-1/2 relative left-1/2" />
                        </div>
                      )}
                    </div>

                    {/* ── Right: event cards & ongoing session blocks ── */}
                    <div className="flex-1 pl-2 py-0.5 min-w-0">
                      {hasStartingEvents || hasOngoingEvents ? (
                        <div className="space-y-2 pb-2">
                          {/* Ongoing sessions continuing from previous hour */}
                          {hasOngoingEvents && (
                            <div className="space-y-1">
                              {ongoingEvents.map((ev) => {
                                const cType = getClassType(ev);
                                const cfg = TYPE_CONFIG[cType] || TYPE_CONFIG.Lecture;
                                return (
                                  <div
                                    key={`ongoing-${ev._id}-${hour}`}
                                    className={`flex items-center justify-between gap-2 rounded-r-xl border border-dashed border-gray-700/60 border-l-2 px-3 py-1.5 bg-gray-850/40 text-xs ${cfg.accent}`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`w-2 h-2 rounded-full flex-shrink-0 animate-pulse ${cfg.dot}`} />
                                      <span className="font-semibold text-gray-200 truncate">{getCleanTitle(ev)}</span>
                                    </div>
                                    <span className="text-[11px] text-gray-400 font-mono shrink-0">
                                      In session (until {ev.endTime})
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Groups that start in this hour */}
                          {groups.map((group, gi) => {
                            const isOverlap = group.events.length > 1;
                            return (
                              <div key={gi} className="space-y-1.5">
                                {isOverlap && (
                                  <div className="flex items-center gap-1 mb-1">
                                    <span className="material-icons text-[10px] text-amber-500">call_merge</span>
                                    <span className="text-[9px] text-amber-500 font-semibold uppercase tracking-wider">Overlapping</span>
                                  </div>
                                )}
                                {group.events.map((ev) => {
                                  const attendance = attendanceState[ev._id] ?? ev.attendanceStatus ?? null;
                                  const cType = getClassType(ev);
                                  const cfg = TYPE_CONFIG[cType] || TYPE_CONFIG.Lecture;
                                  const cleanTitle = getCleanTitle(ev);

                                  const startH = timeToHours(ev.startTime);
                                  const endH = timeToHours(ev.endTime);
                                  const durationH = startH !== null && endH !== null ? Math.max(0, endH - startH) : 1;

                                  const timeLabel =
                                    ev.type === 'task'
                                      ? `Due ${ev.deadline}`
                                      : ev.startTime && ev.endTime
                                        ? `${ev.startTime}–${ev.endTime}`
                                        : '';

                                  return (
                                    <div
                                      key={ev._id}
                                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-r-xl border border-gray-700/50 border-l-4 px-3.5 py-2.5 transition-all duration-200 hover:border-gray-600/80 group ${cfg.accent} ${
                                        isOverlap ? 'ml-3' : ''
                                      }`}
                                    >
                                      {/* Left: type badge + clean title + meta */}
                                      <div className="flex-1 min-w-0">
                                        {/* Type badge on top-left with specific color */}
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${cfg.style}`}>
                                            {cfg.label}
                                          </span>
                                          {durationH > 1 && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-850 text-gray-300 border border-gray-700/80 font-mono">
                                              {durationH} hrs
                                            </span>
                                          )}
                                        </div>

                                        {/* Subject Name / Title */}
                                        <p className="text-sm font-semibold text-gray-100 truncate leading-snug">
                                          {cleanTitle}
                                        </p>

                                        {/* Meta: time, location, professor */}
                                        <div className="flex items-center gap-3.5 mt-1.5 flex-wrap">
                                          {timeLabel && (
                                            <span className="text-xs text-gray-300 font-mono flex items-center gap-1">
                                              <span className="material-icons text-xs text-gray-400">schedule</span>
                                              {timeLabel}
                                            </span>
                                          )}
                                          {ev.location && (
                                            <span className="flex items-center gap-1 text-xs text-gray-300">
                                              <span className="material-icons text-sm text-gray-400">location_on</span>
                                              {ev.location}
                                            </span>
                                          )}
                                          {ev.professor && (
                                            <span className="flex items-center gap-1 text-xs text-gray-300">
                                              <span className="material-icons text-sm text-gray-400">person</span>
                                              {ev.professor}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Right: attendance pills + edit + delete */}
                                      <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                                        {ev.type === 'class' && (
                                          <div className="flex items-center gap-1 sm:flex-col sm:gap-1">
                                            <AttendanceBtn which="present" current={attendance} onClick={(s) => handleAttendance(ev, s)} />
                                            <AttendanceBtn which="absent"  current={attendance} onClick={(s) => handleAttendance(ev, s)} />
                                            <AttendanceBtn which="off"     current={attendance} onClick={(s) => handleAttendance(ev, s)} />
                                          </div>
                                        )}
                                        <div className="flex sm:flex-col gap-1">
                                          <button
                                            onClick={() => handleEditEventClick(ev)}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-violet-400 hover:bg-violet-500/10 transition cursor-pointer"
                                            title="Edit Event"
                                            aria-label="Edit Event"
                                          >
                                            <span className="material-icons text-base">edit</span>
                                          </button>
                                          <button
                                            onClick={() => handleDeleteEventClick(ev)}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                            title="Delete Event"
                                            aria-label="Delete Event"
                                          >
                                            <span className="material-icons text-base">delete_outline</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="h-full" />
                      )}
                    </div>

                    {/* Now horizontal line */}
                    {isNowHour && (
                      <div
                        className="absolute left-[70px] right-0 h-px bg-gradient-to-r from-violet-500 via-violet-400/40 to-transparent pointer-events-none z-10"
                        style={{ top: `${fracInHour * 100}%` }}
                      />
                    )}
                  </div>
                );
              })}

              {/* End-of-range label */}
              <div className="flex">
                <div className="w-[52px] flex-shrink-0 flex justify-end pr-2">
                  <span className="text-[10px] font-mono text-gray-600 -translate-y-[5px] tabular-nums">
                    {String(maxHour + 1 > 24 ? 24 : maxHour + 1).padStart(2, '0')}:00
                  </span>
                </div>
                <div className="w-[18px] flex-shrink-0 flex items-start pt-0">
                  <div className="w-[6px] h-px bg-gray-700" />
                </div>
              </div>
            </div>
          </div>

          {/* Empty state overlay */}
          {schedule.length === 0 && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-32">
              <span className="material-icons text-5xl text-violet-500/20 mb-3">event_available</span>
              <h4 className="text-base font-semibold text-gray-500">No events scheduled</h4>
              <p className="text-xs text-gray-600 mt-1">Add classes or tasks to see them on the timeline.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Add Event Modal ── */}
      {showAddEventModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg border border-violet-700/40 shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="material-icons text-violet-400">add_circle_outline</span>
                Add Event to Schedule
              </h3>
              <button
                onClick={() => setShowAddEventModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 cursor-pointer"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Type */}
              <div>
                <label className="block text-gray-300 mb-1.5 font-medium">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['class', 'task', 'event'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewEvent((prev) => ({ ...prev, type }))}
                      className={`py-2 px-3 rounded-xl border text-center font-semibold capitalize transition cursor-pointer ${
                        newEvent.type === type
                          ? 'bg-violet-600 border-violet-500 text-white'
                          : 'bg-gray-800/80 border-gray-700 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Class Type selection if class */}
              {newEvent.type === 'class' && (
                <div>
                  <label className="block text-gray-300 mb-1.5 font-medium">Class Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Lecture', 'Lab', 'Tutorial'].map((ct) => (
                      <button
                        key={ct}
                        type="button"
                        onClick={() => setNewEvent((prev) => ({ ...prev, classType: ct }))}
                        className={`py-1.5 px-3 rounded-xl border text-center font-semibold text-xs transition cursor-pointer ${
                          newEvent.classType === ct
                            ? ct === 'Lab'
                              ? 'bg-pink-600/30 border-pink-500 text-pink-300'
                              : ct === 'Tutorial'
                              ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                              : 'bg-violet-600/30 border-violet-500 text-violet-300'
                            : 'bg-gray-800/80 border-gray-700 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {ct}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Title / Subject Name: Dropdown for subjects in Subject Info only */}
              <div>
                <label className="block text-gray-300 mb-1.5 font-medium">
                  {newEvent.type === 'class' ? 'Subject (from Subject Info)' : 'Title'}
                </label>
                {newEvent.type === 'class' ? (
                  courses.length > 0 ? (
                    <select
                      value={newEvent.title}
                      onChange={(e) => {
                        const selectedCourse = courses.find((c) => c.courseName === e.target.value);
                        setNewEvent((prev) => ({
                          ...prev,
                          title: e.target.value,
                          professor: selectedCourse?.professor || prev.professor,
                        }));
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                      required
                    >
                      <option value="" disabled>Select a subject from Subject Info</option>
                      {courses.map((c) => (
                        <option key={c._id} value={c.courseName}>
                          {c.courseName} {c.courseCode ? `(${c.courseCode})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                      No subjects found in Subject Info. Please add subjects using the <strong>Subject Info</strong> button above first.
                    </div>
                  )
                ) : (
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    placeholder="e.g. Submit Assignment 3"
                    required
                  />
                )}
              </div>

              {/* Timings */}
              {newEvent.type === 'task' ? (
                <div>
                  <label className="block text-gray-300 mb-1.5 font-medium">Deadline Time</label>
                  <input
                    type="time"
                    value={newEvent.deadline}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, deadline: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-300 mb-1.5 font-medium">Start Time</label>
                    <input
                      type="time"
                      value={newEvent.startTime}
                      onChange={(e) => setNewEvent((prev) => ({ ...prev, startTime: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-1.5 font-medium">End Time</label>
                    <input
                      type="time"
                      value={newEvent.endTime}
                      onChange={(e) => setNewEvent((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              )}

              {/* Location */}
              <div>
                <label className="block text-gray-300 mb-1.5 font-medium">Location (Room/Hall)</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. CC-1 / Lab 2"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Professor (classes only) */}
              {newEvent.type === 'class' && (
                <div>
                  <label className="block text-gray-300 mb-1.5 font-medium">Professor Name</label>
                  <input
                    type="text"
                    value={newEvent.professor}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, professor: e.target.value }))}
                    placeholder="e.g. Dr. A. Sharma"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
              )}

              <button
                onClick={handleAddEvent}
                disabled={isSubmitting || !newEvent.title.trim()}
                className="w-full mt-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-violet-900/30 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? 'Saving...' : 'Save to Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Event Modal ── */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg border border-violet-700/40 shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="material-icons text-violet-400">edit_note</span>
                Edit {editForm.type === 'class' ? 'Class' : editForm.type === 'task' ? 'Task' : 'Event'}
              </h3>
              <button
                onClick={() => setEditingEvent(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 cursor-pointer"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Type */}
              <div>
                <label className="block text-gray-300 mb-1.5 font-medium">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['class', 'task', 'event'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, type }))}
                      className={`py-2 px-3 rounded-xl border text-center font-semibold capitalize transition cursor-pointer ${
                        editForm.type === type
                          ? 'bg-violet-600 border-violet-500 text-white'
                          : 'bg-gray-800/80 border-gray-700 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Class Type selection if class */}
              {editForm.type === 'class' && (
                <div>
                  <label className="block text-gray-300 mb-1.5 font-medium">Class Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Lecture', 'Lab', 'Tutorial'].map((ct) => (
                      <button
                        key={ct}
                        type="button"
                        onClick={() => setEditForm((prev) => ({ ...prev, classType: ct }))}
                        className={`py-1.5 px-3 rounded-xl border text-center font-semibold text-xs transition cursor-pointer ${
                          editForm.classType === ct
                            ? ct === 'Lab'
                              ? 'bg-pink-600/30 border-pink-500 text-pink-300'
                              : ct === 'Tutorial'
                              ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                              : 'bg-violet-600/30 border-violet-500 text-violet-300'
                            : 'bg-gray-800/80 border-gray-700 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {ct}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Title / Subject Name: Dropdown for subjects in Subject Info only */}
              <div>
                <label className="block text-gray-300 mb-1.5 font-medium">
                  {editForm.type === 'class' ? 'Subject (from Subject Info)' : 'Title'}
                </label>
                {editForm.type === 'class' ? (
                  courses.length > 0 ? (
                    <select
                      value={editForm.title}
                      onChange={(e) => {
                        const selectedCourse = courses.find((c) => c.courseName === e.target.value);
                        setEditForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                          professor: selectedCourse?.professor || prev.professor,
                        }));
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                      required
                    >
                      <option value="" disabled>Select a subject from Subject Info</option>
                      {courses.map((c) => (
                        <option key={c._id} value={c.courseName}>
                          {c.courseName} {c.courseCode ? `(${c.courseCode})` : ''}
                        </option>
                      ))}
                      {/* If current subject is not in courses list, allow keeping it */}
                      {editForm.title && !courses.some((c) => c.courseName === editForm.title) && (
                        <option value={editForm.title}>{editForm.title}</option>
                      )}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
                      required
                    />
                  )
                ) : (
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
                    required
                  />
                )}
              </div>

              {/* Timings */}
              {editForm.type === 'task' ? (
                <div>
                  <label className="block text-gray-300 mb-1.5 font-medium">Deadline Time</label>
                  <input
                    type="time"
                    value={editForm.deadline}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, deadline: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-300 mb-1.5 font-medium">Start Time</label>
                    <input
                      type="time"
                      value={editForm.startTime}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, startTime: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-1.5 font-medium">End Time</label>
                    <input
                      type="time"
                      value={editForm.endTime}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              )}

              {/* Location */}
              <div>
                <label className="block text-gray-300 mb-1.5 font-medium">Location (Room/Hall)</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. CC-1 / Lab 2"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Professor (classes only) */}
              {editForm.type === 'class' && (
                <div>
                  <label className="block text-gray-300 mb-1.5 font-medium">Professor Name</label>
                  <input
                    type="text"
                    value={editForm.professor}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, professor: e.target.value }))}
                    placeholder="e.g. Dr. A. Sharma"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSubmitting || !editForm.title.trim()}
                  className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-violet-900/30 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-rose-900/50 shadow-2xl">
            <div className="flex items-center gap-2 mb-2 text-rose-400">
              <span className="material-icons text-xl">delete_forever</span>
              <h3 className="text-lg font-bold text-white">
                Delete {showDeleteConfirm.type === 'class' ? 'Class' : showDeleteConfirm.type === 'task' ? 'Task' : 'Event'}?
              </h3>
            </div>
            <p className="text-sm text-gray-300 mb-5">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white">"{showDeleteConfirm.title}"</strong> from your schedule? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg shadow-rose-900/30 cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
