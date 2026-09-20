/**
 * One-time data migration: embedded post comments -> PostComment collection.
 *
 * Old shape (inside each `posts` document):
 *   comments: [{ _id, userId, text, upvotes, createdAt, replies: [{ _id, userId, text, replyToUsername, upvotes, createdAt }] }]
 * New shape:
 *   posts:        { ..., commentsCount }
 *   postcomments: one document per comment AND per reply (replies carry `parentId`)
 *
 * Safety properties:
 *  - IDEMPOTENT: every comment is upserted by its original `_id`, so re-running
 *    (after a crash, or to catch comments written by a still-running old
 *    instance) never duplicates anything.
 *  - ORIGINAL IDS ARE PRESERVED, so notification deep-links and any stored
 *    references to a comment keep working.
 *  - NON-DESTRUCTIVE UNTIL VERIFIED: the embedded `comments` array is only
 *    $unset from a post after every one of its comments/replies is confirmed
 *    present in `postcomments`. A post that fails verification is left
 *    untouched and reported.
 *  - `dryRun` reads and reports but writes nothing.
 *
 * Works on the raw driver collections on purpose: the Post Mongoose schema no
 * longer declares `comments`, so going through the model would hide the data.
 */

const BATCH_SIZE = 200;

const toCommentDocs = (post) => {
  const docs = [];
  let topLevel = 0;

  for (const comment of post.comments || []) {
    const replies = Array.isArray(comment.replies) ? comment.replies : [];
    const createdAt = comment.createdAt || post.createdAt || new Date();

    docs.push({
      _id: comment._id,
      postId: post._id,
      parentId: null,
      userId: comment.userId,
      text: comment.text,
      upvotes: comment.upvotes || [],
      repliesCount: replies.length,
      createdAt,
      updatedAt: comment.updatedAt || createdAt,
    });
    topLevel += 1;

    for (const reply of replies) {
      const replyCreatedAt = reply.createdAt || createdAt;
      docs.push({
        _id: reply._id,
        postId: post._id,
        parentId: comment._id,
        userId: reply.userId,
        text: reply.text,
        replyToUsername: reply.replyToUsername ?? null,
        upvotes: reply.upvotes || [],
        repliesCount: 0,
        createdAt: replyCreatedAt,
        updatedAt: reply.updatedAt || replyCreatedAt,
      });
    }
  }

  return { docs, topLevel };
};

/**
 * @param {import("mongodb").Db} db  native driver Db (mongoose.connection.db)
 * @param {{ dryRun?: boolean, log?: (msg: string) => void }} options
 */
export const migratePostComments = async (db, { dryRun = false, log = () => {} } = {}) => {
  const posts = db.collection("posts");
  const postComments = db.collection("postcomments");

  const stats = {
    dryRun,
    postsScanned: 0,
    postsMigrated: 0,
    postsWithoutComments: 0,
    postsFailed: 0,
    commentsMigrated: 0,
    repliesMigrated: 0,
    failedPostIds: [],
  };

  if (!dryRun) {
    // Create the indexes up front so the paginated reads are fast from the first request.
    await postComments.createIndex({ postId: 1, parentId: 1, _id: 1 });
    await postComments.createIndex({ parentId: 1, _id: 1 });
  }

  const cursor = posts.find({ comments: { $exists: true } }).batchSize(BATCH_SIZE);

  for await (const post of cursor) {
    stats.postsScanned += 1;
    const { docs, topLevel } = toCommentDocs(post);

    if (docs.length === 0) {
      stats.postsWithoutComments += 1;
      if (!dryRun) {
        await posts.updateOne({ _id: post._id }, { $set: { commentsCount: 0 }, $unset: { comments: "" } });
      }
      continue;
    }

    if (dryRun) {
      stats.postsMigrated += 1;
      stats.commentsMigrated += topLevel;
      stats.repliesMigrated += docs.length - topLevel;
      continue;
    }

    try {
      await postComments.bulkWrite(
        docs.map(({ _id, ...rest }) => ({
          updateOne: { filter: { _id }, update: { $setOnInsert: rest }, upsert: true },
        })),
        { ordered: false }
      );

      // Verify before destroying the source data.
      const present = await postComments.countDocuments({ _id: { $in: docs.map((d) => d._id) } });
      if (present !== docs.length) {
        throw new Error(`verification failed: expected ${docs.length} documents, found ${present}`);
      }

      await posts.updateOne(
        { _id: post._id },
        { $set: { commentsCount: topLevel }, $unset: { comments: "" } }
      );

      stats.postsMigrated += 1;
      stats.commentsMigrated += topLevel;
      stats.repliesMigrated += docs.length - topLevel;
    } catch (err) {
      stats.postsFailed += 1;
      stats.failedPostIds.push(String(post._id));
      log(`FAILED post ${post._id}: ${err.message} (left untouched)`);
    }
  }

  return stats;
};

/**
 * Recompute every post's denormalized `commentsCount` (top-level comments only)
 * and every comment's `repliesCount` from the source-of-truth documents. Use
 * this if the counters ever drift.
 */
export const recountPostComments = async (db, { dryRun = false } = {}) => {
  const posts = db.collection("posts");
  const postComments = db.collection("postcomments");

  const postCounts = await postComments
    .aggregate([{ $match: { parentId: null } }, { $group: { _id: "$postId", n: { $sum: 1 } } }])
    .toArray();
  const replyCounts = await postComments
    .aggregate([{ $match: { parentId: { $ne: null } } }, { $group: { _id: "$parentId", n: { $sum: 1 } } }])
    .toArray();

  if (!dryRun) {
    // Reset everything first so posts/comments that lost all their children go back to 0.
    await posts.updateMany({ commentsCount: { $ne: 0 } }, { $set: { commentsCount: 0 } });
    await postComments.updateMany({ parentId: null, repliesCount: { $ne: 0 } }, { $set: { repliesCount: 0 } });

    if (postCounts.length) {
      await posts.bulkWrite(
        postCounts.map(({ _id, n }) => ({ updateOne: { filter: { _id }, update: { $set: { commentsCount: n } } } }))
      );
    }
    if (replyCounts.length) {
      await postComments.bulkWrite(
        replyCounts.map(({ _id, n }) => ({ updateOne: { filter: { _id }, update: { $set: { repliesCount: n } } } }))
      );
    }
  }

  return { postsUpdated: postCounts.length, commentsWithReplies: replyCounts.length, dryRun };
};

/**
 * True if any post still carries an embedded `comments` array, i.e. the
 * migration hasn't (fully) run. Used for a loud startup warning.
 */
export const hasUnmigratedPostComments = async (db) => {
  const one = await db.collection("posts").findOne({ comments: { $exists: true } }, { projection: { _id: 1 } });
  return Boolean(one);
};
