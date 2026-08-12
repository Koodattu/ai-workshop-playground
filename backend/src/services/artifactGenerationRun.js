const RequestLog = require("../models/RequestLog");
const Usage = require("../models/Usage");
const { AppError } = require("../middleware/errorHandler");
const { ERROR_CODES } = require("../constants/errorCodes");
const { artifactVersionLineage } = require("./artifactVersionLineage");
const { ArtifactEditError, validateGeneratedArtifact } = require("./artifactEditing");

function calculateCostInCents(promptTokens, billableOutputTokens, pricing, cachedTokens = 0) {
  const normalizedCachedTokens = Math.min(Math.max(cachedTokens || 0, 0), promptTokens || 0);
  const uncachedInputTokens = Math.max(0, (promptTokens || 0) - normalizedCachedTokens);
  const cachedInputPerToken = pricing.cachedInputPerToken ?? pricing.inputPerToken;
  const usesLongContextRate = pricing.longContextInputTokenThreshold && promptTokens > pricing.longContextInputTokenThreshold;
  const inputMultiplier = usesLongContextRate ? pricing.longContextInputMultiplier || 1 : 1;
  const outputMultiplier = usesLongContextRate ? pricing.longContextOutputMultiplier || 1 : 1;
  return (uncachedInputTokens * pricing.inputPerToken + normalizedCachedTokens * cachedInputPerToken) * inputMultiplier * 100 +
    (billableOutputTokens || 0) * pricing.outputPerToken * outputMultiplier * 100;
}

const countLines = (text) => (text ? text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").length : 0);

function getCodeChangeSummary({ mode, hasExistingCode, existingCode, finalCode, finalEdits }) {
  if (mode === "ask") return { addedLines: 0, removedLines: 0 };
  if (Array.isArray(finalEdits) && finalEdits.length > 0) {
    return finalEdits.reduce(
      (summary, edit) => ({
        addedLines: summary.addedLines + countLines(edit.newText),
        removedLines: summary.removedLines + countLines(edit.oldText),
      }),
      { addedLines: 0, removedLines: 0 },
    );
  }
  return { addedLines: countLines(finalCode), removedLines: hasExistingCode ? countLines(existingCode) : 0 };
}

function createArtifactGenerationRunService({
  versionLineage = artifactVersionLineage,
  requestLog = RequestLog,
  usage = Usage,
  validateArtifact = validateGeneratedArtifact,
  logger = console,
} = {}) {
  const validate = (code) => {
    try {
      validateArtifact(code);
    } catch (error) {
      if (!(error instanceof ArtifactEditError)) throw error;
      const safeError = new AppError("AI returned code that could not be validated safely.", 500, ERROR_CODES.AI_EDIT_UNSAFE);
      safeError.details = [error.retryFeedback];
      throw safeError;
    }
  };

  const finish = async ({ grant, parentVersionId, existingCode, generation, model, usageMetadata = {} }) => {
    let version = null;
    if (generation.mode === "edit" && grant?.visitorId) {
      version = await versionLineage.create({
        grant,
        parentVersionId,
        existingCode,
        version: {
          code: generation.code,
          prompt: generation.prompt,
          message: generation.message,
          projectName: generation.projectName || null,
          artifactType: generation.artifactType,
          modelProvider: model.provider,
          modelPreference: model.id,
          modelId: model.model,
          modelLabel: model.label,
          modelShortLabel: model.shortLabel,
          modelThinking: model.thinking,
          editMode: generation.editMode,
          changeScope: generation.changeScope,
          editCount: generation.edits.length,
          edits: generation.edits,
          patchRetryAttempted: generation.patchRetryAttempted,
          patchApplyMethod: generation.patchApplyMethod,
        },
      });
    }

    const promptTokens = usageMetadata.promptTokenCount || 0;
    const candidatesTokens = usageMetadata.candidatesTokenCount || 0;
    const thoughtsTokens = usageMetadata.thoughtsTokenCount || 0;
    const cachedTokens = usageMetadata.cachedContentTokenCount || 0;
    const totalTokens = usageMetadata.totalTokenCount || promptTokens + candidatesTokens + thoughtsTokens;
    const estimatedCost = calculateCostInCents(promptTokens, candidatesTokens + thoughtsTokens, model.pricing, cachedTokens);
    const codeChange = getCodeChangeSummary({
      mode: generation.mode,
      hasExistingCode: Boolean(existingCode?.trim()),
      existingCode,
      finalCode: generation.code,
      finalEdits: generation.edits,
    });
    const usageSummary = {
      provider: model.provider,
      modelPreference: model.id,
      modelId: model.model,
      modelLabel: model.label,
      modelThinking: model.thinking,
      mode: generation.mode,
      artifactType: generation.artifactType,
      promptTokens,
      candidatesTokens,
      thoughtsTokens,
      cachedTokens,
      totalTokens,
      estimatedCost,
      addedLines: codeChange.addedLines,
      removedLines: codeChange.removedLines,
      createdAt: new Date().toISOString(),
    };

    try {
      if (grant?.passwordId && grant?.visitorId) {
        const tokenData = { promptTokens, candidatesTokens, thoughtsTokens, totalTokens, estimatedCost };
        await requestLog.logRequest({
          passwordId: grant.passwordId,
          visitorId: grant.visitorId,
          promptTokens,
          candidatesTokens,
          thoughtsTokens,
          cachedTokens,
          totalTokens,
          estimatedCost,
          model: model.model,
          generationType: generation.mode === "ask" ? "ask" : "code-generation",
          mode: generation.mode,
        });
        await usage.trackTokenUsage(grant.passwordId, grant.visitorId, tokenData);
      }
    } catch (error) {
      logger.error("[Token Tracking Error] Failed to log token usage:", error.message);
    }

    return { version, usage: usageSummary };
  };

  return { finish, validate };
}

module.exports = {
  artifactGenerationRunService: createArtifactGenerationRunService(),
  calculateCostInCents,
  createArtifactGenerationRunService,
  getCodeChangeSummary,
};
