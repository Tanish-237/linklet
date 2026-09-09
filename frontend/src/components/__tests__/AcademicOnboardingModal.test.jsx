import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AcademicOnboardingModal from "../AcademicOnboardingModal";
import { apiClient } from "../../api/apiClient";
import useAuthStore from "../../store/useAuthStore";
import { toast } from "react-toastify";

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    put: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: useAuthStore.getState().user,
    setUser: vi.fn(),
  }),
}));

describe("AcademicOnboardingModal Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
    });
  });

  it("does not render when user is not logged in", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] AcademicOnboardingModal › unauthenticated user");

    render(<AcademicOnboardingModal />);

    expect(screen.queryByText("Complete Your Academic Profile")).not.toBeInTheDocument();
    console.log("[TEST] Confirmed modal is hidden for guest/logged-out user");
  });

  it("does not render when user already has department set", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] AcademicOnboardingModal › user with existing department");

    useAuthStore.setState({
      user: {
        _id: "u1",
        fullName: "Existing Student",
        department: "Computer Science and Engineering",
        year: "Second",
      },
      isAuthenticated: true,
    });

    render(<AcademicOnboardingModal />);

    expect(screen.queryByText("Complete Your Academic Profile")).not.toBeInTheDocument();
    console.log("[TEST] Confirmed modal is hidden when user already has department");
  });

  it("renders when user is logged in and department is missing", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] AcademicOnboardingModal › user with missing department");

    useAuthStore.setState({
      user: {
        _id: "u2",
        fullName: "Google Student",
        email: "20235001@mnnit.ac.in",
        department: "",
        year: "Second",
        semester: 4,
      },
      isAuthenticated: true,
    });

    render(<AcademicOnboardingModal />);

    expect(screen.getByText("Complete Your Academic Profile")).toBeInTheDocument();
    expect(screen.getByLabelText(/Branch \/ Department/i)).toBeInTheDocument();
    expect(screen.getByText(/Auto-detected:/i)).toBeInTheDocument();
    console.log("[TEST] Confirmed modal displays for student with missing department");
  });

  it("closes and sets sessionStorage flag when 'Skip for now' is clicked", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] AcademicOnboardingModal › skip for now action");

    useAuthStore.setState({
      user: {
        _id: "u2",
        department: "",
      },
      isAuthenticated: true,
    });

    render(<AcademicOnboardingModal />);

    const skipBtn = screen.getByRole("button", { name: /Skip for now/i });
    fireEvent.click(skipBtn);

    expect(sessionStorage.getItem("linklet_onboarding_skipped")).toBe("true");
    expect(screen.queryByText("Complete Your Academic Profile")).not.toBeInTheDocument();
    console.log("[TEST] Confirmed modal dismissed and session flag set");
  });

  it("saves academic profile and updates user store on submission", async () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] AcademicOnboardingModal › submit academic profile");

    useAuthStore.setState({
      user: {
        _id: "u3",
        fullName: "Aman Verma",
        department: "",
      },
      isAuthenticated: true,
    });

    const updatedUser = {
      _id: "u3",
      fullName: "Aman Verma",
      department: "Computer Science and Engineering",
      section: "D",
      subSection: "DF5",
    };

    apiClient.put.mockResolvedValueOnce({
      status: 200,
      data: { success: true, data: updatedUser },
    });

    render(<AcademicOnboardingModal />);

    const branchSelect = screen.getByLabelText(/Branch \/ Department/i);
    const sectionInput = screen.getByLabelText(/Class Section/i);
    const subSectionInput = screen.getByLabelText(/Sub-Section/i);

    fireEvent.change(branchSelect, { target: { value: "Computer Science and Engineering" } });
    fireEvent.change(sectionInput, { target: { value: "d" } });
    fireEvent.change(subSectionInput, { target: { value: "df5" } });

    const saveBtn = screen.getByRole("button", { name: /Save & Continue/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        "/profile/edit",
        expect.any(FormData),
        expect.objectContaining({
          headers: { "Content-Type": "multipart/form-data" },
        })
      );
    });

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("saved"));
    expect(useAuthStore.getState().user?.department).toBe("Computer Science and Engineering");
    expect(screen.queryByText("Complete Your Academic Profile")).not.toBeInTheDocument();
    console.log("[TEST] Confirmed academic profile saved and store updated successfully");
  });
});
