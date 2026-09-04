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
        })
      );
      expect(mockAttendanceChanged).toHaveBeenCalled();
    });
    console.log("TRACE [DailySchedule.test.jsx]: markAttendance successfully called for Operating Systems");
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
      expect(dashboardApi.deleteAttendanceRecord).toHaveBeenCalledWith("c1", expect.any(String));
    });
    console.log("TRACE [DailySchedule.test.jsx]: deleteAttendanceRecord called correctly on class off");
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
      expect(screen.getAllByText("Image Processing and Computer Vision")[0]).toBeInTheDocument();
    });

    // Check that Lab badge is present
    const labBadge = screen.getByText("Lab");
    expect(labBadge).toBeInTheDocument();
    expect(labBadge.className).toContain("text-pink-300");

    // Check duration badge
    expect(screen.getByText(/2 hrs/i)).toBeInTheDocument();
    console.log("TRACE [DailySchedule.test.jsx]: Lab badge and 2 hrs duration verified");
  });

  it("renders multi-hour ongoing session indicator for 15:00-17:00 lab at hour 16", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing multi-hour in session indicator at hour 16");

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
      expect(screen.getByText(/In session \(until 17:00\)/i)).toBeInTheDocument();
    });
    console.log("TRACE [DailySchedule.test.jsx]: Multi-hour ongoing indicator verified");
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
});
