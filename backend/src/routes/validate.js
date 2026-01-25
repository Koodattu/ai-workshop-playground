/**
 * Validation Routes
 * Handles workshop password validation without consuming usage quota
 */

const express = require("express");
const { body } = require("express-validator");
const validateRequest = require("../middleware/validateRequest");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { ERROR_CODES } = require("../constants/errorCodes");
const Password = require("../models/Password");
const Usage = require("../models/Usage");

const router = express.Router();

/**
 * POST /api/validate
 * Validate a workshop password without incrementing usage
 *
 * Request body:
 * - password: Workshop access password
 * - visitorId: Unique identifier for the visitor/machine
 *
 * Response:
 * - valid: boolean indicating if password is valid
 * - message: Success or error message
 * - remainingUses: Number of uses left for this visitor
 * - maxUses: Maximum uses allowed per visitor
 */
router.post(
  "/",
  [
    body("password").trim().notEmpty().withMessage("Workshop password is required"),
    body("visitorId").trim().notEmpty().withMessage("Visitor ID is required").isLength({ min: 8 }).withMessage("Visitor ID must be at least 8 characters"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { password, visitorId } = req.body;

    // Find password in database
    const passwordDoc = await Password.findOne({
      code: password,
      isActive: true,
    });

    if (!passwordDoc) {
      throw new AppError("Invalid workshop password", 401, ERROR_CODES.PASSWORD_INVALID);
    }

    // Check if password is expired
    if (passwordDoc.isExpired) {
      throw new AppError("Workshop password has expired", 401, ERROR_CODES.PASSWORD_EXPIRED);
    }

    // Get current usage for this visitor (without incrementing)
    const currentUsage = await Usage.getUsage(passwordDoc._id, visitorId);
    const remainingUses = Math.max(0, passwordDoc.maxUsesPerUser - currentUsage);

    // Check if rate limited (but don't throw error, just inform)
    const isRateLimited = remainingUses === 0;

    res.json({
      valid: true,
      message: isRateLimited ? "Password is valid but rate limit reached" : "Password is valid",
      remainingUses,
      maxUses: passwordDoc.maxUsesPerUser,
      isRateLimited,
    });
  }),
);

module.exports = router;
