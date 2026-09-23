import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from "sonner";
import {
  fetchSchedule,
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
  fetchAttendance,
  createAttendanceCourse,
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
  if (ev.type === 'task') return 'Task';
  if (ev.type === 'event') return 'Event';
  if (ev.classType) {
    const ct = ev.classType.charAt(0).toUpperCase() + ev.classType.slice(1).toLowerCase();
    if (TYPE_CONFIG[ct]) return ct;
  }
  const match = ev.title?.match(/\b(Lab|Tutorial|Lecture)\b/i);
  if (match) {
    const word = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    if (TYPE_CONFIG[word]) return word;
  }
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
    active: 'bg-emerald-600 border-emerald-500 text-on-accent shadow-md shadow-emerald-900/40',
    idle: 'bg-emerald-500/15 border-emerald-600/50 text-emerald-400 hover:bg-emerald-500/25',
    icon: 'check_circle',
    short: 'P',
    label: 'Present',
  },
  absent: {
    active: 'bg-rose-600 border-rose-500 text-on-accent shadow-md shadow-rose-900/40',
    idle: 'bg-rose-500/15 border-rose-600/50 text-rose-400 hover:bg-rose-500/25',
    icon: 'cancel',
    short: 'A',
    label: 'Absent',
  },
  off: {
    active: 'bg-amber-600 border-amber-500 text-on-accent shadow-md shadow-amber-900/40',
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
      className={`flex items-center justify-center gap-1.5 w-24 py-1 px-2 rounded-md border text-[10.5px] sm:text-[11px] font-bold transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
        isActive ? s.active : s.idle
      }`}
    >
      <span className="material-icons text-[12px] sm:text-[13px] leading-none shrink-0">{s.icon}</span>
      <span className="leading-none">{s.label}</span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DailySchedule({ onScheduleChanged, onAttendanceChanged, refreshTrigger }) {
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
  const timelineScrollRef = useRef(null);

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

  // Scroll the now-line into view on today, confined to this component's own
  // timeline scroll container. `scrollIntoView` was used here before, but it
  // cascades to every scrollable ancestor needed to center the target —
  // including the page's own <main>, which visibly scrolled the whole
  // Dashboard down on load. Computing and setting scrollTop directly on the
  // local container never touches anything outside it.
  useEffect(() => {
    if (selectedDate === getTodayDateStr() && nowLineRef.current && timelineScrollRef.current) {
      const container = timelineScrollRef.current;
      const target = nowLineRef.current;
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offsetWithinContainer = (targetRect.top - containerRect.top) + container.scrollTop;
      const desiredScrollTop = offsetWithinContainer - container.clientHeight / 2 + target.clientHeight / 2;
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ top: Math.max(desiredScrollTop, 0), behavior: 'smooth' });
      } else {
        container.scrollTop = Math.max(desiredScrollTop, 0);
      }
    }
  }, [selectedDate, loading]);

  // Fetch schedule
  const loadSchedule = useCallback(async (showLoadingSpinner = false) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      const data = await fetchSchedule(selectedDate);
      setSchedule(data || []);
    } catch {
      toast.error('Failed to load schedule');
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadSchedule(true);
  }, [loadSchedule]);

  // Only an explicit refresh re-fetches silently; a date change is already
  // handled (with the spinner) by the effect above.
  useEffect(() => {
    if (refreshTrigger) {
      loadSchedule(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

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

  // Reset attendance state cache when selectedDate changes to prevent state leaking across dates
  useEffect(() => {
    setAttendanceState({});
  }, [selectedDate]);

  // ── Attendance toggle directly linked with Attendance Guardian ────────────
  const handleAttendance = async (event, status) => {
    const eventDate = event.date || selectedDate;
    const key = `${eventDate}_${event._id}`;
    const prev = attendanceState[key] ?? event.attendanceStatus ?? null;
    const next = prev === status ? null : status; // toggle off if same
    setAttendanceState((s) => ({ ...s, [key]: next }));
    setSchedule((prevList) =>
      prevList.map((item) =>
        item._id === event._id ? { ...item, attendanceStatus: next } : item
      )
    );

    try {
      // 1. Direct sync with Attendance Guardian
      const eventSubject = (event.subjectName || getCleanTitle(event) || event.title || '').trim();
      let currentCourses = courses;

      const findMatchingCourse = (courseList, targetName, targetCode) => {
        if (!Array.isArray(courseList) || !courseList.length) return null;
        const normName = targetName?.toLowerCase().trim();
        const normCode = targetCode?.toLowerCase().trim();
        return courseList.find((c) => {
          const cName = c.courseName?.toLowerCase().trim();
          const cCode = c.courseCode?.toLowerCase().trim();
          if (normName && cName) {
            if (cName === normName || cName.includes(normName) || normName.includes(cName)) return true;
          }
          if (normCode && cCode && cCode === normCode) return true;
          if (normName && cCode && (cCode === normName || normName.includes(cCode))) return true;
          return false;
        });
      };

      let matchedCourse = findMatchingCourse(currentCourses, eventSubject, event.courseCode);

      // If not found in local state, fetch latest courses from backend
      if (!matchedCourse) {
        try {
          const data = await fetchAttendance();
          if (data?.courses && Array.isArray(data.courses)) {
            currentCourses = data.courses;
            setCourses(data.courses);
            matchedCourse = findMatchingCourse(currentCourses, eventSubject, event.courseCode);
          }
        } catch {
          // ignore
        }
      }

      const isLab = getClassType(event) === 'Lab' || (event.classType || '').toLowerCase() === 'lab';
      const recordType = isLab ? 'lab' : 'class';

      // Auto-create course in Attendance Guardian if still not present and marking attendance
      if (!matchedCourse && next && next !== 'off') {
        const subjectToCreate = eventSubject || 'Class';
        try {
          const created = await createAttendanceCourse({
            courseName: subjectToCreate,
            courseCode: event.courseCode || '',
            hasLab: isLab,
          });
          if (created) {
            matchedCourse = created;
            setCourses((prevList) => [...prevList, created]);
          }
        } catch {
          // If already exists on backend under duplicate-name, re-fetch and match
          try {
            const data = await fetchAttendance();
            if (data?.courses && Array.isArray(data.courses)) {
              setCourses(data.courses);
              matchedCourse = findMatchingCourse(data.courses, subjectToCreate, event.courseCode);
            }
          } catch {
            // ignore
          }
        }
      }

      if (matchedCourse) {
        if (!next || next === 'off') {
          // Off or untoggled: remove record from attendance guardian (non-fatal)
          try {
            await deleteAttendanceRecord(matchedCourse._id, eventDate, recordType);
          } catch (delErr) {
            console.warn('deleteAttendanceRecord non-fatal warning:', delErr);
          }
        } else {
          // Present or Absent
          await markAttendance({
            courseId: matchedCourse._id,
            date: eventDate,
            status: next,
            recordType,
          });
        }
      }

      // 2. Update on schedule event only for custom events (timetable classes do not store attendance on schedule)
      if (event._id && !event.isFromTimetable && !String(event._id).startsWith('tt_')) {
        try {
          await updateScheduleEvent(event._id, { attendanceStatus: next });
        } catch (scheduleErr) {
          console.warn('Schedule event status update non-fatal warning:', scheduleErr);
        }
      }

      // 3. Notify parent components safely so parent callback errors never revert attendance
      try {
        if (onAttendanceChanged) onAttendanceChanged();
        else if (onScheduleChanged) onScheduleChanged();
      } catch (cbErr) {
        console.warn('onAttendanceChanged callback non-fatal warning:', cbErr);
      }
    } catch (err) {
      console.error('Failed to save attendance:', err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save attendance');
      setAttendanceState((s) => ({ ...s, [key]: prev }));
      setSchedule((prevList) =>
        prevList.map((item) =>
          item._id === event._id ? { ...item, attendanceStatus: prev } : item
        )
      );
    }
  };

  // ── Add event ─────────────────────────────────────────────────────────────
  const handleAddEvent = async () => {
    if (!newEvent.title.trim()) {
      toast.warning('Please select a subject or enter a title');
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
      toast.warning('Please select a subject or enter a title');
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

  // ── Build timeline slots: merge multi-hour events (e.g. 15:00–17:00) together ───
  const overlapGroups = buildOverlapGroups(schedule);

  // Map: startHour (floor) → overlap groups that start in that hour
  const groupStarts = {};
  for (const g of overlapGroups) {
    const h = Math.floor(g.start);
    if (!groupStarts[h]) groupStarts[h] = [];
    groupStarts[h].push(g);
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

  // Build sequential slots: multi-hour blocks (e.g. 15:00-17:00) form a single slot together
  const SLOTS = [];
  let h = minHour;
  while (h <= maxHour) {
    const groups = groupStarts[h];
    if (groups && groups.length > 0) {
      const maxEnd = Math.max(...groups.map((g) => Math.ceil(g.end)));
      const spanEnd = Math.max(h + 1, maxEnd);
      const isMultiHour = (spanEnd - h) > 1;

      const startLabel = `${String(h).padStart(2, '0')}:00`;
      const label = startLabel;

      SLOTS.push({
        key: `slot-${h}-${spanEnd}`,
        startHour: h,
        endHour: spanEnd,
        isMultiHour,
        label,
        groups,
        hasEvents: true,
      });

      // Jump forward by the group duration so intermediate hours (e.g. 16:00) aren't duplicated
      h = spanEnd;
    } else {
      const label = `${String(h).padStart(2, '0')}:00`;
      SLOTS.push({
        key: `slot-${h}-${h + 1}`,
        startHour: h,
        endHour: h + 1,
        isMultiHour: false,
        label,
        groups: [],
        hasEvents: false,
      });
      h += 1;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div id="daily-schedule" className="bg-surface/60 backdrop-blur-xl rounded-2xl p-4 sm:p-6 md:p-8 border border-line shadow-2xl relative">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-line/80 pb-6">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 material-icons">
            calendar_today
          </span>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-fg tracking-wide">Daily Schedule</h2>
            <p className="text-xs sm:text-sm text-fg-muted">{formattedSelectedDate}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="daily-schedule-add-event-btn"
            onClick={() => setShowAddEventModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-on-accent text-xs font-semibold transition-colors duration-150 cursor-pointer shadow-sm"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-fg-secondary hover:text-fg border border-line text-xs font-medium cursor-pointer transition shadow-sm"
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
      <div className="mb-6 p-1.5 sm:p-2 rounded-2xl bg-surface-2 border border-line/80 flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => changeDateByDays(-1)}
          className="p-1.5 sm:p-2 text-fg-muted hover:text-fg rounded-xl hover:bg-surface-3 transition flex-shrink-0 cursor-pointer"
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
              className={`flex-1 flex flex-col items-center py-2 px-1 sm:px-2 rounded-xl transition-all cursor-pointer min-w-[34px] sm:min-w-[42px] ${
                day.isSelected
                  ? 'bg-violet-600 text-on-accent shadow-sm font-semibold'
                  : 'text-fg-muted hover:text-fg-secondary hover:bg-surface-3/60 font-medium'
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider opacity-80">{day.dayName}</span>
              <span className="text-sm sm:text-base font-mono mt-0.5">{day.dayNum}</span>
              {day.isDayToday && (
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-0.5 ${day.isSelected ? 'bg-on-accent' : 'bg-violet-400'}`}
                  title="Today"
                />
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => changeDateByDays(1)}
          className="p-2 text-fg-muted hover:text-fg rounded-xl hover:bg-surface-3 transition flex-shrink-0 cursor-pointer"
          title="Next Day"
          aria-label="Next Day"
        >
          <span className="material-icons text-base">chevron_right</span>
        </button>
      </div>

      {/* ── Current Time & Switch to Today ── */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-violet-950/40 border border-violet-800/40 text-violet-300">
          <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
          <span>Current Time: {currentTime}</span>
        </div>
        {!isToday && (
          <button
            onClick={() => setSelectedDate(getTodayDateStr())}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-950/60 hover:bg-violet-900/60 text-violet-300 border border-violet-700/50 transition-colors duration-150 cursor-pointer shadow-sm"
          >
            <span className="material-icons text-sm">today</span>
            <span>Switch to Today</span>
          </button>
        )}
      </div>

      {/* ── Timeline ── */}
      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading schedule">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-10 bg-surface-2 rounded animate-pulse shrink-0" />
              <div className="w-[18px] flex justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-surface-3 animate-pulse" />
              </div>
              <div
                className="h-12 bg-surface-2 rounded-xl animate-pulse flex-1"
                style={{ opacity: 1 - i * 0.08 }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative">
          <div ref={timelineScrollRef} className="max-h-[70vh] overflow-y-auto pl-1 pr-1 custom-scrollbar">
            <div className="relative pt-3">
              {SLOTS.map((slot, idx) => {
                const isNowInSlot = isToday && nowHours >= slot.startHour && nowHours < slot.endHour;
                const fracInSlot = slot.endHour > slot.startHour
                  ? Math.min(Math.max((nowHours - slot.startHour) / (slot.endHour - slot.startHour), 0), 1)
                  : 0;
                const isLastSlot = idx === SLOTS.length - 1;

                return (
                  <div
                    key={slot.key}
                    className={`flex relative ${
                      slot.hasEvents ? 'min-h-[84px]' : 'min-h-[26px]'
                    }`}
                  >
                    {/* ── Left: time label ── */}
                    <div className="w-[54px] sm:w-[60px] flex-shrink-0 select-none flex justify-end pr-2">
                      <span
                        className={`text-[10px] sm:text-[11px] font-mono leading-none -translate-y-[5px] tabular-nums whitespace-nowrap ${
                          isNowInSlot
                            ? 'text-violet-400 font-bold'
                            : slot.hasEvents
                              ? 'text-fg-secondary'
                              : 'text-fg-subtle'
                        }`}
                      >
                        {slot.label}
                      </span>
                    </div>

                    {/* ── Centre: axis ── */}
                    <div className="relative flex flex-col w-[18px] flex-shrink-0 items-center">
                      {/* Tick mark */}
                      <div
                        className={`h-px flex-shrink-0 ${
                          slot.hasEvents ? 'w-[10px] bg-line-strong' : 'w-[6px] bg-line'
                        }`}
                      />
                      {/* Connector */}
                      {!isLastSlot && (
                        <div
                          className={`flex-1 w-px ${
                            slot.hasEvents ? 'bg-line-strong' : 'bg-line'
                          }`}
                          style={!slot.hasEvents ? { backgroundImage: 'repeating-linear-gradient(to bottom, rgb(var(--line-strong)) 0, rgb(var(--line-strong)) 3px, transparent 3px, transparent 7px)', backgroundSize: '1px 7px', width: '1px', background: 'none' } : {}}
                        />
                      )}

                      {/* Now dot */}
                      {isNowInSlot && (
                        <div
                          ref={nowLineRef}
                          className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                          style={{ top: `${fracInSlot * 100}%` }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full bg-violet-400 ring-2 ring-violet-300/40 shadow-sm -translate-x-1/2 relative left-1/2" />
                        </div>
                      )}
                    </div>

                    {/* ── Right: event cards ── */}
                    <div className="flex-1 pl-2 py-0.5 min-w-0">
                      {slot.hasEvents ? (
                        <div className="space-y-2 pb-2">
                          {slot.groups.map((group, gi) => {
                            const isOverlap = group.events.length > 1;
                            return (
                              <div key={gi} className="space-y-1.5">
                                {isOverlap && (
                                  <div className="flex items-center gap-1 mb-1">
                                    <span className="material-icons text-[10px] text-amber-400">call_merge</span>
                                    <span className="text-[9px] text-amber-400 font-semibold uppercase tracking-wider">Overlapping</span>
                                  </div>
                                )}
                                {group.events.map((ev) => {
                                  const evDate = ev.date || selectedDate;
                                  const attendance = attendanceState[`${evDate}_${ev._id}`] ?? ev.attendanceStatus ?? null;
                                  const cType = getClassType(ev);
                                  const cfg = TYPE_CONFIG[cType] || TYPE_CONFIG.Lecture;
                                  const cleanTitle = getCleanTitle(ev);

                                  return (
                                    <div
                                      key={ev._id}
                                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-r-xl border border-line/50 border-l-4 px-3.5 py-2.5 transition-all duration-200 hover:border-line-strong/80 group ${cfg.accent} ${
                                        isOverlap ? 'ml-3' : ''
                                      }`}
                                    >
                                      {/* Left: Line 1 (Badge + Location for classes) -> Line 2 (Title) -> Line 3 (Professor for classes) */}
                                      <div className="flex-1 min-w-0">
                                        {/* Line 1: Type badge (+ location only for classes) */}
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${cfg.style}`}>
                                            {cfg.label}
                                          </span>
                                          {ev.type === 'class' && ev.location && (
                                            <span className="flex items-center gap-1 text-xs text-fg-secondary">
                                              <span className="material-icons text-sm text-fg-muted">location_on</span>
                                              {ev.location}
                                            </span>
                                          )}
                                        </div>

                                        {/* Line 2: Title in next line */}
                                        <p className="text-sm font-semibold text-fg truncate leading-snug">
                                          {cleanTitle}
                                        </p>

                                        {/* Line 3: Professor name (only for classes) */}
                                        {ev.type === 'class' && ev.professor && (
                                          <div className="mt-1 flex items-center gap-1 text-xs text-fg-secondary">
                                            <span className="material-icons text-sm text-fg-muted">person</span>
                                            <span>{ev.professor}</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Right: attendance pills + edit + delete */}
                                      <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                                        {ev.type === 'class' && (
                                          <div className="flex flex-col gap-1">
                                            <AttendanceBtn which="present" current={attendance} onClick={(s) => handleAttendance(ev, s)} />
                                            <AttendanceBtn which="absent"  current={attendance} onClick={(s) => handleAttendance(ev, s)} />
                                            <AttendanceBtn which="off"     current={attendance} onClick={(s) => handleAttendance(ev, s)} />
                                          </div>
                                        )}
                                        <div className="flex flex-col gap-1">
                                          <button
                                            onClick={() => handleEditEventClick(ev)}
                                            className="p-1.5 rounded-lg text-fg-muted hover:text-violet-400 hover:bg-violet-500/10 transition cursor-pointer"
                                            title="Edit Event"
                                            aria-label="Edit Event"
                                          >
                                            <span className="material-icons text-base">edit</span>
                                          </button>
                                          <button
                                            onClick={() => handleDeleteEventClick(ev)}
                                            className="p-1.5 rounded-lg text-fg-muted hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
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
                    {isNowInSlot && (
                      <div
                        className="absolute left-[72px] sm:left-[78px] right-0 h-px bg-gradient-to-r from-violet-500 via-violet-400/40 to-transparent pointer-events-none z-10"
                        style={{ top: `${fracInSlot * 100}%` }}
                      />
                    )}
                  </div>
                );
              })}

              {/* End-of-range label */}
              <div className="flex">
                <div className="w-[54px] sm:w-[60px] flex-shrink-0 flex justify-end pr-2">
                  <span className="text-[10px] font-mono text-fg-subtle -translate-y-[5px] tabular-nums">
                    {String(maxHour + 1 > 24 ? 24 : maxHour + 1).padStart(2, '0')}:00
                  </span>
                </div>
                <div className="w-[18px] flex-shrink-0 flex items-start pt-0">
                  <div className="w-[6px] h-px bg-line" />
                </div>
              </div>
            </div>
          </div>

          {/* Empty state overlay */}
          {schedule.length === 0 && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-32">
              <span className="material-icons text-5xl text-violet-500/20 mb-3">event_available</span>
              <h4 className="text-base font-semibold text-fg-muted">No events scheduled</h4>
              <p className="text-xs text-fg-subtle mt-1">Add classes or tasks to see them on the timeline.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Add Event Modal ── */}
      {showAddEventModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-lg border border-line shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-line">
              <h3 className="text-xl font-bold text-fg flex items-center gap-2">
                <span className="material-icons text-violet-400">add_circle_outline</span>
                Add Event to Schedule
              </h3>
              <button
                onClick={() => setShowAddEventModal(false)}
                className="text-fg-muted hover:text-fg p-1 rounded-lg hover:bg-surface-2 cursor-pointer"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Type */}
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['class', 'task', 'event'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewEvent((prev) => ({ ...prev, type }))}
                      className={`py-2 px-3 rounded-xl border text-center font-semibold capitalize transition cursor-pointer ${
                        newEvent.type === type
                          ? 'bg-violet-600 border-violet-500 text-on-accent'
                          : 'bg-surface-2/80 border-line text-fg-muted hover:bg-surface-3'
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
                  <label className="block text-fg-secondary mb-1.5 font-medium">Class Type</label>
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
                            : 'bg-surface-2/80 border-line text-fg-muted hover:bg-surface-3'
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
                <label className="block text-fg-secondary mb-1.5 font-medium">
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
                      className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg focus:outline-none focus:border-violet-500 cursor-pointer"
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
                    className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg placeholder-fg-subtle focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    placeholder="e.g. Submit Assignment 3"
                    required
                  />
                )}
              </div>

              {/* Timings */}
              {newEvent.type === 'task' ? (
                <div>
                  <label className="block text-fg-secondary mb-1.5 font-medium">Deadline Time</label>
                  <input
                    type="time"
                    value={newEvent.deadline}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, deadline: e.target.value }))}
                    className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg focus:outline-none focus:border-violet-500"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-fg-secondary mb-1.5 font-medium">Start Time</label>
                    <input
                      type="time"
                      value={newEvent.startTime}
                      onChange={(e) => setNewEvent((prev) => ({ ...prev, startTime: e.target.value }))}
                      className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-fg-secondary mb-1.5 font-medium">End Time</label>
                    <input
                      type="time"
                      value={newEvent.endTime}
                      onChange={(e) => setNewEvent((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              )}

              {/* Location */}
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">Location (Room/Hall)</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. CC-1 / Lab 2"
                  className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg placeholder-fg-subtle focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Professor (classes only) */}
              {newEvent.type === 'class' && (
                <div>
                  <label className="block text-fg-secondary mb-1.5 font-medium">Professor Name</label>
                  <input
                    type="text"
                    value={newEvent.professor}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, professor: e.target.value }))}
                    placeholder="e.g. Dr. A. Sharma"
                    className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg placeholder-fg-subtle focus:outline-none focus:border-violet-500"
                  />
                </div>
              )}

              <button
                onClick={handleAddEvent}
                disabled={isSubmitting || !newEvent.title.trim()}
                className="w-full mt-4 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-on-accent py-3 rounded-xl font-medium shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? 'Saving...' : 'Save to Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Event Modal ── */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-lg border border-line shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-line">
              <h3 className="text-xl font-bold text-fg flex items-center gap-2">
                <span className="material-icons text-violet-400">edit_note</span>
                Edit {editForm.type === 'class' ? 'Class' : editForm.type === 'task' ? 'Task' : 'Event'}
              </h3>
              <button
                onClick={() => setEditingEvent(null)}
                className="text-fg-muted hover:text-fg p-1 rounded-lg hover:bg-surface-2 cursor-pointer"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Type */}
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['class', 'task', 'event'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, type }))}
                      className={`py-2 px-3 rounded-xl border text-center font-semibold capitalize transition cursor-pointer ${
                        editForm.type === type
                          ? 'bg-violet-600 border-violet-500 text-on-accent'
                          : 'bg-surface-2/80 border-line text-fg-muted hover:bg-surface-3'
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
                  <label className="block text-fg-secondary mb-1.5 font-medium">Class Type</label>
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
                            : 'bg-surface-2/80 border-line text-fg-muted hover:bg-surface-3'
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
                <label className="block text-fg-secondary mb-1.5 font-medium">
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
                      className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg focus:outline-none focus:border-violet-500 cursor-pointer"
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
                      className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg focus:outline-none focus:border-violet-500"
                      required
                    />
                  )
                ) : (
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg focus:outline-none focus:border-violet-500"
                    required
                  />
                )}
              </div>

              {/* Timings */}
              {editForm.type === 'task' ? (
                <div>
                  <label className="block text-fg-secondary mb-1.5 font-medium">Deadline Time</label>
                  <input
                    type="time"
                    value={editForm.deadline}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, deadline: e.target.value }))}
                    className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg focus:outline-none focus:border-violet-500"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-fg-secondary mb-1.5 font-medium">Start Time</label>
                    <input
                      type="time"
                      value={editForm.startTime}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, startTime: e.target.value }))}
                      className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-fg-secondary mb-1.5 font-medium">End Time</label>
                    <input
                      type="time"
                      value={editForm.endTime}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              )}

              {/* Location */}
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">Location (Room/Hall)</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. CC-1 / Lab 2"
                  className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg placeholder-fg-subtle focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Professor (classes only) */}
              {editForm.type === 'class' && (
                <div>
                  <label className="block text-fg-secondary mb-1.5 font-medium">Professor Name</label>
                  <input
                    type="text"
                    value={editForm.professor}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, professor: e.target.value }))}
                    placeholder="e.g. Dr. A. Sharma"
                    className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg placeholder-fg-subtle focus:outline-none focus:border-violet-500"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="flex-1 bg-surface-2 hover:bg-surface-3 text-fg-secondary py-3 rounded-xl font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSubmitting || !editForm.title.trim()}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-on-accent py-3 rounded-xl font-medium shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md border border-line shadow-2xl">
            <div className="flex items-center gap-2 mb-2 text-rose-400">
              <span className="material-icons text-xl">delete_forever</span>
              <h3 className="text-lg font-bold text-fg">
                Delete {showDeleteConfirm.type === 'class' ? 'Class' : showDeleteConfirm.type === 'task' ? 'Task' : 'Event'}?
              </h3>
            </div>
            <p className="text-sm text-fg-secondary mb-5">
              Are you sure you want to permanently delete{' '}
              <strong className="text-fg">"{showDeleteConfirm.title}"</strong> from your schedule? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface-2 hover:bg-surface-3 text-fg-secondary transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-on-accent transition-colors duration-150 shadow-sm cursor-pointer"
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
