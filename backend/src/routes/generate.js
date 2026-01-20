/**
 * Generate Routes
 * Handles AI code generation endpoints
 */

const express = require("express");
const { body } = require("express-validator");
const { generateCode } = require("../controllers/aiController");
const workshopGuard = require("../middleware/workshopGuard");
const validateRequest = require("../middleware/validateRequest");

const router = express.Router();

/**
 * POST /api/generate
 * Generate code using Gemini AI
 *
 * Request body:
 * - password: Workshop access password
 * - visitorId: Unique identifier for the visitor/machine
 * - prompt: The code generation prompt
 *
 * Response:
 * - code: Generated HTML/CSS/JS code
 * - remaining: Number of remaining requests
 */
router.post(
  "/",
  [
    body("password").trim().notEmpty().withMessage("Workshop password is required"),
    body("visitorId").trim().notEmpty().withMessage("Visitor ID is required").isLength({ min: 8 }).withMessage("Visitor ID must be at least 8 characters"),
    body("prompt")
      .trim()
      .notEmpty()
      .withMessage("Prompt is required")
      .isLength({ min: 10 })
      .withMessage("Prompt must be at least 10 characters")
      .isLength({ max: 10000 })
      .withMessage("Prompt must not exceed 10000 characters"),
    validateRequest,
  ],
  workshopGuard,
  generateCode,
);

module.exports = router;
