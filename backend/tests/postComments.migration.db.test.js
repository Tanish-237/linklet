import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearTestDb, oid } from "./helpers/mongo.js";

const {
  migratePostComments,
  recountPostComments,
  hasUnmigratedPostComments,
} = await import("../src/migrations/postComments.migration.js");
const { PostComment } = await import("../models/postComment.js");
const commentRepo = await import("../src/repositories/postComment.repository.js");

const db = () => mongoose.connection.db;

/** Seed a post exactly as the OLD schema stored it: comments + replies embedded. */
const seedLegacyPost = async ({ comments }) => {
  const post = {
    _id: oid(),
    userId: oid(),
    caption: "legacy post",
    image: "",
    upvotes: [],
    downvotes: [],
    comments,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };
  await db().collection("posts").insertOne(post);
  return post;
};

const legacyComment = (text, replies = []) => ({
  _id: oid(),
  userId: oid(),
  text,
  upvotes: [oid(), oid()],
  replies: replies.map((r) => ({
    _id: oid(),
    userId: oid(),
    text: r,
    replyToUsername: "someone",
    upvotes: [],
    createdAt: new Date("2025-01-03T00:00:00Z"),
    updatedAt: new Date("2025-01-03T00:00:00Z"),
  })),
  createdAt: new Date("2025-01-02T00:00:00Z"),
  updatedAt: new Date("2025-01-02T00:00:00Z"),
});

