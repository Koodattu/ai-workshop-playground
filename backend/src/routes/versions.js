const express = require("express");
const { body, param } = require("express-validator");
const { inspectWorkshopAccess } = require("../middleware/workshopAccessAdapter");
const validateRequest = require("../middleware/validateRequest");
const { listMyVersions, getMyVersion, getMyVersionLineage } = require("../controllers/versionController");
const { ERROR_CODES } = require("../constants/errorCodes");

const router = express.Router();
const isApiKeyMode = (value, { req }) => req.body.authMode === "api-key";

router.post(
  "/list",
  [
    body("authMode").optional().isIn(["password", "api-key"]).withMessage({ msg: "Auth mode is invalid", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    body("password")
      .if((value, { req }) => req.body.authMode !== "api-key")
      .trim()
      .notEmpty()
      .withMessage({ msg: "Workshop password is required", errorCode: ERROR_CODES.PASSWORD_REQUIRED }),
    body("apiKeyAccessToken")
      .if(isApiKeyMode)
      .trim()
      .notEmpty()
      .withMessage({ msg: "API key session token is required", errorCode: ERROR_CODES.VALIDATION_FAILED })
      .bail()
      .isLength({ min: 24, max: 200 })
      .withMessage({ msg: "API key session token is invalid", errorCode: ERROR_CODES.VALIDATION_FAILED }),
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
  inspectWorkshopAccess,
  listMyVersions,
);

router.post(
  "/:versionId/lineage",
  [
    param("versionId").isMongoId().withMessage({ msg: "Invalid version ID", errorCode: ERROR_CODES.INVALID_OBJECT_ID }),
    body("authMode").optional().isIn(["password", "api-key"]).withMessage({ msg: "Auth mode is invalid", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    body("password")
      .if((value, { req }) => req.body.authMode !== "api-key")
      .trim()
      .notEmpty()
      .withMessage({ msg: "Workshop password is required", errorCode: ERROR_CODES.PASSWORD_REQUIRED }),
    body("apiKeyAccessToken")
      .if(isApiKeyMode)
      .trim()
      .notEmpty()
      .withMessage({ msg: "API key session token is required", errorCode: ERROR_CODES.VALIDATION_FAILED })
      .bail()
      .isLength({ min: 24, max: 200 })
      .withMessage({ msg: "API key session token is invalid", errorCode: ERROR_CODES.VALIDATION_FAILED }),
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
  inspectWorkshopAccess,
  getMyVersionLineage,
);

router.post(
  "/:versionId",
  [
    param("versionId").isMongoId().withMessage({ msg: "Invalid version ID", errorCode: ERROR_CODES.INVALID_OBJECT_ID }),
    body("authMode").optional().isIn(["password", "api-key"]).withMessage({ msg: "Auth mode is invalid", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    body("password")
      .if((value, { req }) => req.body.authMode !== "api-key")
      .trim()
      .notEmpty()
      .withMessage({ msg: "Workshop password is required", errorCode: ERROR_CODES.PASSWORD_REQUIRED }),
    body("apiKeyAccessToken")
      .if(isApiKeyMode)
      .trim()
      .notEmpty()
      .withMessage({ msg: "API key session token is required", errorCode: ERROR_CODES.VALIDATION_FAILED })
      .bail()
      .isLength({ min: 24, max: 200 })
      .withMessage({ msg: "API key session token is invalid", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    body("visitorId")
      .trim()
      .notEmpty()
      .withMessage({ msg: "Visitor ID is required", errorCode: ERROR_CODES.VISITOR_ID_REQUIRED })
      .bail()
      .isLength({ min: 8 })
      .withMessage({ msg: "Visitor ID must be at least 8 characters", errorCode: ERROR_CODES.VISITOR_ID_TOO_SHORT }),
    validateRequest,
  ],
  inspectWorkshopAccess,
  getMyVersion,
);

module.exports = router;
