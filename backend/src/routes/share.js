const express = require("express");
const { body, param } = require("express-validator");
const { createShare, getShare } = require("../controllers/shareController");
const validateRequest = require("../middleware/validateRequest");

const router = express.Router();

/**
 * POST /api/share
 * Creates a new share link for the provided code
 */
router.post(
  "/",
  [
    body("code").notEmpty().withMessage("Code is required").isString().withMessage("Code must be a string").isLength({ max: 500000 }).withMessage("Code cannot exceed 500KB"),
    body("title").optional().isString().withMessage("Title must be a string").isLength({ max: 100 }).withMessage("Title cannot exceed 100 characters"),
  ],
  validateRequest,
  createShare,
);

/**
 * GET /api/share/:shareId
 * Retrieves shared code by share ID (case-insensitive)
 */
router.get(
  "/:shareId",
  [
    param("shareId")
      .notEmpty()
      .withMessage("Share ID is required")
      .isLength({ min: 4, max: 4 })
      .withMessage("Share ID must be exactly 4 characters")
      .matches(/^[a-zA-Z]{4}$/)
      .withMessage("Share ID must contain only alphabetical characters"),
  ],
  validateRequest,
  getShare,
);

module.exports = router;
