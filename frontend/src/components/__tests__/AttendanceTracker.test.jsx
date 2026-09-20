import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import AttendanceTracker from "../AttendanceTracker";
import * as dashboardApi from "../../api/dashboard.api";


// Mock dashboard API methods
vi.mock("../../api/dashboard.api", () => ({
  fetchAttendance: vi.fn(),
}));

// Mock react-toastify
vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const mockCourses = [
  {
    _id: "c1",
    courseName: "Machine Learning with Python",
    courseCode: "CSN17600",
    stats: {
      present: 0,
      absent: 0,
      total: 0,
      percentage: 0,
      skippableClasses: 0,
      neededClasses: 0,
      isSafe: true,
    },
    records: [],
  },
  {
    _id: "c2",
    courseName: "Operating Systems",
    courseCode: "CSN17601",
    stats: {
      present: 8,
      absent: 2,
      total: 10,
      percentage: 80,
      skippableClasses: 1,
      neededClasses: 0,
      isSafe: true,
    },
    records: [
      { date: "2026-09-01", status: "present" },
      { date: "2026-09-02", status: "absent" },
    ],
  },
  {
    _id: "c3",
    courseName: "Computer Networks",
    courseCode: "CSN17602",
    stats: {
      present: 6,
      absent: 4,
      total: 10,
      percentage: 60,
      skippableClasses: 0,
      neededClasses: 6,
      isSafe: false,
    },
    records: [],
  },
];

