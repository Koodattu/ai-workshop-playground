/**
 * Model Routes
 * Exposes enabled AI model preferences for the frontend selector.
 */

const express = require("express");
const { getEnabledModelPreferences } = require("../services/modelSettings");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  res.json({
    models: await getEnabledModelPreferences(),
  });
}));

module.exports = router;
