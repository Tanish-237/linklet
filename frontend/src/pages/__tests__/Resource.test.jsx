import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import GlobalSearch from "../Resource";
import { apiClient } from "../../api/apiClient";
import useAuthStore from "../../store/useAuthStore";

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
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
              categories: { all: 5, notes: 3, assignments: 2, papers: 0, books: 0, lectures: 0, other: 0 },
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
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <HelmetProvider>
          <BrowserRouter>
            <GlobalSearch />
          </BrowserRouter>
        </HelmetProvider>
      </QueryClientProvider>
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

  it("renders load more button when hasNextPage is true and loads page 2 on click", async () => {
    console.log("TRACE [Resource.test.jsx]: Testing pagination load more button");
    apiClient.get.mockImplementation((url, config) => {
      if (url.includes("/resources/stats")) {
        return Promise.resolve({
          data: {
            data: {
              total: 20,
              categories: { all: 20, notes: 10, assignments: 10, papers: 0, books: 0, lectures: 0, other: 0 },
            },
          },
        });
      }
      if (url.includes("/resources/library")) {
        const page = config?.params?.page || 1;
        if (page === 2) {
          return Promise.resolve({
            data: {
              data: [
                {
                  _id: "res2",
                  title: "Advanced Data Structures",
                  subject: "Computer Science",
                  category: "notes",
                  fileType: "pdf",
                  fileUrl: "https://example.com/ds.pdf",
                  user: { _id: "user999", username: "bob" },
                },
              ],
              pagination: { page: 2, totalPages: 2, totalDocs: 2, hasNextPage: false },
            },
          });
        }
        return Promise.resolve({
          data: {
            data: [
              {
                _id: "res1",
                title: "Intro to Algorithms",
                subject: "Computer Science",
                category: "notes",
                fileType: "pdf",
                fileUrl: "https://example.com/algo.pdf",
                user: { _id: "user123", username: "alex" },
              },
            ],
            pagination: { page: 1, totalPages: 2, totalDocs: 2, hasNextPage: true },
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderComponent();

    const loadMoreBtn = await screen.findByRole("button", { name: /load more/i });
    expect(loadMoreBtn).toBeInTheDocument();
    console.log("TRACE [Resource.test.jsx]: Found Load More button");

    fireEvent.click(loadMoreBtn);

    await waitFor(() => {
      expect(screen.getByText("Advanced Data Structures")).toBeInTheDocument();
    });
    console.log("TRACE [Resource.test.jsx]: Verified page 2 resource loaded and appended");
  });

  it("downloads during the tap itself, without waiting for the download counter (phones drop late downloads)", async () => {
    apiClient.get.mockImplementation((url) => {
      if (url.includes("/resources/library")) {
        return Promise.resolve({
          data: {
            data: [
              {
                _id: "res1",
                title: "DBMS Unit 3",
                category: "notes",
                fileType: "xlsx",
                fileUrl: "https://res.cloudinary.com/demo/raw/upload/v1/document-1.xlsx",
                fileSize: 2516582,
                downloadsCount: 7,
                user: { _id: "user999", username: "bob" },
              },
            ],
            pagination: { page: 1, totalPages: 1, totalDocs: 1, hasNextPage: false },
          },
        });
      }
      if (url.includes("/resources/stats")) {
        return Promise.resolve({ data: { data: { total: 1, categories: { all: 1, notes: 1 } } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
    apiClient.patch.mockReturnValue(new Promise(() => {})); // counter never answers
    const clicked = [];
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      clicked.push(this.href);
    });

    renderComponent();
    await screen.findByText("DBMS Unit 3");

    // File size sits immediately left of the download count.
    const size = screen.getByTitle("File size");
    expect(size).toHaveTextContent("2.4 MB");
    expect(size.nextElementSibling).toHaveTextContent(/download\s*7/);
    fireEvent.click(screen.getAllByRole("button", { name: /download/i }).find((b) => /Download$/.test(b.textContent.trim())));

    expect(clicked).toEqual(["https://res.cloudinary.com/demo/raw/upload/fl_attachment:DBMS_Unit_3/v1/document-1.xlsx"]);
    expect(apiClient.patch).toHaveBeenCalledWith("/resources/res1/download");
    clickSpy.mockRestore();
  });
});
