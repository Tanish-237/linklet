import React, { useState, useEffect, useRef } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

const subjects = [
  { id: 'dsa', name: 'Data Structures', totalClasses: 15 },
  { id: 'os', name: 'Operating Systems', totalClasses: 15 },
  { id: 'dbms', name: 'Database Systems', totalClasses: 15 },
  { id: 'cn', name: 'Computer Networks', totalClasses: 15 },
  { id: 'ai', name: 'Artificial Intelligence', totalClasses: 15 }
];

// Initial attendance data with more history
const initialAttendanceHistory = {
  'dsa': [
    { date: '2025-04-19', status: 'present' },
    { date: '2025-04-18', status: 'present' },
    { date: '2025-04-17', status: 'absent' },
    { date: '2025-04-16', status: 'present' },
    { date: '2025-04-15', status: 'present' },
    { date: '2025-04-14', status: 'absent' },
    { date: '2025-04-13', status: 'present' },
    { date: '2025-04-12', status: 'present' },
    { date: '2025-04-11', status: 'present' },
    { date: '2025-04-10', status: 'absent' },
  ],
  'os': [
    { date: '2025-04-19', status: 'present' },
    { date: '2025-04-18', status: 'absent' },
    { date: '2025-04-17', status: 'present' },
    { date: '2025-04-16', status: 'present' },
    { date: '2025-04-15', status: 'absent' },
  ],
  'dbms': [
    { date: '2025-04-19', status: 'present' },
    { date: '2025-04-18', status: 'present' },
    { date: '2025-04-17', status: 'present' },
    { date: '2025-04-16', status: 'absent' },
    { date: '2025-04-15', status: 'present' },
  ],
  'cn': [
    { date: '2025-04-19', status: 'absent' },
    { date: '2025-04-18', status: 'present' },
    { date: '2025-04-17', status: 'present' },
    { date: '2025-04-16', status: 'present' },
    { date: '2025-04-15', status: 'present' },
  ],
  'ai': [
    { date: '2025-04-19', status: 'present' },
    { date: '2025-04-18', status: 'present' },
    { date: '2025-04-17', status: 'present' },
    { date: '2025-04-16', status: 'present' },
    { date: '2025-04-15', status: 'absent' },
  ]
};

const getAttendanceColor = (percentage) => {
  if (percentage >= 85) return 'bg-green-500/20 border-green-500 text-green-400';
  if (percentage >= 75) return 'bg-yellow-500/20 border-yellow-500 text-yellow-400';
  return 'bg-red-500/20 border-red-500 text-red-400';
};

const getStatusMessage = (percentage) => {
  if (percentage >= 85) return 'Excellent! Keep it up! 🌟';
  if (percentage >= 75) return 'Good, but room for improvement! 📈';
  return 'Critical! Attendance needs attention! ⚠️';
};

const calculateSkippableClasses = (present, absent, target = 75) => {
  const total = present + absent;
  if (total === 0) return 0;
  
  const currentPercentage = (present / total) * 100;
  if (currentPercentage <= target) return 0;
  
  // Formula: (present / (total + x)) >= target/100
  // Solving for x: x <= (present * 100/target - total)
  const skippable = Math.floor((present * (100/target)) - total);
  return Math.max(0, skippable);
};

