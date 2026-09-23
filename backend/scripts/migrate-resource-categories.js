/**
 * CLI for the resource category cleanup migration (relabels existing
 * "presentations" resources to "lectures" to match the current category enum).
 *
 *   npm run migrate:resource-categories -- --dry-run     # report what WOULD happen, write nothing
 *   npm run migrate:resource-categories                  # run the migration (safe to re-run)
 *
 * Reads MONGO_URL from the environment / backend/.env, exactly like the server.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { migrateResourceCategories } from "../src/migrations/resourceCategories.migration.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

const log = (msg) => console.log(`[migrate-resource-categories] ${msg}`);

const main = async () => {
  if (!process.env.MONGO_URL) {
    console.error("MONGO_URL is not set. Aborting.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);
  const db = mongoose.connection.db;
  log(`Connected to database "${db.databaseName}"${dryRun ? " (DRY RUN — nothing will be written)" : ""}`);

  const stats = await migrateResourceCategories(db, { dryRun, log });
  log(`Result: ${JSON.stringify(stats, null, 2)}`);

  return 0;
};

main()
  .then((code) => mongoose.disconnect().then(() => process.exit(code)))
  .catch(async (err) => {
    console.error("Migration crashed:", err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
