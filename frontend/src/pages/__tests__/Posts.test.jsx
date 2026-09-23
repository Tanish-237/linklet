import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { mockAllIsIntersecting } from "react-intersection-observer/test-utils";

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({ user: { _id: "u-me", username: "me", role: "user", avatar: "" } })),
}));

vi.mock("../../api/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../api/post.api", () => ({
  getFeed: vi.fn(),
  deletePost: vi.fn(),
}));

// The detail modal (and its comments panel) is covered by its own tests.
vi.mock("../../components/PostDetailModal", () => ({ default: () => null }));

// jsdom can't do real layout (every element measures 0x0), so the real
// virtualizer would think nothing fits on screen and render an empty list.
// This stub renders every item, like the library does once it can actually
// measure a real viewport in a browser — the library's own measurement
// logic isn't this app's code to test.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 100, size: 100 })),
    getTotalSize: () => count * 100,
    measureElement: () => {},
  }),
}));

import { apiClient } from "../../api/apiClient";
import { getFeed } from "../../api/post.api";
import Posts from "../Posts";

const post = (n, extra = {}) => ({
  _id: `post${n}`,
  caption: `caption ${n}`,
  image: "",
  upvotes: [],
  downvotes: [],
  commentsCount: 0,
  createdAt: new Date(2025, 0, 30 - n).toISOString(),
  userId: { _id: "u-author", username: "author", avatar: "" },
  ...extra,
});

const renderPosts = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <Posts />
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

describe("Posts feed page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockImplementation((url) =>
      url === "/profile/me/bookmark-ids"
        ? Promise.resolve({ data: { data: ["post2"] } })
        : Promise.resolve({ data: { data: [] } })
    );
  });

  it("renders the first page and shows each card's comment count (from commentsCount, not a comments array)", async () => {
    console.log("TRACE [Posts.test]: first page + commentsCount");
    getFeed.mockResolvedValueOnce({
      data: [post(1, { commentsCount: 7 }), post(2)],
      hasMore: false,
      nextCursor: null,
    });
    renderPosts();

    expect(await screen.findByText("caption 1")).toBeInTheDocument();
    expect(screen.getByText("caption 2")).toBeInTheDocument();
    expect(screen.getByText("7")).toHaveClass("feed-card__comment-count");
    expect(getFeed).toHaveBeenCalledTimes(1);
  });

  it("loads the next page when the end of the list scrolls into view, using the cursor", async () => {
    console.log("TRACE [Posts.test]: infinite scroll fetches page 2");
    getFeed
      .mockResolvedValueOnce({ data: [post(1)], hasMore: true, nextCursor: "CURSOR-1" })
      .mockResolvedValueOnce({ data: [post(2)], hasMore: false, nextCursor: null });
    renderPosts();
    await screen.findByText("caption 1");

    mockAllIsIntersecting(true);

    expect(await screen.findByText("caption 2")).toBeInTheDocument();
    expect(getFeed).toHaveBeenCalledTimes(2);
    expect(getFeed.mock.calls[1][0].pageParam).toBe("CURSOR-1");
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
  });

  it("does not request another page when the API says there are no more", async () => {
    getFeed.mockResolvedValueOnce({ data: [post(1)], hasMore: false, nextCursor: null });
    renderPosts();
    await screen.findByText("caption 1");

    mockAllIsIntersecting(true);
    await waitFor(() => expect(screen.getByText(/all caught up/i)).toBeInTheDocument());

    expect(getFeed).toHaveBeenCalledTimes(1);
  });

  it("never shows the same post twice even if two pages overlap", async () => {
    getFeed
      .mockResolvedValueOnce({ data: [post(1), post(2)], hasMore: true, nextCursor: "C" })
      .mockResolvedValueOnce({ data: [post(2), post(3)], hasMore: false, nextCursor: null });
    renderPosts();
    await screen.findByText("caption 1");

    mockAllIsIntersecting(true);
    await screen.findByText("caption 3");

    expect(screen.getAllByText("caption 2")).toHaveLength(1);
  });

  it("shows the friendly empty state when the campus feed has no posts", async () => {
    getFeed.mockResolvedValueOnce({ data: [], hasMore: false, nextCursor: null });
    renderPosts();
    expect(await screen.findByText(/your feed is empty/i)).toBeInTheDocument();
  });

  it("uses the lightweight bookmark-ids endpoint (not the fully populated bookmarks list)", async () => {
    console.log("TRACE [Posts.test]: bookmark ids endpoint");
    getFeed.mockResolvedValueOnce({ data: [post(1), post(2)], hasMore: false, nextCursor: null });
    renderPosts();
    await screen.findByText("caption 1");

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith("/profile/me/bookmark-ids"));
    expect(apiClient.get).not.toHaveBeenCalledWith("/profile/me/bookmarks");
  });
});
