const express = require("express");
const { body, param } = require("express-validator");
const workshopAuth = require("../middleware/workshopAuth");
const validateRequest = require("../middleware/validateRequest");
const { listMyVersions, getMyVersion } = require("../controllers/versionController");
const { ERROR_CODES } = require("../constants/errorCodes");

const router = express.Router();

router.post(
  "/list",
  [
    body("password").trim().notEmpty().withMessage({ msg: "Workshop password is required", errorCode: ERROR_CODES.PASSWORD_REQUIRED }),
    body("visitorId")
      .trim()
      .notEmpty()
      .withMessage({ msg: "Visitor ID is required", errorCode: ERROR_CODES.VISITOR_ID_REQUIRED })
      .bail()
      .isLength({ min: 8 })
      .withMessage({ msg: "Visitor ID must be at least 8 characters", errorCode: ERROR_CODES.VISITOR_ID_TOO_SHORT }),
    body("includeCode").optional().isBoolean().withMessage({ msg: "includeCode must be boolean", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    validateRequest,
  ],
  workshopAuth,
  listMyVersions,
);

router.post(
  "/:versionId",
  [
    param("versionId").isMongoId().withMessage({ msg: "Invalid version ID", errorCode: ERROR_CODES.INVALID_OBJECT_ID }),
    body("password").trim().notEmpty().withMessage({ msg: "Workshop password is required", errorCode: ERROR_CODES.PASSWORD_REQUIRED }),
    body("visitorId")
      .trim()
      .notEmpty()
      .withMessage({ msg: "Visitor ID is required", errorCode: ERROR_CODES.VISITOR_ID_REQUIRED })
      .bail()
      .isLength({ min: 8 })
      .withMessage({ msg: "Visitor ID must be at least 8 characters", errorCode: ERROR_CODES.VISITOR_ID_TOO_SHORT }),
    validateRequest,
  ],
  workshopAuth,
  getMyVersion,
);

module.exports = router;
