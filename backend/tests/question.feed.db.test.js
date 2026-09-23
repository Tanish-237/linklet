import { jest } from "@jest/globals";
import { startTestDb, stopTestDb, clearTestDb, ensureIndexes, oid } from "./helpers/mongo.js";

const { Question } = await import("../models/question.js");
const { Answer } = await import("../models/answer.js");
const { User } = await import("../models/users.js");
const questionService = await import("../src/services/question.service.js");
const { parseFeedCursor, paginateList } = await import("../src/utils/feedCursor.js");

const insertUser = async (username) => {
  const _id = oid();
  await User.collection.insertOne({ _id, username, fullName: username, email: `${username}@x.test` });
  return _id;
};

/** Create N questions, one per minute, newest = highest index. */
const seedQuestions = async (userId, count, overrides = () => ({})) => {
  const base = new Date("2025-01-01T00:00:00Z").getTime();
  const docs = Array.from({ length: count }, (_, i) => ({
    _id: oid(),
    userId,
    title: `question ${String(i + 1).padStart(2, "0")}`,
    body: "",
    category: "General",
    tags: [],
    answers: [],
    acceptedAnswers: [],
    upvotes: [],
    downvotes: [],
    views: 0,
    createdAt: new Date(base + i * 60000),
    updatedAt: new Date(base + i * 60000),
    ...overrides(i),
  }));
  await Question.collection.insertMany(docs);
  return docs;
};

const titles = (page) => page.questions.map((q) => q.title);

/** Walk every page of a feed, returning all pages. */
const walk = async (params, { maxPages = 20 } = {}) => {
  const pages = [];
  let cursor = null;
  for (let i = 0; i < maxPages; i++) {
    const page = await questionService.getQuestionsFeed({ ...params, cursor });
    pages.push(page);
    if (!page.hasMore) break;
    cursor = page.nextCursor;
  }
  return pages;
};

