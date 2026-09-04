import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import SubjectInfoModal from "../SubjectInfoModal";
import * as dashboardApi from "../../api/dashboard.api";

vi.mock("../../api/dashboard.api", () => ({
  fetchAttendance: vi.fn(),
  createAttendanceCourse: vi.fn(),
  updateAttendanceCourse: vi.fn(),
  deleteAttendanceCourse: vi.fn(),
}));

describe("SubjectInfoModal Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    console.log("TRACE [SubjectInfoModal.test.jsx]: Testing modal hidden when isOpen=false");
    const { container } = render(
      <SubjectInfoModal isOpen={false} onClose={vi.fn()} onSubjectsChanged={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("transitions cleanly from isOpen=false to isOpen=true without Rules of Hooks violation", async () => {
    console.log("TRACE [SubjectInfoModal.test.jsx]: Testing transition from false to true to verify hook order stability");
    dashboardApi.fetchAttendance.mockResolvedValue({ courses: [] });

    const { rerender } = render(
      <SubjectInfoModal isOpen={false} onClose={vi.fn()} onSubjectsChanged={vi.fn()} />
    );

    // Re-render with isOpen=true
    rerender(
      <SubjectInfoModal isOpen={true} onClose={vi.fn()} onSubjectsChanged={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Enrolled Subjects/i)).toBeInTheDocument();
    });

    // Re-render back to isOpen=false
    rerender(
      <SubjectInfoModal isOpen={false} onClose={vi.fn()} onSubjectsChanged={vi.fn()} />
    );

    expect(screen.queryByText(/Enrolled Subjects/i)).not.toBeInTheDocument();
  });

  it("renders enrolled subjects list with professor without credits or attendance percentages", async () => {
    console.log("TRACE [SubjectInfoModal.test.jsx]: Testing subjects rendering with prof and no credits/attendance");

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: [
        {
          _id: "c1",
          courseName: "Compiler Design",
          courseCode: "CS301",
          professor: "Dr. D. S. Sharma",
          stats: { percentage: 85, present: 17, total: 20 },
        },
      ],
    });

    render(
      <SubjectInfoModal isOpen={true} onClose={vi.fn()} onSubjectsChanged={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText("Compiler Design")).toBeInTheDocument();
      expect(screen.getByText("CS301")).toBeInTheDocument();
      expect(screen.getByText("Dr. D. S. Sharma")).toBeInTheDocument();
      expect(screen.queryByText(/Credits/i)).toBeNull();
      expect(screen.queryByText(/85% attendance/i)).toBeNull();
    });
  });

  it("allows editing an existing subject without displaying ID or credits and submits updates", async () => {
    console.log("TRACE [SubjectInfoModal.test.jsx]: Testing inline editing flow without ID");

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: [
        {
          _id: "c1",
          courseName: "Compiler Design",
          courseCode: "CS301",
          professor: "Dr. D. S. Sharma",
          credits: 4,
          targetPercentage: 75,
          stats: { percentage: 85, present: 17, total: 20 },
        },
      ],
    });

    dashboardApi.updateAttendanceCourse.mockResolvedValue({
      _id: "c1",
      courseName: "Advanced Compiler Design",
      courseCode: "CS301",
      professor: "Prof. D. S. Sharma",
      credits: 4,
    });

    const mockChanged = vi.fn();

    render(
      <SubjectInfoModal isOpen={true} onClose={vi.fn()} onSubjectsChanged={mockChanged} />
    );

    await waitFor(() => {
      expect(screen.getByText("Compiler Design")).toBeInTheDocument();
    });

    // Click Edit button
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    // Verify edit form is shown and ID is NOT displayed
    expect(screen.queryByText(/ID:/i)).toBeNull();
    const nameInput = screen.getByDisplayValue("Compiler Design");
    fireEvent.change(nameInput, { target: { value: "Advanced Compiler Design" } });

    // Submit edit form
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(dashboardApi.updateAttendanceCourse).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          courseName: "Advanced Compiler Design",
        })
      );
      expect(mockChanged).toHaveBeenCalled();
    });
  });

  it("allows adding a new subject and triggers onSubjectsChanged callback", async () => {
    console.log("TRACE [SubjectInfoModal.test.jsx]: Testing add new subject flow");

    dashboardApi.fetchAttendance.mockResolvedValue({ courses: [] });
    dashboardApi.createAttendanceCourse.mockResolvedValue({
      _id: "c2",
      courseName: "Computer Networks",
      courseCode: "CS302",
      professor: "Dr. R. K. Singh",
      credits: 4,
    });

    const mockChanged = vi.fn();

    render(
      <SubjectInfoModal isOpen={true} onClose={vi.fn()} onSubjectsChanged={mockChanged} />
    );

    await waitFor(() => {
      expect(screen.getByText("No subjects added yet")).toBeInTheDocument();
    });

    // Open Add Form
    fireEvent.click(screen.getByRole("button", { name: /add new subject/i }));

    // Fill form
    fireEvent.change(screen.getByPlaceholderText("e.g. Compiler Design"), {
      target: { value: "Computer Networks" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. CS301"), {
      target: { value: "CS302" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. Dr. D. S. Sharma"), {
      target: { value: "Dr. R. K. Singh" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /^add subject$/i }));

    await waitFor(() => {
      expect(dashboardApi.createAttendanceCourse).toHaveBeenCalledWith(
        expect.objectContaining({
          courseName: "Computer Networks",
          courseCode: "CS302",
          professor: "Dr. R. K. Singh",
        })
      );
      expect(mockChanged).toHaveBeenCalled();
    });
  });

  it("allows deleting a subject with confirmation", async () => {
    console.log("TRACE [SubjectInfoModal.test.jsx]: Testing delete subject flow with window.confirm");

    dashboardApi.fetchAttendance.mockResolvedValue({
      courses: [
        {
          _id: "c1",
          courseName: "Compiler Design",
          courseCode: "CS301",
          professor: "Dr. D. S. Sharma",
          credits: 4,
          stats: { percentage: 85, present: 17, total: 20 },
        },
      ],
    });
    dashboardApi.deleteAttendanceCourse.mockResolvedValue({ success: true });

    const mockChanged = vi.fn();

    render(
      <SubjectInfoModal isOpen={true} onClose={vi.fn()} onSubjectsChanged={mockChanged} />
    );

    await waitFor(() => {
      expect(screen.getByText("Compiler Design")).toBeInTheDocument();
    });

    // Click delete button
    fireEvent.click(screen.getByLabelText("Delete Compiler Design"));

    // Custom confirmation modal appears
    expect(screen.getByText("Delete Subject?")).toBeInTheDocument();
    expect(screen.getByText(/All associated attendance logs/i)).toBeInTheDocument();

    // Confirm permanent deletion
    fireEvent.click(screen.getByRole("button", { name: /Delete Permanently/i }));

    await waitFor(() => {
      expect(dashboardApi.deleteAttendanceCourse).toHaveBeenCalledWith("c1");
      expect(mockChanged).toHaveBeenCalled();
    });
  });
});
