const SharedCode = require("../models/SharedCode");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

/**
 * Generates a random 4-letter alphabetical share ID (uppercase)
 * @returns {string} 4-character uppercase alphabetical string
 */
const generateShareId = () => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return result;
};

/**
 * Creates a new share link for the provided code
 * POST /api/share
 */
const createShare = asyncHandler(async (req, res) => {
  const { code, title, projectName } = req.body;

  // Generate a unique share ID with collision handling
  let shareId;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    shareId = generateShareId();
    const existing = await SharedCode.findOne({ shareId });
    if (!existing) {
      break;
    }
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new AppError("Unable to generate unique share ID. Please try again.", 503);
  }

  // Create the shared code entry
  const sharedCode = await SharedCode.create({
    shareId,
    code,
    title: title || null,
    projectName: projectName || null,
  });

  res.status(201).json({
    message: "Share link created successfully",
    data: {
      shareId: sharedCode.shareId,
      createdAt: sharedCode.createdAt,
    },
  });
});

/**
 * Retrieves shared code by share ID
 * GET /api/share/:shareId
 */
const getShare = asyncHandler(async (req, res) => {
  const { shareId } = req.params;

  // Convert to uppercase for case-insensitive lookup
  const normalizedShareId = shareId.toUpperCase();

  const sharedCode = await SharedCode.findOne({ shareId: normalizedShareId });

  if (!sharedCode) {
    throw new AppError("Share link not found", 404, "SHARE_NOT_FOUND");
  }

  res.status(200).json({
    message: "Shared code retrieved successfully",
    data: {
      shareId: sharedCode.shareId,
      code: sharedCode.code,
      title: sharedCode.title,
      projectName: sharedCode.projectName,
      createdAt: sharedCode.createdAt,
    },
  });
});

module.exports = {
  createShare,
  getShare,
};
