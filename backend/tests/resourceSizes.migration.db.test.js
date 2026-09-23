import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { startTestDb, stopTestDb, clearTestDb, oid } from "./helpers/mongo.js";

const { migrateResourceSizes } = await import("../src/migrations/resourceSizes.migration.js");

const db = () => mongoose.connection.db;

const seed = async (overrides) => {
  const doc = {
    _id: oid(),
    userId: oid(),
    title: "Notes",
    description: "d",
    category: "notes",
    fileType: "pdf",
    fileUrl: "https://res.cloudinary.com/demo/image/upload/v1/a.pdf",
    ...overrides,
  };
  await db().collection("resources").insertOne(doc);
  return doc;
};

const sizeOf = async (doc) => (await db().collection("resources").findOne({ _id: doc._id })).fileSize;

describe("Resource file-size backfill (real MongoDB)", () => {
  beforeAll(async () => {
    await startTestDb();
  }, 180000);
  afterAll(stopTestDb);
  beforeEach(clearTestDb);

  test("sizes uploads that lack one and leaves links and sized resources alone", async () => {
    const missing = await seed();
    const sized = await seed({ fileSize: 111 });
    const link = await seed({ fileType: "link", fileUrl: "https://example.com" });
    const getSize = jest.fn().mockResolvedValue(2048);

    const stats = await migrateResourceSizes(db(), { getSize });

    expect(stats).toMatchObject({ matched: 1, sized: 1, failed: [] });
    expect(getSize).toHaveBeenCalledWith(missing.fileUrl);
    expect(await sizeOf(missing)).toBe(2048);
    expect(await sizeOf(sized)).toBe(111);
    expect(await sizeOf(link)).toBeUndefined();

    // Idempotent: nothing left to do.
    expect((await migrateResourceSizes(db(), { getSize })).matched).toBe(0);
  });

  test("dry run writes nothing, and unreadable sizes are reported and left unset", async () => {
    const ok = await seed();
    const broken = await seed({ fileUrl: "https://res.cloudinary.com/demo/raw/upload/v1/gone.docx" });
    const getSize = jest.fn(async (url) => {
      if (url.includes("gone")) throw new Error("HTTP 404");
      return 500;
    });

    const dry = await migrateResourceSizes(db(), { dryRun: true, getSize });
    expect(dry).toMatchObject({ matched: 2, sized: 1 });
    expect(await sizeOf(ok)).toBeUndefined();

    const real = await migrateResourceSizes(db(), { getSize });
    expect(real.failed).toEqual([{ _id: String(broken._id), reason: "HTTP 404" }]);
    expect(await sizeOf(ok)).toBe(500);
    expect(await sizeOf(broken)).toBeUndefined();
  });
});
