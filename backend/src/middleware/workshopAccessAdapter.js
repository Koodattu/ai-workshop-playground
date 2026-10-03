const { asyncHandler } = require("./errorHandler");
const { workshopAccess } = require("../services/workshopAccess");

function readCredentials(req, includeProviderKeys) {
  const body = req.body || {};
  const query = req.query || {};
  const authMode = body.authMode === "api-key" ? "api-key" : "password";

  if (authMode === "api-key") {
    return {
      authMode,
      visitorId: body.visitorId || query.visitorId,
      accessToken: body.apiKeyAccessToken || query.apiKeyAccessToken,
      apiKeys: includeProviderKeys ? body.apiKeys : undefined,
    };
  }

  return {
    authMode,
    visitorId: body.visitorId || query.visitorId,
    password: body.password || query.password,
  };
}

function applyGrant(req, grant) {
  req.workshopAccessGrant = grant;
  req.workshop = {
    authMode: grant.authMode,
    passwordId: grant.passwordId,
    visitorId: grant.visitorId,
    remaining: grant.remaining,
    maxUses: grant.maxUses,
    ownerTokenHash: grant.ownerTokenHash,
  };
}

const inspectWorkshopAccess = asyncHandler(async (req, res, next) => {
  const grant = await workshopAccess.inspect(readCredentials(req, false));
  applyGrant(req, grant);
  next();
});

const grantGenerationAccess = asyncHandler(async (req, res, next) => {
  const grant = await workshopAccess.grantForGeneration(readCredentials(req, true));
  applyGrant(req, grant);

  if (grant.authMode === "password") {
    res.set("X-RateLimit-Limit", grant.maxUses.toString());
    res.set("X-RateLimit-Remaining", grant.remaining.toString());
  }

  next();
});

module.exports = {
  grantGenerationAccess,
  inspectWorkshopAccess,
  readCredentials,
};
