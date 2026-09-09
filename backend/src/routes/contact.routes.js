import express from "express";
import rateLimit from "express-rate-limit";
import { submitContactMessage } from "../controllers/contact.controller.js";

const router = express.Router();

// Rate limiter: Max 10 submissions per 15 minutes per IP
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many contact requests from this IP. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/v1/contact
router.post("/", contactLimiter, submitContactMessage);

export default router;
