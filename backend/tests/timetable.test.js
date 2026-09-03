import { jest } from '@jest/globals';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockTimetableFindOneAndUpdate = jest.fn();
const mockTimetableFindOne = jest.fn();
const mockTimetableFindOneAndDelete = jest.fn();
const mockAttendanceFindOne = jest.fn();
const mockAttendanceCreate = jest.fn();
const mockScheduleFindByUserIdAndDate = jest.fn();

jest.unstable_mockModule('../src/models/timetable.model.js', () => ({
  Timetable: {
    findOneAndUpdate: mockTimetableFindOneAndUpdate,
    findOne: mockTimetableFindOne,
    findOneAndDelete: mockTimetableFindOneAndDelete,
  },
}));

jest.unstable_mockModule('../src/models/attendance.model.js', () => ({
  AttendanceCourse: {
    findOne: mockAttendanceFindOne,
    create: mockAttendanceCreate,
  },
}));

jest.unstable_mockModule('../src/repositories/schedule.repository.js', () => ({
  findByUserIdAndDate: mockScheduleFindByUserIdAndDate,
  findEventById: jest.fn(),
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
  countPendingTasks: jest.fn().mockResolvedValue(0),
}));

jest.unstable_mockModule('../src/repositories/attendance.repository.js', () => ({
  findAllByUserId: jest.fn().mockResolvedValue([]),
  findCourseById: jest.fn(),
  createCourse: jest.fn(),
  deleteCourse: jest.fn(),
  upsertAttendanceRecord: jest.fn(),
  deleteAttendanceRecordByDate: jest.fn(),
}));

// Dynamic imports (after mocks are set up)
const {
  matchesUserSection,
  mergeConsecutiveClasses,
  confirmAndSaveTimetable,
  parseTimetablePdf,
  abandonTimetable,
} = await import('../src/services/timetable.service.js');

const {
  confirmTimetable,
  getTimetable,
  deleteTimetable,
} = await import('../src/controllers/timetable.controller.js');