describe("Help Forum feed (real MongoDB)", () => {
  let author;

  beforeAll(async () => {
    await startTestDb();
    await ensureIndexes(Question, Answer);
  }, 180000);

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    author = await insertUser("author");
  });

  describe("chronological pagination (date cursor)", () => {
    test("walks every question exactly once, newest first, with an exact hasMore", async () => {
      console.log("[TEST] feed › 23 questions, page size 10 → 10/10/3, no duplicates, no gaps");
      await seedQuestions(author, 23);

      const pages = await walk({ limit: 10 });

      const all = pages.flatMap(titles);
      console.log(`[TEST RESULT] pages=${pages.length}, sizes=${pages.map((p) => p.questions.length)}, total=${all.length}, unique=${new Set(all).size}`);
      expect(pages.map((p) => p.questions.length)).toEqual([10, 10, 3]);
      expect(pages.map((p) => p.hasMore)).toEqual([true, true, false]);
      expect(pages[2].nextCursor).toBeNull();
      expect(all).toHaveLength(23);
      expect(new Set(all).size).toBe(23);
      expect(all[0]).toBe("question 23");
      expect(all[22]).toBe("question 01");
    });

    test("hasMore is false (not a phantom 'Load more') when the total is an exact multiple of the page size", async () => {
      console.log("[TEST] feed › 20 questions, page size 10 → second page has no more");
      await seedQuestions(author, 20);
      const pages = await walk({ limit: 10 });
      expect(pages).toHaveLength(2);
      expect(pages[1].hasMore).toBe(false);
    });

    test("an oversized limit is clamped to 50 AND hasMore still works (old code compared against the raw limit)", async () => {
      console.log("[TEST] feed › ?limit=100 with 60 questions → 50 then 10");
      await seedQuestions(author, 60);

      const first = await questionService.getQuestionsFeed({ limit: 100 });
      console.log(`[TEST RESULT] first page ${first.questions.length}, hasMore=${first.hasMore}`);
      expect(first.questions).toHaveLength(50);
      expect(first.hasMore).toBe(true);

      const second = await questionService.getQuestionsFeed({ limit: 100, cursor: first.nextCursor });
      expect(second.questions).toHaveLength(10);
      expect(second.hasMore).toBe(false);
    });

    test("'oldest' orders ascending and pages without gaps", async () => {
      await seedQuestions(author, 7);
      const pages = await walk({ limit: 3, filter: "oldest" });
      const all = pages.flatMap(titles);
      expect(all[0]).toBe("question 01");
      expect(all).toHaveLength(7);
      expect(new Set(all).size).toBe(7);
    });

    test("category and tag filters combine with pagination", async () => {
      await seedQuestions(author, 12, (i) => ({
        category: i % 2 === 0 ? "Academic" : "Technical",
        tags: i % 3 === 0 ? ["react"] : ["exam"],
      }));

      const academic = (await walk({ limit: 4, category: "Academic" })).flatMap(titles);
      expect(academic).toHaveLength(6);

      const reactTech = (await walk({ limit: 2, category: "Technical", tag: "react" })).flatMap(titles);
      console.log(`[TEST RESULT] technical+react: ${reactTech.join(", ")}`);
      expect(reactTech.every((t) => ["question 04", "question 10"].includes(t))).toBe(true);
    });

    test("'mine' (author filter) only returns that user's questions", async () => {
      const other = await insertUser("other");
      await seedQuestions(author, 5);
      await seedQuestions(other, 3, (i) => ({ title: `other ${i}` }));

      const mine = await questionService.getQuestionsFeed({ userId: String(other), limit: 10 });
      expect(mine.questions).toHaveLength(3);
    });
  });

  describe("answered / unanswered / solved filters (index-friendly, no $expr)", () => {
    test("classifies questions by their answers/acceptedAnswers arrays", async () => {
      console.log("[TEST] filters › unanswered / answered / solved");
      const answerId = oid();
      await seedQuestions(author, 6, (i) => ({
        answers: i < 2 ? [] : [answerId],
        acceptedAnswers: i === 5 ? [answerId] : [],
      }));

      const unanswered = await questionService.getQuestionsFeed({ filter: "unanswered", limit: 50 });
      const answered = await questionService.getQuestionsFeed({ filter: "answered", limit: 50 });
      const solved = await questionService.getQuestionsFeed({ filter: "solved", limit: 50 });

      console.log(`[TEST RESULT] unanswered=${unanswered.questions.length}, answered=${answered.questions.length}, solved=${solved.questions.length}`);
      expect(unanswered.questions).toHaveLength(2);
      expect(answered.questions).toHaveLength(4);
      expect(titles(solved)).toEqual(["question 06"]);
    });

    test("the queries no longer contain $expr (which cannot use an index)", async () => {
      // Structural guard: build the same query the repository uses and confirm no $expr.
      const spy = jest.spyOn(Question, "find");
      await questionService.getQuestionsFeed({ filter: "unanswered", limit: 5 });
      const usedQuery = spy.mock.calls[0][0];
      spy.mockRestore();
      console.log(`[TEST RESULT] query used: ${JSON.stringify(usedQuery)}`);
      expect(usedQuery.$expr).toBeUndefined();
      expect(usedQuery["answers.0"]).toEqual({ $exists: false });
    });

    test("`status` combines with a `filter` sort — solved questions sorted by most viewed", async () => {
      console.log("[TEST] status + filter › solved, sorted by views");
      const answerId = oid();
      await seedQuestions(author, 4, (i) => ({
        // Every question is solved, so status:"solved" alone wouldn't narrow anything —
        // the only way "views" ordering below can be right is if status combined with filter.
        answers: [answerId],
        acceptedAnswers: [answerId],
        views: [30, 10, 40, 20][i],
      }));

      const page = await questionService.getQuestionsFeed({ status: "solved", filter: "views", limit: 50 });

      console.log(`[TEST RESULT] order: ${titles(page).join(" > ")}`);
      expect(titles(page)).toEqual(["question 03", "question 01", "question 04", "question 02"]);
    });

    test("an explicit `status` overrides a status-shaped `filter` value", async () => {
      console.log("[TEST] status overrides legacy filter when both are status-like");
      const answerId = oid();
      await seedQuestions(author, 3, (i) => ({
        answers: i === 0 ? [] : [answerId],
        acceptedAnswers: [],
      }));

      // Legacy caller shape says "unanswered", but the new `status` field says "answered" — status wins.
      const page = await questionService.getQuestionsFeed({ filter: "unanswered", status: "answered", limit: 50 });

      console.log(`[TEST RESULT] count=${page.questions.length}`);
      expect(page.questions).toHaveLength(2);
    });
  });

  describe("popular / most-viewed (offset cursor)", () => {
    test("'popular' orders by upvote COUNT, not by the array's largest ObjectId", async () => {
      console.log("[TEST] popular › ordered by number of upvotes");
      const voters = await Promise.all([1, 2, 3, 4].map((n) => insertUser(`v${n}`)));
      // Give the question with the FEWEST upvotes voters with the numerically largest ids,
      // which is exactly what fooled the old `sort({ upvotes: -1 })`.
      const sortedVoters = [...voters].sort((a, b) => String(a).localeCompare(String(b)));
      await seedQuestions(author, 3, (i) => ({
        upvotes: i === 0 ? sortedVoters : i === 1 ? [sortedVoters[3]] : [sortedVoters[0], sortedVoters[1]],
      }));

      const page = await questionService.getQuestionsFeed({ filter: "popular", limit: 10 });

      console.log(`[TEST RESULT] popular order: ${titles(page).join(" > ")}`);
      expect(titles(page)).toEqual(["question 01", "question 03", "question 02"]); // 4, 2, 1 upvotes
    });

    test("'popular' pages are stable: every question appears exactly once across pages", async () => {
      const voters = await Promise.all([1, 2, 3].map((n) => insertUser(`pv${n}`)));
      await seedQuestions(author, 17, (i) => ({ upvotes: voters.slice(0, i % 4 > 3 ? 3 : i % 4) }));

      const pages = await walk({ filter: "popular", limit: 5 });
      const all = pages.flatMap(titles);

      console.log(`[TEST RESULT] popular pages=${pages.length}, total=${all.length}, unique=${new Set(all).size}, cursors=${pages.map((p) => p.nextCursor)}`);
      expect(all).toHaveLength(17);
      expect(new Set(all).size).toBe(17);
      expect(pages[0].nextCursor).toBe("o:5"); // offset cursor, NOT a createdAt date
      expect(pages[pages.length - 1].hasMore).toBe(false);
    });

    test("'views' orders by view count and pages without duplicates", async () => {
      await seedQuestions(author, 11, (i) => ({ views: (i * 7) % 11 }));
      const pages = await walk({ filter: "views", limit: 4 });
      const all = pages.flatMap((p) => p.questions);
      expect(all).toHaveLength(11);
      expect(new Set(all.map((q) => String(q._id))).size).toBe(11);
      const views = all.map((q) => q.views);
      expect(views).toEqual([...views].sort((a, b) => b - a));
    });
  });

  describe("search (ranked list, offset cursor)", () => {
    const seedSearchCorpus = async () => {
      const bob = await insertUser("bobthebuilder");
      await Question.collection.insertMany([
        { _id: oid(), userId: author, title: "How do I fix hostel wifi issues", body: "wifi keeps dropping in the hostel", category: "Hostel & Facilities", tags: ["hostel", "wi-fi"], answers: [], acceptedAnswers: [], upvotes: [], downvotes: [], views: 0, createdAt: new Date("2025-02-01T10:00:00Z") },
        { _id: oid(), userId: author, title: "Best React tutorial for beginners", body: "looking for a react guide", category: "Technical", tags: ["react"], answers: [], acceptedAnswers: [], upvotes: [], downvotes: [], views: 0, createdAt: new Date("2025-02-02T10:00:00Z") },
        { _id: oid(), userId: bob, title: "Library timings during exams", body: "when does the library close", category: "Campus Life", tags: ["library"], answers: [], acceptedAnswers: [], upvotes: [], downvotes: [], views: 0, createdAt: new Date("2025-02-03T10:00:00Z") },
      ]);
    };

    test("full-text search finds the right question", async () => {
      console.log("[TEST] search › $text match");
      await seedSearchCorpus();
      const page = await questionService.getQuestionsFeed({ search: "react", limit: 10 });
      console.log(`[TEST RESULT] ${titles(page).join(" | ")}`);
      expect(titles(page)).toEqual(["Best React tutorial for beginners"]);
    });

    test("partial words fall back to fuzzy matching when $text finds nothing", async () => {
      console.log("[TEST] search › partial word 'wif' still finds the wifi question");
      await seedSearchCorpus();
      const page = await questionService.getQuestionsFeed({ search: "wif", limit: 10 });
      expect(titles(page)).toEqual(["How do I fix hostel wifi issues"]);
    });

    test("searching @username returns that author's questions", async () => {
      await seedSearchCorpus();
      const page = await questionService.getQuestionsFeed({ search: "@bobthe", limit: 10 });
      expect(titles(page)).toEqual(["Library timings during exams"]);
    });

    test("search respects category filters", async () => {
      await seedSearchCorpus();
      const hit = await questionService.getQuestionsFeed({ search: "hostel", category: "Hostel & Facilities", limit: 10 });
      const miss = await questionService.getQuestionsFeed({ search: "hostel", category: "Technical", limit: 10 });
      expect(hit.questions).toHaveLength(1);
      expect(miss.questions).toHaveLength(0);
    });

    test("search pagination: pages never exceed the page size and cover every match exactly once", async () => {
      console.log("[TEST] search › 25 matches, page size 10 → 10/10/5, opaque offset cursors, exact hasMore");
      await seedQuestions(author, 25, (i) => ({ title: `kubernetes tips ${i}`, body: "kubernetes cluster" }));
      // Force the fuzzy fallback path too by ALSO matching an @username query:
      const pages = await walk({ search: "kubernetes", limit: 10 });

      const all = pages.flatMap(titles);
      console.log(`[TEST RESULT] sizes=${pages.map((p) => p.questions.length)}, unique=${new Set(all).size}, cursors=${pages.map((p) => p.nextCursor)}`);
      expect(pages.every((p) => p.questions.length <= 10)).toBe(true);
      expect(pages.map((p) => p.questions.length)).toEqual([10, 10, 5]);
      expect(pages.map((p) => p.hasMore)).toEqual([true, true, false]);
      expect(all).toHaveLength(25);
      expect(new Set(all).size).toBe(25);
      expect(pages[0].nextCursor).toBe("o:10");
      expect(pages[1].nextCursor).toBe("o:20");
    });

    test("search pagination is stable when a fuzzy fallback merges extra results (old code returned up to 2x the page size)", async () => {
      console.log("[TEST] search › fuzzy merge can no longer inflate a page");
      const bob = await insertUser("kubby");
      await seedQuestions(author, 14, (i) => ({ title: `kube note ${i}`, body: "" }));
      await seedQuestions(bob, 14, (i) => ({ title: `unrelated ${i}` }));

      // "kub" matches nothing via $text (partial), matches 14 titles + 14 by username "kubby".
      const pages = await walk({ search: "kub", limit: 10 });
      const all = pages.flatMap(titles);
      console.log(`[TEST RESULT] sizes=${pages.map((p) => p.questions.length)}, unique=${new Set(all).size}`);
      expect(pages.every((p) => p.questions.length <= 10)).toBe(true);
      expect(new Set(all).size).toBe(all.length);
      expect(all.length).toBe(28);
    });

    test("repeating the same search twice yields the same ordering (deterministic ranking)", async () => {
      await seedQuestions(author, 12, (i) => ({ title: `algorithms ${i}`, body: "algorithms" }));
      const a = await walk({ search: "algorithms", limit: 5 });
      const b = await walk({ search: "algorithms", limit: 5 });
      expect(a.flatMap(titles)).toEqual(b.flatMap(titles));
    });

    test("regex metacharacters in a search are treated literally (no ReDoS / no crash)", async () => {
      await seedSearchCorpus();
      const page = await questionService.getQuestionsFeed({ search: "(a+)+$.*", limit: 10 });
      expect(page.questions).toEqual([]);
      expect(page.hasMore).toBe(false);
    });
  });

  describe("cursor helpers", () => {
    test("parseFeedCursor understands date and offset cursors and ignores garbage", () => {
      expect(parseFeedCursor(null)).toEqual({ offset: 0, date: null });
      expect(parseFeedCursor("o:30")).toEqual({ offset: 30, date: null });
      expect(parseFeedCursor("o:-4")).toEqual({ offset: 0, date: null });
      expect(parseFeedCursor("o:99999").offset).toBe(1000);
      expect(parseFeedCursor("2025-01-30T10:00:00.000Z").date.toISOString()).toBe("2025-01-30T10:00:00.000Z");
      expect(parseFeedCursor("not-a-date")).toEqual({ offset: 0, date: null });
    });

    test("paginateList slices a ranked list with an exact hasMore", () => {
      const list = [1, 2, 3, 4, 5];
      expect(paginateList(list, 0, 2)).toEqual({ items: [1, 2], hasMore: true, nextCursor: "o:2" });
      expect(paginateList(list, 4, 2)).toEqual({ items: [5], hasMore: false, nextCursor: null });
      expect(paginateList(list, 2, 3)).toEqual({ items: [3, 4, 5], hasMore: false, nextCursor: null });
    });
  });
});
