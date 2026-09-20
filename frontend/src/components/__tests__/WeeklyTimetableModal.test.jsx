import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import WeeklyTimetableModal from "../WeeklyTimetableModal";
import * as timetableApi from "../../api/timetable.api";

vi.mock("../../api/timetable.api", () => ({
  fetchTimetable: vi.fn(),
  confirmTimetable: vi.fn(),
}));

describe("WeeklyTimetableModal Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    console.log("TRACE [WeeklyTimetableModal.test.jsx]: Testing hidden modal state");
    const { container } = render(
      <WeeklyTimetableModal isOpen={false} onClose={vi.fn()} onTimetableChanged={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("transitions cleanly from isOpen=false to isOpen=true without Rules of Hooks violation", async () => {
    console.log("TRACE [WeeklyTimetableModal.test.jsx]: Testing transition from false to true to verify hook order stability");
    timetableApi.fetchTimetable.mockResolvedValue({ classes: [] });

    const { rerender } = render(
      <WeeklyTimetableModal isOpen={false} onClose={vi.fn()} onTimetableChanged={vi.fn()} />
    );

    // Re-render with isOpen=true
    rerender(
      <WeeklyTimetableModal isOpen={true} onClose={vi.fn()} onTimetableChanged={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Weekly Timetable/i)).toBeInTheDocument();
    });

    // Re-render back to isOpen=false
    rerender(
      <WeeklyTimetableModal isOpen={false} onClose={vi.fn()} onTimetableChanged={vi.fn()} />
    );

    expect(screen.queryByText(/Weekly Timetable/i)).not.toBeInTheDocument();
  });

  it("renders all 7 days from Monday to Sunday and verifies Abandon button is removed", async () => {
    console.log("TRACE [WeeklyTimetableModal.test.jsx]: Testing all 7 days rendered and no abandon button");

    timetableApi.fetchTimetable.mockResolvedValue({
      branch: "Computer Science and Engineering",
      semester: 4,
      section: "A1",
      classes: [
        {
          day: "Monday",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "10:00",
          subjectName: "Operating Systems",
          classType: "Lecture",
          location: "GS6",
          professor: "Dr. A. K. Singh",
          courseCode: "CSN14401",
        },
        {
          day: "Sunday",
          dayOfWeek: 0,
          startTime: "11:00",
          endTime: "12:00",
          subjectName: "Competitive Programming",
          classType: "Tutorial",
          location: "Online",
          professor: "Prof. Coding",
          courseCode: "CP101",
        },
      ],
    });

    render(
      <WeeklyTimetableModal isOpen={true} onClose={vi.fn()} onTimetableChanged={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.queryByText(/Loading your weekly timetable/i)).not.toBeInTheDocument();
    });

    // Check all 7 days in the day selector
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    for (const day of days) {
      expect(screen.getAllByText(day).length).toBeGreaterThanOrEqual(1);
    }

    // Verify "Abandon Timetable" button is completely removed
    expect(screen.queryByText(/Abandon Timetable/i)).toBeNull();
    expect(screen.queryByText(/Remove Timetable/i)).toBeNull();

    // Verify Sunday can be selected and shows its class
    const sundayTab = screen.getByRole("button", { name: /^Sunday/i }) /* tab only — anchored so "Add Class to Sunday" never matches */;
    fireEvent.click(sundayTab);

    await waitFor(() => {
      expect(screen.getByText("Competitive Programming")).toBeInTheDocument();
      expect(screen.getByText("Prof. Coding")).toBeInTheDocument();
    });
  });

  it("allows adding a class to Sunday and calls confirmTimetable", async () => {
    console.log("TRACE [WeeklyTimetableModal.test.jsx]: Testing adding class to Sunday");

    timetableApi.fetchTimetable.mockResolvedValue({
      branch: "CSE",
      semester: 4,
      section: "A1",
      classes: [],
    });
    timetableApi.confirmTimetable.mockResolvedValue({ success: true });

    const mockChanged = vi.fn();

    render(
      <WeeklyTimetableModal isOpen={true} onClose={vi.fn()} onTimetableChanged={mockChanged} />
    );

    await waitFor(() => {
      expect(screen.queryByText(/Loading your weekly timetable/i)).not.toBeInTheDocument();
    });

    // Switch to Sunday
    fireEvent.click(screen.getByRole("button", { name: /^Sunday/i }) /* tab only — anchored so "Add Class to Sunday" never matches */);

    // Click "Add Class to Sunday"
    fireEvent.click(screen.getByRole("button", { name: /Add Class to Sunday/i }));

    // Fill form
    fireEvent.change(screen.getByPlaceholderText("e.g. Distributed Systems"), {
      target: { value: "Weekend AI Workshop" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. CS14402"), {
      target: { value: "AI701" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. Dr. A. K. Singh"), {
      target: { value: "Dr. Machine Learning" },
    });

    // Submit add form
    fireEvent.click(screen.getByRole("button", { name: /^Add Class$/i }));

    await waitFor(() => {
      expect(timetableApi.confirmTimetable).toHaveBeenCalledWith(
        expect.objectContaining({
          classes: expect.arrayContaining([
            expect.objectContaining({
              day: "Sunday",
              dayOfWeek: 0,
              subjectName: "Weekend AI Workshop",
              courseCode: "AI701",
              professor: "Dr. Machine Learning",
            }),
          ]),
        })
      );
      expect(mockChanged).toHaveBeenCalled();
    });
  });

  it("allows editing an existing class on any day", async () => {
    console.log("TRACE [WeeklyTimetableModal.test.jsx]: Testing editing a class");

    timetableApi.fetchTimetable.mockResolvedValue({
      branch: "CSE",
      semester: 4,
      section: "A1",
      classes: [
        {
          day: "Monday",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "10:00",
          subjectName: "Compiler Design",
          classType: "Lecture",
          location: "GS6",
          professor: "Dr. D. S. Sharma",
          courseCode: "CS301",
        },
      ],
    });
    timetableApi.confirmTimetable.mockResolvedValue({ success: true });

    render(
      <WeeklyTimetableModal isOpen={true} onClose={vi.fn()} onTimetableChanged={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.queryByText(/Loading your weekly timetable/i)).not.toBeInTheDocument();
    });

    // Switch to Monday
    fireEvent.click(screen.getByRole("button", { name: /Monday/i }));

    await waitFor(() => {
      expect(screen.getByText("Compiler Design")).toBeInTheDocument();
    });

    // Click Edit button
    fireEvent.click(screen.getByTitle("Edit class"));

    // Change subject name
    const subjectInput = screen.getByDisplayValue("Compiler Design");
    fireEvent.change(subjectInput, { target: { value: "Advanced Compilers" } });

    // Click Save Changes
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(timetableApi.confirmTimetable).toHaveBeenCalledWith(
        expect.objectContaining({
          classes: expect.arrayContaining([
            expect.objectContaining({
              subjectName: "Advanced Compilers",
            }),
          ]),
        })
      );
    });
  });

  it("allows deleting a class with confirmation", async () => {
    console.log("TRACE [WeeklyTimetableModal.test.jsx]: Testing deleting a class");

    timetableApi.fetchTimetable.mockResolvedValue({
      branch: "CSE",
      semester: 4,
      section: "A1",
      classes: [
        {
          day: "Monday",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "10:00",
          subjectName: "Old Class",
          classType: "Lecture",
          location: "GS6",
        },
      ],
    });
    timetableApi.confirmTimetable.mockResolvedValue({ success: true });

    render(
      <WeeklyTimetableModal isOpen={true} onClose={vi.fn()} onTimetableChanged={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.queryByText(/Loading your weekly timetable/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Monday/i }));

    await waitFor(() => {
      expect(screen.getByText("Old Class")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Delete class"));

    // Custom confirmation modal appears
    expect(screen.getByText("Remove Class?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Remove Class/i }));

    await waitFor(() => {
      expect(timetableApi.confirmTimetable).toHaveBeenCalledWith(
        expect.objectContaining({
          classes: [],
        })
      );
    });
  });

  it("renders consistent centered empty state for days with no classes scheduled", async () => {
    console.log("TRACE [WeeklyTimetableModal.test.jsx]: Testing centered empty state for day with no classes");

    timetableApi.fetchTimetable.mockResolvedValue({
      branch: "CSE",
      semester: 4,
      section: "A1",
      classes: [],
    });

    render(
      <WeeklyTimetableModal isOpen={true} onClose={vi.fn()} onTimetableChanged={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText(/No classes scheduled on/i)).toBeInTheDocument();
      expect(screen.getByText(/event_available/i)).toBeInTheDocument();
      expect(screen.getByText(/to add a lecture or lab/i)).toBeInTheDocument();
    });
  });
});
