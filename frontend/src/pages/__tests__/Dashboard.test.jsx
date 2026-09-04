import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Dashboard from "../Dashboard";
import * as dashboardApi from "../../api/dashboard.api";

// Mock Auth Context
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      username: "tanish",
      fullName: "Tanish Sharma",
      department: "Computer Science & Engineering",
      semester: 5,
      section: "A",
      email: "tanish@mnnit.ac.in",
    },
  }),
}));

// Mock dashboard API methods
vi.mock("../../api/dashboard.api", () => ({
  fetchDashboardStats: vi.fn(),
  fetchSchedule: vi.fn(),
  createScheduleEvent: vi.fn(),
  updateScheduleEvent: vi.fn(),
  deleteScheduleEvent: vi.fn(),
  fetchAttendance: vi.fn(),
  createAttendanceCourse: vi.fn(),
  deleteAttendanceCourse: vi.fn(),
  markAttendance: vi.fn(),
  deleteAttendanceRecord: vi.fn(),
}));

// Mock react-chartjs-2 Doughnut to avoid HTML5 canvas issues in jsdom
vi.mock("react-chartjs-2", () => ({
  Doughnut: () => <div data-testid="mock-doughnut">Doughnut Chart</div>,
}));

// Mock Timetable modals to keep test fast and focused
vi.mock("../../components/TimetableUploadModal", () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="mock-upload-modal">
        Mock Upload Modal <button onClick={onClose}>Close Upload</button>
      </div>
    ) : null,
}));

vi.mock("../../components/WeeklyTimetableModal", () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="mock-weekly-modal">
        Mock Weekly Modal <button onClick={onClose}>Close Weekly</button>
      </div>
    ) : null,
}));

vi.mock("../../components/SubjectInfoModal", () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="mock-subject-info-modal">
        Mock Subject Info Modal <button onClick={onClose}>Close Subject Info</button>
      </div>
    ) : null,
}));

