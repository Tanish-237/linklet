import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import DailySchedule from "../DailySchedule";
import * as dashboardApi from "../../api/dashboard.api";

// Mock Auth Context
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { username: "tanish", fullName: "Tanish Sharma" },
  }),
}));

// Mock dashboard API methods
vi.mock("../../api/dashboard.api", () => ({
  fetchSchedule: vi.fn(),
  createScheduleEvent: vi.fn(),
  updateScheduleEvent: vi.fn(),
  deleteScheduleEvent: vi.fn(),
  fetchAttendance: vi.fn(),
  createAttendanceCourse: vi.fn(),
  markAttendance: vi.fn(),
  deleteAttendanceRecord: vi.fn(),
}));

describe("DailySchedule Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: [
        { _id: "c1", courseName: "Data Structures", courseCode: "CS101", professor: "Dr. Sharma" },
        { _id: "c2", courseName: "Operating Systems", courseCode: "CS102", professor: "Dr. Rao" },
      ],
    });
  });

  it("renders Add Event button to the left of Pick Date and omits old filter tabs", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing button layout and absence of viewMode filter tabs");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "evt-1",
        title: "Database Systems (Lecture)",
        subjectName: "Database Systems",
        type: "class",
        classType: "Lecture",
        startTime: "10:00",
        endTime: "11:00",
        status: "pending",
        location: "Hall A",
        professor: "Dr. Sharma",
      },
    ]);

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Database Systems")).toBeInTheDocument();
    });

    const addEventBtn = screen.getByRole("button", { name: /Add Event/i });
    expect(addEventBtn).toBeInTheDocument();

    const pickDateInput = screen.getByLabelText("Pick Date");
    expect(pickDateInput).toBeInTheDocument();

    expect(addEventBtn.compareDocumentPosition(pickDateInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.queryByText("All Items")).not.toBeInTheDocument();
    expect(screen.queryByText("Upcoming")).not.toBeInTheDocument();
    expect(screen.queryByText("Past / Done")).not.toBeInTheDocument();
  });

  it("renders attendance buttons (Present, Absent, Class Off) and directly links with Attendance Guardian", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing attendance buttons and Attendance Guardian sync");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "cls-1",
        title: "Operating Systems",
        subjectName: "Operating Systems",
        type: "class",
        classType: "Lecture",
        startTime: "09:00",
        endTime: "10:00",
        status: "pending",
      },
    ]);
    dashboardApi.updateScheduleEvent.mockResolvedValue({ attendanceStatus: "present" });
    dashboardApi.markAttendance.mockResolvedValue({ success: true });

    const mockAttendanceChanged = vi.fn();
    render(<DailySchedule onScheduleChanged={vi.fn()} onAttendanceChanged={mockAttendanceChanged} />);

    await waitFor(() => {
      expect(screen.getByText("Operating Systems")).toBeInTheDocument();
    });

    const presentBtn = screen.getByRole("button", { name: /Present/i });
    const absentBtn = screen.getByRole("button", { name: /Absent/i });
    const offBtn = screen.getByRole("button", { name: /Class Off/i });

    expect(presentBtn).toBeInTheDocument();
    expect(absentBtn).toBeInTheDocument();
    expect(offBtn).toBeInTheDocument();

    // Verify all 3 buttons have equal w-24 width to prevent text overflow
    expect(presentBtn.className).toContain("w-24");
    expect(absentBtn.className).toContain("w-24");
    expect(offBtn.className).toContain("w-24");
    console.log("TRACE [DailySchedule.test.jsx]: Equal w-24 width verified on all 3 attendance buttons");

    // Click Present
    fireEvent.click(presentBtn);

    await waitFor(() => {
      expect(dashboardApi.updateScheduleEvent).toHaveBeenCalledWith(
        "cls-1",
        expect.objectContaining({ attendanceStatus: "present" })
      );
      expect(dashboardApi.markAttendance).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: "c2",
          status: "present",
          recordType: "class",
        })
      );
      expect(mockAttendanceChanged).toHaveBeenCalled();
    });
    console.log("TRACE [DailySchedule.test.jsx]: markAttendance successfully called for Operating Systems");
  });

  it("automatically creates course in Attendance Guardian if not present when marking attendance", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing auto-creation of AttendanceCourse when marking attendance");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "cls-new-subj",
        title: "Artificial Intelligence (Lecture)",
        subjectName: "Artificial Intelligence",
        courseCode: "AI301",
        type: "class",
        classType: "Lecture",
        startTime: "14:00",
        endTime: "15:00",
        status: "pending",
      },
    ]);
    dashboardApi.createAttendanceCourse.mockResolvedValue({
      _id: "new-course-id",
      courseName: "Artificial Intelligence",
      courseCode: "AI301",
    });
    dashboardApi.updateScheduleEvent.mockResolvedValue({ attendanceStatus: "present" });
    dashboardApi.markAttendance.mockResolvedValue({ success: true });

    render(<DailySchedule onScheduleChanged={vi.fn()} onAttendanceChanged={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Artificial Intelligence")).toBeInTheDocument();
    });

    const presentBtn = screen.getAllByRole("button", { name: /Present/i })[0];
    fireEvent.click(presentBtn);

    await waitFor(() => {
      expect(dashboardApi.createAttendanceCourse).toHaveBeenCalledWith(
        expect.objectContaining({
          courseName: "Artificial Intelligence",
          hasLab: false,
        })
      );
      expect(dashboardApi.markAttendance).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: "new-course-id",
          status: "present",
          recordType: "class",
        })
      );
    });
    console.log("TRACE [DailySchedule.test.jsx]: Successfully auto-created course and marked attendance");
  });

  it("calls deleteAttendanceRecord when class off is marked", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing deleteAttendanceRecord on class off");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "cls-off-test",
        title: "Data Structures",
        subjectName: "Data Structures",
        type: "class",
        classType: "Lecture",
        startTime: "11:00",
        endTime: "12:00",
        status: "pending",
        attendanceStatus: null,
      },
    ]);
    dashboardApi.updateScheduleEvent.mockResolvedValue({ attendanceStatus: "off" });
    dashboardApi.deleteAttendanceRecord.mockResolvedValue({ success: true });

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Data Structures")).toBeInTheDocument();
    });

    const offBtn = screen.getByRole("button", { name: /Class Off/i });
    fireEvent.click(offBtn);

    await waitFor(() => {
      expect(dashboardApi.deleteAttendanceRecord).toHaveBeenCalledWith("c1", expect.any(String), "class");
    });
    console.log("TRACE [DailySchedule.test.jsx]: deleteAttendanceRecord called correctly on class off");
  });

  it("marks Lab attendance with recordType 'lab' when clicking on a Lab event", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing markAttendance with recordType 'lab'");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "lab-event-1",
        title: "Operating Systems (Lab)",
        subjectName: "Operating Systems",
        type: "class",
        classType: "Lab",
        startTime: "14:00",
        endTime: "16:00",
        status: "pending",
        attendanceStatus: null,
      },
    ]);
    dashboardApi.updateScheduleEvent.mockResolvedValue({ attendanceStatus: "present" });
    dashboardApi.markAttendance.mockResolvedValue({ success: true });

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Operating Systems")).toBeInTheDocument();
    });

    const presentBtn = screen.getByRole("button", { name: /Present/i });
    fireEvent.click(presentBtn);

    await waitFor(() => {
      expect(dashboardApi.markAttendance).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: "c2",
          status: "present",
          recordType: "lab",
        })
      );
    });
    console.log("TRACE [DailySchedule.test.jsx]: markAttendance called with recordType 'lab'");
  });

  it("renders separated type badge (Lab, Tutorial, Lecture) on top-left of card with specific colors", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing type badge rendering and colors");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "lab-1",
        title: "Image Processing and Computer Vision (Lab)",
        subjectName: "Image Processing and Computer Vision",
        classType: "Lab",
        type: "class",
        startTime: "15:00",
        endTime: "17:00",
      },
    ]);

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Image Processing and Computer Vision")).toBeInTheDocument();
    });

    // Check that Lab badge is present
    const labBadge = screen.getByText("Lab");
    expect(labBadge).toBeInTheDocument();
    expect(labBadge.className).toContain("text-pink-300");
    console.log("TRACE [DailySchedule.test.jsx]: Lab badge verified");
  });

  it("renders multi-hour 15:00-17:00 events together as a single slot starting at 15:00 without duplicate in-session rows", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing multi-hour 15:00-17:00 combined slot");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "lab-2",
        title: "Image Processing and Computer Vision (Lab)",
        subjectName: "Image Processing and Computer Vision",
        classType: "Lab",
        type: "class",
        startTime: "15:00",
        endTime: "17:00",
      },
    ]);

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading schedule/i)).not.toBeInTheDocument();
    });

    // Expect the slot label to be 15:00 (clean hour mark)
    expect(screen.getByText("15:00")).toBeInTheDocument();
    // Expect the card to appear exactly once
    expect(screen.getByText("Image Processing and Computer Vision")).toBeInTheDocument();
    // Ensure no redundant "In session" strip or 16:00 intermediate slot is displayed
    expect(screen.queryByText(/In session/i)).not.toBeInTheDocument();
    expect(screen.queryByText("16:00")).not.toBeInTheDocument();
    console.log("TRACE [DailySchedule.test.jsx]: Combined 15:00 slot verified without duplicate rows");
  });

  it("displays Task and Event badges without location or lecture label, and omits time from cards", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing Task and Event badges without location or time");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "task-1",
        title: "Submit OS Assignment",
        type: "task",
        deadline: "17:00",
        location: "Room 404",
      },
      {
        _id: "event-1",
        title: "Hackathon Intro",
        type: "event",
        startTime: "14:00",
        endTime: "16:00",
        location: "Auditorium",
      },
      {
        _id: "class-1",
        title: "Networks (Lecture)",
        subjectName: "Networks",
        type: "class",
        classType: "Lecture",
        startTime: "10:00",
        endTime: "11:00",
        location: "Hall B",
        professor: "Dr. Verma",
      },
    ]);

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading schedule/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText("Submit OS Assignment")).toBeInTheDocument();
    expect(screen.getByText("Hackathon Intro")).toBeInTheDocument();
    expect(screen.getByText("Networks")).toBeInTheDocument();

    // Task badge should be present, but NOT Lecture for the task
    expect(screen.getByText("Task")).toBeInTheDocument();
    // Event badge should be present, but NOT Lecture for the event
    expect(screen.getByText("Event")).toBeInTheDocument();
    // Lecture badge should only be for the class
    expect(screen.getByText("Lecture")).toBeInTheDocument();

    // Location should only be shown for the class (Hall B), NOT Room 404 or Auditorium
    expect(screen.getByText("Hall B")).toBeInTheDocument();
    expect(screen.queryByText("Room 404")).not.toBeInTheDocument();
    expect(screen.queryByText("Auditorium")).not.toBeInTheDocument();

    // Professor only for class
    expect(screen.getByText("Dr. Verma")).toBeInTheDocument();

    // No time text inside cards
    expect(screen.queryByText("10:00–11:00")).not.toBeInTheDocument();
    expect(screen.queryByText("Due 17:00")).not.toBeInTheDocument();
    console.log("TRACE [DailySchedule.test.jsx]: Task, Event badges, location filter, and time omission verified");
  });

  it("allows editing an event via Edit button and modal", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing Edit Event modal opening and saving");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "evt-edit-1",
        title: "Data Structures",
        subjectName: "Data Structures",
        type: "class",
        classType: "Lecture",
        startTime: "09:00",
        endTime: "10:00",
        location: "Room 101",
        professor: "Dr. Sharma",
      },
    ]);
    dashboardApi.updateScheduleEvent.mockResolvedValue({
      _id: "evt-edit-1",
      title: "Data Structures (Lab)",
      subjectName: "Data Structures",
      classType: "Lab",
      startTime: "09:00",
      endTime: "11:00",
    });

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Data Structures")).toBeInTheDocument();
    });

    // Click Edit button
    const editBtn = screen.getByLabelText("Edit Event");
    fireEvent.click(editBtn);

    // Modal should be open
    expect(screen.getByText(/Edit Class/i)).toBeInTheDocument();

    // Select Lab classType button inside modal
    const labBtn = screen.getByRole("button", { name: "Lab" });
    fireEvent.click(labBtn);

    // Save changes
    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(dashboardApi.updateScheduleEvent).toHaveBeenCalledWith(
        "evt-edit-1",
        expect.objectContaining({ classType: "Lab" })
      );
    });
    console.log("TRACE [DailySchedule.test.jsx]: Event updated successfully via Edit modal");
  });

  it("shows Subject Info dropdown when adding a class in Add Event modal", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing Subject Info dropdown in Add Event modal");

    dashboardApi.fetchSchedule.mockResolvedValue([]);
    dashboardApi.createScheduleEvent.mockResolvedValue({
      _id: "new-cls",
      title: "Data Structures (Lecture)",
      subjectName: "Data Structures",
      type: "class",
      classType: "Lecture",
      startTime: "09:00",
      endTime: "10:00",
    });

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(dashboardApi.fetchSchedule).toHaveBeenCalled();
    });

    // Click Add Event
    const addEventBtn = screen.getByRole("button", { name: /Add Event/i });
    fireEvent.click(addEventBtn);

    // Modal should appear
    expect(screen.getByText("Add Event to Schedule")).toBeInTheDocument();

    // Select dropdown should be present with courses from Subject Info
    const subjectSelect = screen.getByRole("combobox");
    expect(subjectSelect).toBeInTheDocument();
    expect(screen.getByText(/Data Structures \(CS101\)/i)).toBeInTheDocument();

    // Choose Data Structures
    fireEvent.change(subjectSelect, { target: { value: "Data Structures" } });

    // Click Save to Schedule
    const submitBtn = screen.getByRole("button", { name: /Save to Schedule/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(dashboardApi.createScheduleEvent).toHaveBeenCalledWith(
        expect.objectContaining({ subjectName: "Data Structures" })
      );
    });
    console.log("TRACE [DailySchedule.test.jsx]: Class added with subject selected from Subject Info dropdown");
  });

  it("navigates left and right by 1 day and switches back to today", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing date navigation chevron buttons");

    dashboardApi.fetchSchedule.mockResolvedValue([]);

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(dashboardApi.fetchSchedule).toHaveBeenCalled();
    });

    const initialCallsCount = dashboardApi.fetchSchedule.mock.calls.length;

    const prevBtn = screen.getByRole("button", { name: "Previous Day" });
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(dashboardApi.fetchSchedule.mock.calls.length).toBeGreaterThan(initialCallsCount);
    });

    const prevDateArg = dashboardApi.fetchSchedule.mock.calls.at(-1)[0];
    console.log("TRACE [DailySchedule.test.jsx]: Date after Previous Day click:", prevDateArg);

    const todayBtn = screen.getByRole("button", { name: /Switch to Today/i });
    expect(todayBtn).toBeInTheDocument();
    expect(screen.getByText(/Current Time:/i)).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: "Next Day" });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(dashboardApi.fetchSchedule.mock.calls.length).toBeGreaterThan(initialCallsCount + 1);
    });

    const nextDateArg = dashboardApi.fetchSchedule.mock.calls.at(-1)[0];
    console.log("TRACE [DailySchedule.test.jsx]: Date after Next Day click:", nextDateArg);

    fireEvent.click(nextBtn);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Switch to Today/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Switch to Today/i }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Switch to Today/i })).not.toBeInTheDocument();
      expect(screen.getByText(/Current Time:/i)).toBeInTheDocument();
    });
  });

  it("shows custom confirmation popup when clicking delete on a schedule event", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing custom delete confirmation popup");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "evt-to-delete",
        title: "Calculus Lab",
        type: "class",
        startTime: "11:00",
        endTime: "12:00",
        status: "pending",
      },
    ]);
    dashboardApi.deleteScheduleEvent.mockResolvedValue({ success: true });

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Calculus Lab")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText("Delete Event");
    fireEvent.click(deleteBtn);

    expect(screen.getByText("Delete Class?")).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to permanently delete/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Delete Permanently/i }));

    await waitFor(() => {
      expect(dashboardApi.deleteScheduleEvent).toHaveBeenCalledWith("evt-to-delete");
    });
    console.log("TRACE [DailySchedule.test.jsx]: deleteScheduleEvent called correctly for Calculus Lab");
  });

  it("handles throwing parent callbacks gracefully without rolling back attendance state", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing error isolation when onAttendanceChanged throws");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "cls-error-isolate",
        title: "Operating Systems (Lecture)",
        subjectName: "Operating Systems",
        type: "class",
        classType: "Lecture",
        startTime: "10:00",
        endTime: "11:00",
        status: "pending",
      },
    ]);
    dashboardApi.updateScheduleEvent.mockResolvedValue({ attendanceStatus: "present" });
    dashboardApi.markAttendance.mockResolvedValue({ success: true });

    // Mock parent callback that throws an error (e.g. triggerRefresh is not defined)
    const buggyOnAttendanceChanged = vi.fn(() => {
      throw new ReferenceError("triggerRefresh is not defined");
    });

    render(<DailySchedule onScheduleChanged={vi.fn()} onAttendanceChanged={buggyOnAttendanceChanged} />);

    await waitFor(() => {
      expect(screen.getByText("Operating Systems")).toBeInTheDocument();
    });

    const presentBtn = screen.getByRole("button", { name: /Present/i });
    fireEvent.click(presentBtn);

    await waitFor(() => {
      expect(dashboardApi.markAttendance).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: "c2",
          status: "present",
        })
      );
      expect(buggyOnAttendanceChanged).toHaveBeenCalled();
      // Button should still reflect active present state because markAttendance succeeded
      expect(presentBtn.className).toContain("bg-emerald-600");
    });
    console.log("TRACE [DailySchedule.test.jsx]: Attendance successfully remained present despite throwing parent callback");
  });
});

