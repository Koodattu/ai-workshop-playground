/**
 * Model Routes
 * Exposes enabled AI model preferences for the frontend selector.
 */

const express = require("express");
const { getModelSettings } = require("../services/modelSettings");
const { getPublicModelCatalog } = require("../services/modelCatalog");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const options = getPublicModelCatalog(await getModelSettings());

  res.json({
    models: options.filter(({ enabled }) => enabled).map(({ id }) => id),
    options,
  });
}));

module.exports = router;
