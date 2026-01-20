/**
 * Route Aggregator
 * Combines all route modules
 */

const express = require("express");

const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Mount route modules
router.use("/validate", require("./validate"));
router.use("/generate", require("./generate"));
router.use("/admin", require("./admin"));

module.exports = router;
