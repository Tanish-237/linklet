import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Saved from "../Saved";
import { apiClient } from "../../api/apiClient";
import * as collectionApi from "../../api/collection.api";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { _id: "user1", username: "currentuser" },
  }),
}));

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../api/collection.api", () => ({
  getCollections: vi.fn(),
  createCollection: vi.fn(),
  deleteCollection: vi.fn(),
  toggleResourceInCollection: vi.fn(),
}));

const fakeLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
globalThis.localStorage = fakeLocalStorage;

describe("Saved Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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
      expect(screen.getByText("Your Collections")).toBeInTheDocument();
      console.log("[TEST] Saved Page › renders collection grid for own profile");
      expect(screen.getByText("Saved Posts")).toBeInTheDocument();
      expect(screen.getByText("Saved Resources")).toBeInTheDocument();
      expect(screen.getByText("1 resource")).toBeInTheDocument();
      expect(screen.getByText("Design Assets")).toBeInTheDocument();
      expect(screen.getByText("0 resources")).toBeInTheDocument();
    });
  });

  it("renders Starred Chat Media collection card and opens gallery view", async () => {
    apiClient.get.mockResolvedValue({ data: { data: [] } });
    collectionApi.getCollections.mockResolvedValue([]);

    const mockMedia = [
      {
        _id: "m_star1",
        chatId: "chat_99",
        chatName: "Angel",
        mediaType: "image",
        media: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        createdAt: new Date().toISOString(),
      },
    ];
    localStorage.setItem("linklet_starred_chat_media_user1", JSON.stringify(mockMedia));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Starred Chat Media")).toBeInTheDocument();
      expect(screen.getByText("1 item")).toBeInTheDocument();
    });

    // Click into Starred Chat Media collection
    fireEvent.click(screen.getByText("Starred Chat Media"));

    await waitFor(() => {
      expect(screen.getByText("Angel")).toBeInTheDocument();
      expect(screen.getByText("Go to message")).toBeInTheDocument();
    });

    // Clicking on the media card opens the preview lightbox
    const mediaCard = screen.getByText("Angel").closest(".bm-chat-media-card");
    expect(mediaCard).toBeInTheDocument();
    fireEvent.click(mediaCard);

    await waitFor(() => {
      // Lightbox preview modal should now be rendered
      expect(screen.getByText("Go to Message")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /Unstar/i }).length).toBeGreaterThanOrEqual(1);
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
      expect(collectionApi.getCollections).not.toHaveBeenCalled();
    });
  });
});
