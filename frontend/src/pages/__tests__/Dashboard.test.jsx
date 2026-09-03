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

  it("renders user greeting, academic year badge, and real-time KPI metrics", async () => {
    console.log("TRACE [Dashboard.test.jsx]: Testing initial render and metric cards");

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
          targetPercentage: 75,
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

      // Check card titles rendered for the 5 banner cards
      expect(screen.getByText("My Questions")).toBeInTheDocument();
      expect(screen.getByText("My Answers")).toBeInTheDocument();
      expect(screen.getByText("Resources")).toBeInTheDocument();
      expect(screen.getByText("Bookmarks")).toBeInTheDocument();
      expect(screen.getByText("Tasks Today")).toBeInTheDocument();
      expect(screen.getByText("How does Dijkstra algorithm work?")).toBeInTheDocument();
    });
  });

  it("switches tabs between Overview, Daily Schedule, and Attendance Guardian", async () => {
    console.log("TRACE [Dashboard.test.jsx]: Testing tab switching");

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
      expect(screen.getByText("Overview & Highlights")).toBeInTheDocument();
    });

    // Click on Daily Schedule tab
    const scheduleTab = screen.getByRole("button", { name: /Daily Schedule/i });
    fireEvent.click(scheduleTab);

    // Verify Schedule view is active
    expect(screen.getAllByText("Daily Schedule").length).toBeGreaterThan(0);

    // Click on Attendance Guardian tab
    const attendanceTab = screen.getByRole("button", { name: /Attendance Guardian/i });
    fireEvent.click(attendanceTab);

    // Verify Attendance Guardian view is active
    expect(screen.getAllByText("Attendance Guardian").length).toBeGreaterThan(0);
  });
});