describe("Post comments migration (real MongoDB)", () => {
  beforeAll(async () => {
    await startTestDb();
  }, 180000);

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  test("moves embedded comments and replies into the collection, preserving ids, order, votes and timestamps", async () => {
    console.log("[TEST] migrate › embedded → postcomments with original _ids / upvotes / createdAt");
    const c1 = legacyComment("first", ["reply a", "reply b"]);
    const c2 = legacyComment("second");
    const post = await seedLegacyPost({ comments: [c1, c2] });

    const stats = await migratePostComments(db());

    console.log(`[TEST RESULT] ${JSON.stringify(stats)}`);
    expect(stats.postsMigrated).toBe(1);
    expect(stats.commentsMigrated).toBe(2);
    expect(stats.repliesMigrated).toBe(2);
    expect(stats.postsFailed).toBe(0);

    const migrated = await PostComment.find({ postId: post._id }).sort({ _id: 1 }).lean();
    expect(migrated).toHaveLength(4);

    const top = migrated.find((m) => String(m._id) === String(c1._id));
    expect(top.parentId).toBeNull();
    expect(top.text).toBe("first");
    expect(top.repliesCount).toBe(2);
    expect(top.upvotes.map(String)).toEqual(c1.upvotes.map(String));
    expect(top.createdAt.toISOString()).toBe("2025-01-02T00:00:00.000Z");

    const reply = migrated.find((m) => String(m._id) === String(c1.replies[0]._id));
    expect(String(reply.parentId)).toBe(String(c1._id));
    expect(reply.replyToUsername).toBe("someone");

    const stored = await db().collection("posts").findOne({ _id: post._id });
    expect(stored.commentsCount).toBe(2);
    expect(stored.comments).toBeUndefined();
    expect(await hasUnmigratedPostComments(db())).toBe(false);
  });

  test("migrated data is readable through the real repository (order + reply preview)", async () => {
    console.log("[TEST] migrate › result is served correctly by getPostComments");
    const post = await seedLegacyPost({
      comments: [legacyComment("A", ["a1", "a2", "a3", "a4"]), legacyComment("B")],
    });
    // Users must exist for author population.
    await migratePostComments(db());

    const { comments, hasMore } = await commentRepo.getPostComments(post._id);

    console.log(`[TEST RESULT] ${comments.map((c) => `${c.text}(${c.repliesCount} replies, ${c.replies.length} inline)`).join(", ")}`);
    expect(comments.map((c) => c.text)).toEqual(["A", "B"]);
    expect(comments[0].repliesCount).toBe(4);
    expect(comments[0].replies).toHaveLength(commentRepo.REPLY_PREVIEW_LIMIT);
    expect(hasMore).toBe(false);
  });

  test("is idempotent: running twice creates no duplicates", async () => {
    console.log("[TEST] migrate › second run is a no-op");
    await seedLegacyPost({ comments: [legacyComment("only", ["r"])] });

    await migratePostComments(db());
    const second = await migratePostComments(db());

    console.log(`[TEST RESULT] second run scanned ${second.postsScanned} posts`);
    expect(second.postsScanned).toBe(0);
    expect(await PostComment.countDocuments()).toBe(2);
  });

  test("re-run picks up a post that regained embedded comments (old instance still writing during deploy)", async () => {
    console.log("[TEST] migrate › catches late writes from a not-yet-replaced old instance, without duplicating");
    const existing = legacyComment("already migrated");
    const post = await seedLegacyPost({ comments: [existing] });
    await migratePostComments(db());
    expect(await PostComment.countDocuments()).toBe(1);

    // Old code $push-es a new comment back into the (unset) embedded array.
    const late = legacyComment("written by old instance");
    await db().collection("posts").updateOne({ _id: post._id }, { $push: { comments: { $each: [existing, late] } } });

    const stats = await migratePostComments(db());

    console.log(`[TEST RESULT] total comments now ${await PostComment.countDocuments()}`);
    expect(stats.postsMigrated).toBe(1);
    expect(await PostComment.countDocuments()).toBe(2); // `existing` upserted onto itself, `late` added
    const stored = await db().collection("posts").findOne({ _id: post._id });
    expect(stored.commentsCount).toBe(2);
  });

  test("posts with an empty embedded array get commentsCount 0 and the array removed", async () => {
    console.log("[TEST] migrate › empty comments array is cleaned up");
    const post = await seedLegacyPost({ comments: [] });

    const stats = await migratePostComments(db());

    expect(stats.postsWithoutComments).toBe(1);
    const stored = await db().collection("posts").findOne({ _id: post._id });
    expect(stored.commentsCount).toBe(0);
    expect(stored.comments).toBeUndefined();
  });

  test("dry run reports what would happen but writes nothing", async () => {
    console.log("[TEST] migrate › --dry-run leaves the database untouched");
    const post = await seedLegacyPost({ comments: [legacyComment("x", ["y"])] });

    const stats = await migratePostComments(db(), { dryRun: true });

    console.log(`[TEST RESULT] dry-run stats ${JSON.stringify(stats)}`);
    expect(stats.dryRun).toBe(true);
    expect(stats.commentsMigrated).toBe(1);
    expect(stats.repliesMigrated).toBe(1);
    expect(await PostComment.countDocuments()).toBe(0);
    const stored = await db().collection("posts").findOne({ _id: post._id });
    expect(stored.comments).toHaveLength(1);
    expect(await hasUnmigratedPostComments(db())).toBe(true);
  });

  test("recount repairs drifted commentsCount and repliesCount from the source documents", async () => {
    console.log("[TEST] recount › counters rebuilt from PostComment documents");
    const post = await seedLegacyPost({ comments: [legacyComment("p", ["r1", "r2"]), legacyComment("q")] });
    await migratePostComments(db());
    await db().collection("posts").updateOne({ _id: post._id }, { $set: { commentsCount: 99 } });
    await PostComment.updateMany({}, { $set: { repliesCount: 42 } });

    const result = await recountPostComments(db());

    console.log(`[TEST RESULT] ${JSON.stringify(result)}`);
    const stored = await db().collection("posts").findOne({ _id: post._id });
    expect(stored.commentsCount).toBe(2);
    const parent = await PostComment.findOne({ text: "p" }).lean();
    const sibling = await PostComment.findOne({ text: "q" }).lean();
    expect(parent.repliesCount).toBe(2);
    expect(sibling.repliesCount).toBe(0);
  });
});
