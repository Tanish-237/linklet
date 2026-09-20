/**
 * CLI for the embedded-comments -> PostComment collection migration.
 *
 *   npm run migrate:comments -- --dry-run     # report what WOULD happen, write nothing
 *   npm run migrate:comments                  # run the migration (safe to re-run)
 *   npm run migrate:comments -- --recount     # repair denormalized counters only
 *
 * Reads MONGO_URL from the environment / backend/.env, exactly like the server.
 */
import "dotenv/config";
import mongoose from "mongoose";
import {
  migratePostComments,
  recountPostComments,
  hasUnmigratedPostComments,
} from "../src/migrations/postComments.migration.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const recount = args.has("--recount");

const log = (msg) => console.log(`[migrate-post-comments] ${msg}`);

const main = async () => {
  if (!process.env.MONGO_URL) {
    console.error("MONGO_URL is not set. Aborting.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);
  const db = mongoose.connection.db;
  log(`Connected to database "${db.databaseName}"${dryRun ? " (DRY RUN — nothing will be written)" : ""}`);

  if (recount) {
    const result = await recountPostComments(db, { dryRun });
    log(`Recount complete: ${JSON.stringify(result)}`);
    return 0;
  }

  const stats = await migratePostComments(db, { dryRun, log });
  log(`Result: ${JSON.stringify(stats, null, 2)}`);

  if (!dryRun) {
    const leftover = await hasUnmigratedPostComments(db);
    log(leftover ? "WARNING: some posts still have embedded comments (see failedPostIds). Re-run after fixing." : "All posts migrated. No embedded comments remain.");
  }

  return stats.postsFailed > 0 ? 1 : 0;
};

main()
  .then((code) => mongoose.disconnect().then(() => process.exit(code)))
  .catch(async (err) => {
    console.error("Migration crashed:", err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
