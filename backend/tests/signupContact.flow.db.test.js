import { jest } from "@jest/globals";
import express from "express";
import cookieParser from "cookie-parser";
import supertest from "supertest";
import { MemoryStore } from "express-rate-limit";
import { startTestDb, stopTestDb, clearTestDb } from "./helpers/mongo.js";

/**
 * End-to-end signup (send OTP → register) and contact-form flows through the
 * real routes, controllers, services and Mongoose models. Only the edges are
 * faked: Redis is an in-memory map, email sending is captured instead of sent.
 */
process.env.ACCESS_TOKEN_SECRET ||= "test-access-secret";
process.env.REFRESH_TOKEN_SECRET ||= "test-refresh-secret";
process.env.ACCESS_TOKEN_EXPIRY ||= "15m";
process.env.REFRESH_TOKEN_EXPIRY ||= "7d";

const store = new Map();
const fakeRedis = {
  setEx: async (key, _ttl, value) => { store.set(key, String(value)); return "OK"; },
  get: async (key) => (store.has(key) ? store.get(key) : null),
  del: async (key) => (store.delete(key) ? 1 : 0),
};

const sentEmails = [];
const contactEmails = [];
const mockSendContactFormEmail = jest.fn(async (data) => {
  contactEmails.push(data);
  return { success: true, messageId: "m1", provider: "test" };
});

jest.unstable_mockModule("../src/utils/redis.js", () => ({
  connectRedis: async () => {},
  getRedisClient: () => fakeRedis,
}));
const limiterStores = [];
jest.unstable_mockModule("../src/utils/rateLimitStore.js", () => ({
  createRateLimitStore: () => {
    const s = new MemoryStore();
    limiterStores.push(s);
    return s;
  },
}));
jest.unstable_mockModule("../src/utils/email.service.js", () => ({
  sendEmail: async (to, subject, text, options) => {
    sentEmails.push({ to, subject, text, options });
  },
  sendContactFormEmail: mockSendContactFormEmail,
}));

const authRoutes = (await import("../src/routes/auth.routes.js")).default;
const contactRoutes = (await import("../src/routes/contact.routes.js")).default;
const { User } = await import("../models/users.js");
const { ContactMessage } = await import("../src/models/contactMessage.model.js");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/contact", contactRoutes);
app.use((err, req, res, _next) => {
  res.status(err.statusCode || 500).json({ success: false, message: err.message });
});

const lastOtp = () => sentEmails.at(-1)?.text.match(/\b\d{6}\b/)?.[0];

// Each test gets its own client IP so the per-IP OTP limiter doesn't carry over.
let ipCounter = 0;
const agent = () => {
  const ip = `10.0.0.${++ipCounter}`;
  const withIp = (req) => req.set("X-Forwarded-For", ip);
  const request = supertest(app);
  return { post: (url) => withIp(request.post(url)) };
};

const signup = {
  email: "new.student.20231234@mnnit.ac.in",
  password: "Strongpass1",
  fullName: "New Student",
  department: "Computer Science and Engineering",
};

