/**
 * Admin Routes
 * Handles password management and usage statistics
 */

const express = require("express");
const { body, param, query } = require("express-validator");
const {
  verifyAdmin,
  verifyAdminCredentials,
  getAdminModelSettings,
  updateAdminModelSettings,
  createPassword,
  listPasswords,
  getUsageStats,
  updatePassword,
  deletePassword,
  getSystemStats,
  getPasswordDetailedStats,
  getUsersForPassword,
  getRecentRequests,
  getTokenTimeSeries,
  getShareLinks,
  getCodeVersions,
} = require("../controllers/adminController");
const { MODEL_PREFERENCE_IDS, MODEL_DEFAULTS } = require("../services/modelSettings");
const { PROMPT_MODE_IDS } = require("../services/promptModes");
const validateRequest = require("../middleware/validateRequest");

const router = express.Router();

/**
 * POST /api/admin/verify
 * Verify admin credentials
 */
router.post("/verify", verifyAdmin, verifyAdminCredentials);

// All other admin routes require admin authentication
router.use(verifyAdmin);

router.get("/model-settings", getAdminModelSettings);
router.put(
  "/model-settings",
  [
    body("models")
      .isObject()
      .withMessage("Model settings are required")
      .bail()
      .custom((models) => {
        for (const [id, setting] of Object.entries(models || {})) {
          if (!MODEL_PREFERENCE_IDS.includes(id)) {
            throw new Error(`Unknown model setting: ${id}`);
          }

          if (typeof setting === "boolean") {
            continue;
          }

          if (!setting || typeof setting !== "object" || Array.isArray(setting)) {
            throw new Error(`${id} must be a boolean or settings object`);
          }

          if ("enabled" in setting && typeof setting.enabled !== "boolean") {
            throw new Error(`${id}.enabled must be a boolean`);
          }

          if ("thinking" in setting && !MODEL_DEFAULTS[id].thinkingOptions.includes(setting.thinking)) {
            throw new Error(`${id}.thinking is not supported`);
          }
        }

        return true;
      }),
    validateRequest,
  ],
  updateAdminModelSettings,
);

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
    body("promptMode").optional().isIn(PROMPT_MODE_IDS).withMessage("Prompt mode is invalid"),
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
    body("promptMode").optional().isIn(PROMPT_MODE_IDS).withMessage("Prompt mode is invalid"),
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

/**
 * GET /api/admin/stats/system
 * Get overall system-wide statistics
 */
router.get("/stats/system", getSystemStats);

/**
 * GET /api/admin/stats/password/:passwordId
 * Get detailed stats for a specific password
 */
router.get("/stats/password/:passwordId", [param("passwordId").isMongoId().withMessage("Invalid password ID"), validateRequest], getPasswordDetailedStats);

/**
 * GET /api/admin/stats/password/:passwordId/users
 * Get paginated list of users for a specific password
 */
router.get(
  "/stats/password/:passwordId/users",
  [
    param("passwordId").isMongoId().withMessage("Invalid password ID"),
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    validateRequest,
  ],
  getUsersForPassword,
);

/**
 * GET /api/admin/stats/requests
 * Get recent requests log
 */
router.get(
  "/stats/requests",
  [
    query("limit").optional().isInt({ min: 1, max: 200 }).withMessage("Limit must be between 1 and 200"),
    query("passwordId").optional().isMongoId().withMessage("Invalid password ID format"),
    validateRequest,
  ],
  getRecentRequests,
);

/**
 * GET /api/admin/stats/timeseries
 * Get token usage over time for charts
 */
router.get(
  "/stats/timeseries",
  [
    query("period").optional().isIn(["day", "week", "month"]).withMessage("Period must be 'day', 'week', or 'month'"),
    query("passwordId").optional().isMongoId().withMessage("Invalid password ID format"),
    validateRequest,
  ],
  getTokenTimeSeries,
);

/**
 * GET /api/admin/share-links
 * Get all share links
 */
router.get("/share-links", getShareLinks);

/**
 * GET /api/admin/code-versions
 * Get all generated code versions
 */
router.get("/code-versions", getCodeVersions);

module.exports = router;
