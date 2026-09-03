import nodemailer from "nodemailer";
import { AppError } from "./error.js";
import logger from "./logger.js";

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

  console.log(`[EMAIL DISPATCH] Dispatching to ${to}. Brevo Key detected: ${!!brevoApiKey}`);

  // 1. Primary: Use Brevo HTTPS API (port 443 - never blocked by Render)
  if (brevoApiKey) {
    try {
      const senderEmail = (process.env.EMAIL_USER || "founderslinklet@gmail.com").trim().replace(/^["']|["']$/g, "");
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
        console.error(`[BREVO API ERROR] HTTP ${res.status}:`, JSON.stringify(data));
        logger.error(`Brevo API error (${res.status}):`, data);
        throw new Error(data.message || `Brevo API returned status ${res.status}`);
      }

      console.log(`[BREVO SUCCESS] Email successfully sent to ${to} (MessageId: ${data.messageId})`);
      logger.info(`Email successfully sent to ${to} via Brevo (MessageId: ${data.messageId})`);
      return data;
    } catch (err) {
      console.error("[EMAIL FAILED VIA BREVO]:", err.message);
      logger.error("Failed to send email via Brevo API:", err);
      throw new AppError("Failed to send verification email. Please try again later.", 500);
    }
  }

  console.log("[EMAIL FALLBACK] No BREVO_API_KEY found, attempting Nodemailer SMTP fallback...");

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
