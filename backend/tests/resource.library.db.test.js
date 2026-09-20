import { startTestDb, stopTestDb, clearTestDb, ensureIndexes, oid } from "./helpers/mongo.js";

const { Resource } = await import("../models/resource.js");
const { User } = await import("../models/users.js");
const repo = await import("../src/repositories/resource.repository.js");
const service = await import("../src/services/resource.service.js");

const insertUser = async (username) => {
  const _id = oid();
  await User.collection.insertOne({
    _id, username, fullName: username, email: `${username}@x.test`,
    phoneNumber: "9999999999", googleId: "g-secret", bookmarks: [oid()],
  });
  return _id;
};

const seed = async (userId, count, overrides = () => ({})) => {
  const base = new Date("2025-01-01T00:00:00Z").getTime();
  const docs = Array.from({ length: count }, (_, i) => ({
    _id: oid(), userId, title: `resource ${String(i + 1).padStart(2, "0")}`,
    description: "desc", category: "notes", resourcetags: [], fileUrl: "https://x.test/f.pdf",
    fileType: "pdf", fileName: `f${i}.pdf`, downloadsCount: 0, isVerified: true,
    createdAt: new Date(base + i * 60000), updatedAt: new Date(base + i * 60000),
    ...overrides(i),
  }));
  await Resource.collection.insertMany(docs);
  return docs;
};

