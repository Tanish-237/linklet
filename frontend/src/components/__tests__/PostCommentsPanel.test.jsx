import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("../../api/post.api", () => ({
  getPostComments: vi.fn(),
  getCommentReplies: vi.fn(),
  addComment: vi.fn(),
  addReply: vi.fn(),
  toggleCommentUpvote: vi.fn(),
  deletePostComment: vi.fn(),
}));

// The emoji picker is lazy-loaded and irrelevant here.
vi.mock("emoji-picker-react", () => ({ default: () => <div data-testid="emoji-picker" /> }));

import * as postApi from "../../api/post.api";
import PostCommentsPanel from "../PostCommentsPanel";

const id = (n) => String(n).padStart(24, "0");
const author = (name, uid) => ({ _id: uid, username: name, avatar: "" });
const comment = (n, extra = {}) => ({
  _id: id(n),
  text: `comment ${n}`,
  userId: author("alice", "u-alice"),
  upvotes: [],
  replies: [],
  repliesCount: 0,
  createdAt: new Date().toISOString(),
  ...extra,
});

const me = { _id: "u-me", username: "me", role: "user" };
const admin = { _id: "u-admin", username: "root", role: "admin" };

const renderPanel = (props = {}) =>
  render(
    <PostCommentsPanel
      postId="post1"
      commentsCount={2}
      onCountChange={vi.fn()}
      user={me}
      onNavigateToProfile={vi.fn()}
      {...props}
    />
  );

