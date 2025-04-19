import React, { useState } from 'react';

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
  const [newEvent, setNewEvent] = useState({
    type: 'event',
    title: '',
    startTime: '',
    endTime: '',
    priority: 'medium',
    status: 'pending',
    location: ''
  });

  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit'
  });

  const handleAddEvent = () => {
    if (!newEvent.title || !newEvent.startTime || (newEvent.type !== 'task' && !newEvent.endTime)) {
      return;
    }

    const id = Math.max(...schedule.map(e => e.id), 0) + 1;
    const eventToAdd = {
      ...newEvent,
      id
    };

    setSchedule(prev => [...prev, eventToAdd].sort((a, b) => {
      const timeA = a.type === 'task' ? a.deadline : a.startTime;
      const timeB = b.type === 'task' ? b.deadline : b.startTime;
      return timeA.localeCompare(timeB);
    }));

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

  return (
    <div className="bg-gray-900/50 backdrop-blur-md rounded-lg p-8 border border-gray-800">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-violet-400">Today's Schedule</h2>
        <div className="flex items-center gap-4">
          <div className="text-xl font-semibold text-gray-400">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'long',
              day: 'numeric' 
            })}
          </div>
          <button
            onClick={() => setShowAddEventModal(true)}
            className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-full hover:bg-violet-700 transition-colors"
          >
            <span className="material-icons">add</span>
            Add Event
          </button>
        </div>
      </div>

      <div className="relative">
        {/* Current time indicator */}
        <div className="absolute left-0 right-0 flex items-center gap-2 z-10" style={{
          top: `${(parseInt(currentTime.split(':')[0]) - 8) * 100}px`
        }}>
          <div className="h-0.5 flex-1 bg-violet-500"></div>
          <span className="px-2 py-1 bg-violet-500 text-white text-sm rounded-full">
            Current Time
          </span>
        </div>

        {/* Timeline events */}
        <div className="space-y-6">
          {schedule.map((event) => (
            <div
              key={event.id}
              className="relative flex gap-4 group"
              onMouseEnter={() => setShowEventDetails(event.id)}
              onMouseLeave={() => setShowEventDetails(null)}
            >
              {/* Timeline line */}
              <div className="absolute top-0 left-6 w-px h-full bg-gray-800 -z-10"></div>

              {/* Event icon */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 
                ${event.type === 'class' ? 'border-violet-500 bg-violet-500/20' :
                  event.type === 'task' ? 'border-blue-500 bg-blue-500/20' :
                  'border-emerald-500 bg-emerald-500/20'}`}>
                <span className="material-icons text-2xl">
                  {getTypeIcon(event.type)}
                </span>
              </div>

              {/* Event details */}
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {event.type === 'class' ? event.subject : event.title}
                    </h3>
                    <p className="text-gray-400">
                      {event.type === 'task' ? 
                        `Due by ${event.deadline}` :
                        `${event.startTime} - ${event.endTime}`}
                    </p>
                  </div>
                  {(event.type === 'task' || event.type === 'event') && (
                    <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(event.status)}`}>
                      {event.status}
                    </span>
                  )}
                </div>

                {/* Hover details */}
                {showEventDetails === event.id && (
                  <div className="mt-2 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    {event.type === 'class' && (
                      <>
                        <p className="text-gray-300">Location: {event.location}</p>
                        <p className="text-gray-300">Professor: {event.professor}</p>
                      </>
                    )}
                    {(event.type === 'task' || event.type === 'event') && event.priority && (
                      <p className={`${getPriorityColor(event.priority)}`}>
                        Priority: {event.priority}
                      </p>
                    )}
                    {event.type === 'event' && event.location && (
                      <p className="text-gray-300">Location: {event.location}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddEventModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-violet-400">Add New Event</h3>
              <button
                onClick={() => setShowAddEventModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Type</label>
                <select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-gray-700 focus:border-violet-500 focus:outline-none"
                >
                  <option value="event">Event</option>
                  <option value="task">Task</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {newEvent.type === 'task' ? 'Task Title' : 'Event Title'}
                </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-gray-700 focus:border-violet-500 focus:outline-none"
                  placeholder={newEvent.type === 'task' ? 'Enter task title' : 'Enter event title'}
                />
              </div>

              {newEvent.type === 'task' ? (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Deadline</label>
                  <input
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-gray-700 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Start Time</label>
                    <input
                      type="time"
                      value={newEvent.startTime}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-gray-700 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">End Time</label>
                    <input
                      type="time"
                      value={newEvent.endTime}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-gray-700 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {(newEvent.type === 'task' || newEvent.type === 'event') && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Priority</label>
                  <select
                    value={newEvent.priority}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-gray-700 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              )}

              {newEvent.type === 'event' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Location (Optional)</label>
                  <input
                    type="text"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-gray-700 focus:border-violet-500 focus:outline-none"
                    placeholder="Enter location"
                  />
                </div>
              )}

              <button
                onClick={handleAddEvent}
                className="w-full bg-violet-600 text-white py-2 rounded-lg hover:bg-violet-700 transition-colors"
              >
                Add {newEvent.type === 'task' ? 'Task' : 'Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
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
      `}</style>
    </div>
  );
}