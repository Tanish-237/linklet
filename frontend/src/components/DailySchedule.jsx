import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import TimetableUploadModal from './TimetableUploadModal';
import WeeklyTimetableModal from './WeeklyTimetableModal';
import {
  fetchSchedule,
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
} from '../api/dashboard.api';

const formatTime = (timeString) => {
  if (!timeString) return '';
  try {
    const [hours, minutes] = timeString.split(':');
    return `${hours}:${minutes}`;
  } catch (e) {
    return timeString;
  }
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'high':
      return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    case 'medium':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'low':
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    default:
      return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/20 border-emerald-500 text-emerald-400';
    case 'in-progress':
      return 'bg-amber-500/20 border-amber-500 text-amber-400';
    case 'pending':
      return 'bg-violet-500/20 border-violet-500 text-violet-300';
    case 'cancelled':
      return 'bg-gray-700/50 border-gray-600 text-gray-400';
    default:
      return 'bg-gray-800 border-gray-700 text-gray-400';
  }
};

const getTypeIcon = (type) => {
  switch (type) {
    case 'class':
      return 'school';
    case 'task':
      return 'assignment';
    case 'event':
      return 'event';
    default:
      return 'event';
  }
};

export default function DailySchedule({ onScheduleChanged }) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEventDetails, setShowEventDetails] = useState(null);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showWeeklyTimetableModal, setShowWeeklyTimetableModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [currentTime, setCurrentTime] = useState('');
  const [viewMode, setViewMode] = useState('all'); // 'all', 'upcoming', 'past'
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newEvent, setNewEvent] = useState({
    type: 'class',
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    deadline: '17:00',
    priority: 'medium',
    status: 'pending',
    location: '',
    professor: '',
  });

  // Track live clock for timeline
  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };

    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch schedule from backend
  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSchedule(selectedDate);
      setSchedule(data);
    } catch (err) {
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const isEventPast = (event) => {
    if (!currentTime) return false;
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate < today) return true;
    if (selectedDate > today) return false;

    const eventEndTime = event.type === 'task' ? event.deadline : event.endTime;
    if (!eventEndTime) return false;
    return eventEndTime < currentTime;
  };

  const handleAddEvent = async () => {
    if (!newEvent.title.trim()) {
      toast.warn('Please enter a title or subject name');
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await createScheduleEvent({
        ...newEvent,
        date: selectedDate,
      });
      setSchedule((prev) =>
        [...prev, created].sort((a, b) => {
          const timeA = a.type === 'task' ? a.deadline || '' : a.startTime || '';
          const timeB = b.type === 'task' ? b.deadline || '' : b.startTime || '';
          return timeA.localeCompare(timeB);
        })
      );
      toast.success('Event added successfully');
      setShowAddEventModal(false);
      setNewEvent({
        type: 'class',
        title: '',
        startTime: '09:00',
        endTime: '10:00',
        deadline: '17:00',
        priority: 'medium',
        status: 'pending',
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

  const handleToggleTaskStatus = async (event) => {
    if (event.type !== 'task') return;
    const nextStatus = event.status === 'completed' ? 'pending' : 'completed';
    try {
      const updated = await updateScheduleEvent(event._id, { status: nextStatus });
      setSchedule((prev) =>
        prev.map((item) => (item._id === event._id ? { ...item, status: updated.status } : item))
      );
      toast.success(nextStatus === 'completed' ? 'Task completed! 🎉' : 'Task marked pending');
      if (onScheduleChanged) onScheduleChanged();
    } catch (err) {
      toast.error('Failed to update task status');
    }
  };

  const handleCutClass = (id) => {
    setShowDeleteConfirm(id);
    setCancelReason('');
  };

  const confirmCutClass = async (id) => {
    try {
      if (cancelReason.trim()) {
        const updated = await updateScheduleEvent(id, {
          status: 'cancelled',
          cancelReason: cancelReason.trim(),
        });
        setSchedule((prev) =>
          prev.map((item) => (item._id === id ? { ...item, ...updated } : item))
        );
        toast.info('Class marked as cancelled');
      } else {
        await deleteScheduleEvent(id);
        setSchedule((prev) => prev.filter((item) => item._id !== id));
        toast.success('Class removed from schedule');
      }
      setShowDeleteConfirm(null);
      setCancelReason('');
      if (onScheduleChanged) onScheduleChanged();
    } catch (err) {
      toast.error('Failed to update schedule');
    }
  };

  const getTimelinePosition = () => {
    if (!currentTime) return 0;
    try {
      const [hours, minutes] = currentTime.split(':').map(Number);
      return (hours * 60 + minutes) / 4;
    } catch (e) {
      return 0;
    }
  };

  const filteredSchedule = schedule.filter((event) => {
    const past = isEventPast(event);
    if (viewMode === 'all') return true;
    if (viewMode === 'upcoming') return !past && event.status !== 'cancelled';
    if (viewMode === 'past') return past || event.status === 'cancelled' || event.status === 'completed';
    return true;
  });

  const changeDateByDays = (offset) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + offset);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="bg-gray-900/60 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-gray-800 shadow-2xl relative">
      {/* Header with Title and Date Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8 border-b border-gray-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 material-icons">
              calendar_today
            </span>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-wide">Daily Schedule</h2>
              <p className="text-sm text-gray-400">
                Organize your classes, deadlines, and events with real-time sync
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-gray-800/80 rounded-xl p-1 border border-gray-700">
            <button
              onClick={() => changeDateByDays(-1)}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition"
              title="Previous Day"
              aria-label="Previous Day"
            >
              <span className="material-icons text-sm">chevron_left</span>
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm text-white font-medium px-2 py-1 focus:outline-none cursor-pointer"
            />
            <button
              onClick={() => changeDateByDays(1)}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition"
              title="Next Day"
              aria-label="Next Day"
            >
              <span className="material-icons text-sm">chevron_right</span>
            </button>
          </div>

          {!isToday && (
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-900/40 text-violet-300 hover:bg-violet-900/70 border border-violet-700/50 transition"
            >
              Today
            </button>
          )}

          <button
            onClick={() => setShowWeeklyTimetableModal(true)}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-750 text-gray-200 border border-gray-700 px-3.5 py-2 rounded-xl text-sm font-semibold transition cursor-pointer"
            title="View complete weekly routine"
          >
            <span className="material-icons text-base text-violet-400">calendar_view_week</span>
            Weekly Timetable
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-violet-950/40 hover:bg-violet-900/50 text-violet-300 border border-violet-700/50 px-3.5 py-2 rounded-xl text-sm font-semibold transition cursor-pointer"
            title="Upload MNNIT Timetable PDF with Gemini Vision"
          >
            <span className="material-icons text-base text-violet-400">upload_file</span>
            Import Timetable
          </button>

          <button
            onClick={() => setShowAddEventModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-violet-900/40 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <span className="material-icons text-base">add</span>
            Add Event
          </button>
        </div>
      </div>

      {/* Filter Tabs & Current Time Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-gray-800 w-fit">
          {[
            { id: 'all', label: 'All Items' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'past', label: 'Past / Done' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === tab.id
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isToday && (
          <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-violet-950/40 border border-violet-800/40 text-violet-300 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping"></span>
            <span>Current Time: {currentTime}</span>
          </div>
        )}
      </div>

      {/* Schedule Items Section */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-block w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-sm text-gray-400">Loading schedule...</p>
        </div>
      ) : filteredSchedule.length === 0 ? (
        <div className="p-10 rounded-2xl bg-gray-950/40 border border-dashed border-gray-800 text-center">
          <span className="material-icons text-5xl text-violet-500/40 mb-3">event_available</span>
          <h4 className="text-lg font-bold text-gray-300">No events found for this view</h4>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Your schedule for {selectedDate} is clear. Add your classes or tasks to stay organized.
          </p>
          <div className="mt-5 flex justify-center">
            <button
              onClick={() => setShowAddEventModal(true)}
              className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition shadow-lg shadow-violet-900/30 cursor-pointer"
            >
              + Add Event
            </button>
          </div>
        </div>
      ) : (
        <div className="relative space-y-3">
          {/* Visual current time indicator line for today */}
          {isToday && (
            <div
              className="absolute left-0 right-0 flex items-center gap-2 z-10 pointer-events-none opacity-80"
              style={{ top: `${Math.min(Math.max(getTimelinePosition(), 0), 450)}px` }}
            >
              <div className="h-0.5 flex-1 bg-gradient-to-r from-violet-500 to-transparent"></div>
              <span className="px-2 py-0.5 bg-violet-600 text-[10px] text-white font-mono rounded-full shadow">
                NOW {currentTime}
              </span>
            </div>
          )}

          {filteredSchedule.map((event) => {
            const past = isEventPast(event);
            const isCompleted = event.status === 'completed';
            const isCancelled = event.status === 'cancelled';

            return (
              <div
                key={event._id}
                className={`relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border transition-all duration-200 group ${
                  isCancelled
                    ? 'bg-gray-900/30 border-gray-800 opacity-60'
                    : isCompleted
                    ? 'bg-emerald-950/20 border-emerald-900/40'
                    : past
                    ? 'bg-gray-800/30 border-gray-800'
                    : 'bg-gray-800/60 hover:bg-gray-800/90 border-gray-700/60 hover:border-violet-500/40'
                }`}
                onMouseEnter={() => setShowEventDetails(event._id)}
                onMouseLeave={() => setShowEventDetails(null)}
              >
                {/* Left Side: Icon & Details */}
                <div className="flex items-start gap-4">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center border flex-shrink-0 mt-0.5 ${
                      isCancelled
                        ? 'border-gray-700 bg-gray-800 text-gray-500'
                        : isCompleted
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                        : event.type === 'class'
                        ? 'border-violet-500/50 bg-violet-500/20 text-violet-400'
                        : event.type === 'task'
                        ? 'border-blue-500/50 bg-blue-500/20 text-blue-400'
                        : 'border-amber-500/50 bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    <span className="material-icons text-xl">
                      {isCancelled ? 'block' : isCompleted ? 'check_circle' : getTypeIcon(event.type)}
                    </span>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`text-base font-bold ${
                          isCancelled
                            ? 'text-gray-500 line-through'
                            : isCompleted
                            ? 'text-gray-300 line-through decoration-emerald-500'
                            : 'text-white'
                        }`}
                      >
                        {event.title}
                      </h3>

                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                          event.type === 'class'
                            ? 'bg-violet-900/50 text-violet-300 border border-violet-800'
                            : event.type === 'task'
                            ? 'bg-blue-900/50 text-blue-300 border border-blue-800'
                            : 'bg-amber-900/50 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {event.type}
                      </span>

                      {event.priority && (
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-medium border ${getPriorityColor(
                            event.priority
                          )}`}
                        >
                          {event.priority}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <span className="material-icons text-xs text-violet-400">schedule</span>
                        {event.type === 'task'
                          ? `Due: ${formatTime(event.deadline)}`
                          : `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`}
                      </span>

                      {event.location && (
                        <span className="flex items-center gap-1 text-gray-300">
                          <span className="material-icons text-xs text-gray-400">location_on</span>
                          {event.location}
                        </span>
                      )}

                      {event.professor && (
                        <span className="flex items-center gap-1 text-gray-300">
                          <span className="material-icons text-xs text-gray-400">person</span>
                          {event.professor}
                        </span>
                      )}
                    </div>

                    {isCancelled && event.cancelReason && (
                      <p className="text-xs text-rose-400 mt-1 font-medium">
                        Reason: {event.cancelReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Side: Status Badge & Interactive Actions */}
                <div className="flex items-center gap-3 self-end md:self-center">
                  {/* Task Toggle Button */}
                  {event.type === 'task' && !isCancelled && (
                    <button
                      onClick={() => handleToggleTaskStatus(event)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
                        isCompleted
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-gray-800 text-gray-300 hover:text-white border-gray-700 hover:border-emerald-500'
                      }`}
                    >
                      <span className="material-icons text-sm">
                        {isCompleted ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span>{isCompleted ? 'Completed' : 'Mark Done'}</span>
                    </button>
                  )}

                  {/* Cut / Cancel Class Button */}
                  {event.type === 'class' && !isCancelled && !isCompleted && (
                    <button
                      onClick={() => handleCutClass(event._id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-icons text-xs">close</span>
                      <span>Cut Class</span>
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => confirmCutClass(event._id)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                    title="Delete permanently"
                    aria-label="Delete Event"
                  >
                    <span className="material-icons text-sm">delete_outline</span>
                  </button>

                  {/* Status Indicator */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getStatusColor(
                      event.status
                    )}`}
                  >
                    {event.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Event Modal */}
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
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Event Type */}
              <div>
                <label className="block text-gray-300 mb-1.5 font-medium">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['class', 'task', 'event'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewEvent((prev) => ({ ...prev, type }))}
                      className={`py-2 px-3 rounded-xl border text-center font-semibold capitalize transition ${
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
                      onChange={(e) =>
                        setNewEvent((prev) => ({ ...prev, startTime: e.target.value }))
                      }
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

              {/* Priority & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1.5 font-medium">Priority</label>
                  <select
                    value={newEvent.priority}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, priority: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
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
              </div>

              {/* Professor for Classes */}
              {newEvent.type === 'class' && (
                <div>
                  <label className="block text-gray-300 mb-1.5 font-medium">Professor Name</label>
                  <input
                    type="text"
                    value={newEvent.professor}
                    onChange={(e) =>
                      setNewEvent((prev) => ({ ...prev, professor: e.target.value }))
                    }
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

      {/* Confirmation Modal for Cutting Class */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-rose-900/50 shadow-2xl">
            <h3 className="text-xl font-bold text-rose-400 mb-2 flex items-center gap-2">
              <span className="material-icons">event_busy</span>
              Cut / Cancel Class
            </h3>
            <p className="text-sm text-gray-300 mb-4">
              Would you like to mark this class as cancelled with a reason, or completely delete it?
            </p>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Cancellation Reason (Optional)
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Professor on leave, Sick, Fest preparation"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Providing a reason marks the class as Cancelled. Leaving blank deletes it.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => confirmCutClass(showDeleteConfirm)}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2.5 rounded-xl transition text-sm shadow-lg shadow-rose-900/30 cursor-pointer"
              >
                {cancelReason.trim() ? 'Mark Cancelled' : 'Delete Permanently'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-5 bg-gray-800 hover:bg-gray-750 text-gray-300 py-2.5 rounded-xl transition text-sm cursor-pointer"
              >
                Cancel
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
          loadSchedule();
          if (onScheduleChanged) onScheduleChanged();
        }}
        userSection={user?.section}
      />

      {/* Full Weekly Timetable Modal */}
      <WeeklyTimetableModal
        isOpen={showWeeklyTimetableModal}
        onClose={() => setShowWeeklyTimetableModal(false)}
        onTimetableAbandoned={() => {
          loadSchedule();
          if (onScheduleChanged) onScheduleChanged();
        }}
      />
    </div>
  );
}