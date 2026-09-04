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
}));

describe("DailySchedule Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Add Event button to the left of Pick Date and omits old filter tabs", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing button layout and absence of viewMode filter tabs");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "evt-1",
        title: "Database Systems",
        type: "class",
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

    // Check that Add Event button is present
    const addEventBtn = screen.getByRole("button", { name: /Add Event/i });
    expect(addEventBtn).toBeInTheDocument();

    // Check that Pick Date input is present
    const pickDateInput = screen.getByLabelText("Pick Date");
    expect(pickDateInput).toBeInTheDocument();

    // Verify Add Event comes before Pick Date in the DOM
    expect(addEventBtn.compareDocumentPosition(pickDateInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Old filter tabs must not exist
    expect(screen.queryByText("All Items")).not.toBeInTheDocument();
    expect(screen.queryByText("Upcoming")).not.toBeInTheDocument();
    expect(screen.queryByText("Past / Done")).not.toBeInTheDocument();
  });

  it("renders attendance buttons (Present, Absent, Class Off) for class-type events", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing attendance button rendering for class events");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "cls-1",
        title: "Operating Systems",
        type: "class",
        startTime: "09:00",
        endTime: "10:00",
        status: "pending",
      },
    ]);

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Operating Systems")).toBeInTheDocument();
    });

    // All three attendance buttons should be visible
    expect(screen.getByRole("button", { name: /Present/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Absent/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Class Off/i })).toBeInTheDocument();

    // Old cut-class / status buttons must not exist
    expect(screen.queryByText("Cut Class")).not.toBeInTheDocument();
    expect(screen.queryByText("Mark Done")).not.toBeInTheDocument();
  });

  it("calls updateScheduleEvent with attendanceStatus when clicking attendance button", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing attendance toggle -> updateScheduleEvent");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "cls-2",
        title: "Data Structures",
        type: "class",
        startTime: "11:00",
        endTime: "12:00",
        status: "pending",
        attendanceStatus: null,
      },
    ]);
    dashboardApi.updateScheduleEvent.mockResolvedValue({ attendanceStatus: "present" });

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Data Structures")).toBeInTheDocument();
    });

    const presentBtn = screen.getByRole("button", { name: /Present/i });
    fireEvent.click(presentBtn);

    await waitFor(() => {
      expect(dashboardApi.updateScheduleEvent).toHaveBeenCalledWith(
        "cls-2",
        expect.objectContaining({ attendanceStatus: "present" })
      );
    });
    console.log("TRACE [DailySchedule.test.jsx]: updateScheduleEvent called correctly with attendanceStatus=present");
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

    // Switch to Today button should now be visible
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

    // Move one more day forward, then switch to today
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

  it("updates schedule date when picking a date from Pick Date input", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing Pick Date input interaction");

    dashboardApi.fetchSchedule.mockResolvedValue([]);

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(dashboardApi.fetchSchedule).toHaveBeenCalled();
    });

    const pickDateInput = screen.getByLabelText("Pick Date");
    fireEvent.change(pickDateInput, { target: { value: "2026-10-15" } });

    await waitFor(() => {
      expect(dashboardApi.fetchSchedule).toHaveBeenCalledWith("2026-10-15");
    });
    console.log("TRACE [DailySchedule.test.jsx]: fetchSchedule called with 2026-10-15");
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

    // Delete button is opacity-0 but focusable; trigger via aria-label
    const deleteBtn = screen.getByLabelText("Delete Event");
    fireEvent.click(deleteBtn);

    // Custom modal popup should appear
    expect(screen.getByText("Delete Class?")).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to permanently delete/i)).toBeInTheDocument();

    // Click Delete Permanently
    fireEvent.click(screen.getByRole("button", { name: /Delete Permanently/i }));

    await waitFor(() => {
      expect(dashboardApi.deleteScheduleEvent).toHaveBeenCalledWith("evt-to-delete");
    });
    console.log("TRACE [DailySchedule.test.jsx]: deleteScheduleEvent called correctly for Calculus Lab");
  });

  it("allows adding a new event via Add Event modal", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing Add Event modal opening and submission");

    dashboardApi.fetchSchedule.mockResolvedValue([]);
    dashboardApi.createScheduleEvent.mockResolvedValue({
      _id: "new-evt",
      title: "AI Workshop",
      type: "event",
      startTime: "14:00",
      endTime: "16:00",
      status: "pending",
    });

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(dashboardApi.fetchSchedule).toHaveBeenCalled();
    });

    // Click Add Event (top control button)
    const addEventBtn = screen.getAllByRole("button", { name: /Add Event/i })[0];
    fireEvent.click(addEventBtn);

    // Modal should appear
    expect(screen.getByText("Add Event to Schedule")).toBeInTheDocument();

    // Fill title
    const titleInput = screen.getByPlaceholderText(/Data Structures/i);
    fireEvent.change(titleInput, { target: { value: "AI Workshop" } });

    // Submit
    const submitBtn = screen.getByRole("button", { name: /Save to Schedule/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(dashboardApi.createScheduleEvent).toHaveBeenCalledWith(
        expect.objectContaining({ title: "AI Workshop" })
      );
      expect(screen.getByText("AI Workshop")).toBeInTheDocument();
    });
    console.log("TRACE [DailySchedule.test.jsx]: createScheduleEvent called and event rendered");
  });
});


