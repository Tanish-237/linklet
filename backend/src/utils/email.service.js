import nodemailer from "nodemailer";
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

const getTransporter = () => {
  const user = (process.env.EMAIL_USER || "").trim().replace(/^["']|["']$/g, "");
  const pass = (process.env.EMAIL_PASS || "").trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");

  if (!user || !pass) {
    logger.error("EMAIL_USER or EMAIL_PASS environment variable is missing in deployment settings!");
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Use SSL for reliable cloud deployment
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
};

/**
 * Sends an email via Brevo HTTPS API (Port 443 - works reliably on Render Free Tier)
 * or falls back to Nodemailer SMTP if BREVO_API_KEY is not configured.
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} text - Email body text
 */
export const sendEmail = async (to, subject, text) => {
  const brevoApiKey = (
    process.env.BREVO_API_KEY ||
    process.env.BRAVO_API_KEY ||
    process.env.BREVO_KEY ||
    ""
  ).trim().replace(/^["']|["']$/g, "");

  logger.info(`[EMAIL DISPATCH] Dispatching to ${to}. Brevo Key detected: ${!!brevoApiKey}`);

  // 1. Primary: Use Brevo HTTPS API (port 443 - never blocked by Render)
  if (brevoApiKey) {
    try {
      const senderEmail = (process.env.EMAIL_USER || DEFAULT_CONTACT_EMAIL).trim().replace(/^["']|["']$/g, "");
      const otpCode = text.match(/\d{6}/)?.[0] || "";

      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json",
          "accept": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "Linklet",
            email: senderEmail,
          },
          to: [{ email: to }],
          subject,
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #7c3aed; margin-top: 0; margin-bottom: 12px; font-size: 22px;">Linklet Verification</h2>
              <p style="color: #374151; font-size: 15px; margin-bottom: 8px;">Hello,</p>
              <p style="color: #374151; font-size: 15px; margin-bottom: 20px;">Your OTP for registering on <strong>Linklet</strong> is:</p>
              <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #111827; margin: 24px 0;">
                ${otpCode || text}
              </div>
              <p style="color: #6b7280; font-size: 13px; margin-bottom: 24px;">This code is valid for 10 minutes. If you did not request this, you can safely ignore this email.</p>
              <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 12px; color: #9ca3af; text-align: center;">
                Linklet — MNNIT Allahabad Community Platform
              </div>
            </div>
          `,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        logger.error(`[BREVO API ERROR] HTTP ${res.status}: ${JSON.stringify(data)}`);
        throw new Error(data.message || `Brevo API returned status ${res.status}`);
      }

      logger.info(`[BREVO SUCCESS] Email successfully sent to ${to} via Brevo (MessageId: ${data.messageId})`);
      return data;
    } catch (err) {
      logger.error(`[EMAIL FAILED VIA BREVO]: ${err.message}`);
      throw new AppError("Failed to send verification email. Please try again later.", 500);
    }
  }

  logger.info("[EMAIL FALLBACK] No BREVO_API_KEY found, attempting Nodemailer SMTP fallback...");

  // 2. Secondary / Local fallback: Nodemailer SMTP
  try {
    const user = (process.env.EMAIL_USER || "").trim().replace(/^["']|["']$/g, "");
    const transporter = getTransporter();

    const mailOptions = {
      from: `"Linklet" <${user}>`,
      to,
      subject,
      text,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent successfully to ${to} via SMTP (MessageId: ${info.messageId})`);
    return info;
  } catch (error) {
    logger.error(`Error sending email to ${to}:`, error);
    throw new AppError("Failed to send verification email. Please try again later.", 500);
  }
};

/**
 * Sends a contact form notification to founderslinklet@gmail.com
 * with replyTo set to the user who sent the message.
 * @param {Object} data - Contact form data { name, email, category, subject, message }
 */
export const sendContactFormEmail = async ({ name, email, category, subject, message }) => {
  const receiverEmail = (
    process.env.CONTACT_RECEIVER_EMAIL ||
    process.env.FOUNDER_EMAIL ||
    DEFAULT_CONTACT_EMAIL
  ).trim().replace(/^["']|["']$/g, "");

  const brevoApiKey = (
    process.env.BREVO_API_KEY ||
    process.env.BRAVO_API_KEY ||
    process.env.BREVO_KEY ||
    ""
  ).trim().replace(/^["']|["']$/g, "");

  const senderEmail = (
    process.env.EMAIL_USER ||
    DEFAULT_CONTACT_EMAIL
  ).trim().replace(/^["']|["']$/g, "");

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

  logger.info(`[CONTACT EMAIL DISPATCH] Dispatching contact form notification to ${receiverEmail} (Reply-To: ${email}). Brevo Key: ${!!brevoApiKey}`);

  // 1. Primary: Brevo HTTPS API
  if (brevoApiKey) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json",
          "accept": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "Linklet Contact Form",
            email: senderEmail,
          },
          to: [{ email: receiverEmail, name: "Linklet Founders" }],
          replyTo: {
            email,
            name,
          },
          subject: emailSubject,
          htmlContent,
          textContent,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        logger.error(`[BREVO CONTACT EMAIL ERROR] HTTP ${res.status}: ${JSON.stringify(data)}`);
        throw new Error(data.message || `Brevo API returned status ${res.status}`);
      }

      logger.info(`[BREVO CONTACT SUCCESS] Notification delivered to ${receiverEmail} via Brevo (MessageId: ${data.messageId})`);
      return { success: true, messageId: data.messageId, provider: "brevo" };
    } catch (err) {
      logger.error(`[BREVO CONTACT EMAIL FAILED]: ${err.message}`);
      // Let it fall through to SMTP fallback or rethrow if desired
    }
  }

  // 2. Secondary: SMTP Fallback
  try {
    const transporter = getTransporter();
    const mailOptions = {
      from: `"Linklet Contact Form" <${senderEmail}>`,
      to: receiverEmail,
      replyTo: `"${name}" <${email}>`,
      subject: emailSubject,
      text: textContent,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Contact email sent to ${receiverEmail} via SMTP (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId, provider: "smtp" };
  } catch (error) {
    logger.error(`Error sending contact email to ${receiverEmail} via SMTP:`, error);
    throw new AppError("Failed to dispatch contact email", 500);
  }
};
