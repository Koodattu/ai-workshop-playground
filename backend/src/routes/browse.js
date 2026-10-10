const express = require("express");
const { body, param, query } = require("express-validator");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const validateRequest = require("../middleware/validateRequest");
const { inspectWorkshopAccess } = require("../middleware/workshopAccessAdapter");
const { publicArtifacts } = require("../services/publicArtifacts");
const { getBrowseSettings } = require("../services/browseSettings");
const { createShareSnapshot } = require("../controllers/shareController");
const PublicArtifact = require("../models/PublicArtifact");
const SharedCode = require("../models/SharedCode");

const router = express.Router();
router.get("/settings", asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store").json(await getBrowseSettings());
}));

router.get("/", [query("page").optional().isInt({ min: 1, max: 100000 }).toInt(), validateRequest], asyncHandler(async (req, res) => {
  await publicArtifacts.requireEnabled();
  const page = Number(req.query.page) || 1;
  const limit = 12;
  const listings = await PublicArtifact.find({}).select("shareId projectName artifactType thumbnail updatedAt -_id")
    .sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit + 1).lean();
  res.set("Cache-Control", "no-store").json({ artifacts: listings.slice(0, limit), hasMore: listings.length > limit });
}));

router.get("/:shareId/preview", [param("shareId").matches(/^[A-Z]{4}$/), validateRequest], asyncHandler(async (req, res) => {
  await publicArtifacts.requireEnabled();
  if (!await PublicArtifact.exists({ shareId: req.params.shareId })) throw new AppError("Public artifact not found", 404);
  const share = await SharedCode.findOne({ shareId: req.params.shareId }).select("code").lean();
  if (!share) throw new AppError("Share not found", 404);
  // Gallery previews are inert documents. Scripts run only when a visitor opens the share page.
  res.set({
    "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline' https:; img-src data: https:; font-src data: https:; base-uri 'none'; form-action 'none'",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  }).type("html").send(share.code);
}));

const ownerValidation = [
  param("versionId").isMongoId(),
  body("visitorId").isString().isLength({ min: 8, max: 200 }),
  body("authMode").optional().isIn(["password", "api-key"]),
  validateRequest,
  inspectWorkshopAccess,
];

router.post("/:versionId/status", ownerValidation, asyncHandler(async (req, res) => {
  res.json(await publicArtifacts.get(req.workshopAccessGrant, req.params.versionId));
}));

router.put("/:versionId", ownerValidation, [
  body("isPublic").isBoolean({ strict: true }),
  body("code").if(body("isPublic").equals("true")).isString().notEmpty().isLength({ max: 500000 }),
  body("projectName").optional().isString().isLength({ max: 50 }),
  body("artifactType").optional().isIn(["website", "game"]),
  body("thumbnail").optional().isString().isLength({ max: 120000 }).matches(/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/),
  validateRequest,
], asyncHandler(async (req, res) => {
  const grant = req.workshopAccessGrant;
  const versionId = req.params.versionId;
  if (!req.body.isPublic) return res.json(await publicArtifacts.unpublish(grant, versionId));
  await publicArtifacts.requireEnabled();
  await publicArtifacts.get(grant, versionId); // Verify ownership before creating a snapshot.
  const snapshot = await createShareSnapshot({ code: req.body.code, projectName: req.body.projectName, artifactType: req.body.artifactType });
  res.json(await publicArtifacts.publish(grant, versionId, snapshot, req.body.thumbnail));
}));

module.exports = router;