export default function AttendanceTracker() {
  const [selectedSubject, setSelectedSubject] = useState('dsa');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [animateValue, setAnimateValue] = useState(0);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatus, setAttendanceStatus] = useState('present');
  const [editMode, setEditMode] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState(initialAttendanceHistory);
  const previousPercentage = useRef(0);

  // Calculate attendance stats based on history
  const calculateAttendance = (subjectId) => {
    const history = attendanceHistory[subjectId] || [];
    const present = history.filter(record => record.status === 'present').length;
    const absent = history.filter(record => record.status === 'absent').length;
    return { present, absent };
  };

  const attendance = calculateAttendance(selectedSubject);
  const total = attendance.present + attendance.absent;
  const percentage = total > 0 ? ((attendance.present / total) * 100).toFixed(1) : '0.0';

  useEffect(() => {
    const targetValue = parseFloat(percentage);
    const startValue = previousPercentage.current;
    let currentValue = startValue;
    const duration = 1000;
    const steps = 60;
    const stepValue = (targetValue - startValue) / steps;
    
    const timer = setInterval(() => {
      if ((stepValue > 0 && currentValue >= targetValue) || 
          (stepValue < 0 && currentValue <= targetValue)) {
        setAnimateValue(targetValue);
        clearInterval(timer);
      } else {
        currentValue += stepValue;
        setAnimateValue(currentValue);
      }
    }, duration / steps);

    previousPercentage.current = targetValue;
    return () => clearInterval(timer);
  }, [percentage]);

  const handleAttendanceSubmit = () => {
    setAttendanceHistory(prev => {
      const newHistory = { ...prev };
      const subjectHistory = [...(newHistory[selectedSubject] || [])];
      
      if (editMode) {
        // Update existing record
        const index = subjectHistory.findIndex(record => record.date === selectedDate);
        if (index !== -1) {
          subjectHistory[index] = { date: selectedDate, status: attendanceStatus };
        }
      } else {
        // Add new record
        subjectHistory.unshift({ date: selectedDate, status: attendanceStatus });
      }
      
      // Sort by date descending
      subjectHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      newHistory[selectedSubject] = subjectHistory;
      return newHistory;
    });
    
    setShowAttendanceModal(false);
  };

  const chartData = {
    labels: ['Present', 'Absent'],
    datasets: [
      {
        data: [
          attendance.present,
          attendance.absent,
        ],
        backgroundColor: [
          '#10b981',  // Present - Emerald
          '#f43f5e',  // Absent - Rose
        ],
        borderWidth: 0,
        cutout: '75%',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label;
            const value = context.formattedValue;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((context.parsed / total) * 100);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
  };

  const attendanceColorClass = getAttendanceColor(parseFloat(percentage));
  const statusMessage = getStatusMessage(parseFloat(percentage));

  return (
    <div className="bg-gray-900/50 backdrop-blur-md rounded-lg p-8 border border-gray-800">
      <div className="flex justify-between items-start gap-12">
        {/* Left side with title and chart */}
        <div className="flex flex-col items-center flex-1">
          <h2 className="text-2xl font-bold text-violet-400 mb-8 self-start">Attendance Tracker</h2>
          <div className="relative h-72 w-72">
            <Doughnut data={chartData} options={options} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={`text-4xl font-bold ${
                parseFloat(percentage) >= 85 ? 'text-green-400' :
                parseFloat(percentage) >= 75 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {Math.round(animateValue)}%
              </div>
              <div className="text-base text-gray-400 mt-2">Attendance</div>
            </div>
          </div>
        </div>

        {/* Right side with controls and stats */}
        <div className="flex flex-col items-stretch gap-4 flex-1">
          <div className="flex items-center gap-4 justify-end">
            <button
              onClick={() => {
                setEditMode(false);
                setSelectedDate(new Date().toISOString().split('T')[0]);
                setAttendanceStatus('present');
                setShowAttendanceModal(true);
              }}
              className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-full hover:bg-violet-700 transition-colors"
            >
              <span className="material-icons">add</span>
              Mark Today
            </button>
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 bg-gray-900/95 text-white px-4 py-2 rounded-full border-2 border-gray-800 hover:border-violet-500 focus:border-violet-500 focus:outline-none transition-all duration-300"
              >
                {subjects.find(s => s.id === selectedSubject)?.name}
                <span className="material-icons text-violet-400">
                  expand_more
                </span>
              </button>
              
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-800 py-2 z-50">
                  {subjects.map(subject => {
                    const stats = calculateAttendance(subject.id);
                    const subjectPercentage = stats.present + stats.absent > 0 
                      ? ((stats.present / (stats.present + stats.absent)) * 100).toFixed(1)
                      : '0.0';
                    
                    return (
                      <button
                        key={subject.id}
                        onClick={() => {
                          setSelectedSubject(subject.id);
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-violet-900/30 transition-all duration-200 flex justify-between items-center"
                      >
                        <span>{subject.name}</span>
                        <span className={`text-sm px-2 py-1 rounded-full ${
                          getAttendanceColor(parseFloat(subjectPercentage))
                        }`}>
                          {subjectPercentage}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className={`p-4 rounded-lg border-2 ${attendanceColorClass}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold">Status</span>
              {parseFloat(percentage) < 75 && (
                <span className="material-icons text-red-500 animate-pulse">
                  warning
                </span>
              )}
            </div>
            <p className="text-lg">{statusMessage}</p>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-lg p-5 text-center">
              <div className="text-xl text-gray-400 mb-1">Total Classes</div>
              <div className="text-5xl font-bold text-violet-400">{total}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-400 mb-1">{attendance.present}</div>
                <div className="text-sm text-gray-400">Present</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-400 mb-1">{attendance.absent}</div>
                <div className="text-sm text-gray-400">Absent</div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-400 mb-1">
                {calculateSkippableClasses(attendance.present, attendance.absent)}
              </div>
              <div className="text-sm text-gray-400">Can Skip</div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="mt-12">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-violet-400">Attendance History</h3>
          <button
            onClick={() => {
              setEditMode(true);
              setShowAttendanceModal(true);
            }}
            className="text-violet-400 hover:text-violet-300 transition-colors"
          >
            <span className="material-icons">edit</span>
          </button>
        </div>
        <div className="h-[300px] overflow-y-auto pr-4 space-y-3 custom-scrollbar">
          {attendanceHistory[selectedSubject]?.map((record, index) => (
            <div
              key={record.date}
              className="flex items-center gap-4 p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-all cursor-pointer group relative"
              onClick={() => {
                setSelectedDate(record.date);
                setAttendanceStatus(record.status);
                setEditMode(true);
                setShowAttendanceModal(true);
              }}
            >
              <div className="absolute left-0 h-full w-1 bg-gray-700 group-hover:bg-violet-500 transition-colors rounded-l-lg" />
              <div className={`w-3 h-3 rounded-full ${
                record.status === 'present' ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <div className="flex-1">
                <div className="text-sm text-gray-400">
                  {new Date(record.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
              <span className="material-icons text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                edit
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-violet-400">
                {editMode ? 'Edit Attendance' : 'Mark Attendance'}
              </h3>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white border border-gray-700 focus:border-violet-500 focus:outline-none"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Status</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setAttendanceStatus('present')}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
                      attendanceStatus === 'present'
                        ? 'border-green-500 bg-green-500/20 text-green-400'
                        : 'border-gray-700 hover:border-green-500/50'
                    }`}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => setAttendanceStatus('absent')}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
                      attendanceStatus === 'absent'
                        ? 'border-red-500 bg-red-500/20 text-red-400'
                        : 'border-gray-700 hover:border-red-500/50'
                    }`}
                  >
                    Absent
                  </button>
                </div>
              </div>

              <button
                onClick={handleAttendanceSubmit}
                className="w-full bg-violet-600 text-white py-2 rounded-lg hover:bg-violet-700 transition-colors"
              >
                {editMode ? 'Update Attendance' : 'Mark Attendance'}
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