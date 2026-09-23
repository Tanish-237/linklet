import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearTestDb, oid } from "./helpers/mongo.js";

const { migrateResourceCategories } = await import("../src/migrations/resourceCategories.migration.js");

const db = () => mongoose.connection.db;

const seedResource = async (category) => {
  const resource = {
    _id: oid(),
    userId: oid(),
    title: "Test Resource",
    description: "Test description",
    category,
    fileUrl: "https://example.com/file.pdf",
    fileType: "pdf",
    fileName: "file.pdf",
  };
  await db().collection("resources").insertOne(resource);
  return resource;
};

describe("Resource category cleanup migration (real MongoDB)", () => {
  beforeAll(async () => {
    await startTestDb();
  }, 180000);

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  test("relabels \"presentations\" resources to \"lectures\"", async () => {
    console.log("[TEST] migrateResourceCategories › relabels presentations -> lectures");
    await seedResource("presentations");
    await seedResource("presentations");

    const stats = await migrateResourceCategories(db());
    console.log(`[TEST RESULT] ${JSON.stringify(stats)}`);

    expect(stats.matched).toBe(2);
    expect(stats.migrated).toBe(2);

    const remaining = await db().collection("resources").countDocuments({ category: "presentations" });
    const migrated = await db().collection("resources").countDocuments({ category: "lectures" });
    expect(remaining).toBe(0);
    expect(migrated).toBe(2);
  });

  test("leaves other categories untouched", async () => {
    console.log("[TEST] migrateResourceCategories › leaves notes/papers untouched");
    await seedResource("notes");
    await seedResource("papers");

    const stats = await migrateResourceCategories(db());
    console.log(`[TEST RESULT] ${JSON.stringify(stats)}`);

    expect(stats.matched).toBe(0);
    expect(stats.migrated).toBe(0);

    const notes = await db().collection("resources").countDocuments({ category: "notes" });
    const papers = await db().collection("resources").countDocuments({ category: "papers" });
    expect(notes).toBe(1);
    expect(papers).toBe(1);
  });

  test("dry run reports but writes nothing", async () => {
    console.log("[TEST] migrateResourceCategories › dry run is a no-op");
    await seedResource("presentations");

    const stats = await migrateResourceCategories(db(), { dryRun: true });
    console.log(`[TEST RESULT] ${JSON.stringify(stats)}`);

    expect(stats.matched).toBe(1);
    expect(stats.migrated).toBe(1);
    expect(stats.dryRun).toBe(true);

    const stillPresentations = await db().collection("resources").countDocuments({ category: "presentations" });
    expect(stillPresentations).toBe(1);
  });

  test("is idempotent — re-running finds nothing left to migrate", async () => {
    console.log("[TEST] migrateResourceCategories › idempotent on re-run");
    await seedResource("presentations");

    await migrateResourceCategories(db());
    const second = await migrateResourceCategories(db());
    console.log(`[TEST RESULT second run] ${JSON.stringify(second)}`);

    expect(second.matched).toBe(0);
    expect(second.migrated).toBe(0);
  });
});
