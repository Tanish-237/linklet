import React, { useState, useEffect } from 'react';

const initialSchedule = [
  {
    id: 1,
    type: 'class',
    subject: 'Data Structures',
    startTime: '09:00',
    endTime: '10:00',
    location: 'CC-1',
    professor: 'Dr. Smith'
  },
  {
    id: 2,
    type: 'task',
    title: 'DSA Assignment',
    deadline: '11:00',
    priority: 'high',
    status: 'pending'
  },
  {
    id: 3,
    type: 'class',
    subject: 'Operating Systems',
    startTime: '11:00',
    endTime: '12:00',
    location: 'CC-2',
    professor: 'Dr. Johnson'
  },
  {
    id: 4,
    type: 'class',
    subject: 'Database Systems',
    startTime: '14:00',
    endTime: '15:00',
    location: 'CC-3',
    professor: 'Dr. Davis'
  },
  {
    id: 5,
    type: 'task',
    title: 'DBMS Project',
    deadline: '16:00',
    priority: 'medium',
    status: 'in-progress'
  }
];

// Industry-standard formatter for consistent time display
const formatTime = (timeString) => {
  try {
    const [hours, minutes] = timeString.split(':');
    return `${hours}:${minutes}`;
  } catch (e) {
    return timeString;
  }
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'high': return 'text-red-400';
    case 'medium': return 'text-yellow-400';
    case 'low': return 'text-green-400';
    default: return 'text-gray-400';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'bg-green-500/20 border-green-500 text-green-400';
    case 'in-progress': return 'bg-yellow-500/20 border-yellow-500 text-yellow-400';
    case 'pending': return 'bg-red-500/20 border-red-500 text-red-400';
    case 'cancelled': return 'bg-gray-500/20 border-gray-500 text-gray-400';
    default: return 'bg-gray-500/20 border-gray-500 text-gray-400';
  }
};

const getTypeIcon = (type) => {
  switch (type) {
    case 'class': return 'school';
    case 'task': return 'assignment';
    case 'event': return 'event';
    default: return 'event';
  }
};

