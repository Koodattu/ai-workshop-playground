/**
 * Model Routes
 * Exposes enabled AI model preferences for the frontend selector.
 */

const express = require("express");
const { getEnabledModelPreferences } = require("../services/modelSettings");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    models: getEnabledModelPreferences(),
  });
});

module.exports = router;
