import { AppError } from "./error.js";
import logger from "./logger.js";
import { DEFAULT_CONTACT_EMAIL } from "../config/constants.js";

/**
 * Escape HTML special characters before interpolating untrusted input (a
 * contact-form submission from anyone, logged in or not) into an HTML email
 * body. Without this, a message like `<a href="https://evil.example">click
 * here</a>` renders as a real clickable link/markup in the founders' inbox —
 * classic HTML injection turning a support form into a phishing vector.
 */
const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const clean = (value) => (value || "").trim().replace(/^["']|["']$/g, "");

/** "someone@mnnit.ac.in" -> "so***@mnnit.ac.in", so logs don't collect addresses. */
const maskEmail = (email = "") => {
  const [user, domain] = String(email).split("@");
  return domain ? `${user.slice(0, 2)}***@${domain}` : "***";
};

/** Verified Brevo sender address (EMAIL_USER is the older name for the same setting). */
const senderAddress = () => clean(process.env.EMAIL_FROM || process.env.EMAIL_USER) || DEFAULT_CONTACT_EMAIL;

const isLocalDev = () => process.env.NODE_ENV !== "production" && !process.env.VERCEL;

/**
 * Send one email through Brevo's transactional API (HTTPS, so no SMTP port is
 * needed). Brevo is the only provider: a failure throws, and the caller turns
 * it into a user-facing error. Returns Brevo's response ({ messageId }).
 */
const sendViaBrevo = async (message) => {
  const apiKey = clean(process.env.BREVO_API_KEY);
  if (!apiKey) throw new Error("BREVO_API_KEY is not set");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Brevo's message names the problem, e.g. an unauthorised IP or sender.
    throw new Error(`Brevo HTTP ${res.status}: ${data.message || data.code || "unknown error"}`);
  }
  return data;
};

/**
 * Send a verification-code email (sign-up, password reset).
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} text - Plain-text body; its 6-digit code is shown large in the HTML
 * @param {{ intro?: string }} [options] - `intro` is the trusted HTML line shown
 *   above the code ("registering" vs. "resetting your password").
 */
export const sendEmail = async (to, subject, text, { intro = "Your <strong>Linklet</strong> verification code is:" } = {}) => {
  // Local development without a Brevo key: print instead of sending, so sign-up
  // can be tested offline. Never happens on Vercel or in production.
  if (!clean(process.env.BREVO_API_KEY) && isLocalDev()) {
    logger.warn(`[EMAIL] BREVO_API_KEY not set; not sending "${subject}" to ${to}. Body: ${text}`);
    return { messageId: "local-dev" };
  }

  const otpCode = text.match(/\d{6}/)?.[0] || "";
  try {
    const data = await sendViaBrevo({
      sender: { name: "Linklet", email: senderAddress() },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #7c3aed; margin-top: 0; margin-bottom: 12px; font-size: 22px;">Linklet Verification</h2>
              <p style="color: #374151; font-size: 15px; margin-bottom: 8px;">Hello,</p>
              <p style="color: #374151; font-size: 15px; margin-bottom: 20px;">${intro}</p>
              <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #111827; margin: 24px 0;">
                ${escapeHtml(otpCode || text)}
              </div>
              <p style="color: #6b7280; font-size: 13px; margin-bottom: 24px;">This code is valid for 10 minutes. If you did not request this, you can safely ignore this email.</p>
              <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 12px; color: #9ca3af; text-align: center;">
                Linklet — MNNIT Allahabad Community Platform
              </div>
            </div>
          `,
    });
    logger.info(`[EMAIL] Sent "${subject}" to ${maskEmail(to)} (Brevo ${data.messageId})`);
    return data;
  } catch (err) {
    logger.error(`[EMAIL] Failed to send "${subject}" to ${maskEmail(to)}: ${err.message}`);
    throw new AppError("Failed to send verification email. Please try again later.", 500);
  }
};

/**
 * Sends a contact form notification to founderslinklet@gmail.com
 * with replyTo set to the user who sent the message.
 * @param {Object} data - Contact form data { name, email, category, subject, message }
 */
export const sendContactFormEmail = async ({ name, email, category, subject, message }) => {
  const receiverEmail =
    clean(process.env.CONTACT_RECEIVER_EMAIL || process.env.FOUNDER_EMAIL) || DEFAULT_CONTACT_EMAIL;

  const emailSubject = `[Linklet Contact] [${category || "General Inquiry"}] ${subject || "New Message from " + name}`;

  // Every user-supplied value below is escaped — this HTML is built from an
  // unauthenticated public contact form.
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeCategory = escapeHtml(category || "General Inquiry");
  const safeSubject = escapeHtml(subject || "");
  const safeMessage = escapeHtml(message);
  const safeEmailSubjectHtml = escapeHtml(emailSubject);

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e4e4e7; border-radius: 14px; background: #ffffff; color: #18181b;">
      <div style="border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px;">
        <span style="display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; background: #ede9fe; color: #6d28d9; padding: 4px 10px; border-radius: 6px; margin-bottom: 8px;">
          New Contact Submission
        </span>
        <h2 style="color: #18181b; margin: 8px 0 4px 0; font-size: 22px; font-weight: 700;">${safeEmailSubjectHtml}</h2>
        <p style="color: #71717a; font-size: 13px; margin: 0;">Received via Linklet Campus Platform</p>
      </div>

      <div style="background: #f4f4f5; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #71717a; width: 110px; font-weight: 600;">From:</td>
            <td style="padding: 6px 0; color: #18181b; font-weight: 600;">${safeName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #71717a; font-weight: 600;">Sender Email:</td>
            <td style="padding: 6px 0; color: #7c3aed;">
              <a href="mailto:${safeEmail}" style="color: #7c3aed; text-decoration: none; font-weight: 600;">${safeEmail}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #71717a; font-weight: 600;">Category:</td>
            <td style="padding: 6px 0;">
              <span style="display: inline-block; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                ${safeCategory}
              </span>
            </td>
          </tr>
          ${
            subject
              ? `<tr>
                  <td style="padding: 6px 0; color: #71717a; font-weight: 600;">Subject:</td>
                  <td style="padding: 6px 0; color: #18181b;">${safeSubject}</td>
                </tr>`
              : ""
          }
        </table>
      </div>

      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; margin: 0 0 10px 0;">Message Content</h4>
        <div style="background: #fafafa; border: 1px solid #e4e4e7; border-left: 4px solid #7c3aed; border-radius: 8px; padding: 18px; font-size: 14px; line-height: 1.6; color: #27272a; white-space: pre-wrap;">${safeMessage}</div>
      </div>

      <div style="border-top: 1px solid #e4e4e7; padding-top: 18px; font-size: 12px; color: #71717a; text-align: center; line-height: 1.5;">
        💡 <strong>Quick Reply:</strong> Simply hit <strong>Reply</strong> in Gmail to answer <strong>${safeName}</strong> (<a href="mailto:${safeEmail}" style="color: #7c3aed; text-decoration: none;">${safeEmail}</a>) directly.
      </div>
    </div>
  `;

  const textContent = `New Contact Form Submission on Linklet\n\nFrom: ${name} (${email})\nCategory: ${category}\nSubject: ${subject || "N/A"}\n\nMessage:\n${message}\n\n--\nHit Reply to respond to ${email}`;

  if (!clean(process.env.BREVO_API_KEY) && isLocalDev()) {
    logger.warn(`[CONTACT EMAIL] BREVO_API_KEY not set; not sending. ${textContent}`);
    return { success: true, messageId: "local-dev", provider: "none" };
  }

  try {
    const data = await sendViaBrevo({
      sender: { name: "Linklet Contact Form", email: senderAddress() },
      to: [{ email: receiverEmail, name: "Linklet Founders" }],
      replyTo: { email, name },
      subject: emailSubject,
      htmlContent,
      textContent,
    });
    logger.info(`[CONTACT EMAIL] Delivered to ${maskEmail(receiverEmail)} (Brevo ${data.messageId})`);
    return { success: true, messageId: data.messageId, provider: "brevo" };
  } catch (err) {
    logger.error(`[CONTACT EMAIL] Failed: ${err.message}`);
    throw new AppError("Failed to dispatch contact email", 500);
  }
};