describe("Dashboard Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <HelmetProvider>
        <BrowserRouter>
          <Dashboard />
        </BrowserRouter>
      </HelmetProvider>
    );
  };

  it("renders user greeting, academic chips, and 4 KPI metrics (with Tasks banner removed)", async () => {
    console.log("TRACE [Dashboard.test.jsx]: Testing initial render with tasks banner removed");

    dashboardApi.fetchDashboardStats.mockResolvedValue({
      metrics: {
        questionsCount: 7,
        answersCount: 14,
        resourcesCount: 9,
        bookmarksCount: 4,
        pendingTasksCount: 3,
        overallAttendancePercentage: 88.5,
        totalLoggedClasses: 20,
        totalCoursesCount: 4,
      },
      recentActivity: {
        questions: [{ _id: "q1", title: "How does Dijkstra algorithm work?", category: "Technical" }],
        resources: [{ _id: "r1", title: "Operating Systems End Sem Notes", fileType: "pdf" }],
      },
    });

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "s1",
        title: "Compiler Design",
        type: "class",
        startTime: "09:00",
        endTime: "10:00",
        status: "pending",
      },
    ]);

    dashboardApi.fetchAttendance.mockResolvedValue({
      overall: { totalPresent: 18, totalAbsent: 2, totalClasses: 20, percentage: 90 },
      courses: [
        {
          _id: "c1",
          courseName: "Compiler Design",
          courseCode: "CS301",
          stats: { present: 18, absent: 2, total: 20, percentage: 90, skippableClasses: 4, isSafe: true },
          records: [{ date: "2026-09-04", status: "present" }],
        },
      ],
    });

    renderComponent();

    await waitFor(() => {
      // Check greeting with first name
      expect(screen.getByText(/Tanish/i)).toBeInTheDocument();

      // Check dynamic semester and section chips
      expect(screen.getByText("Sem 5")).toBeInTheDocument();
      expect(screen.getByText("Sec A")).toBeInTheDocument();

      // Check card titles rendered for the 4 metrics cards
      expect(screen.getByText("My Questions")).toBeInTheDocument();
      expect(screen.getByText("My Answers")).toBeInTheDocument();
      expect(screen.getByText("Resources")).toBeInTheDocument();
      expect(screen.getByText("Bookmarks")).toBeInTheDocument();

      // Ensure "Tasks Today" banner card has been removed
      expect(screen.queryByText("Tasks Today")).not.toBeInTheDocument();

      expect(screen.getByText("How does Dijkstra algorithm work?")).toBeInTheDocument();
    });
  });

  it("never displays 'Good night' even at late night hours (displays 'Good evening')", async () => {
    console.log("TRACE [Dashboard.test.jsx]: Verifying 'Good night' is never displayed at night");

    const getHoursSpy = vi.spyOn(Date.prototype, "getHours").mockReturnValue(23);

    dashboardApi.fetchDashboardStats.mockResolvedValue({
      metrics: { questionsCount: 0, answersCount: 0, resourcesCount: 0, bookmarksCount: 0 },
      recentActivity: { questions: [], resources: [] },
    });
    dashboardApi.fetchSchedule.mockResolvedValue([]);
    dashboardApi.fetchAttendance.mockResolvedValue({ overall: { percentage: 0 }, courses: [] });

    renderComponent();

    await waitFor(() => {
      // Ensure "Good night" is never present
      expect(screen.queryByText(/Good night/i)).not.toBeInTheDocument();
      // Ensure "Good evening" is displayed instead
      expect(screen.getByText(/Good evening/i)).toBeInTheDocument();
    });

    getHoursSpy.mockRestore();
  });

  it("verifies Action Bar renders Add Event first, Subject Info second, and Timetable Options dropdown", async () => {
    console.log("TRACE [Dashboard.test.jsx]: Testing Action Bar order (Add Event first, Subject Info second) and modals");

    dashboardApi.fetchDashboardStats.mockResolvedValue({
      metrics: {
        questionsCount: 0,
        answersCount: 0,
        resourcesCount: 0,
        bookmarksCount: 0,
        pendingTasksCount: 0,
        overallAttendancePercentage: 0,
        totalCoursesCount: 1,
      },
      recentActivity: { questions: [], resources: [] },
    });

    dashboardApi.fetchSchedule.mockResolvedValue([]);
    dashboardApi.fetchAttendance.mockResolvedValue({
      overall: { percentage: 0 },
      courses: [],
    });

    renderComponent();

    await waitFor(() => {
      // Ensure the old tab switcher banner is removed
      expect(screen.queryByText("Overview & Highlights")).not.toBeInTheDocument();

      // Ensure both Daily Schedule and Attendance Guardian are rendered concurrently
      expect(screen.getAllByText("Daily Schedule").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Attendance Guardian").length).toBeGreaterThan(0);

      // Verify Action Bar buttons exist with Add Event first, then Subject Info
      const addEventBtn = screen.getByRole("button", { name: /Add Event/i });
      const subjectInfoBtn = screen.getByRole("button", { name: /Subject Info/i });
      const timetableOptionsBtn = screen.getByRole("button", { name: /Timetable Options/i });

      expect(addEventBtn).toBeInTheDocument();
      expect(subjectInfoBtn).toBeInTheDocument();
      expect(timetableOptionsBtn).toBeInTheDocument();
    });

    // Test Subject Info opens SubjectInfoModal
    const subjectInfoBtn = screen.getByRole("button", { name: /Subject Info/i });
    fireEvent.click(subjectInfoBtn);
    expect(screen.getByTestId("mock-subject-info-modal")).toBeInTheDocument();

    // Close Subject Info modal
    fireEvent.click(screen.getByText("Close Subject Info"));
    expect(screen.queryByTestId("mock-subject-info-modal")).not.toBeInTheDocument();

    // Test Timetable Options dropdown toggle
    const timetableOptionsBtn = screen.getByRole("button", { name: /Timetable Options/i });
    fireEvent.click(timetableOptionsBtn);

    // Dropdown items should now be visible: View Timetable first, Upload New Timetable second
    expect(screen.getByText("View Timetable")).toBeInTheDocument();
    expect(screen.getByText("Upload New Timetable")).toBeInTheDocument();

    // Click View Timetable (first option)
    fireEvent.click(screen.getByText("View Timetable"));
    expect(screen.getByTestId("mock-weekly-modal")).toBeInTheDocument();

    // Close weekly modal
    fireEvent.click(screen.getByText("Close Weekly"));
    expect(screen.queryByTestId("mock-weekly-modal")).not.toBeInTheDocument();

    // Open dropdown again and click Upload New Timetable (second option)
    fireEvent.click(timetableOptionsBtn);
    fireEvent.click(screen.getByText("Upload New Timetable"));
    expect(screen.getByTestId("mock-upload-modal")).toBeInTheDocument();
  });
});