describe("Signup with OTP and contact form (real routes + MongoDB)", () => {
  beforeAll(async () => {
    await startTestDb();
  }, 180000);

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    store.clear();
    await Promise.all(limiterStores.map((s) => s.resetAll()));
    sentEmails.length = 0;
    contactEmails.length = 0;
    mockSendContactFormEmail.mockClear();
  });

  test("send-otp emails a 6-digit code, register with it creates the user and signs them in", async () => {
    const client = agent();
    const sent = await client.post("/api/v1/auth/send-otp").send({ email: signup.email });
    expect(sent.status).toBe(200);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe(signup.email);
    expect(sentEmails[0].options.intro).toMatch(/creating your/);
    const otp = lastOtp();
    expect(otp).toMatch(/^\d{6}$/);

    const res = await client.post("/api/v1/auth/register").send({ ...signup, otp });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(signup.email);
    expect(res.body.user.password).toBeUndefined();
    const cookies = res.headers["set-cookie"].join(";");
    expect(cookies).toMatch(/accesstoken=/);
    expect(cookies).toMatch(/refreshtoken=/);

    const saved = await User.findOne({ email: signup.email }).select("+password");
    expect(saved).not.toBeNull();
    expect(saved.password).not.toBe(signup.password); // hashed
    expect(await saved.matchPassword(signup.password)).toBe(true);

    // The code is single-use.
    expect(store.has(`otp:${signup.email}`)).toBe(false);
  });

  test("the new account can log in with its password", async () => {
    const client = agent();
    await client.post("/api/v1/auth/send-otp").send({ email: signup.email });
    await client.post("/api/v1/auth/register").send({ ...signup, otp: lastOtp() });

    const login = await client.post("/api/v1/auth/login").send({ email: signup.email, password: signup.password });
    expect(login.status).toBe(200);
  });

  test("a wrong code is rejected and no user is created", async () => {
    const client = agent();
    await client.post("/api/v1/auth/send-otp").send({ email: signup.email });
    const wrong = lastOtp() === "000000" ? "111111" : "000000";

    const res = await client.post("/api/v1/auth/register").send({ ...signup, otp: wrong });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid or expired OTP");
    expect(await User.countDocuments()).toBe(0);
  });

  test("an expired (or never-sent) code is rejected", async () => {
    const client = agent();
    await client.post("/api/v1/auth/send-otp").send({ email: signup.email });
    const otp = lastOtp();
    store.clear(); // what Redis does when the 10-minute TTL runs out

    const res = await client.post("/api/v1/auth/register").send({ ...signup, otp });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid or expired OTP");
  });

  test("resending replaces the code: only the newest one works", async () => {
    const client = agent();
    await client.post("/api/v1/auth/send-otp").send({ email: signup.email });
    const first = lastOtp();
    await client.post("/api/v1/auth/send-otp").send({ email: signup.email });
    const second = lastOtp();

    if (first !== second) {
      const old = await client.post("/api/v1/auth/register").send({ ...signup, otp: first });
      expect(old.status).toBe(400);
    }
    const res = await client.post("/api/v1/auth/register").send({ ...signup, otp: second });
    expect(res.status).toBe(201);
  });

  test("a code sent to a mixed-case email works when the email is retyped in lowercase", async () => {
    const client = agent();
    await client.post("/api/v1/auth/send-otp").send({ email: "New.Student.20231234@MNNIT.ac.in" });
    const res = await client.post("/api/v1/auth/register").send({ ...signup, otp: lastOtp() });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(signup.email);
  });

  test("an already-registered email can't request a code or register again", async () => {
    const client = agent();
    await client.post("/api/v1/auth/send-otp").send({ email: signup.email });
    await client.post("/api/v1/auth/register").send({ ...signup, otp: lastOtp() });

    const again = await client.post("/api/v1/auth/send-otp").send({ email: signup.email.toUpperCase() });
    expect(again.status).toBe(400);
    expect(again.body.message).toBe("Email is already registered");
    expect(await User.countDocuments()).toBe(1);
  });

  test("non-institutional emails never get a code", async () => {
    const res = await agent().post("/api/v1/auth/send-otp").send({ email: "someone@gmail.com" });
    expect(res.status).toBe(400);
    expect(sentEmails).toHaveLength(0);
  });

  describe("rate limits", () => {
    const createAccount = async () => {
      const client = agent();
      await client.post("/api/v1/auth/send-otp").send({ email: signup.email });
      const res = await client.post("/api/v1/auth/register").send({ ...signup, otp: lastOtp() });
      expect(res.status).toBe(201);
      return res.headers["set-cookie"];
    };

    test("5 wrong codes lock that email even when each guess comes from a different IP", async () => {
      await agent().post("/api/v1/auth/send-otp").send({ email: signup.email });
      const wrong = lastOtp() === "000000" ? "111111" : "000000";
      for (let i = 0; i < 5; i++) {
        const r = await agent().post("/api/v1/auth/register").send({ ...signup, otp: wrong });
        expect(r.status).toBe(400);
      }
      const locked = await agent().post("/api/v1/auth/register").send({ ...signup, otp: lastOtp() });
      expect(locked.status).toBe(429);
      expect(locked.body.message).toMatch(/Too many incorrect codes for this email/);
    });

    test("one email's lockout doesn't block other students on the same network", async () => {
      const hostel = agent();
      await hostel.post("/api/v1/auth/send-otp").send({ email: signup.email });
      for (let i = 0; i < 6; i++) {
        await hostel.post("/api/v1/auth/register").send({ ...signup, otp: "000001" });
      }
      const other = { ...signup, email: "other.student.20231111@mnnit.ac.in" };
      await hostel.post("/api/v1/auth/send-otp").send({ email: other.email });
      const res = await hostel.post("/api/v1/auth/register").send({ ...other, otp: lastOtp() });
      expect(res.status).toBe(201);
    });

    test("at most 5 codes can be requested per email", async () => {
      const statuses = [];
      for (let i = 0; i < 6; i++) {
        statuses.push((await agent().post("/api/v1/auth/send-otp").send({ email: signup.email })).status);
      }
      expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
      expect(sentEmails).toHaveLength(5);
    });

    test("10 wrong passwords lock the account; the email's case doesn't get around it", async () => {
      await createAccount();
      for (let i = 0; i < 10; i++) {
        const email = i % 2 ? signup.email.toUpperCase() : signup.email;
        const r = await agent().post("/api/v1/auth/login").send({ email, password: "Wrongpass9" });
        expect(r.status).toBe(401);
      }
      const locked = await agent().post("/api/v1/auth/login").send({ email: signup.email, password: signup.password });
      expect(locked.status).toBe(429);
      expect(locked.body).toEqual({ success: false, message: expect.stringMatching(/failed login attempts/) });
    });

    test("successful logins don't use up the account's budget", async () => {
      await createAccount();
      for (let i = 0; i < 12; i++) {
        const r = await agent().post("/api/v1/auth/login").send({ email: signup.email, password: signup.password });
        expect(r.status).toBe(200);
      }
    });

    test("change password allows 5 wrong current passwords, then blocks", async () => {
      const cookies = await createAccount();
      const client = agent();
      const attempt = () =>
        client
          .post("/api/v1/auth/change-password")
          .set("Cookie", cookies)
          .send({ currentPassword: "Wrongpass9", newPassword: "Newerpass2" });
      for (let i = 0; i < 5; i++) {
        expect((await attempt()).status).not.toBe(429);
      }
      const locked = await attempt();
      expect(locked.status).toBe(429);
      expect(locked.body.message).toMatch(/Too many password change attempts/);
    });
  });

  test("password-reset codes use reset wording, not registration wording", async () => {
    const client = agent();
    await client.post("/api/v1/auth/send-otp").send({ email: signup.email });
    await client.post("/api/v1/auth/register").send({ ...signup, otp: lastOtp() });

    const res = await client.post("/api/v1/auth/forgot-password-otp").send({ email: signup.email });
    expect(res.status).toBe(200);
    expect(sentEmails.at(-1).options.intro).toMatch(/reset your/);

    const reset = await client
      .post("/api/v1/auth/reset-password")
      .send({ email: signup.email, otp: lastOtp(), newPassword: "Newerpass2" });
    expect(reset.status).toBe(200);
    const login = await client.post("/api/v1/auth/login").send({ email: signup.email, password: "Newerpass2" });
    expect(login.status).toBe(200);
  });

  describe("contact form", () => {
    const message = {
      name: "Visitor",
      email: "Visitor@Example.com",
      category: "Bug Report",
      subject: "Upload fails",
      message: "The upload button does nothing.",
    };

    test("saves the message and emails the founders", async () => {
      const res = await agent().post("/api/v1/contact").send(message);
      expect(res.status).toBe(201);

      const saved = await ContactMessage.findById(res.body.data.id);
      expect(saved.email).toBe("visitor@example.com");
      expect(saved.category).toBe("Bug Report");
      expect(saved.emailSent).toBe(true);
      expect(contactEmails).toHaveLength(1);
      expect(contactEmails[0]).toMatchObject({ name: "Visitor", email: "visitor@example.com", subject: "Upload fails" });
    });

    test("still saves the message when the email can't be sent", async () => {
      mockSendContactFormEmail.mockRejectedValueOnce(new Error("SMTP down"));
      const res = await agent().post("/api/v1/contact").send(message);
      expect(res.status).toBe(201);
      const saved = await ContactMessage.findById(res.body.data.id);
      expect(saved.emailSent).toBe(false);
      expect(saved.emailError).toBe("SMTP down");
    });

    test("an over-long message gets a clear 400, not a 500", async () => {
      const res = await agent().post("/api/v1/contact").send({ ...message, message: "x".repeat(3001) });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Message cannot exceed 3000 characters.");
      expect(await ContactMessage.countDocuments()).toBe(0);
    });

    test("an unknown category falls back to General Inquiry", async () => {
      const res = await agent().post("/api/v1/contact").send({ ...message, category: "Spam" });
      expect(res.status).toBe(201);
      const saved = await ContactMessage.findById(res.body.data.id);
      expect(saved.category).toBe("General Inquiry");
    });
  });
});
