import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Saved from "../Saved";
import { apiClient } from "../../api/apiClient";
import * as collectionApi from "../../api/collection.api";

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("../../api/collection.api", () => ({
  getCollections: vi.fn(),
  createCollection: vi.fn(),
  deleteCollection: vi.fn(),
  toggleResourceInCollection: vi.fn(),
}));

describe("Saved Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <HelmetProvider>
        <BrowserRouter>
          <Saved {...props} />
        </BrowserRouter>
      </HelmetProvider>
    );
  };

  it("renders collection grid for own profile", async () => {
    apiClient.get.mockResolvedValue({ data: { data: [{ _id: "r1", title: "Resource 1" }] } });
    collectionApi.getCollections.mockResolvedValue([
      { _id: "c1", name: "Design Assets", coverColor: "#ff0000", resources: [] },
    ]);

    renderComponent();

    await waitFor(() => {
      // Should show the title for collections
      expect(screen.getByText("Your Collections")).toBeInTheDocument();
      // Should show default Saved Posts and Saved Resources cards
      console.log("[TEST] Saved Page › renders collection grid for own profile");
      expect(screen.getByText("Saved Posts")).toBeInTheDocument();
      expect(screen.getByText("Saved Resources")).toBeInTheDocument();
      expect(screen.getByText("1 resource")).toBeInTheDocument(); // Saved resources count
      // Should show fetched collections
      expect(screen.getByText("Design Assets")).toBeInTheDocument();
      expect(screen.getByText("0 resources")).toBeInTheDocument();
    });
  });

  it("renders flat list for another user's profile", async () => {
    apiClient.get.mockResolvedValue({
      data: { data: [{ _id: "r2", title: "Public Resource", fileType: "pdf", category: "Notes" }] },
    });

    renderComponent({ username: "johndoe" });

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/profile/johndoe/bookmarks");
      expect(screen.getByText("Public Resource")).toBeInTheDocument();
      // Should NOT fetch collections
      expect(collectionApi.getCollections).not.toHaveBeenCalled();
    });
  });
});