const { getDailySchedule } = await import('../src/services/dashboard.service.js');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Timetable Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Section Hierarchy Matching ──────────────────────────────────────────
  describe('matchesUserSection', () => {
    it('should correctly match CSA (whole section) for both A1 and A2', () => {
      console.log('[TEST] matchesUserSection › CSA matches A1 and A2');
      expect(matchesUserSection('CSA', 'A1')).toBe(true);
      expect(matchesUserSection('CSA', 'A2')).toBe(true);
      expect(matchesUserSection('CS-A', 'A1')).toBe(true);
      expect(matchesUserSection('A', 'A1')).toBe(true);
    });

    it('should strictly match CSA1 only for A1, and CSA2 only for A2', () => {
      console.log('[TEST] matchesUserSection › sub-batch matching');
      expect(matchesUserSection('CSA1', 'A1')).toBe(true);
      expect(matchesUserSection('CSA1', 'A2')).toBe(false);
      expect(matchesUserSection('CSA2', 'A2')).toBe(true);
      expect(matchesUserSection('CSA2', 'A1')).toBe(false);
    });

    it('should reject different section letters', () => {
      console.log('[TEST] matchesUserSection › reject different branches/sections');
      expect(matchesUserSection('CSB', 'A1')).toBe(false);
      expect(matchesUserSection('CSC', 'A1')).toBe(false);
      expect(matchesUserSection('CSD1', 'A1')).toBe(false);
      expect(matchesUserSection('CSB2', 'A1')).toBe(false);
    });

    it('should return true when classSection is empty (applies to all)', () => {
      console.log('[TEST] matchesUserSection › empty section matches all');
      expect(matchesUserSection('', 'A1')).toBe(true);
      expect(matchesUserSection(null, 'A1')).toBe(true);
    });
  });

  // ── 2. Multi-Hour Lab Merging ──────────────────────────────────────────────
  describe('mergeConsecutiveClasses', () => {
    it('should merge two consecutive 1-hour lab slots into a 2-hour slot', () => {
      console.log('[TEST] mergeConsecutiveClasses › merging consecutive lab sessions');
      const input = [
        {
          day: 'Monday', dayOfWeek: 1, startTime: '11:00', endTime: '12:00',
          courseCode: 'CSN14400', classType: 'Lab', location: 'M. Processor Lab',
          subjectName: 'Microprocessors',
        },
        {
          day: 'Monday', dayOfWeek: 1, startTime: '12:00', endTime: '13:00',
          courseCode: 'CSN14400', classType: 'Lab', location: 'M. Processor Lab',
          subjectName: 'Microprocessors',
        },
      ];

      const merged = mergeConsecutiveClasses(input);
      console.log('[TEST] Merged result count:', merged.length, 'start:', merged[0]?.startTime, 'end:', merged[0]?.endTime);
      expect(merged.length).toBe(1);
      expect(merged[0].startTime).toBe('11:00');
      expect(merged[0].endTime).toBe('13:00');
    });

    it('should keep different courses separate even if consecutive', () => {
      console.log('[TEST] mergeConsecutiveClasses › separate different courses');
      const input = [
        { day: 'Monday', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', courseCode: 'CSN14401', classType: 'Lecture', location: 'GS6' },
        { day: 'Monday', dayOfWeek: 1, startTime: '10:00', endTime: '11:00', courseCode: 'CSN14402', classType: 'Lecture', location: 'GS7' },
      ];
      const merged = mergeConsecutiveClasses(input);
      expect(merged.length).toBe(2);
    });

    it('should handle empty input', () => {
      console.log('[TEST] mergeConsecutiveClasses › empty input');
      expect(mergeConsecutiveClasses([])).toEqual([]);
      expect(mergeConsecutiveClasses(null)).toEqual([]);
    });
  });

  // ── 3. parseTimetablePdf without GEMINI_API_KEY ────────────────────────────
  describe('parseTimetablePdf', () => {
    it('should throw an error when GEMINI_API_KEY is not set', async () => {
      console.log('[TEST] parseTimetablePdf › rejects without GEMINI_API_KEY');
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      await expect(
        parseTimetablePdf(Buffer.from('%PDF-1.4 test'), { section: 'A1' })
      ).rejects.toThrow(/GEMINI_API_KEY is not configured/);

      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    });

    it('should throw when pdfBuffer is not a Buffer', async () => {
      console.log('[TEST] parseTimetablePdf › rejects non-buffer input');
      await expect(parseTimetablePdf(null, {})).rejects.toThrow(/valid PDF timetable file/);
      await expect(parseTimetablePdf('not-a-buffer', {})).rejects.toThrow(/valid PDF timetable file/);
    });
  });

  // ── 4. confirmAndSaveTimetable ─────────────────────────────────────────────
  describe('confirmAndSaveTimetable', () => {
    it('should save timetable and auto-register distinct courses in Attendance Guardian', async () => {
      console.log('[TEST] confirmAndSaveTimetable › saving timetable and auto-syncing attendance');
      mockTimetableFindOneAndUpdate.mockResolvedValue({
        _id: 'tt123', userId: 'user1', branch: 'CSE',
      });

      mockAttendanceFindOne
        .mockResolvedValueOnce(null) // Microprocessors not registered
        .mockResolvedValueOnce({ _id: 'c2', courseName: 'Operating System' }); // OS already registered

      mockAttendanceCreate.mockResolvedValueOnce({
        _id: 'c1', courseName: 'Microprocessors', targetPercentage: 75,
      });

      const result = await confirmAndSaveTimetable('user1', {
        branch: 'Computer Science and Engineering', semester: 4, section: 'A1',
        classes: [
          { day: 'Monday', dayOfWeek: 1, startTime: '11:00', endTime: '13:00', subjectName: 'Microprocessors', courseCode: 'CSN14400', classType: 'Lab' },
          { day: 'Tuesday', dayOfWeek: 2, startTime: '09:00', endTime: '10:00', subjectName: 'Operating System', courseCode: 'CSN14401', classType: 'Lecture' },
        ],
      });

      console.log('[TEST] Attendance courses created count:', result.attendanceCoursesAddedCount);
      expect(mockTimetableFindOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user1' },
        expect.objectContaining({ section: 'A1', semester: 4 }),
        expect.any(Object)
      );
      expect(mockAttendanceCreate).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user1', courseName: 'Microprocessors', targetPercentage: 75, totalClasses: 0, attendedClasses: 0 })
      );
      expect(result.attendanceCoursesAddedCount).toBe(1);
    });

    it('should reject empty classes array', async () => {
      console.log('[TEST] confirmAndSaveTimetable › rejects empty classes');
      await expect(confirmAndSaveTimetable('user1', { classes: [] })).rejects.toThrow(/At least one class/);
    });
  });

  // ── 5. abandonTimetable ────────────────────────────────────────────────────
  describe('abandonTimetable', () => {
    it('should delete the user timetable', async () => {
      console.log('[TEST] abandonTimetable › deletes timetable');
      mockTimetableFindOneAndDelete.mockResolvedValue({ _id: 'tt123' });
      const result = await abandonTimetable('user1');
      expect(result.message).toContain('removed successfully');
      expect(mockTimetableFindOneAndDelete).toHaveBeenCalledWith({ userId: 'user1' });
    });

    it('should throw 404 when no timetable exists', async () => {
      console.log('[TEST] abandonTimetable › throws 404 if no timetable');
      mockTimetableFindOneAndDelete.mockResolvedValue(null);
      await expect(abandonTimetable('user1')).rejects.toThrow(/No active timetable found/);
    });
  });

  // ── 6. Daily Schedule Integration ──────────────────────────────────────────
  describe('getDailySchedule with Timetable integration', () => {
    it('should merge recurring timetable classes for that day of week with specific date events', async () => {
      console.log('[TEST] getDailySchedule › recurring classes merged for target day');

      // 2026-09-07 is a Monday (dayOfWeek = 1)
      const mondayDate = '2026-09-07';

      mockScheduleFindByUserIdAndDate.mockResolvedValue([
        { _id: 'task1', type: 'task', title: 'Submit Lab Assignment', startTime: '15:00', endTime: '16:00' },
      ]);

      mockTimetableFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          userId: 'user1',
          classes: [
            { _id: 'c_mon', day: 'Monday', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', subjectName: 'Operating System', classType: 'Lecture' },
            { _id: 'c_tue', day: 'Tuesday', dayOfWeek: 2, startTime: '10:00', endTime: '11:00', subjectName: 'Artificial Intelligence' },
          ],
        }),
      });

      const combined = await getDailySchedule('user1', mondayDate);

      console.log('[TEST] Returned combined schedule items:', combined.length);
      expect(combined.length).toBe(2); // 1 timetable class (Monday) + 1 task
      expect(combined[0].startTime).toBe('09:00');
      expect(combined[0].isFromTimetable).toBe(true);
      expect(combined[1].title).toBe('Submit Lab Assignment');
    });

    it('should return only specific events on Sunday (no timetable classes)', async () => {
      console.log('[TEST] getDailySchedule › Sunday returns no timetable classes');

      // 2026-09-06 is a Sunday
      mockScheduleFindByUserIdAndDate.mockResolvedValue([
        { _id: 'ev1', type: 'event', title: 'Study Session', startTime: '10:00', endTime: '12:00' },
      ]);

      const result = await getDailySchedule('user1', '2026-09-06');
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Study Session');
    });
  });

  // ── 7. Controller Endpoints ────────────────────────────────────────────────
  describe('Timetable Controllers', () => {
    it('confirmTimetable saves verified classes', async () => {
      console.log('[TEST] confirmTimetable controller');
      mockTimetableFindOneAndUpdate.mockResolvedValue({ _id: 'tt1' });
      mockAttendanceFindOne.mockResolvedValue(null);
      mockAttendanceCreate.mockResolvedValue({});

      const req = {
        user: { _id: 'user1', department: 'CSE', semester: 4, section: 'A1' },
        body: {
          classes: [
            { day: 'Monday', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', subjectName: 'Compiler' },
          ],
        },
      };
      const res = makeRes();
      const next = jest.fn();

      await confirmTimetable(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: expect.stringContaining('Timetable synced') })
      );
    });

    it('getTimetable returns user active timetable', async () => {
      console.log('[TEST] getTimetable controller');
      mockTimetableFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'tt_existing', section: 'A1' }),
      });

      const req = { user: { _id: 'user1' } };
      const res = makeRes();
      const next = jest.fn();

      await getTimetable(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ section: 'A1' }),
      });
    });

    it('deleteTimetable removes the active timetable', async () => {
      console.log('[TEST] deleteTimetable controller');
      mockTimetableFindOneAndDelete.mockResolvedValue({ _id: 'tt_del' });

      const req = { user: { _id: 'user1' } };
      const res = makeRes();
      const next = jest.fn();

      await deleteTimetable(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: expect.stringContaining('removed') })
      );
    });
  });
});
