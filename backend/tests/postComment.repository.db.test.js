import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearTestDb, ensureIndexes, oid } from "./helpers/mongo.js";

const { Post } = await import("../models/posts.js");
const { PostComment } = await import("../models/postComment.js");
const { User } = await import("../models/users.js");
const commentRepo = await import("../src/repositories/postComment.repository.js");
const postRepo = await import("../src/repositories/post.repository.js");

const makeUser = (name) =>
  User.collection.insertOne({
    _id: oid(),
    username: name,
    fullName: `${name} Full`,
    email: `${name}@example.com`,
    avatar: `https://img.test/${name}.png`,
  }).then((r) => r.insertedId);

describe("PostComment repository (real MongoDB)", () => {
  let authorId;
  let commenterId;
  let post;

  beforeAll(async () => {
    await startTestDb();
    await ensureIndexes(Post, PostComment);
  }, 180000);

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    authorId = await makeUser("author");
    commenterId = await makeUser("commenter");
    post = await Post.create({ userId: authorId, caption: "hello campus" });
  });

  test("createComment stores a top-level comment and bumps the post's commentsCount", async () => {
    console.log("[TEST] createComment › inserts PostComment + increments Post.commentsCount atomically");

    const result = await commentRepo.createComment({ postId: post._id, userId: commenterId, text: "first!" });

    console.log(`[TEST RESULT] commentsCount=${result.commentsCount}, author populated=${result.comment.userId.username}`);
    expect(result.commentsCount).toBe(1);
    expect(result.comment.userId.username).toBe("commenter");
    expect(result.comment.replies).toEqual([]);
    expect(String(result.postAuthorId)).toBe(String(authorId));

    const refreshed = await Post.findById(post._id).lean();
    expect(refreshed.commentsCount).toBe(1);
    expect(await PostComment.countDocuments({ postId: post._id })).toBe(1);
  });

  test("createComment returns null for a post that does not exist (and creates nothing)", async () => {
    console.log("[TEST] createComment › unknown post → null, no orphan comment");
    const result = await commentRepo.createComment({ postId: oid(), userId: commenterId, text: "ghost" });
    expect(result).toBeNull();
    expect(await PostComment.countDocuments()).toBe(0);
  });

  test("createReply attaches to its parent, bumps repliesCount and does NOT change the post's commentsCount", async () => {
    console.log("[TEST] createReply › parent.repliesCount++ and post.commentsCount unchanged (top-level only)");
    const { comment } = await commentRepo.createComment({ postId: post._id, userId: commenterId, text: "parent" });

    const result = await commentRepo.createReply({
      postId: post._id,
      parentId: comment._id,
      userId: authorId,
      text: "reply",
      replyToUsername: "commenter",
    });

    console.log(`[TEST RESULT] repliesCount=${result.repliesCount}, commentsCount=${result.commentsCount}`);
    expect(result.repliesCount).toBe(1);
    expect(result.commentsCount).toBe(1);
    expect(result.reply.replyToUsername).toBe("commenter");
    expect(String(result.parentAuthorId)).toBe(String(commenterId));
  });

  test("createReply refuses a parent from a different post or a reply-to-a-reply", async () => {
    console.log("[TEST] createReply › cross-post parent and nested-reply parent are rejected");
    const otherPost = await Post.create({ userId: authorId, caption: "other" });
    const { comment } = await commentRepo.createComment({ postId: post._id, userId: commenterId, text: "parent" });
    const { reply } = await commentRepo.createReply({ postId: post._id, parentId: comment._id, userId: authorId, text: "r1" });

    const crossPost = await commentRepo.createReply({ postId: otherPost._id, parentId: comment._id, userId: authorId, text: "x" });
    const nested = await commentRepo.createReply({ postId: post._id, parentId: reply._id, userId: authorId, text: "y" });

    expect(crossPost).toBeNull();
    expect(nested).toBeNull();
  });

  test("getPostComments paginates oldest-first with an exact hasMore/nextCursor and no duplicates", async () => {
    console.log("[TEST] getPostComments › 5 comments, page size 2 → 2/2/1 with correct cursors");
    for (let i = 1; i <= 5; i++) {
      await commentRepo.createComment({ postId: post._id, userId: commenterId, text: `c${i}` });
    }

    const page1 = await commentRepo.getPostComments(post._id, { limit: 2 });
    const page2 = await commentRepo.getPostComments(post._id, { limit: 2, cursor: page1.nextCursor });
    const page3 = await commentRepo.getPostComments(post._id, { limit: 2, cursor: page2.nextCursor });

    console.log(`[TEST RESULT] pages: ${[page1, page2, page3].map((p) => p.comments.map((c) => c.text).join(",")).join(" | ")}`);
    expect(page1.comments.map((c) => c.text)).toEqual(["c1", "c2"]);
    expect(page2.comments.map((c) => c.text)).toEqual(["c3", "c4"]);
    expect(page3.comments.map((c) => c.text)).toEqual(["c5"]);
    expect(page1.hasMore).toBe(true);
    expect(page2.hasMore).toBe(true);
    expect(page3.hasMore).toBe(false);
    expect(page3.nextCursor).toBeNull();
  });

  test("getPostComments attaches only the first REPLY_PREVIEW_LIMIT replies but reports the true repliesCount", async () => {
    console.log("[TEST] getPostComments › reply preview is capped, repliesCount is exact");
    const { comment } = await commentRepo.createComment({ postId: post._id, userId: commenterId, text: "hot take" });
    const total = commentRepo.REPLY_PREVIEW_LIMIT + 2;
    for (let i = 1; i <= total; i++) {
      await commentRepo.createReply({ postId: post._id, parentId: comment._id, userId: authorId, text: `r${i}` });
    }

    const { comments } = await commentRepo.getPostComments(post._id);

    console.log(`[TEST RESULT] inline replies=${comments[0].replies.length}, repliesCount=${comments[0].repliesCount}`);
    expect(comments[0].replies).toHaveLength(commentRepo.REPLY_PREVIEW_LIMIT);
    expect(comments[0].replies.map((r) => r.text)).toEqual(["r1", "r2", "r3"]);
    expect(comments[0].repliesCount).toBe(total);
    expect(comments[0].replies[0].userId.username).toBe("author");
  });

  test("getCommentReplies continues after the preview using the cursor", async () => {
    console.log("[TEST] getCommentReplies › paginates the remaining replies after the inline preview");
    const { comment } = await commentRepo.createComment({ postId: post._id, userId: commenterId, text: "thread" });
    for (let i = 1; i <= 6; i++) {
      await commentRepo.createReply({ postId: post._id, parentId: comment._id, userId: authorId, text: `r${i}` });
    }

    const { comments } = await commentRepo.getPostComments(post._id);
    const lastPreviewId = comments[0].replies[comments[0].replies.length - 1]._id.toString();
    const rest = await commentRepo.getCommentReplies(post._id, comment._id, { cursor: lastPreviewId, limit: 10 });

    console.log(`[TEST RESULT] remaining replies: ${rest.replies.map((r) => r.text).join(",")}`);
    expect(rest.replies.map((r) => r.text)).toEqual(["r4", "r5", "r6"]);
    expect(rest.hasMore).toBe(false);
  });

  test("toggleCommentUpvote adds then removes the vote atomically", async () => {
    console.log("[TEST] toggleCommentUpvote › add → remove, never duplicates a voter");
    const { comment } = await commentRepo.createComment({ postId: post._id, userId: commenterId, text: "vote me" });

    const on = await commentRepo.toggleCommentUpvote(post._id, comment._id, authorId);
    const off = await commentRepo.toggleCommentUpvote(post._id, comment._id, authorId);

    expect(on.upvotes.map(String)).toEqual([String(authorId)]);
    expect(off.upvotes).toEqual([]);
  });

  test("concurrent upvotes from different users are all kept (no lost update)", async () => {
    console.log("[TEST] toggleCommentUpvote › 10 concurrent voters → 10 votes");
    const { comment } = await commentRepo.createComment({ postId: post._id, userId: commenterId, text: "popular" });
    const voters = await Promise.all(Array.from({ length: 10 }, (_, i) => makeUser(`voter${i}`)));

    await Promise.all(voters.map((v) => commentRepo.toggleCommentUpvote(post._id, comment._id, v)));

    const stored = await PostComment.findById(comment._id).lean();
    console.log(`[TEST RESULT] stored upvotes=${stored.upvotes.length}`);
    expect(stored.upvotes).toHaveLength(10);
  });

  test("deleting a top-level comment removes its replies and decrements commentsCount", async () => {
    console.log("[TEST] deleteComment › top-level delete cascades to replies and fixes the counter");
    const { comment } = await commentRepo.createComment({ postId: post._id, userId: commenterId, text: "parent" });
    await commentRepo.createReply({ postId: post._id, parentId: comment._id, userId: authorId, text: "r1" });
    await commentRepo.createReply({ postId: post._id, parentId: comment._id, userId: authorId, text: "r2" });
    await commentRepo.createComment({ postId: post._id, userId: commenterId, text: "sibling" });

    const target = await commentRepo.findComment(post._id, comment._id);
    const result = await commentRepo.deleteComment(target);

    console.log(`[TEST RESULT] deletedIds=${result.deletedIds.length}, commentsCount=${result.commentsCount}`);
    expect(result.deletedIds).toHaveLength(3);
    expect(result.commentsCount).toBe(1);
    expect(await PostComment.countDocuments({ postId: post._id })).toBe(1);
  });

  test("deleting a reply decrements the parent's repliesCount but not the post's commentsCount", async () => {
    console.log("[TEST] deleteComment › reply delete only touches parent.repliesCount");
    const { comment } = await commentRepo.createComment({ postId: post._id, userId: commenterId, text: "parent" });
    const { reply } = await commentRepo.createReply({ postId: post._id, parentId: comment._id, userId: authorId, text: "r1" });

    const result = await commentRepo.deleteComment(await commentRepo.findComment(post._id, reply._id));

    const parent = await PostComment.findById(comment._id).lean();
    expect(result.commentsCount).toBe(1);
    expect(parent.repliesCount).toBe(0);
  });

  test("the counter never goes below zero even if it had drifted", async () => {
    console.log("[TEST] deleteComment › drifted counter is clamped at 0");
    const { comment } = await commentRepo.createComment({ postId: post._id, userId: commenterId, text: "parent" });
    await Post.updateOne({ _id: post._id }, { $set: { commentsCount: 0 } }); // simulate drift

    const result = await commentRepo.deleteComment(await commentRepo.findComment(post._id, comment._id));
    expect(result.commentsCount).toBe(0);
  });

  test("deleting a post also deletes all of its comments and replies", async () => {
    console.log("[TEST] postRepository.deletePost › cascades to the PostComment collection");
    const { comment } = await commentRepo.createComment({ postId: post._id, userId: commenterId, text: "parent" });
    await commentRepo.createReply({ postId: post._id, parentId: comment._id, userId: authorId, text: "r1" });
    const survivor = await Post.create({ userId: authorId, caption: "keep me" });
    await commentRepo.createComment({ postId: survivor._id, userId: commenterId, text: "safe" });

    await postRepo.deletePost(post._id);

    expect(await PostComment.countDocuments({ postId: post._id })).toBe(0);
    expect(await PostComment.countDocuments({ postId: survivor._id })).toBe(1);
  });

  test("feed and post reads never include comment bodies, only commentsCount", async () => {
    console.log("[TEST] getPostsFeed / findPostById › no embedded comments in the payload");
    await commentRepo.createComment({ postId: post._id, userId: commenterId, text: "hello" });
    // Simulate a not-yet-migrated legacy document still carrying the embedded array.
    await Post.collection.updateOne({ _id: post._id }, { $set: { comments: [{ _id: oid(), userId: commenterId, text: "legacy", replies: [] }] } });

    const feed = await postRepo.getPostsFeed(null, 10);
    const single = await postRepo.findPostById(post._id);

    console.log(`[TEST RESULT] feed keys include comments? ${"comments" in feed[0]}, commentsCount=${feed[0].commentsCount}`);
    expect(feed[0].comments).toBeUndefined();
    expect(feed[0].commentsCount).toBe(1);
    expect(single.toObject().comments).toBeUndefined();
  });

  test("post votes stay atomic and mutually exclusive on the slimmed Post document", async () => {
    console.log("[TEST] toggleUpvote/toggleDownvote › mutual exclusion + toggle-off");
    const up = await postRepo.toggleUpvote(post._id, commenterId);
    expect(up.upvotes.map(String)).toEqual([String(commenterId)]);

    const down = await postRepo.toggleDownvote(post._id, commenterId);
    expect(down.upvotes).toHaveLength(0);
    expect(down.downvotes.map(String)).toEqual([String(commenterId)]);

    const off = await postRepo.toggleDownvote(post._id, commenterId);
    expect(off.downvotes).toHaveLength(0);
    expect(await postRepo.toggleUpvote(new mongoose.Types.ObjectId(), commenterId)).toBeNull();
  });
});