export default function DailySchedule() {
  const [schedule, setSchedule] = useState(initialSchedule);
  const [showEventDetails, setShowEventDetails] = useState(null);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [currentTime, setCurrentTime] = useState('');
  const [viewMode, setViewMode] = useState('all'); // 'all', 'upcoming', 'past'
  const [cancelReason, setCancelReason] = useState('');
  const [newEvent, setNewEvent] = useState({
    type: 'event',
    title: '',
    startTime: '',
    endTime: '',
    priority: 'medium',
    status: 'pending',
    location: ''
  });

  // Industry-standard approach: Use effect for real-time updates with cleanup
  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit'
      }));
    };
    
    updateCurrentTime(); // Initial call
    const interval = setInterval(updateCurrentTime, 60000);
    
    return () => clearInterval(interval); // Proper cleanup to prevent memory leaks
  }, []);

  // Industry-standard approach: Use memoized helper functions
  const isEventPast = (event) => {
    if (!currentTime) return false;
    
    const now = currentTime;
    const eventEndTime = event.type === 'task' ? event.deadline : event.endTime;
    return eventEndTime < now;
  };

  const handleAddEvent = () => {
    // Input validation - industry standard approach
    if (!newEvent.title || !newEvent.startTime || (newEvent.type !== 'task' && !newEvent.endTime)) {
      return;
    }

    // Generate unique ID using recommended approach
    const id = Math.max(...schedule.map(e => e.id), 0) + 1;
    
    // Create immutable copy for state update - industry standard approach
    const eventToAdd = {
      ...newEvent,
      id
    };

    // Sort after adding - industry standard functional approach with immutability
    setSchedule(prev => [...prev, eventToAdd].sort((a, b) => {
      const timeA = a.type === 'task' ? a.deadline : a.startTime;
      const timeB = b.type === 'task' ? b.deadline : b.startTime;
      return timeA.localeCompare(timeB);
    }));

    // Reset form state - industry standard approach
    setShowAddEventModal(false);
    setNewEvent({
      type: 'event',
      title: '',
      startTime: '',
      endTime: '',
      priority: 'medium',
      status: 'pending',
      location: ''
    });
  };

  const handleCutClass = (id) => {
    setShowDeleteConfirm(id);
    setCancelReason('');
  };

  const confirmCutClass = (id) => {
    // Industry standard functional approach with immutability
    if (cancelReason) {
      // Mark as cancelled instead of removing
      setSchedule(prev => prev.map(event => 
        event.id === id 
          ? { ...event, status: 'cancelled', cancelReason: cancelReason }
          : event
      ));
    } else {
      // Remove completely if no reason provided
      setSchedule(prev => prev.filter(event => event.id !== id));
    }
    setShowDeleteConfirm(null);
    setCancelReason('');
  };

  const cancelCutClass = () => {
    setShowDeleteConfirm(null);
    setCancelReason('');
  };

  const getTimelinePosition = () => {
    if (!currentTime) return 0;
    
    try {
      const [hours, minutes] = currentTime.split(':').map(Number);
      // More precise calculation for timeline position
      return (hours * 60 + minutes) / 4;
    } catch (e) {
      return 0;
    }
  };

  // Filter events based on view mode
  const filteredSchedule = schedule.filter(event => {
    const isPast = isEventPast(event);
    if (viewMode === 'all') return true;
    if (viewMode === 'upcoming') return !isPast && event.status !== 'cancelled';
    if (viewMode === 'past') return isPast || event.status === 'cancelled';
    return true;
  });

  return (
    <div className="bg-gray-900/50 backdrop-blur-md rounded-lg p-8 border border-gray-800">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-violet-400">Today's Schedule</h2>
        <div className="flex items-center gap-6">
          {/* Time indicator spaced out from Add Event button */}
          <div className="flex flex-col items-end">
            <div className="text-xl font-semibold text-gray-400">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long',
                month: 'long',
                day: 'numeric' 
              })}
            </div>
            <div className="text-violet-300 text-sm mt-1">
              Current time: {currentTime}
            </div>
          </div>
          <button
            onClick={() => setShowAddEventModal(true)}
            className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2 rounded-full hover:bg-violet-700 transition-colors shadow-lg shadow-violet-900/30"
          >
            <span className="material-icons">add</span>
            Add Event
          </button>
        </div>
      </div>

      {/* View mode selector */}
      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setViewMode('all')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            viewMode === 'all' 
              ? 'bg-violet-600 text-white' 
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          All Events
        </button>
        <button 
          onClick={() => setViewMode('upcoming')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            viewMode === 'upcoming' 
              ? 'bg-violet-600 text-white' 
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Upcoming
        </button>
        <button 
          onClick={() => setViewMode('past')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            viewMode === 'past' 
              ? 'bg-violet-600 text-white' 
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Past/Cancelled
        </button>
      </div>

      <div className="relative">
        {/* Current time indicator - thin purple timeline */}
        <div className="absolute left-0 right-0 flex items-center gap-2 z-20" style={{
          top: `${getTimelinePosition()}px`
        }}>
          <div className="h-0.5 flex-1 bg-violet-500 shadow-md shadow-violet-500/50"></div>
          <span className="px-3 py-1 bg-violet-700 text-white text-xs rounded-full shadow-md shadow-violet-900/30">
            {currentTime}
          </span>
        </div>

        {/* Timeline events */}
        <div className="space-y-4">
          {filteredSchedule.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              No events to display in this view.
            </div>
          ) : (
            filteredSchedule.map((event) => (
              <div
                key={event.id}
                className={`relative flex items-center gap-4 p-4 rounded-lg transition-all 
                  ${event.status === 'cancelled' ? 'bg-gray-800/30 border-gray-700 opacity-75' : 
                    isEventPast(event) ? 'bg-gray-800/30 opacity-60' : 
                    'hover:bg-violet-500/10 hover:border-violet-500/30'} 
                  border border-transparent`}
                onMouseEnter={() => setShowEventDetails(event.id)}
                onMouseLeave={() => setShowEventDetails(null)}
                aria-expanded={showEventDetails === event.id}
                role="button"
                tabIndex={0}
              >
                {/* Timeline line - industry standard semantic colors */}
                <div className="absolute top-0 left-6 w-px h-full bg-violet-800/40 -z-10"></div>

                {/* Event icon - accessibility enhanced */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 flex-shrink-0
                  ${event.status === 'cancelled' ? 'border-gray-500 bg-gray-500/20' :
                    event.type === 'class' ? 'border-violet-500 bg-violet-500/20' :
                    event.type === 'task' ? 'border-blue-500 bg-blue-500/20' :
                    'border-emerald-500 bg-emerald-500/20'}`}
                  aria-hidden="true"
                >
                  <span className="material-icons text-2xl">
                    {event.status === 'cancelled' ? 'cancel' : getTypeIcon(event.type)}
                  </span>
                </div>

                {/* Basic event info - always visible */}
                <div className="flex-1 flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-lg font-semibold ${event.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-white'}`}>
                        {event.type === 'class' ? event.subject : event.title}
                      </h3>
                      {isEventPast(event) && event.status !== 'cancelled' && (
                        <span className="bg-gray-700 text-gray-300 px-2 py-0.5 text-xs rounded">
                          Past
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400">
                      {event.type === 'task' ? 
                        `Due by ${formatTime(event.deadline)}` :
                        `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`}
                    </p>
                    {event.status === 'cancelled' && event.cancelReason && (
                      <p className="text-red-400 text-sm mt-1">
                        <span className="font-semibold">Cancelled:</span> {event.cancelReason}
                      </p>
                    )}
                  </div>

                  {/* Additional details - inline on hover with purplish theme */}
                  <div className="flex items-center gap-4">
                    {showEventDetails === event.id && (
                      <div className="flex items-center gap-3 animate-fadeIn px-4 py-2 bg-violet-900/20 backdrop-blur-sm rounded-lg border border-violet-500/30">
                        {event.type === 'class' && (
                          <>
                            <div className="flex items-center gap-1 text-violet-300">
                              <span className="material-icons text-sm">location_on</span>
                              <span>{event.location}</span>
                            </div>
                            <div className="flex items-center gap-1 text-violet-300">
                              <span className="material-icons text-sm">person</span>
                              <span>{event.professor}</span>
                            </div>
                          </>
                        )}

                        {(event.type === 'task' || event.type === 'event') && (
                          <>
                            <div className={`flex items-center gap-1 text-violet-300`}>
                              <span className="material-icons text-sm">flag</span>
                              <span className={getPriorityColor(event.priority)}>
                                {event.priority}
                              </span>
                            </div>
                            {event.type === 'event' && event.location && (
                              <div className="flex items-center gap-1 text-violet-300">
                                <span className="material-icons text-sm">location_on</span>
                                <span>{event.location}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Status badge - always visible */}
                    {(event.type === 'task' || event.type === 'event' || event.status === 'cancelled') && (
                      <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(event.status)}`}>
                        {event.status}
                      </span>
                    )}

                    {/* Cut class option - always visible for upcoming classes */}
                    {event.type === 'class' && !isEventPast(event) && event.status !== 'cancelled' && (
                      <button 
                        onClick={() => handleCutClass(event.id)}
                        className="flex items-center gap-1 text-red-400 hover:text-red-300 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-all"
                        aria-label="Cut class"
                      >
                        <span className="material-icons text-sm">close</span>
                        <span>Cut</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Event Modal - with dark purplish theme, following industry standards for modals */}
      {showAddEventModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" 
          role="dialog" 
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-violet-800/50 shadow-xl shadow-violet-900/20">
            <div className="flex justify-between items-center mb-4">
              <h3 id="modal-title" className="text-xl font-bold text-violet-400">Add New Event</h3>
              <button
                onClick={() => setShowAddEventModal(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close modal"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2" htmlFor="event-type">Type</label>
                <select
                  id="event-type"
                  value={newEvent.type}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-violet-800/50 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="event">Event</option>
                  <option value="task">Task</option>
                  <option value="class">Class</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2" htmlFor="event-title">
                  {newEvent.type === 'class' ? 'Subject' : 
                    newEvent.type === 'task' ? 'Task Title' : 'Event Title'}
                </label>
                <input
                  id="event-title"
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-violet-800/50 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  placeholder={newEvent.type === 'class' ? 'Enter subject name' :
                    newEvent.type === 'task' ? 'Enter task title' : 'Enter event title'}
                  required
                />
              </div>

              {newEvent.type === 'task' ? (
                <div>
                  <label className="block text-sm text-gray-400 mb-2" htmlFor="event-deadline">Deadline</label>
                  <input
                    id="event-deadline"
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-violet-800/50 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    placeholder="HH:MM"
                    required
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2" htmlFor="event-start">Start Time</label>
                    <input
                      id="event-start"
                      type="time"
                      value={newEvent.startTime}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-violet-800/50 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      placeholder="HH:MM"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2" htmlFor="event-end">End Time</label>
                    <input
                      id="event-end"
                      type="time"
                      value={newEvent.endTime}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-violet-800/50 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      placeholder="HH:MM"
                      required
                    />
                  </div>
                </>
              )}

              {(newEvent.type === 'task' || newEvent.type === 'event') && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2" htmlFor="event-priority">Priority</label>
                  <select
                    id="event-priority"
                    value={newEvent.priority}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-violet-800/50 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              )}

              {(newEvent.type === 'event' || newEvent.type === 'class') && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2" htmlFor="event-location">Location</label>
                  <input
                    id="event-location"
                    type="text"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-violet-800/50 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    placeholder="Enter location"
                  />
                </div>
              )}

              {newEvent.type === 'class' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2" htmlFor="event-professor">Professor</label>
                  <input
                    id="event-professor"
                    type="text"
                    value={newEvent.professor || ''}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, professor: e.target.value }))}
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-violet-800/50 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    placeholder="Enter professor name"
                  />
                </div>
              )}

              <button
                onClick={handleAddEvent}
                className="w-full bg-violet-600 text-white py-2 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-900/30"
                disabled={!newEvent.title || !newEvent.startTime || (newEvent.type !== 'task' && !newEvent.endTime)}
              >
                Add {newEvent.type === 'class' ? 'Class' : newEvent.type === 'task' ? 'Task' : 'Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Confirmation Modal for Cutting Class - with reason field */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" 
          role="alertdialog" 
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-red-800/50 shadow-xl shadow-red-900/20">
            <h3 id="confirm-title" className="text-xl font-bold text-red-400 mb-4">Cut Class Confirmation</h3>
            <p className="text-gray-300 mb-4">Are you sure you want to remove this class from your schedule?</p>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2" htmlFor="cancel-reason">
                Reason for cancellation (optional)
              </label>
              <input
                id="cancel-reason"
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-red-800/50 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                placeholder="e.g., Professor cancelled, sick day, etc."
              />
              <p className="text-gray-500 text-xs mt-1">
                If you provide a reason, the class will be marked as cancelled instead of removed
              </p>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => confirmCutClass(showDeleteConfirm)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-900/30"
              >
                {cancelReason ? 'Mark as Cancelled' : 'Remove Class'}
              </button>
              <button
                onClick={cancelCutClass}
                className="flex-1 bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          cursor: pointer;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.5);
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.7);
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-in-out;
        }
      `}</style>
    </div>
  );
}