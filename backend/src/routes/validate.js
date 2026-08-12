/**
 * Validation Routes
 * Handles workshop password validation without consuming usage quota
 */

const express = require("express");
const { body } = require("express-validator");
const validateRequest = require("../middleware/validateRequest");
const { inspectWorkshopAccess } = require("../middleware/workshopAccessAdapter");

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
  inspectWorkshopAccess,
  (req, res) => {
    const remainingUses = req.workshopAccessGrant.remaining;
    const isRateLimited = remainingUses === 0;

    res.json({
      valid: true,
      message: isRateLimited ? "Password is valid but rate limit reached" : "Password is valid",
      remainingUses,
      maxUses: req.workshopAccessGrant.maxUses,
      isRateLimited,
    });
  },
);

module.exports = router;
