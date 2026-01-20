/**
 * Validation Routes
 * Handles workshop password validation without consuming usage quota
 */

const express = require("express");
const { body } = require("express-validator");
const validateRequest = require("../middleware/validateRequest");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const Password = require("../models/Password");

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
 */
router.post(
  "/",
  [
    body("password").trim().notEmpty().withMessage("Workshop password is required"),
    body("visitorId").trim().notEmpty().withMessage("Visitor ID is required").isLength({ min: 8 }).withMessage("Visitor ID must be at least 8 characters"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { password } = req.body;

    // Find password in database
    const passwordDoc = await Password.findOne({
      code: password,
      isActive: true,
    });

    if (!passwordDoc) {
      throw new AppError("Invalid workshop password", 401);
    }

    // Check if password is expired
    if (passwordDoc.isExpired) {
      throw new AppError("Workshop password has expired", 401);
    }

    res.json({
      valid: true,
      message: "Password is valid",
    });
  }),
);

module.exports = router;
