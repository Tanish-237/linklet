import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import GlobalSearch from "../Resource";
import { apiClient } from "../../api/apiClient";
import useAuthStore from "../../store/useAuthStore";

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../store/useAuthStore", () => ({
  default: vi.fn(),
}));

describe("GlobalSearch / Resource Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.mockReturnValue({
      user: { _id: "user123", username: "alex", fullName: "Alex Smith" },
    });
    apiClient.get.mockImplementation((url) => {
      if (url.includes("/resources/stats")) {
        return Promise.resolve({
          data: {
            data: {
              total: 5,
              categories: { all: 5, notes: 3, assignments: 2, papers: 0, presentations: 0, other: 0 },
            },
          },
        });
      }
      if (url.includes("/resources")) {
        return Promise.resolve({
          data: {
            data: [],
            pagination: { page: 1, totalPages: 1 },
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  const renderComponent = () => {
    return render(
      <HelmetProvider>
        <BrowserRouter>
          <GlobalSearch />
        </BrowserRouter>
      </HelmetProvider>
    );
  };

  it("renders upload button with modernized styling class and opens upload modal", async () => {
    console.log("TRACE [Resource.test.jsx]: Rendering GlobalSearch component");
    renderComponent();

    const uploadBtn = await screen.findByRole("button", { name: /upload_file\s*Share/i });
    console.log("TRACE [Resource.test.jsx]: Verified upload button rendered");
    expect(uploadBtn).toBeInTheDocument();
    expect(uploadBtn).toHaveClass("gs-btn-upload");

    fireEvent.click(uploadBtn);
    console.log("TRACE [Resource.test.jsx]: Clicked upload button, verifying modal opens");

    await waitFor(() => {
      const modalTitle = document.querySelector(".gs-modal-title");
      console.log("TRACE [Resource.test.jsx]: Found modalTitle:", modalTitle?.textContent);
      expect(modalTitle).toBeInTheDocument();
      const submitBtn = document.querySelector(".gs-btn-primary.gs-submit-btn");
      console.log("TRACE [Resource.test.jsx]: Found submitBtn:", submitBtn?.className);
      expect(submitBtn).toBeInTheDocument();
      expect(submitBtn).toHaveClass("gs-btn-primary");
    });
    console.log("TRACE [Resource.test.jsx]: Modal verified with solid primary action button");
  });
});