describe("Resource library (real MongoDB)", () => {
  let uploader;

  beforeAll(async () => {
    await startTestDb();
    await ensureIndexes(Resource);
  }, 180000);
  afterAll(async () => { await stopTestDb(); });
  beforeEach(async () => {
    await clearTestDb();
    uploader = await insertUser("uploader");
  });

  test("paginates with exact totals, no duplicates, stable order", async () => {
    console.log("[TEST] library › 25 resources, page size 10 → 10/10/5, totalPages 3");
    await seed(uploader, 25, (i) => ({ downloadsCount: i % 5 }));

    const pages = [];
    for (let p = 1; p <= 3; p++) pages.push(await repo.getVerifiedResources({ sort: "most_downloaded" }, p, 10));

    const all = pages.flatMap((p) => p.resources.map((r) => r.title));
    console.log(`[TEST RESULT] sizes=${pages.map((p) => p.resources.length)}, totalDocs=${pages[0].totalDocs}, totalPages=${pages[0].totalPages}`);
    expect(pages.map((p) => p.resources.length)).toEqual([10, 10, 5]);
    expect(pages[0].totalDocs).toBe(25);
    expect(pages[0].totalPages).toBe(3);
    expect(pages.map((p) => p.hasNextPage)).toEqual([true, true, false]);
    expect(new Set(all).size).toBe(25);
  });

  test("sort orders are applied across pages (newest / oldest / az)", async () => {
    await seed(uploader, 6);
    const newest = await repo.getVerifiedResources({ sort: "newest" }, 1, 3);
    const oldest = await repo.getVerifiedResources({ sort: "oldest" }, 1, 3);
    const az = await repo.getVerifiedResources({ sort: "az" }, 1, 2);
    expect(newest.resources[0].title).toBe("resource 06");
    expect(oldest.resources[0].title).toBe("resource 01");
    expect(az.resources.map((r) => r.title)).toEqual(["resource 01", "resource 02"]);
  });

  test("the uploader is joined with a WHITELIST — no sensitive user fields leak", async () => {
    console.log("[TEST] library › uploader projection exposes only id/username/avatar/fullName");
    await seed(uploader, 1);
    const { resources } = await repo.getVerifiedResources({}, 1, 10);
    const keys = Object.keys(resources[0].userId).sort();
    console.log(`[TEST RESULT] uploader keys: ${keys.join(",")}`);
    expect(keys).toEqual(["_id", "fullName", "username"]);
    expect(resources[0].userId.phoneNumber).toBeUndefined();
    expect(resources[0].userId.googleId).toBeUndefined();
    expect(resources[0].userId.bookmarks).toBeUndefined();
  });

  test("hidden (isVerified:false) resources never appear, but legacy docs without the field do", async () => {
    await seed(uploader, 3, (i) => (i === 0 ? { isVerified: false } : i === 1 ? { isVerified: undefined } : {}));
    const { resources, totalDocs } = await repo.getVerifiedResources({}, 1, 10);
    expect(totalDocs).toBe(2);
    expect(resources.some((r) => r.title === "resource 01")).toBe(false);
  });

  test("text search works, and falls back to regex for partial words", async () => {
    console.log("[TEST] library › $text hit, then regex fallback for a partial term");
    await seed(uploader, 3, (i) => ({
      title: ["Operating Systems notes", "Thermodynamics formulas", "Compiler design PYQ"][i],
      description: ["kernel scheduling", "heat engines", "parsing tables"][i],
    }));
    const full = await repo.getVerifiedResources({ search: "thermodynamics" }, 1, 10);
    const partial = await repo.getVerifiedResources({ search: "thermo" }, 1, 10);
    expect(full.resources.map((r) => r.title)).toEqual(["Thermodynamics formulas"]);
    expect(partial.resources.map((r) => r.title)).toEqual(["Thermodynamics formulas"]);
    expect(partial.totalDocs).toBe(1);
  });

  test("category, file-type and combined filters keep counts and pages consistent", async () => {
    await seed(uploader, 10, (i) => ({
      category: i % 2 ? "papers" : "notes",
      fileType: i % 3 === 0 ? "pdf" : "docx",
      fileName: i % 3 === 0 ? `a${i}.pdf` : `a${i}.docx`,
    }));
    const papers = await repo.getVerifiedResources({ category: "papers" }, 1, 3);
    expect(papers.totalDocs).toBe(5);
    expect(papers.totalPages).toBe(2);
    const pdfNotes = await repo.getVerifiedResources({ category: "notes", fileType: "pdf" }, 1, 10);
    expect(pdfNotes.resources.every((r) => r.category === "notes" && /pdf/i.test(r.fileType))).toBe(true);
  });

  test("asking for a page past the end returns an empty page, not an error", async () => {
    await seed(uploader, 3);
    const result = await repo.getVerifiedResources({}, 9, 10);
    expect(result.resources).toEqual([]);
    expect(result.totalDocs).toBe(3);
    expect(result.hasNextPage).toBe(false);
  });

  test("getCategoryStats counts per category, honours branch and ignores hidden resources", async () => {
    console.log("[TEST] stats › per-category counts scoped by branch");
    const branchA = oid();
    const branchB = oid();
    await seed(uploader, 6, (i) => ({
      branch: i < 4 ? branchA : branchB,
      category: ["notes", "notes", "papers", "assignments", "other", "notes"][i],
      isVerified: i !== 5,
    }));

    const all = await repo.getCategoryStats();
    const a = await repo.getCategoryStats(String(branchA));

    console.log(`[TEST RESULT] all=${JSON.stringify(all.categories)}, branchA total=${a.total}`);
    expect(all.total).toBe(5); // the hidden one is excluded
    expect(all.categories).toMatchObject({ all: 5, notes: 2, papers: 1, assignments: 1, other: 1 });
    expect(a.total).toBe(4);
    expect(a.categories.notes).toBe(2);
  });

  test("service composes the page with stats and ignores search when computing stats", async () => {
    await seed(uploader, 4, (i) => ({ category: i < 3 ? "notes" : "papers", title: i === 0 ? "special one" : `plain ${i}` }));
    const result = await service.getVerifiedResourcesFeed({ search: "special" }, "1", "12");
    expect(result.resources).toHaveLength(1);
    expect(result.stats.total).toBe(4); // unaffected by the search
    expect(result.pagination ?? result.totalDocs).toBeDefined();
  });
});