describe("PostCommentsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  it("shows a loading state then the comments and the count in the header", async () => {
    console.log("TRACE [PostCommentsPanel.test]: loading → list");
    postApi.getPostComments.mockResolvedValueOnce({ data: [comment(1), comment(2)], hasMore: false, nextCursor: null });
    renderPanel();

    expect(screen.getByText(/Loading comments/i)).toBeInTheDocument();
    expect(await screen.findByText("comment 1")).toBeInTheDocument();
    expect(screen.getByText("comment 2")).toBeInTheDocument();
    expect(screen.getByText("2")).toHaveClass("feed-detail__comments-count");
  });

  it("shows the empty state when there are no comments", async () => {
    postApi.getPostComments.mockResolvedValueOnce({ data: [], hasMore: false, nextCursor: null });
    renderPanel({ commentsCount: 0 });
    expect(await screen.findByText(/No comments yet/i)).toBeInTheDocument();
  });

  it("shows an error with a working retry when the first page fails", async () => {
    console.log("TRACE [PostCommentsPanel.test]: error → retry → list");
    postApi.getPostComments.mockRejectedValueOnce(new Error("offline"));
    renderPanel();

    const retry = await screen.findByRole("button", { name: /try again/i });
    postApi.getPostComments.mockResolvedValueOnce({ data: [comment(1)], hasMore: false, nextCursor: null });
    fireEvent.click(retry);

    expect(await screen.findByText("comment 1")).toBeInTheDocument();
  });

  it("paginates: 'Load more comments' fetches the next page with the cursor", async () => {
    postApi.getPostComments
      .mockResolvedValueOnce({ data: [comment(1)], hasMore: true, nextCursor: id(1) })
      .mockResolvedValueOnce({ data: [comment(2)], hasMore: false, nextCursor: null });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /load more comments/i }));

    expect(await screen.findByText("comment 2")).toBeInTheDocument();
    expect(postApi.getPostComments).toHaveBeenLastCalledWith("post1", { cursor: id(1) });
    expect(screen.queryByRole("button", { name: /load more comments/i })).not.toBeInTheDocument();
  });

  it("shows the reply preview and a 'View N more replies' button that loads the rest", async () => {
    console.log("TRACE [PostCommentsPanel.test]: reply preview + expand");
    postApi.getPostComments.mockResolvedValueOnce({
      data: [
        comment(1, {
          replies: [{ _id: id(10), text: "first reply", userId: author("bob", "u-bob"), createdAt: new Date().toISOString() }],
          repliesCount: 3,
        }),
      ],
      hasMore: false,
      nextCursor: null,
    });
    postApi.getCommentReplies.mockResolvedValueOnce({
      data: [
        { _id: id(11), text: "second reply", userId: author("bob", "u-bob"), createdAt: new Date().toISOString() },
        { _id: id(12), text: "third reply", userId: author("bob", "u-bob"), createdAt: new Date().toISOString() },
      ],
      hasMore: false,
      nextCursor: null,
    });
    renderPanel();

    expect(await screen.findByText("first reply")).toBeInTheDocument();
    const more = screen.getByRole("button", { name: /view 2 more replies/i });
    fireEvent.click(more);

    expect(await screen.findByText("third reply")).toBeInTheDocument();
    expect(postApi.getCommentReplies).toHaveBeenCalledWith("post1", id(1), { cursor: id(10) });
    expect(screen.queryByRole("button", { name: /more repl/i })).not.toBeInTheDocument();
  });

  it("posts a new comment, clears the input and reports the new count", async () => {
    postApi.getPostComments.mockResolvedValueOnce({ data: [], hasMore: false, nextCursor: null });
    postApi.addComment.mockResolvedValueOnce({ comment: comment(5, { text: "brand new" }), commentsCount: 1 });
    const onCountChange = vi.fn();
    renderPanel({ onCountChange, commentsCount: 0 });
    await screen.findByText(/No comments yet/i);

    const input = screen.getByPlaceholderText(/add a comment/i);
    fireEvent.change(input, { target: { value: "brand new" } });
    fireEvent.click(screen.getByRole("button", { name: /send comment/i }));

    expect(await screen.findByText("brand new")).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(onCountChange).toHaveBeenCalledWith(1);
    expect(toast.success).toHaveBeenCalledWith("Comment added");
  });

  it("shows the server's message when posting a comment fails", async () => {
    postApi.getPostComments.mockResolvedValueOnce({ data: [], hasMore: false, nextCursor: null });
    postApi.addComment.mockRejectedValueOnce({ response: { data: { message: "Comment must be 2000 characters or fewer" } } });
    renderPanel();
    await screen.findByText(/No comments yet/i);

    fireEvent.change(screen.getByPlaceholderText(/add a comment/i), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: /send comment/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Comment must be 2000 characters or fewer")
    );
  });

  it("logged-out visitors can read but the composer is disabled", async () => {
    postApi.getPostComments.mockResolvedValueOnce({ data: [comment(1)], hasMore: false, nextCursor: null });
    renderPanel({ user: null });

    expect(await screen.findByText("comment 1")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/log in to comment/i)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Like$/ }));
    expect(toast.info).toHaveBeenCalledWith("Please log in to vote");
    expect(postApi.toggleCommentUpvote).not.toHaveBeenCalled();
  });

  it("replying sends the parent comment id and the @mention and shows the reply", async () => {
    postApi.getPostComments.mockResolvedValueOnce({ data: [comment(1)], hasMore: false, nextCursor: null });
    postApi.addReply.mockResolvedValueOnce({
      reply: { _id: id(20), text: "thanks!", replyToUsername: "alice", userId: author("me", "u-me"), createdAt: new Date().toISOString() },
      repliesCount: 1,
      commentsCount: 1,
    });
    renderPanel();
    await screen.findByText("comment 1");

    // Buttons are named "<icon ligature> <label>", e.g. "reply Reply".
    fireEvent.click(screen.getByRole("button", { name: /Reply$/ }));
    fireEvent.change(screen.getByPlaceholderText(/replying to @alice/i), { target: { value: "thanks!" } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" })); // the composer's submit button

    expect(await screen.findByText("thanks!")).toBeInTheDocument();
    expect(postApi.addReply).toHaveBeenCalledWith("post1", id(1), "thanks!", "alice");
  });

  it("replying to a reply nests the new reply under it (not under the top-level comment)", async () => {
    console.log("TRACE [PostCommentsPanel.test]: reply-to-a-reply nests one level deeper");
    postApi.getPostComments.mockResolvedValueOnce({
      data: [
        comment(1, {
          replies: [{ _id: id(10), text: "first reply", userId: author("bob", "u-bob"), createdAt: new Date().toISOString(), replies: [], repliesCount: 0 }],
          repliesCount: 1,
        }),
      ],
      hasMore: false,
      nextCursor: null,
    });
    postApi.addReply.mockResolvedValueOnce({
      reply: { _id: id(20), text: "nested!", replyToUsername: "bob", userId: author("me", "u-me"), createdAt: new Date().toISOString() },
      repliesCount: 1,
      commentsCount: 1,
    });
    renderPanel();
    await screen.findByText("first reply");

    // Reply to the reply itself, not the top-level comment.
    const replyButtons = screen.getAllByRole("button", { name: /Reply$/ });
    fireEvent.click(replyButtons[replyButtons.length - 1]);
    fireEvent.change(screen.getByPlaceholderText(/replying to @bob/i), { target: { value: "nested!" } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    expect(await screen.findByText("nested!")).toBeInTheDocument();
    expect(postApi.addReply).toHaveBeenCalledWith("post1", id(10), "nested!", "bob");
  });

  it("likes a comment and shows the returned like count", async () => {
    postApi.getPostComments.mockResolvedValueOnce({ data: [comment(1)], hasMore: false, nextCursor: null });
    postApi.toggleCommentUpvote.mockResolvedValueOnce({ _id: id(1), upvotes: ["u-me"] });
    renderPanel();
    await screen.findByText("comment 1");

    fireEvent.click(screen.getByRole("button", { name: /Like$/ }));

    expect(await screen.findByRole("button", { name: /1$/ })).toHaveClass("liked");
  });

  it("only offers Delete on your own comments (and on everything for an admin)", async () => {
    console.log("TRACE [PostCommentsPanel.test]: delete visibility by role");
    const data = [
      comment(1, { userId: author("me", "u-me") }),
      comment(2, { userId: author("alice", "u-alice") }),
    ];
    postApi.getPostComments.mockResolvedValue({ data, hasMore: false, nextCursor: null });

    const { unmount } = renderPanel({ user: me });
    await screen.findByText("comment 1");
    expect(screen.getAllByRole("button", { name: /delete comment by/i })).toHaveLength(1);
    unmount();

    renderPanel({ user: admin });
    await screen.findByText("comment 1");
    expect(screen.getAllByRole("button", { name: /delete comment by/i })).toHaveLength(2);
  });

  it("deleting a comment asks for confirmation, removes it and reports the count", async () => {
    postApi.getPostComments.mockResolvedValueOnce({
      data: [comment(1, { userId: author("me", "u-me") }), comment(2)],
      hasMore: false,
      nextCursor: null,
    });
    postApi.deletePostComment.mockResolvedValueOnce({ deletedIds: [id(1)], commentsCount: 1 });
    const onCountChange = vi.fn();
    renderPanel({ onCountChange });
    await screen.findByText("comment 1");

    fireEvent.click(screen.getByRole("button", { name: /delete comment by/i }));

    await waitFor(() => expect(screen.queryByText("comment 1")).not.toBeInTheDocument());
    expect(window.confirm).toHaveBeenCalled();
    expect(onCountChange).toHaveBeenCalledWith(1);
    expect(screen.getByText("comment 2")).toBeInTheDocument();
  });

  it("does nothing when the user cancels the delete confirmation", async () => {
    window.confirm = vi.fn(() => false);
    postApi.getPostComments.mockResolvedValueOnce({
      data: [comment(1, { userId: author("me", "u-me") })],
      hasMore: false,
      nextCursor: null,
    });
    renderPanel();
    await screen.findByText("comment 1");

    fireEvent.click(screen.getByRole("button", { name: /delete comment by/i }));

    expect(postApi.deletePostComment).not.toHaveBeenCalled();
    expect(screen.getByText("comment 1")).toBeInTheDocument();
  });

  it("clicking an author name navigates to their profile", async () => {
    postApi.getPostComments.mockResolvedValueOnce({ data: [comment(1)], hasMore: false, nextCursor: null });
    const onNavigateToProfile = vi.fn();
    renderPanel({ onNavigateToProfile });
    await screen.findByText("comment 1");

    fireEvent.click(screen.getByText("alice"));
    expect(onNavigateToProfile).toHaveBeenCalledWith("alice");
  });
});
