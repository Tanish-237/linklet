import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import TimetableUploadModal from "../TimetableUploadModal";
import * as timetableApi from "../../api/timetable.api";

vi.mock("../../api/timetable.api", () => ({
  uploadTimetablePdf: vi.fn(),
  confirmTimetable: vi.fn(),
  fetchTimetable: vi.fn(),
  deleteTimetable: vi.fn(),
}));

describe("TimetableUploadModal Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    console.log("TRACE [TimetableUploadModal.test.jsx]: Testing hidden modal state");
    const { container } = render(
      <TimetableUploadModal isOpen={false} onClose={vi.fn()} userSection="A1" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders upload dropzone with How It Works section when open", () => {
    console.log("TRACE [TimetableUploadModal.test.jsx]: Testing visible upload state");
    render(
      <TimetableUploadModal isOpen={true} onClose={vi.fn()} userSection="A1" />
    );
    expect(screen.getByText(/Import Timetable/i)).toBeInTheDocument();
    expect(screen.getByText(/How It Works/i)).toBeInTheDocument();
    expect(screen.getAllByText(/A1/).length).toBeGreaterThanOrEqual(1);
  });

  it("displays error message when scan fails", async () => {
    console.log("TRACE [TimetableUploadModal.test.jsx]: Testing scan failure error display");

    timetableApi.uploadTimetablePdf.mockRejectedValue({
      response: { data: { message: "GEMINI_API_KEY is not configured." } },
    });

    render(
      <TimetableUploadModal isOpen={true} onClose={vi.fn()} userSection="A1" />
    );

    // Select a file
    const fileInput = document.getElementById("timetable-file-input");
    const mockFile = new File(["%PDF"], "timetable.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Click scan
    const scanBtn = screen.getByRole("button", { name: /Scan & Extract/i });
    fireEvent.click(scanBtn);

    await waitFor(() => {
      expect(screen.getByText(/Scan Failed/i)).toBeInTheDocument();
      expect(screen.getByText(/GEMINI_API_KEY is not configured/i)).toBeInTheDocument();
    });
  });

  it("allows re-upload from preview state", async () => {
    console.log("TRACE [TimetableUploadModal.test.jsx]: Testing re-upload flow");

    timetableApi.uploadTimetablePdf.mockResolvedValue({
      success: true,
      message: "Extracted 5 classes",
      data: {
        branch: "CSE", semester: 4, targetSection: "A1",
        totalExtracted: 30, totalClassesFound: 5,
        attendanceSubjects: ["OS", "DBMS"],
        classes: [
          { day: "Monday", dayOfWeek: 1, startTime: "09:00", endTime: "10:00", subjectName: "OS", classType: "Lecture", location: "GS6", professor: "Dr. X", courseCode: "CSN101" },
        ],
      },
    });

    render(
      <TimetableUploadModal isOpen={true} onClose={vi.fn()} userSection="A1" />
    );

    // Upload a file
    const fileInput = document.getElementById("timetable-file-input");
    fireEvent.change(fileInput, { target: { files: [new File(["%PDF"], "t.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByRole("button", { name: /Scan & Extract/i }));

    await waitFor(() => {
      expect(screen.getByText("Verify Extracted Classes")).toBeInTheDocument();
    });

    // Click "Re-upload Different PDF"
    const reUploadBtn = screen.getByRole("button", { name: /Re-upload Different PDF/i });
    fireEvent.click(reUploadBtn);

    // Should be back to upload state
    expect(screen.getByText(/Import Timetable/i)).toBeInTheDocument();
    expect(screen.getByText(/How It Works/i)).toBeInTheDocument();

    console.log("TRACE [TimetableUploadModal.test.jsx]: Re-upload flow verified");
  });
});
