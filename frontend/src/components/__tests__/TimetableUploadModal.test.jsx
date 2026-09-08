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

  it("renders upload dropzone without verbose How It Works section when open", () => {
    console.log("TRACE [TimetableUploadModal.test.jsx]: Testing visible upload state");
    render(
      <TimetableUploadModal isOpen={true} onClose={vi.fn()} userSection="A1" />
    );
    expect(screen.getByText(/Import Timetable/i)).toBeInTheDocument();
    expect(screen.queryByText(/How It Works/i)).toBeNull();
    expect(screen.getByText(/AI scans your official timetable/i)).toBeInTheDocument();
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

    // Click "Re-upload Timetable"
    const reUploadBtn = screen.getByRole("button", { name: /Re-upload/i });
    fireEvent.click(reUploadBtn);

    // Should be back to upload state
    expect(screen.getByText(/Import Timetable/i)).toBeInTheDocument();
    expect(screen.queryByText(/How It Works/i)).toBeNull();
    expect(screen.getByText(/AI scans your official timetable/i)).toBeInTheDocument();

    console.log("TRACE [TimetableUploadModal.test.jsx]: Re-upload flow verified");
  });

  it("allows uploading an image file (PNG/JPG/WEBP) and extracting schedule", async () => {
    console.log("TRACE [TimetableUploadModal.test.jsx]: Testing timetable image upload support");

    timetableApi.uploadTimetablePdf.mockResolvedValue({
      success: true,
      message: "Extracted 4 classes from timetable image",
      data: {
        branch: "ECE",
        semester: 4,
        targetSection: "B",
        totalExtracted: 20,
        totalClassesFound: 4,
        attendanceSubjects: ["Signals & Systems"],
        classes: [
          {
            day: "Monday",
            dayOfWeek: 1,
            startTime: "10:00",
            endTime: "11:00",
            subjectName: "Signals & Systems",
            classType: "Lecture",
            location: "LT2",
            professor: "Dr. Sharma",
            courseCode: "ECN14101",
          },
        ],
      },
    });

    render(
      <TimetableUploadModal isOpen={true} onClose={vi.fn()} userSection="B" />
    );

    const fileInput = document.getElementById("timetable-file-input");
    const imageFile = new File(["fake_png_data"], "timetable_sem4.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [imageFile] } });

    // Ensure selected image file name is displayed
    expect(screen.getByText("timetable_sem4.png")).toBeInTheDocument();

    const scanBtn = screen.getByRole("button", { name: /Scan & Extract/i });
    fireEvent.click(scanBtn);

    await waitFor(() => {
      expect(timetableApi.uploadTimetablePdf).toHaveBeenCalled();
      expect(screen.getByText("Verify Extracted Classes")).toBeInTheDocument();
      expect(screen.getAllByText("Signals & Systems").length).toBeGreaterThanOrEqual(1);
    });

    console.log("TRACE [TimetableUploadModal.test.jsx]: Image upload parsed and verified successfully");
  });

  it("renders reset warning banner and confirms timetable with wipeExisting: true", async () => {
    console.log("TRACE [TimetableUploadModal.test.jsx]: Testing reset warning banner and wipeExisting flag");

    timetableApi.uploadTimetablePdf.mockResolvedValue({
      success: true,
      message: "Extracted 2 classes",
      data: {
        branch: "CSE",
        semester: 5,
        targetSection: "A1",
        totalExtracted: 2,
        totalClassesFound: 2,
        attendanceSubjects: ["OS"],
        classes: [
          { day: "Monday", dayOfWeek: 1, startTime: "09:00", endTime: "10:00", subjectName: "OS", classType: "Lecture" },
        ],
      },
    });
    timetableApi.confirmTimetable.mockResolvedValue({ success: true, message: "Timetable synced!" });

    render(
      <TimetableUploadModal isOpen={true} onClose={vi.fn()} userSection="A1" />
    );

    // Verify warning banner exists in upload state
    expect(screen.getByText(/Schedule & Attendance Reset Notice/i)).toBeInTheDocument();
    expect(screen.getByText(/Uploading a new timetable will wipe your existing Daily Schedule/i)).toBeInTheDocument();

    // Upload and scan
    const fileInput = document.getElementById("timetable-file-input");
    fireEvent.change(fileInput, { target: { files: [new File(["%PDF"], "sample.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByRole("button", { name: /Scan & Extract/i }));

    await waitFor(() => {
      expect(screen.getByText("Verify Extracted Classes")).toBeInTheDocument();
      expect(screen.getByText(/Wipes previous schedule & attendance/i)).toBeInTheDocument();
    });

    // Confirm & sync
    fireEvent.click(screen.getByRole("button", { name: /Confirm & Sync/i }));

    await waitFor(() => {
      expect(timetableApi.confirmTimetable).toHaveBeenCalledWith(
        expect.objectContaining({
          wipeExisting: true,
          section: "A1",
        })
      );
    });
    console.log("TRACE [TimetableUploadModal.test.jsx]: confirmTimetable successfully invoked with wipeExisting: true");
  });

  it("renders Section & Sub-Section check notice with profile reminder", () => {
    console.log("TRACE [TimetableUploadModal.test.jsx]: Testing Section & Sub-Section check notice display");
    render(
      <TimetableUploadModal isOpen={true} onClose={vi.fn()} userSection="J" userSubSection="CE3" />
    );

    expect(screen.getByText(/Section & Sub-Section Check/i)).toBeInTheDocument();
    expect(screen.getByText("J")).toBeInTheDocument();
    expect(screen.getByText("CE3")).toBeInTheDocument();
    expect(screen.getByText(/Please make sure your section and sub-section are updated properly/i)).toBeInTheDocument();
  });
});
