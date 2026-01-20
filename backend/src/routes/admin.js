/**
 * Admin Routes
 * Handles password management and usage statistics
 */

const express = require("express");
const { body, param, query } = require("express-validator");
const { verifyAdmin, verifyAdminCredentials, createPassword, listPasswords, getUsageStats, updatePassword, deletePassword } = require("../controllers/adminController");
const validateRequest = require("../middleware/validateRequest");

const router = express.Router();

/**
 * POST /api/admin/verify
 * Verify admin credentials
 */
router.post("/verify", verifyAdmin, verifyAdminCredentials);

// All other admin routes require admin authentication
router.use(verifyAdmin);

/**
 * POST /api/admin/passwords
 * Create a new workshop password
 */
router.post(
  "/passwords",
  [
    body("code").trim().notEmpty().withMessage("Password code is required").isLength({ min: 4 }).withMessage("Password code must be at least 4 characters"),
    body("expiresAt")
      .notEmpty()
      .withMessage("Expiration date is required")
      .isISO8601()
      .withMessage("Invalid date format. Use ISO 8601 format.")
      .custom((value) => {
        if (new Date(value) <= new Date()) {
          throw new Error("Expiration date must be in the future");
        }
        return true;
      }),
    body("maxUsesPerUser").optional().isInt({ min: 1, max: 1000 }).withMessage("Max uses per user must be between 1 and 1000"),
    body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
    validateRequest,
  ],
  createPassword,
);

/**
 * GET /api/admin/passwords
 * List all passwords with stats
 */
router.get("/passwords", listPasswords);

/**
 * GET /api/admin/usage
 * Get usage statistics
 */
router.get("/usage", [query("passwordId").optional().isMongoId().withMessage("Invalid password ID format"), validateRequest], getUsageStats);

/**
 * PUT /api/admin/passwords/:id
 * Update a password
 */
router.put(
  "/passwords/:id",
  [
    param("id").isMongoId().withMessage("Invalid password ID"),
    body("expiresAt").optional().isISO8601().withMessage("Invalid date format. Use ISO 8601 format."),
    body("maxUsesPerUser").optional().isInt({ min: 1, max: 1000 }).withMessage("Max uses per user must be between 1 and 1000"),
    body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
    validateRequest,
  ],
  updatePassword,
);

/**
 * DELETE /api/admin/passwords/:id
 * Delete a password and its usage records
 */
router.delete("/passwords/:id", [param("id").isMongoId().withMessage("Invalid password ID"), validateRequest], deletePassword);

module.exports = router;
