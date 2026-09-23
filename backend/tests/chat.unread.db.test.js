import { startTestDb, stopTestDb, clearTestDb, ensureIndexes, oid } from "./helpers/mongo.js";

const { Chat, Message } = await import("../models/chat.js");
const { User } = await import("../models/users.js");
const { ChatMemberSettings } = await import("../src/models/chatMemberSettings.model.js");
const chatService = await import("../src/services/chat.service.js");

const makeUser = (name) =>
  User.collection
    .insertOne({ _id: oid(), username: name, fullName: name, email: `${name}@example.com` })
    .then((r) => r.insertedId);

describe("Chat list unread counts (real MongoDB, through the service)", () => {
  let alice;
  let bob;
  let chat;

  const send = async (sender, content) => {
    const m = await Message.create({ sender, chat: chat._id, content, readBy: [sender] });
    await Chat.updateOne({ _id: chat._id }, { lastMessage: m._id });
    return m;
  };
  const unreadFor = async (userId) => {
    const { chats } = await chatService.getUserChats(userId);
    return chats.find((c) => c._id.toString() === chat._id.toString());
  };

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
    chat = await Chat.create({ chatName: "DM", isGroup: false, participants: [alice, bob] });
  });

  test("reports the real number of unread messages, not a flat 1", async () => {
    await send(bob, "hey");
    await send(bob, "you there?");
    await send(bob, "ping");

    const entry = await unreadFor(alice);
    expect(entry.unreadCount).toBe(3);
    expect(entry.lastReadAt).toBeNull();

    // The sender has nothing unread
    expect((await unreadFor(bob)).unreadCount).toBe(0);
  });

  test("reading the chat clears the count and sets the read cursor; only newer messages count after", async () => {
    await send(bob, "one");
    await send(bob, "two");
    await chatService.markAsRead(chat._id, alice);

    let entry = await unreadFor(alice);
    expect(entry.unreadCount).toBe(0);
    expect(entry.lastReadAt).toBeInstanceOf(Date);

    await new Promise((r) => setTimeout(r, 5));
    await send(bob, "three");
    entry = await unreadFor(alice);
    expect(entry.unreadCount).toBe(1);
  });

  test("replying marks the conversation read for the sender", async () => {
    await send(bob, "question?");
    await chatService.sendMessage(alice, { chatId: chat._id, content: "answer" }, []);
    // markMessagesAsRead runs fire-and-forget inside sendMessage
    await new Promise((r) => setTimeout(r, 50));

    expect((await unreadFor(alice)).unreadCount).toBe(0);
    const question = await Message.findOne({ content: "question?" });
    expect(question.readBy.map(String)).toContain(alice.toString());
  });
});
