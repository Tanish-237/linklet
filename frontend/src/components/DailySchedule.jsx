import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import {
  fetchSchedule,
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
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

// Attendance button configs
const ATTENDANCE_STYLES = {
  present: {
    active: 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/40',
    idle: 'bg-gray-800/70 border-gray-700 text-emerald-400 hover:bg-emerald-900/30 hover:border-emerald-600',
    icon: 'check_circle',
    label: 'Present',
  },
  absent: {
    active: 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-900/40',
    idle: 'bg-gray-800/70 border-gray-700 text-rose-400 hover:bg-rose-900/30 hover:border-rose-600',
    icon: 'cancel',
    label: 'Absent',
  },
  off: {
    active: 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/40',
    idle: 'bg-gray-800/70 border-gray-700 text-amber-400 hover:bg-amber-900/30 hover:border-amber-600',
    icon: 'event_busy',
    label: 'Class Off',
  },
};

// ─── Attendance Button ────────────────────────────────────────────────────────
function AttendanceBtn({ which, current, onClick }) {
  const s = ATTENDANCE_STYLES[which];
  const isActive = current === which;
  return (
    <button
      onClick={() => onClick(which)}
      title={s.label}
      aria-label={s.label}
      className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition-all duration-150 cursor-pointer min-w-[48px] ${
        isActive ? s.active : s.idle
      }`}
    >
      <span className="material-icons text-sm">{s.icon}</span>
      <span className="leading-none">{s.label}</span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DailySchedule({ onScheduleChanged, addEventTrigger, refreshTrigger }) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // { id, title, type }
  const [currentTime, setCurrentTime] = useState('');
  const [nowHours, setNowHours] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attendanceState, setAttendanceState] = useState({}); // { [eventId]: 'present'|'absent'|'off'|null }
  const dateInputRef = useRef(null);
  const nowLineRef = useRef(null);

  const [newEvent, setNewEvent] = useState({
    type: 'class',
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    deadline: '17:00',
    location: '',
    professor: '',
  });

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

  // Scroll now-line into view on today (guard for jsdom/test environments)
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
      setSchedule(data);
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

  // ── Attendance toggle ─────────────────────────────────────────────────────
  const handleAttendance = async (event, status) => {
    const prev = attendanceState[event._id] ?? event.attendanceStatus ?? null;
    const next = prev === status ? null : status; // toggle off if same
    setAttendanceState((s) => ({ ...s, [event._id]: next }));
    try {
      await updateScheduleEvent(event._id, { attendanceStatus: next });
      if (onScheduleChanged) onScheduleChanged();
    } catch {
      toast.error('Failed to save attendance');
      setAttendanceState((s) => ({ ...s, [event._id]: prev }));
    }
  };

  // ── Add event ─────────────────────────────────────────────────────────────
  const handleAddEvent = async () => {
    if (!newEvent.title.trim()) {
      toast.warn('Please enter a title or subject name');
      return;
    }
    try {
      setIsSubmitting(true);
      const created = await createScheduleEvent({ ...newEvent, date: selectedDate });
      setSchedule((prev) =>
        [...prev, created].sort((a, b) => (eventStartHour(a) ?? 99) - (eventStartHour(b) ?? 99))
      );
      toast.success('Event added successfully');
      setShowAddEventModal(false);
      setNewEvent({ type: 'class', title: '', startTime: '09:00', endTime: '10:00', deadline: '17:00', location: '', professor: '' });
      if (onScheduleChanged) onScheduleChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add event');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete event ──────────────────────────────────────────────────────────
  const handleDeleteEventClick = (event) => {
    setShowDeleteConfirm({ id: event._id, title: event.title, type: event.type });
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

  // ── Build 24-hour slots ───────────────────────────────────────────────────
  const eventsByHour = {};
  schedule.forEach((ev) => {
    const h = Math.floor(eventStartHour(ev) ?? 0);
    if (!eventsByHour[h]) eventsByHour[h] = [];
    eventsByHour[h].push(ev);
  });

  const HOURS = Array.from({ length: 24 }, (_, i) => i);

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
            <div className="relative">
              {HOURS.map((hour) => {
                const events = eventsByHour[hour] || [];
                const hasEvents = events.length > 0;
                const isNowHour = isToday && Math.floor(nowHours) === hour;
                const hourLabel = `${String(hour).padStart(2, '0')}:00`;
                const fracInHour = nowHours - hour; // 0..1

                return (
                  <div
                    key={hour}
                    className={`flex gap-0 relative ${hasEvents ? 'min-h-[88px]' : 'min-h-[28px]'}`}
                  >
                    {/* Left: time label */}
                    <div className="flex flex-col items-end w-14 flex-shrink-0 select-none">
                      <span
                        className={`text-[11px] font-mono leading-none -translate-y-[6px] ${
                          isNowHour ? 'text-violet-400 font-bold' : 'text-gray-600'
                        }`}
                      >
                        {hourLabel}
                      </span>
                    </div>

                    {/* Centre: tick + connector */}
                    <div className="relative flex flex-col w-5 flex-shrink-0 items-center">
                      <div className={`w-2 h-px flex-shrink-0 ${hasEvents ? 'bg-gray-600' : 'bg-gray-800'}`} />
                      <div className="flex-1 w-px bg-gray-800/70" />

                      {/* Now dot */}
                      {isNowHour && (
                        <div
                          ref={nowLineRef}
                          className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                          style={{ top: `${fracInHour * 100}%` }}
                        >
                          <div className="w-3 h-3 rounded-full bg-violet-400 border-2 border-violet-300 shadow-md shadow-violet-900/60 -translate-x-1/2 relative left-1/2" />
                        </div>
                      )}
                    </div>

                    {/* Right: cards or empty */}
                    <div className="flex-1 pl-2 py-0.5">
                      {hasEvents ? (
                        <div className="space-y-2 pb-2">
                          {events.map((ev) => {
                            const attendance = attendanceState[ev._id] ?? ev.attendanceStatus ?? null;
                            const timeLabel =
                              ev.type === 'task'
                                ? `Due ${ev.deadline}`
                                : ev.startTime && ev.endTime
                                  ? `${ev.startTime} – ${ev.endTime}`
                                  : '';

                            const accent =
                              ev.type === 'class'
                                ? 'border-l-violet-500 bg-violet-500/5'
                                : ev.type === 'task'
                                  ? 'border-l-blue-500 bg-blue-500/5'
                                  : 'border-l-amber-500 bg-amber-500/5';

                            return (
                              <div
                                key={ev._id}
                                className={`flex items-center justify-between gap-3 rounded-r-xl border border-gray-700/60 border-l-2 px-3 py-2.5 transition-all duration-200 hover:border-gray-600 hover:bg-gray-800/60 group ${accent}`}
                              >
                                {/* Left: title + meta */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-white truncate leading-snug">
                                    {ev.title}
                                  </p>
                                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                    {timeLabel && (
                                      <span className="text-[11px] text-gray-500 font-mono">{timeLabel}</span>
                                    )}
                                    {ev.location && (
                                      <span className="flex items-center gap-0.5 text-[11px] text-gray-500">
                                        <span className="material-icons text-[11px]">location_on</span>
                                        {ev.location}
                                      </span>
                                    )}
                                    {ev.professor && (
                                      <span className="flex items-center gap-0.5 text-[11px] text-gray-500">
                                        <span className="material-icons text-[11px]">person</span>
                                        {ev.professor}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Right: attendance + delete */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {ev.type === 'class' && (
                                    <>
                                      <AttendanceBtn which="present" current={attendance} onClick={(s) => handleAttendance(ev, s)} />
                                      <AttendanceBtn which="absent"  current={attendance} onClick={(s) => handleAttendance(ev, s)} />
                                      <AttendanceBtn which="off"     current={attendance} onClick={(s) => handleAttendance(ev, s)} />
                                    </>
                                  )}
                                  <button
                                    onClick={() => handleDeleteEventClick(ev)}
                                    className="p-1.5 rounded-lg text-gray-500/40 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer group-hover:text-gray-500 focus:text-rose-400"
                                    title="Delete"
                                    aria-label="Delete Event"
                                  >
                                    <span className="material-icons text-sm">delete_outline</span>
                                  </button>
                                </div>
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
                        className="absolute left-14 right-0 h-px bg-gradient-to-r from-violet-500/80 to-transparent pointer-events-none z-10"
                        style={{ top: `${fracInHour * 100}%` }}
                      />
                    )}
                  </div>
                );
              })}

              {/* 24:00 end label */}
              <div className="flex gap-0">
                <div className="w-14 flex-shrink-0 flex justify-end">
                  <span className="text-[11px] font-mono text-gray-600 -translate-y-[6px]">24:00</span>
                </div>
                <div className="w-5 flex-shrink-0 flex items-center">
                  <div className="w-2 h-px bg-gray-700" />
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

              {/* Title */}
              <div>
                <label className="block text-gray-300 mb-1.5 font-medium">
                  {newEvent.type === 'class' ? 'Subject Name' : 'Title'}
                </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  placeholder={
                    newEvent.type === 'class'
                      ? 'e.g. Data Structures & Algorithms'
                      : 'e.g. Submit Assignment 3'
                  }
                  required
                />
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

