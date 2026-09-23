import { ContactMessage } from "../models/contactMessage.model.js";
import { sendContactFormEmail } from "../utils/email.service.js";
import { AppError } from "../utils/error.js";
import logger from "../utils/logger.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same limits as the ContactMessage schema. Checked up front so an over-long
// field gets a clear 400 instead of a Mongoose ValidationError (a generic 500).
const MAX_NAME = 100;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 3000;

/**
 * POST /api/v1/contact
 * Handles contact form submissions, saves to MongoDB, and dispatches an email to founders via Brevo/SMTP.
 */
export const submitContactMessage = async (req, res, next) => {
  try {
    const { name, email, category, subject, message } = req.body;

    // Validation
    if (!name || typeof name !== "string" || !name.trim()) {
      throw new AppError("Name is required.", 400);
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      throw new AppError("Email is required.", 400);
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      throw new AppError("Please provide a valid email address.", 400);
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      throw new AppError("Message is required.", 400);
    }

    const trimmedName = name.trim();
    const trimmedSubject = subject && typeof subject === "string" ? subject.trim() : "";
    const trimmedMessage = message.trim();

    if (trimmedName.length > MAX_NAME) {
      throw new AppError(`Name cannot exceed ${MAX_NAME} characters.`, 400);
    }
    if (trimmedSubject.length > MAX_SUBJECT) {
      throw new AppError(`Subject cannot exceed ${MAX_SUBJECT} characters.`, 400);
    }
    if (trimmedMessage.length > MAX_MESSAGE) {
      throw new AppError(`Message cannot exceed ${MAX_MESSAGE} characters.`, 400);
    }
    const validCategory = [
      "General Inquiry",
      "Contribute to Linklet",
      "Timetable Issue",
      "Resource Hub",
      "Bug Report",
    ].includes(category)
      ? category
      : "General Inquiry";

    // 1. Save to Database
    const contactDoc = await ContactMessage.create({
      name: trimmedName,
      email: trimmedEmail,
      category: validCategory,
      subject: trimmedSubject,
      message: trimmedMessage,
    });

    logger.info(`New contact inquiry saved to DB (ID: ${contactDoc._id}) from ${trimmedEmail}`);

    // 2. Dispatch Email Notification asynchronously
    try {
      await sendContactFormEmail({
        name: trimmedName,
        email: trimmedEmail,
        category: validCategory,
        subject: trimmedSubject,
        message: trimmedMessage,
      });
      contactDoc.emailSent = true;
      await contactDoc.save();
    } catch (emailErr) {
      logger.error(`Failed to send contact notification email for ID ${contactDoc._id}:`, emailErr);
      contactDoc.emailSent = false;
      contactDoc.emailError = emailErr.message || "Email dispatch failed";
      await contactDoc.save();
    }

    return res.status(201).json({
      success: true,
      message: "Your message has been sent successfully! Our team will get back to you shortly.",
      data: {
        id: contactDoc._id,
      },
    });
  } catch (err) {
    next(err);
  }
};
