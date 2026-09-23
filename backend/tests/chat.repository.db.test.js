import { startTestDb, stopTestDb, clearTestDb, ensureIndexes, oid } from "./helpers/mongo.js";

const { Chat, Message } = await import("../models/chat.js");
const { User } = await import("../models/users.js");
const { ChatMemberSettings } = await import("../src/models/chatMemberSettings.model.js");
const chatRepo = await import("../src/repositories/chat.repository.js");

const makeUser = (name) =>
  User.collection
    .insertOne({
      _id: oid(),
      username: name,
      fullName: `${name} Full`,
      email: `${name}@example.com`,
      avatar: `https://img.test/${name}.png`,
    })
    .then((r) => r.insertedId);

describe("Chat repository (real MongoDB)", () => {
  let alice;
  let bob;
  let chat;

  beforeAll(async () => {
    await startTestDb();
    await ensureIndexes(Chat, Message, ChatMemberSettings);
  }, 180000);

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    alice = await makeUser("alice");
    bob = await makeUser("bob");
    chat = await Chat.create({ chatName: "Direct Message", isGroup: false, participants: [alice, bob] });
  });

  describe("getMessages cursor pagination", () => {
    test("ties on createdAt are broken by _id instead of silently dropped", async () => {
      console.log("[TEST] getMessages › same-millisecond messages all survive pagination via the _id tie-break");
      const sharedTime = new Date("2026-01-01T00:00:00.000Z");
      const docs = Array.from({ length: 5 }, (_, i) => ({
        sender: alice,
        chat: chat._id,
        content: `msg${i}`,
        createdAt: sharedTime,
        updatedAt: sharedTime,
      }));
      await Message.collection.insertMany(docs);

      const page1 = await chatRepo.getMessages(chat._id, { limit: 3 });
      expect(page1.messages).toHaveLength(3);
      expect(page1.hasMore).toBe(true);

      const page2 = await chatRepo.getMessages(chat._id, { limit: 3, cursor: page1.nextCursor });
      expect(page2.messages).toHaveLength(2);
      expect(page2.hasMore).toBe(false);

      const seenContents = new Set([
        ...page1.messages.map((m) => m.content),
        ...page2.messages.map((m) => m.content),
      ]);
      console.log(`[TEST RESULT] union across both pages has ${seenContents.size} distinct messages`);
      expect(seenContents.size).toBe(5);
    });

    test("`after` hides messages at or before a delete-for-me cutoff", async () => {
      console.log("[TEST] getMessages › `after` cutoff (clearChatForUser) hides old messages, keeps new ones");
      await Message.create({ sender: alice, chat: chat._id, content: "old" });
      await new Promise((r) => setTimeout(r, 5));
      const cutoff = new Date();
      await new Promise((r) => setTimeout(r, 5));
      await Message.create({ sender: bob, chat: chat._id, content: "fresh" });

      const result = await chatRepo.getMessages(chat._id, { limit: 25, after: cutoff });
      const contents = result.messages.map((m) => m.content);
      console.log(`[TEST RESULT] visible after cutoff: ${contents.join(", ")}`);
      expect(contents).toEqual(["fresh"]);
      expect(contents).not.toContain("old");
    });
  });

  describe("findMessagesByClientId (idempotent resend)", () => {
    test("finds a message previously created with the same clientId", async () => {
      console.log("[TEST] findMessagesByClientId › returns the original send instead of nothing");
      await Message.create({ sender: alice, chat: chat._id, content: "hi", clientId: "abc123" });

      const found = await chatRepo.findMessagesByClientId(alice, "abc123");
      expect(found).toHaveLength(1);
      expect(found[0].content).toBe("hi");
    });

    test("matches per-file suffixed clientIds from a multi-file send", async () => {
      console.log("[TEST] findMessagesByClientId › `<id>:0`, `<id>:1` both match the `<id>` prefix");
      await Message.create([
        { sender: alice, chat: chat._id, media: "https://x/1.png", mediaType: "image", clientId: "batch1:0" },
        { sender: alice, chat: chat._id, media: "https://x/2.png", mediaType: "image", clientId: "batch1:1" },
      ]);

      const found = await chatRepo.findMessagesByClientId(alice, "batch1");
      console.log(`[TEST RESULT] matched ${found.length} messages for prefix "batch1"`);
      expect(found).toHaveLength(2);
    });

    test("the unique (sender, clientId) index rejects a true double-insert", async () => {
      console.log("[TEST] unique index › second insertMany with a colliding clientId throws E11000");
      await Message.create({ sender: alice, chat: chat._id, content: "one", clientId: "dupe" });
      await expect(
        Message.create({ sender: alice, chat: chat._id, content: "one again", clientId: "dupe" })
      ).rejects.toThrow(/duplicate key|E11000/);
    });

    test("the same clientId from two different senders does not collide", async () => {
      console.log("[TEST] unique index › scoped per-sender, not global");
      await Message.create({ sender: alice, chat: chat._id, content: "a", clientId: "shared" });
      await expect(
        Message.create({ sender: bob, chat: chat._id, content: "b", clientId: "shared" })
      ).resolves.toBeTruthy();
    });
  });

  describe("chat list pagination + member settings", () => {
    test("findChatsByUser excludes pinned ids and paginates the rest by cursor", async () => {
      console.log("[TEST] findChatsByUser › excludeIds keeps a pinned chat out of the normal cursor stream");
      const carol = await makeUser("carol");
      const chat2 = await Chat.create({ chatName: "Direct Message", isGroup: false, participants: [alice, carol] });

      const page = await chatRepo.findChatsByUser(alice, { limit: 10, excludeIds: [chat2._id] });
      const ids = page.chats.map((c) => c._id.toString());
      console.log(`[TEST RESULT] returned chat ids: ${ids.join(", ")}`);
      expect(ids).toContain(chat._id.toString());
      expect(ids).not.toContain(chat2._id.toString());
    });

    test("upsertMemberSetting is create-then-update idempotent, and unique per (user, chat)", async () => {
      console.log("[TEST] upsertMemberSetting › pin then mute the same chat merges rather than overwrites");
      await chatRepo.upsertMemberSetting(chat._id, alice, { pinned: true, pinnedAt: new Date() });
      const afterPin = await chatRepo.findMemberSetting(chat._id, alice);
      expect(afterPin.pinned).toBe(true);

      await chatRepo.upsertMemberSetting(chat._id, alice, { muted: true });
      const afterMute = await chatRepo.findMemberSetting(chat._id, alice);
      console.log(`[TEST RESULT] pinned=${afterMute.pinned}, muted=${afterMute.muted}`);
      expect(afterMute.pinned).toBe(true);
      expect(afterMute.muted).toBe(true);

      const count = await ChatMemberSettings.countDocuments({ chat: chat._id, user: alice });
      expect(count).toBe(1);
    });

    test("findMutedChatIdsByUser returns only this user's muted chats", async () => {
      await chatRepo.upsertMemberSetting(chat._id, alice, { muted: true });
      await chatRepo.upsertMemberSetting(chat._id, bob, { pinned: true, pinnedAt: new Date() });

      expect(await chatRepo.findMutedChatIdsByUser(alice)).toEqual([chat._id.toString()]);
      expect(await chatRepo.findMutedChatIdsByUser(bob)).toEqual([]);

      await chatRepo.upsertMemberSetting(chat._id, alice, { muted: false });
      expect(await chatRepo.findMutedChatIdsByUser(alice)).toEqual([]);
    });

    test("deleteChat also removes member settings for that chat", async () => {
      console.log("[TEST] deleteChat › ChatMemberSettings rows for the chat are cleaned up, not orphaned");
      await chatRepo.upsertMemberSetting(chat._id, alice, { muted: true });
      await chatRepo.deleteChat(chat._id);

      const remaining = await ChatMemberSettings.countDocuments({ chat: chat._id });
      expect(remaining).toBe(0);
    });
  });

  describe("read cursor, unread counts, delete-for-me, preview repair", () => {
    const at = (ms) => new Date(Date.UTC(2026, 0, 1) + ms);
    const msg = (sender, content, ms) =>
      Message.create({ sender, chat: chat._id, content, readBy: [sender], createdAt: at(ms) });

    test("markMessagesAsRead sets readBy and a read cursor that never moves backward", async () => {
      await msg(bob, "one", 1000);
      await chatRepo.markMessagesAsRead(chat._id, alice, at(5000));
      let setting = await chatRepo.findMemberSetting(chat._id, alice);
      expect(setting.lastReadAt.getTime()).toBe(at(5000).getTime());
      expect((await Message.findOne({ content: "one" })).readBy.map(String)).toContain(alice.toString());

      // A late, out-of-order receipt with an older timestamp is ignored
      await chatRepo.setLastReadAt(chat._id, alice, at(2000));
      setting = await chatRepo.findMemberSetting(chat._id, alice);
      expect(setting.lastReadAt.getTime()).toBe(at(5000).getTime());
    });

    test("countUnreadMessages counts only other people's messages after the cursor", async () => {
      await msg(bob, "read", 1000);
      await msg(bob, "new-1", 3000);
      await msg(alice, "mine", 3500);
      await msg(bob, "new-2", 4000);

      expect(await chatRepo.countUnreadMessages(chat._id, alice, { since: at(2000) })).toBe(2);
      // Legacy fallback (no cursor yet): readBy-based
      expect(await chatRepo.countUnreadMessages(chat._id, alice, { useReadBy: true })).toBe(3);
    });

    test("hidden messages disappear for that user only, and stop counting as unread", async () => {
      const theirs = await msg(bob, "hide me", 1000);
      await msg(bob, "keep", 2000);

      await chatRepo.hideMessagesForUser(chat._id, [theirs._id], alice);

      const forAlice = await chatRepo.getMessages(chat._id, { limit: 25, viewerId: alice });
      const forBob = await chatRepo.getMessages(chat._id, { limit: 25, viewerId: bob });
      expect(forAlice.messages.map((m) => m.content)).toEqual(["keep"]);
      expect(forBob.messages.map((m) => m.content)).toEqual(["hide me", "keep"]);
      expect(await chatRepo.countUnreadMessages(chat._id, alice, { useReadBy: true })).toBe(1);
    });

    test("refreshLastMessage repoints the chat at the newest surviving message", async () => {
      const older = await msg(alice, "older", 1000);
      const newest = await msg(alice, "newest", 2000);
      await Chat.updateOne({ _id: chat._id }, { lastMessage: newest._id });

      await chatRepo.deleteMessage(newest._id);
      await chatRepo.refreshLastMessage(chat._id);
      expect((await Chat.findById(chat._id)).lastMessage.toString()).toBe(older._id.toString());

      await chatRepo.deleteMessage(older._id);
      await chatRepo.refreshLastMessage(chat._id);
      expect((await Chat.findById(chat._id)).lastMessage).toBeNull();
    });
  });

  describe("in-chat search and shared media", () => {
    const at = (ms) => new Date(Date.UTC(2026, 1, 1) + ms);
    const make = (fields, ms) =>
      Message.create({ sender: alice, chat: chat._id, readBy: [alice], createdAt: at(ms), ...fields });

    test("search matches partial words, case-insensitively, newest first, and skips hidden messages", async () => {
      await make({ content: "Hello there" }, 1000);
      await make({ content: "unrelated" }, 2000);
      await make({ content: "SAY HELLO!" }, 3000);
      const hidden = await make({ content: "hello secret" }, 4000);
      await chatRepo.hideMessagesForUser(chat._id, [hidden._id], bob);

      const forBob = await chatRepo.searchMessagesInChat(chat._id, "hel", { viewerId: bob });
      expect(forBob.map((m) => m.content)).toEqual(["SAY HELLO!", "Hello there"]);

      const forAlice = await chatRepo.searchMessagesInChat(chat._id, "hel", { viewerId: alice });
      expect(forAlice).toHaveLength(3);
    });

    test("search treats regex characters literally", async () => {
      await make({ content: "is it (really) true?" }, 1000);
      await make({ content: "really" }, 2000);
      const results = await chatRepo.searchMessagesInChat(chat._id, "(really", {});
      expect(results.map((m) => m.content)).toEqual(["is it (really) true?"]);
    });

    test("getChatMedia filters by kind and pages newest-first with a cursor", async () => {
      for (let i = 0; i < 5; i++) {
        await make({ media: `https://cdn.test/img${i}.jpg`, mediaType: "image" }, 1000 + i);
      }
      await make({ media: "https://cdn.test/v.mp4", mediaType: "video" }, 2000);
      await make({ media: "https://cdn.test/notes.pdf", mediaType: "document" }, 3000);
      await make({ media: "https://cdn.test/v.webm", mediaType: "audio" }, 4000);
      await make({ content: "text only" }, 5000);

      const page1 = await chatRepo.getChatMedia(chat._id, { kind: "media", limit: 4 });
      expect(page1.items.map((m) => m.media)).toEqual([
        "https://cdn.test/v.mp4",
        "https://cdn.test/img4.jpg",
        "https://cdn.test/img3.jpg",
        "https://cdn.test/img2.jpg",
      ]);
      expect(page1.hasMore).toBe(true);

      const page2 = await chatRepo.getChatMedia(chat._id, { kind: "media", limit: 4, cursor: page1.nextCursor });
      expect(page2.items.map((m) => m.media)).toEqual(["https://cdn.test/img1.jpg", "https://cdn.test/img0.jpg"]);
      expect(page2.hasMore).toBe(false);

      const docs = await chatRepo.getChatMedia(chat._id, { kind: "docs" });
      expect(docs.items.map((m) => m.media)).toEqual(["https://cdn.test/notes.pdf"]);
      const audio = await chatRepo.getChatMedia(chat._id, { kind: "audio" });
      expect(audio.items).toHaveLength(1);
    });
  });
});
