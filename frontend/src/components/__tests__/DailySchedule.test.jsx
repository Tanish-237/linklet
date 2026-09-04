import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import DailySchedule from "../DailySchedule";
import * as dashboardApi from "../../api/dashboard.api";

// Mock Auth Context
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      username: "tanish",
      fullName: "Tanish Sharma",
    },
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

  it("renders Add Event button to the left of Pick Date and excludes viewMode filter tabs", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing button layout and absence of viewMode filter tabs");

    dashboardApi.fetchSchedule.mockResolvedValue([
      {
        _id: "evt-1",
        title: "Database Systems Lecture",
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
      expect(screen.getByText("Database Systems Lecture")).toBeInTheDocument();
    });

    // Check that Add Event button is present
    const addEventBtn = screen.getByRole("button", { name: /Add Event/i });
    expect(addEventBtn).toBeInTheDocument();

    // Check that Pick Date input / button is present
    const pickDateInput = screen.getByLabelText("Pick Date");
    expect(pickDateInput).toBeInTheDocument();

    // Verify ordering: Add Event comes before Pick Date in the DOM
    expect(addEventBtn.compareDocumentPosition(pickDateInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Verify "All Items", "Upcoming", and "Past / Done" tabs are NOT rendered
    expect(screen.queryByText("All Items")).not.toBeInTheDocument();
    expect(screen.queryByText("Upcoming")).not.toBeInTheDocument();
    expect(screen.queryByText("Past / Done")).not.toBeInTheDocument();
  });

  it("navigates left and right by 1 day cleanly without timezone drift and re-centers", async () => {
    console.log("TRACE [DailySchedule.test.jsx]: Testing date navigation chevron buttons");

    dashboardApi.fetchSchedule.mockResolvedValue([]);

    render(<DailySchedule onScheduleChanged={vi.fn()} />);

    await waitFor(() => {
      expect(dashboardApi.fetchSchedule).toHaveBeenCalled();
    });

    const initialCallsCount = dashboardApi.fetchSchedule.mock.calls.length;

    // Click Previous Day (<)
    const prevBtn = screen.getByRole("button", { name: "Previous Day" });
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(dashboardApi.fetchSchedule.mock.calls.length).toBeGreaterThan(initialCallsCount);
    });

    const prevDateArg = dashboardApi.fetchSchedule.mock.calls[dashboardApi.fetchSchedule.mock.calls.length - 1][0];
    console.log("TRACE [DailySchedule.test.jsx]: Date requested after clicking Previous Day:", prevDateArg);

    // "Switch to Today" button should now be visible because we are not on today
    const todayBtn = screen.getByRole("button", { name: /Switch to Today/i });
    expect(todayBtn).toBeInTheDocument();
    expect(screen.getByText(/Current Time:/i)).toBeInTheDocument();

    // Click Next Day (>)
    const nextBtn = screen.getByRole("button", { name: "Next Day" });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(dashboardApi.fetchSchedule.mock.calls.length).toBeGreaterThan(initialCallsCount + 1);
    });

    const nextDateArg = dashboardApi.fetchSchedule.mock.calls[dashboardApi.fetchSchedule.mock.calls.length - 1][0];
    console.log("TRACE [DailySchedule.test.jsx]: Date requested after clicking Next Day:", nextDateArg);

    // Click Next Day again to move +1 from today
    fireEvent.click(nextBtn);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Switch to Today/i })).toBeInTheDocument();
    });

    // Click Switch to Today button to jump back
    fireEvent.click(screen.getByRole("button", { name: /Switch to Today/i }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Switch to Today/i })).not.toBeInTheDocument();
      // Current Time remains visible
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

    // Click delete icon
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
        expect.objectContaining({
          title: "AI Workshop",
        })
      );
      expect(screen.getByText("AI Workshop")).toBeInTheDocument();
    });
  });
});
