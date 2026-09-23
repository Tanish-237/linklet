import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("../../api/post.api", () => ({
  getPostComments: vi.fn(),
  getCommentReplies: vi.fn(),
  addComment: vi.fn(),
  addReply: vi.fn(),
  toggleCommentUpvote: vi.fn(),
  deletePostComment: vi.fn(),
}));

import * as postApi from "../../api/post.api";
import usePostComments from "../usePostComments";

// ObjectId-like ids: fixed length, so string order == creation order.
const id = (n) => String(n).padStart(24, "0");
const comment = (n, extra = {}) => ({
  _id: id(n),
  text: `c${n}`,
  userId: { _id: "u1", username: "alice" },
  upvotes: [],
  replies: [],
  repliesCount: 0,
  ...extra,
});
const reply = (n) => ({ _id: id(n), text: `r${n}`, userId: { _id: "u2", username: "bob" } });

describe("usePostComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the first page of comments on mount", async () => {
    console.log("TRACE [usePostComments.test]: first page load");
    postApi.getPostComments.mockResolvedValueOnce({ data: [comment(1), comment(2)], hasMore: true, nextCursor: id(2) });

    const { result } = renderHook(() => usePostComments("post1"));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    console.log(`TRACE [usePostComments.test]: loaded ${result.current.comments.length}, hasMore=${result.current.hasMore}`);
    expect(result.current.comments.map((c) => c.text)).toEqual(["c1", "c2"]);
    expect(result.current.hasMore).toBe(true);
  });

  it("loadMore appends the next page with the cursor and never duplicates", async () => {
    postApi.getPostComments
      .mockResolvedValueOnce({ data: [comment(1), comment(2)], hasMore: true, nextCursor: id(2) })
      .mockResolvedValueOnce({ data: [comment(2), comment(3)], hasMore: false, nextCursor: null });

    const { result } = renderHook(() => usePostComments("post1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.loadMore();
    });

    console.log(`TRACE [usePostComments.test]: after loadMore -> ${result.current.comments.map((c) => c.text).join(",")}`);
    expect(postApi.getPostComments).toHaveBeenLastCalledWith("post1", { cursor: id(2) });
    expect(result.current.comments.map((c) => c.text)).toEqual(["c1", "c2", "c3"]);
    expect(result.current.hasMore).toBe(false);
  });

  it("surfaces a load error and lets the caller retry", async () => {
    postApi.getPostComments.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => usePostComments("post1"));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.comments).toEqual([]);

    postApi.getPostComments.mockResolvedValueOnce({ data: [comment(1)], hasMore: false, nextCursor: null });
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.comments).toHaveLength(1);
  });

  it("ignores a slow response for a post the user has already left", async () => {
    console.log("TRACE [usePostComments.test]: stale response for previous post is dropped");
    let resolveSlow;
    postApi.getPostComments.mockImplementationOnce(
      () => new Promise((resolve) => { resolveSlow = resolve; })
    );
    postApi.getPostComments.mockResolvedValueOnce({ data: [comment(9, { text: "fresh" })], hasMore: false, nextCursor: null });

    const { result, rerender } = renderHook(({ postId }) => usePostComments(postId), {
      initialProps: { postId: "slow-post" },
    });
    rerender({ postId: "fast-post" });
    await waitFor(() => expect(result.current.comments.map((c) => c.text)).toEqual(["fresh"]));

    await act(async () => {
      resolveSlow({ data: [comment(1, { text: "stale" })], hasMore: false, nextCursor: null });
    });

    expect(result.current.comments.map((c) => c.text)).toEqual(["fresh"]);
  });

  it("addComment appends the new comment and reports the server's commentsCount", async () => {
    postApi.getPostComments.mockResolvedValueOnce({ data: [comment(1)], hasMore: false, nextCursor: null });
    postApi.addComment.mockResolvedValueOnce({ comment: comment(2), commentsCount: 2 });
    const onCountChange = vi.fn();

    const { result } = renderHook(() => usePostComments("post1", { onCountChange }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addComment("hello");
    });

    expect(postApi.addComment).toHaveBeenCalledWith("post1", "hello");
    expect(result.current.comments.map((c) => c.text)).toEqual(["c1", "c2"]);
    expect(onCountChange).toHaveBeenCalledWith(2);
  });

  it("addComment failure rejects (caller shows the error) and leaves the list unchanged", async () => {
    postApi.getPostComments.mockResolvedValueOnce({ data: [comment(1)], hasMore: false, nextCursor: null });
    postApi.addComment.mockRejectedValueOnce(new Error("nope"));
    const { result } = renderHook(() => usePostComments("post1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.addComment("x")).rejects.toThrow("nope");
    expect(result.current.comments).toHaveLength(1);
  });

  it("addReply appends under the right comment and updates repliesCount", async () => {
    postApi.getPostComments.mockResolvedValueOnce({
      data: [comment(1, { replies: [reply(10)], repliesCount: 1 }), comment(2)],
      hasMore: false,
      nextCursor: null,
    });
    postApi.addReply.mockResolvedValueOnce({ reply: reply(11), repliesCount: 2, commentsCount: 2 });

    const { result } = renderHook(() => usePostComments("post1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addReply(id(1), "answer", "alice");
    });

    expect(postApi.addReply).toHaveBeenCalledWith("post1", id(1), "answer", "alice");
    const first = result.current.comments[0];
    expect(first.replies.map((r) => r.text)).toEqual(["r10", "r11"]);
    expect(first.repliesCount).toBe(2);
    expect(result.current.comments[1].replies).toHaveLength(0);
  });

  it("loadMoreReplies continues from the last SERVER reply, not from a reply the user just added", async () => {
    console.log("TRACE [usePostComments.test]: reply cursor must skip nothing after a local reply");
    postApi.getPostComments.mockResolvedValueOnce({
      data: [comment(1, { replies: [reply(10), reply(11), reply(12)], repliesCount: 6 })],
      hasMore: false,
      nextCursor: null,
    });
    postApi.addReply.mockResolvedValueOnce({ reply: reply(99), repliesCount: 7, commentsCount: 1 });
    postApi.getCommentReplies.mockResolvedValueOnce({
      data: [reply(13), reply(14), reply(15)],
      hasMore: false,
      nextCursor: null,
    });

    const { result } = renderHook(() => usePostComments("post1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addReply(id(1), "mine", "alice"); // lands after the preview, before r13..r15
    });
    await act(async () => {
      await result.current.loadMoreReplies(id(1));
    });

    expect(postApi.getCommentReplies).toHaveBeenCalledWith("post1", id(1), { cursor: id(12) });
    const texts = result.current.comments[0].replies.map((r) => r.text);
    console.log(`TRACE [usePostComments.test]: replies -> ${texts.join(",")}`);
    expect(texts).toEqual(["r10", "r11", "r12", "r13", "r14", "r15", "r99"]);
  });

  it("addReply nests correctly when replying to a reply (not just a top-level comment)", async () => {
    console.log("TRACE [usePostComments.test]: reply-to-a-reply attaches at the right depth");
    postApi.getPostComments.mockResolvedValueOnce({
      data: [comment(1, { replies: [reply(10)], repliesCount: 1 })],
      hasMore: false,
      nextCursor: null,
    });
    postApi.addReply.mockResolvedValueOnce({ reply: reply(20), repliesCount: 1, commentsCount: 1 });

    const { result } = renderHook(() => usePostComments("post1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Reply to r10 (a reply, not the top-level comment) — should nest under it, not under c1.
    await act(async () => {
      await result.current.addReply(id(10), "nested reply", "bob");
    });

    expect(postApi.addReply).toHaveBeenCalledWith("post1", id(10), "nested reply", "bob");
    const topComment = result.current.comments[0];
    expect(topComment.replies).toHaveLength(1); // still just r10 directly under c1
    const r10 = topComment.replies[0];
    expect(r10.replies.map((r) => r.text)).toEqual(["r20"]);
    expect(r10.repliesCount).toBe(1);
  });

  it("deleting a nested reply-of-a-reply removes it from deep inside the tree without disturbing siblings", async () => {
    console.log("TRACE [usePostComments.test]: multi-level delete finds the node at any depth");
    postApi.getPostComments.mockResolvedValueOnce({
      data: [
        comment(1, {
          replies: [{ ...reply(10), replies: [reply(20)], repliesCount: 1 }],
          repliesCount: 1,
        }),
      ],
      hasMore: false,
      nextCursor: null,
    });
    postApi.deletePostComment.mockResolvedValueOnce({ deletedIds: [id(20)], commentsCount: 1 });

    const { result } = renderHook(() => usePostComments("post1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteComment(id(20));
    });

    const topComment = result.current.comments[0];
    const r10 = topComment.replies[0];
    expect(r10).toBeTruthy();
    expect(r10.replies).toHaveLength(0);
    expect(r10.repliesCount).toBe(0);
  });

  it("toggleUpvote writes the returned upvotes onto the right comment", async () => {
    postApi.getPostComments.mockResolvedValueOnce({ data: [comment(1), comment(2)], hasMore: false, nextCursor: null });
    postApi.toggleCommentUpvote.mockResolvedValueOnce({ _id: id(2), upvotes: ["u1", "u3"] });
    const { result } = renderHook(() => usePostComments("post1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleUpvote(id(2));
    });

    expect(result.current.comments[0].upvotes).toEqual([]);
    expect(result.current.comments[1].upvotes).toEqual(["u1", "u3"]);
  });

  it("deleting a comment removes it (and its replies) and reports the new count", async () => {
    postApi.getPostComments.mockResolvedValueOnce({
      data: [comment(1, { replies: [reply(10)], repliesCount: 1 }), comment(2)],
      hasMore: false,
      nextCursor: null,
    });
    postApi.deletePostComment.mockResolvedValueOnce({ deletedIds: [id(1), id(10)], commentsCount: 1 });
    const onCountChange = vi.fn();
    const { result } = renderHook(() => usePostComments("post1", { onCountChange }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteComment(id(1));
    });

    expect(result.current.comments.map((c) => c.text)).toEqual(["c2"]);
    expect(onCountChange).toHaveBeenCalledWith(1);
  });

  it("deleting a reply removes only that reply and decrements the parent's repliesCount", async () => {
    postApi.getPostComments.mockResolvedValueOnce({
      data: [comment(1, { replies: [reply(10), reply(11)], repliesCount: 2 })],
      hasMore: false,
      nextCursor: null,
    });
    postApi.deletePostComment.mockResolvedValueOnce({ deletedIds: [id(10)], commentsCount: 1 });
    const { result } = renderHook(() => usePostComments("post1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteComment(id(10));
    });

    const parent = result.current.comments[0];
    expect(parent.replies.map((r) => r.text)).toEqual(["r11"]);
    expect(parent.repliesCount).toBe(1);
  });
});