describe("AttendanceTracker Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Attendance Guardian header and omits the Mark Attendance button", async () => {
    console.log("TRACE [AttendanceTracker.test.jsx]: Testing header and absence of Mark Attendance button");

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: mockCourses,
      overall: { totalPresent: 14, totalAbsent: 6, percentage: 70 },
    });

    render(<AttendanceTracker />);

    await waitFor(() => {
      expect(screen.getByText("Attendance Guardian")).toBeInTheDocument();
    });

    // Verify Mark Attendance button is completely removed
    const markBtn = screen.queryByRole("button", { name: /mark attendance/i });
    expect(markBtn).not.toBeInTheDocument();
    console.log("TRACE [AttendanceTracker.test.jsx]: Confirmed Mark Attendance button is not rendered");
  });

  it("omits the status badge below the doughnut chart and omits All Subjects Aggregate bar", async () => {
    console.log("TRACE [AttendanceTracker.test.jsx]: Testing removal of status badge under doughnut and aggregate bar");

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: mockCourses,
      overall: { totalPresent: 0, totalAbsent: 0, percentage: 0 },
    });

    render(<AttendanceTracker />);

    await waitFor(() => {
      expect(screen.getByText("Machine Learning with Python")).toBeInTheDocument();
    });

    // The old status badge below doughnut had 'No logs yet' or 'Can leave' / 'On track' pill
    expect(screen.queryByText("No logs yet")).not.toBeInTheDocument();

    // The old All Subjects Aggregate bar is removed
    expect(screen.queryByText(/All Subjects Aggregate:/i)).not.toBeInTheDocument();
    console.log("TRACE [AttendanceTracker.test.jsx]: Confirmed status badge and aggregate bar are absent");
  });

  it("omits the entire Attendance Log section", async () => {
    console.log("TRACE [AttendanceTracker.test.jsx]: Testing removal of Attendance Log section");

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: mockCourses,
    });

    render(<AttendanceTracker />);

    await waitFor(() => {
      expect(screen.getByText("Machine Learning with Python")).toBeInTheDocument();
    });

    // Attendance Log header and records list should not exist
    expect(screen.queryByText(/Attendance Log for/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/records logged/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No attendance entries logged for this course yet/i)).not.toBeInTheDocument();
    console.log("TRACE [AttendanceTracker.test.jsx]: Confirmed Attendance Log section is not rendered");
  });

  it("renders centered doughnut chart and 3 KPI metric cards named Total, Attended, Missed down the chart", async () => {
    console.log("TRACE [AttendanceTracker.test.jsx]: Testing centered doughnut chart and 3 KPI metric cards (Total, Attended, Missed)");

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: mockCourses,
    });

    render(<AttendanceTracker />);

    await waitFor(() => {
      expect(screen.getByTestId("attendance-donut")).toBeInTheDocument();
    });

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Attended")).toBeInTheDocument();
    expect(screen.getByText("Missed")).toBeInTheDocument();
    console.log("TRACE [AttendanceTracker.test.jsx]: Confirmed Total, Attended, Missed metrics rendered below chart");
  });

  it("does not include Add Subject in dropdown or Add Course modals in Attendance Guardian", async () => {
    console.log("TRACE [AttendanceTracker.test.jsx]: Testing absence of Add Subject in Attendance Guardian");

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: mockCourses,
    });

    render(<AttendanceTracker />);

    await waitFor(() => {
      expect(screen.getByText("Machine Learning with Python")).toBeInTheDocument();
    });

    // Open dropdown
    const dropdownBtn = screen.getByRole("button", { name: /Machine Learning with Python/i });
    fireEvent.click(dropdownBtn);

    // Verify Add Subject is NOT in dropdown
    expect(screen.queryByText("Add Subject")).not.toBeInTheDocument();
    console.log("TRACE [AttendanceTracker.test.jsx]: Confirmed Add Subject is absent in dropdown");
  });

  it("displays single-line advisory linking to Daily Schedule when total classes is 0", async () => {
    console.log("TRACE [AttendanceTracker.test.jsx]: Testing single line advisory with Daily Schedule link");

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: [mockCourses[0]], // 0 total classes
    });

    render(<AttendanceTracker />);

    await waitFor(() => {
      expect(screen.getByText(/No .*attendance recorded yet\. Mark attendance using your/i)).toBeInTheDocument();
    });

    const dailyScheduleLink = screen.getByRole("button", { name: /Daily Schedule/i });
    expect(dailyScheduleLink).toBeInTheDocument();

    // Test clicking Daily Schedule button
    const scrollIntoViewMock = vi.fn();
    const fakeElement = document.createElement("div");
    fakeElement.id = "daily-schedule";
    fakeElement.scrollIntoView = scrollIntoViewMock;
    document.body.appendChild(fakeElement);

    fireEvent.click(dailyScheduleLink);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

    document.body.removeChild(fakeElement);
    console.log("TRACE [AttendanceTracker.test.jsx]: Confirmed single line advisory and Daily Schedule smooth scroll");
  });

  it("displays single-line advisory showing leave allowance when attendance is >= 75%", async () => {
    console.log("TRACE [AttendanceTracker.test.jsx]: Testing single line advisory for >= 75% attendance");

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: [mockCourses[1]], // 80% attendance, 1 skippable
    });

    render(<AttendanceTracker />);

    await waitFor(() => {
      expect(screen.getByText(/Attendance is/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/You can leave/i)).toBeInTheDocument();
    expect(screen.getByText(/and remain above 75%/i)).toBeInTheDocument();
    console.log("TRACE [AttendanceTracker.test.jsx]: Confirmed leave allowance single line advisory");
  });

  it("displays single-line advisory showing needed consecutive classes when attendance is < 75%", async () => {
    console.log("TRACE [AttendanceTracker.test.jsx]: Testing single line advisory for < 75% attendance");

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: [mockCourses[2]], // 60% attendance, 6 needed
    });

    render(<AttendanceTracker />);

    await waitFor(() => {
      expect(screen.getByText(/Critical/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Attend next/i)).toBeInTheDocument();
    expect(screen.getByText(/consecutive classes to reach 75%/i)).toBeInTheDocument();
    console.log("TRACE [AttendanceTracker.test.jsx]: Confirmed needed classes single line advisory");
  });

  it("allows switching courses from the stretched Selected Course dropdown", async () => {
    console.log("TRACE [AttendanceTracker.test.jsx]: Testing course switching via dropdown");

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: mockCourses,
    });

    render(<AttendanceTracker />);

    await waitFor(() => {
      expect(screen.getByText("Machine Learning with Python")).toBeInTheDocument();
    });

    // Open dropdown
    const dropdownBtn = screen.getByRole("button", { name: /Machine Learning with Python/i });
    fireEvent.click(dropdownBtn);

    // Click Operating Systems
    const osOption = screen.getByRole("button", { name: /Operating Systems/i });
    fireEvent.click(osOption);

    // Verify course switch updated KPIs to Operating Systems (total: 10, present: 8, absent: 2)
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    console.log("TRACE [AttendanceTracker.test.jsx]: Successfully switched course and updated stats");
  });

  it("renders segmented [Class] [Lab] toggle only when subject hasLab: true and switches metrics", async () => {
    console.log("TRACE [AttendanceTracker.test.jsx]: Testing segmented toggle when course hasLab: true");
    const courseWithLab = {
      _id: "c-lab",
      courseName: "Compiler Design",
      courseCode: "CS501",
      hasLab: true,
      stats: {
        present: 15,
        absent: 3,
        total: 18,
        percentage: 83.3,
        skippableClasses: 2,
        neededClasses: 0,
        class: {
          present: 10,
          absent: 2,
          total: 12,
          percentage: 83.3,
          skippableClasses: 1,
          neededClasses: 0,
        },
        lab: {
          present: 5,
          absent: 1,
          total: 6,
          percentage: 83.3,
          skippableClasses: 1,
          neededClasses: 0,
        },
      },
    };

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: [courseWithLab],
    });

    render(<AttendanceTracker />);

    await waitFor(() => {
      expect(screen.getByText("Compiler Design")).toBeInTheDocument();
    });

    // Verify segmented control is rendered
    const classBtn = screen.getByRole("button", { name: /Class \(Lecture \+ Tutorial\)/i });
    const labBtn = screen.getByRole("button", { name: /science\s*Lab/i });
    expect(classBtn).toBeInTheDocument();
    expect(labBtn).toBeInTheDocument();

    // In Class mode (default): Total should be 12, attended 10, missed 2
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);

    // Click Lab toggle
    fireEvent.click(labBtn);

    // In Lab mode: Total should be 6, attended 5, missed 1
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Lab Attendance")).toBeInTheDocument();

    // Click back to Class mode
    fireEvent.click(classBtn);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Class Attendance")).toBeInTheDocument();
  });

  it("strictly hides the Lab option and toggle when subject hasLab: false", async () => {
    console.log("TRACE [AttendanceTracker.test.jsx]: Testing absence of Lab option when hasLab: false");
    const courseNoLab = {
      _id: "c-no-lab",
      courseName: "Engineering Economics",
      courseCode: "HS201",
      hasLab: false,
      stats: {
        present: 8,
        absent: 2,
        total: 10,
        percentage: 80,
        class: {
          present: 8,
          absent: 2,
          total: 10,
          percentage: 80,
        },
        lab: null,
      },
    };

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: [courseNoLab],
    });

    render(<AttendanceTracker />);

    await waitFor(() => {
      expect(screen.getByText("Engineering Economics")).toBeInTheDocument();
    });

    // Neither the segmented control nor any Lab button should exist
    expect(screen.queryByRole("button", { name: /science\s*Lab/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Class \(Lecture \+ Tutorial\)/i })).not.toBeInTheDocument();
  });

  it("allows selecting Class and Lab separately directly inside the Selected Course dropdown for subjects with hasLab: true", async () => {
    console.log("TRACE [AttendanceTracker.test.jsx]: Testing direct Class and Lab selection from inside dropdown menu");
    const courseWithLab = {
      _id: "c-lab-direct",
      courseName: "Machine Learning with Python",
      courseCode: "CSN17600",
      hasLab: true,
      stats: {
        present: 12,
        absent: 2,
        total: 14,
        percentage: 85.7,
        class: {
          present: 8,
          absent: 2,
          total: 10,
          percentage: 80,
          skippableClasses: 1,
          neededClasses: 0,
        },
        lab: {
          present: 4,
          absent: 0,
          total: 4,
          percentage: 100,
          skippableClasses: 1,
          neededClasses: 0,
        },
      },
    };

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: [courseWithLab],
    });

    render(<AttendanceTracker />);

    await waitFor(() => {
      expect(screen.getByText("Machine Learning with Python")).toBeInTheDocument();
    });

    // Initially in Class mode (default): Total: 10, Attended: 8, Missed: 2
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();

    // Open Selected Course dropdown
    const dropdownBtn = screen.getByRole("button", { name: /Machine Learning with Python/i });
    fireEvent.click(dropdownBtn);

    // Verify inside dropdown: Subject row with percentage, Has Lab tag, and Lab sub-row with percentage
    expect(screen.getByText("Has Lab")).toBeInTheDocument();
    const dropdownCourseBtn = screen.getByTestId("dropdown-course-c-lab-direct");
    const dropdownLabBtn = screen.getByTestId("dropdown-lab-c-lab-direct");
    expect(dropdownCourseBtn).toBeInTheDocument();
    expect(dropdownLabBtn).toBeInTheDocument();
    expect(dropdownCourseBtn).toHaveTextContent("80%");
    expect(dropdownLabBtn).toHaveTextContent("100%");

    // Click Lab option inside dropdown
    fireEvent.click(dropdownLabBtn);

    // Dropdown should close and metrics should now reflect Lab: Total: 4, Attended: 4, Missed: 0
    await waitFor(() => {
      expect(screen.queryByText("Has Lab")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("4").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Lab Attendance")).toBeInTheDocument();
    console.log("TRACE [AttendanceTracker.test.jsx]: Successfully selected Lab directly from dropdown menu");

    // Open dropdown again and click Subject row (which selects Class)
    fireEvent.click(dropdownBtn);
    const dropdownCourseBtnAgain = screen.getByTestId("dropdown-course-c-lab-direct");
    fireEvent.click(dropdownCourseBtnAgain);

    // Should switch back to Class mode: Total: 10, Attended: 8, Missed: 2
    await waitFor(() => {
      expect(screen.queryByText("Has Lab")).not.toBeInTheDocument();
    });
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Class Attendance")).toBeInTheDocument();
    console.log("TRACE [AttendanceTracker.test.jsx]: Successfully switched back to Class directly from subject row in dropdown menu");
  });

  it("closes the dropdown when clicking outside", async () => {
    console.log("TRACE [AttendanceTracker.test.jsx]: Testing dropdown close on outside click");
    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: mockCourses,
    });

    render(
      <div>
        <div data-testid="outside-area">Outside</div>
        <AttendanceTracker />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText("Machine Learning with Python")).toBeInTheDocument();
    });

    const dropdownBtn = screen.getByRole("button", { name: /Machine Learning with Python/i });
    fireEvent.click(dropdownBtn);

    // Dropdown is open
    expect(screen.getByRole("button", { name: /Operating Systems/i })).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId("outside-area"));

    // Dropdown is closed
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Operating Systems/i })).not.toBeInTheDocument();
    });
    console.log("TRACE [AttendanceTracker.test.jsx]: Dropdown closed successfully on outside click");
  });
});
