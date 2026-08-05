/**
 * AI Controller
 * Handles Gemini API integration for code generation
 */

const { GoogleGenAI, ThinkingLevel } = require("@google/genai");
const OpenAI = require("openai");
const crypto = require("crypto");
const mongoose = require("mongoose");
const config = require("../config");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { ERROR_CODES } = require("../constants/errorCodes");
const RequestLog = require("../models/RequestLog");
const Usage = require("../models/Usage");
const CodeVersion = require("../models/CodeVersion");
const { getAllowedModelPreference, getModelSetting, normalizeThinkingLevel } = require("../services/modelSettings");

const MODEL_PREFERENCES = {
  fast: {
    provider: "gemini",
    model: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    shortLabel: "2.5",
    pricing: {
      inputPerToken: 0.0000003,
      outputPerToken: 0.0000025,
    },
    thinkingOptions: ["none"],
    defaultThinking: "none",
    thinkingMode: "gemini-budget",
  },
  balanced: {
    provider: "gemini",
    model: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    shortLabel: "3",
    pricing: {
      inputPerToken: 0.0000005,
      outputPerToken: 0.000003,
    },
    thinkingOptions: ["low", "medium", "high"],
    defaultThinking: "low",
    thinkingMode: "gemini-level",
  },
  accurate: {
    provider: "gemini",
    model: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    shortLabel: "3.5",
    pricing: {
      inputPerToken: 0.0000015,
      outputPerToken: 0.000009,
    },
    thinkingOptions: ["low", "medium", "high"],
    defaultThinking: "low",
    thinkingMode: "gemini-level",
  },
  gpt54mini: {
    provider: "openai",
    model: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    shortLabel: "5.4-mini",
    pricing: {
      inputPerToken: 0.75 / 1000000,
      cachedInputPerToken: 0.075 / 1000000,
      outputPerToken: 4.5 / 1000000,
      longContextInputTokenThreshold: 272000,
      longContextInputMultiplier: 2,
      longContextOutputMultiplier: 1.5,
    },
    thinkingOptions: ["none", "low", "medium", "high", "xhigh"],
    defaultThinking: "none",
    thinkingMode: "openai-reasoning",
  },
  gpt54: {
    provider: "openai",
    model: "gpt-5.4",
    label: "GPT-5.4",
    shortLabel: "5.4",
    pricing: {
      inputPerToken: 2.5 / 1000000,
      cachedInputPerToken: 0.25 / 1000000,
      outputPerToken: 15 / 1000000,
      longContextInputTokenThreshold: 272000,
      longContextInputMultiplier: 2,
      longContextOutputMultiplier: 1.5,
    },
    thinkingOptions: ["none", "low", "medium", "high", "xhigh"],
    defaultThinking: "none",
    thinkingMode: "openai-reasoning",
  },
  gpt55: {
    provider: "openai",
    model: "gpt-5.5",
    label: "GPT-5.5",
    shortLabel: "5.5",
    pricing: {
      inputPerToken: 5 / 1000000,
      cachedInputPerToken: 0.5 / 1000000,
      outputPerToken: 30 / 1000000,
      longContextInputTokenThreshold: 272000,
      longContextInputMultiplier: 2,
      longContextOutputMultiplier: 1.5,
    },
    thinkingOptions: ["none", "low", "medium", "high", "xhigh"],
    defaultThinking: "medium",
    thinkingMode: "openai-reasoning",
  },
};

const DEFAULT_MODEL_PREFERENCE = "balanced";
const SSE_CODE_CHUNK_FLUSH_CHARS = 1024;
const SSE_CODE_CHUNK_FLUSH_MS = 100;

const GEMINI_THINKING_LEVELS = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

function createCodeChunkSseBuffer(sendSse, { onFlush } = {}) {
  let pendingChunk = "";
  let flushTimer = null;

  const clearFlushTimer = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  };

  const flush = () => {
    clearFlushTimer();
    if (!pendingChunk) return;

    const chunk = pendingChunk;
    pendingChunk = "";
    onFlush?.(chunk);
    sendSse({ type: "code-chunk", chunk });
  };

  const push = (chunk) => {
    if (!chunk) return;

    pendingChunk += chunk;
    if (pendingChunk.length >= SSE_CODE_CHUNK_FLUSH_CHARS) {
      flush();
      return;
    }

    if (!flushTimer) {
      flushTimer = setTimeout(flush, SSE_CODE_CHUNK_FLUSH_MS);
    }
  };

  const cancel = () => {
    clearFlushTimer();
    pendingChunk = "";
  };

  return {
    push,
    flush,
    cancel,
  };
}

/**
 * Calculate estimated cost in cents based on token usage
 */
function calculateCostInCents(promptTokens, billableOutputTokens, pricing, cachedTokens = 0) {
  const normalizedCachedTokens = Math.min(Math.max(cachedTokens || 0, 0), promptTokens || 0);
  const uncachedInputTokens = Math.max(0, (promptTokens || 0) - normalizedCachedTokens);
  const cachedInputPerToken = pricing.cachedInputPerToken ?? pricing.inputPerToken;
  const usesLongContextRate =
    pricing.longContextInputTokenThreshold && promptTokens > pricing.longContextInputTokenThreshold;
  const inputMultiplier = usesLongContextRate ? pricing.longContextInputMultiplier || 1 : 1;
  const outputMultiplier = usesLongContextRate ? pricing.longContextOutputMultiplier || 1 : 1;

  const inputCost = (uncachedInputTokens * pricing.inputPerToken + normalizedCachedTokens * cachedInputPerToken) * inputMultiplier;
  const outputCost = (billableOutputTokens || 0) * pricing.outputPerToken * outputMultiplier;
  const totalCostDollars = inputCost + outputCost;
  return totalCostDollars * 100; // Convert to cents
}

function countLines(text) {
  if (!text) return 0;
  return normalizeLineEndings(text).split("\n").length;
}

function getCodeChangeSummary({ mode, hasExistingCode, existingCode, finalCode, finalEdits }) {
  if (mode === "ask") {
    return { addedLines: 0, removedLines: 0 };
  }

  if (Array.isArray(finalEdits) && finalEdits.length > 0) {
    return finalEdits.reduce(
      (summary, edit) => ({
        addedLines: summary.addedLines + countLines(edit.newText),
        removedLines: summary.removedLines + countLines(edit.oldText),
      }),
      { addedLines: 0, removedLines: 0 },
    );
  }

  return {
    addedLines: countLines(finalCode),
    removedLines: hasExistingCode ? countLines(existingCode) : 0,
  };
}

function redactSecretLikeText(value) {
  if (typeof value !== "string") return value;
  return value.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]").replace(/AIza[0-9A-Za-z_-]{8,}/g, "[redacted]");
}

function sanitizeErrorForLog(error) {
  return {
    name: error?.name,
    message: redactSecretLikeText(error?.message),
    status: error?.status || error?.statusCode,
    code: redactSecretLikeText(error?.code || error?.errorCode),
  };
}

async function getModelPreference(modelPreference, options = {}) {
  const { restrictToEnabled = true } = options;
  const allowedPreference = restrictToEnabled
    ? await getAllowedModelPreference(modelPreference, DEFAULT_MODEL_PREFERENCE)
    : MODEL_PREFERENCES[modelPreference]
      ? modelPreference
      : DEFAULT_MODEL_PREFERENCE;
  const selectedModel = MODEL_PREFERENCES[allowedPreference] || MODEL_PREFERENCES[DEFAULT_MODEL_PREFERENCE];
  const setting = await getModelSetting(allowedPreference);

  return {
    ...selectedModel,
    id: allowedPreference,
    thinking: normalizeThinkingLevel(setting.thinking, selectedModel.thinkingOptions, selectedModel.defaultThinking),
  };
}

function getGeminiThinkingConfig(selectedModel) {
  if (selectedModel.thinkingMode === "gemini-budget") {
    return { thinkingBudget: 0 };
  }

  if (selectedModel.thinkingMode === "gemini-level") {
    return {
      thinkingLevel: GEMINI_THINKING_LEVELS[selectedModel.thinking] || ThinkingLevel.LOW,
    };
  }

  return null;
}

function getOpenAIReasoningConfig(selectedModel) {
  if (selectedModel.thinkingMode !== "openai-reasoning") return null;
  return {
    effort: selectedModel.thinking,
  };
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let position = 0;

  while (position !== -1) {
    position = haystack.indexOf(needle, position);
    if (position !== -1) {
      count++;
      position += needle.length;
    }
  }

  return count;
}

function hashText(text) {
  return crypto.createHash("sha256").update(text || "").digest("hex").slice(0, 16);
}

function previewText(text, maxLength = 600) {
  if (typeof text !== "string") return "";
  const normalized = text.replace(/\r/g, "\\r").replace(/\n/g, "\\n");
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function getDominantLineEnding(text) {
  const crlfCount = (text.match(/\r\n/g) || []).length;
  const withoutCrlf = text.replace(/\r\n/g, "");
  const lfCount = (withoutCrlf.match(/\n/g) || []).length;

  return crlfCount > lfCount ? "\r\n" : "\n";
}

function applyLineEnding(text, lineEnding) {
  return normalizeLineEndings(text).replace(/\n/g, lineEnding);
}

function normalizeWhitespace(text) {
  return normalizeLineEndings(text).replace(/\s+/g, " ").trim();
}

function findClosestTextWindows(originalCode, oldText, maxResults = 3) {
  if (!oldText || !originalCode) return [];

  const needle = normalizeWhitespace(oldText);
  if (!needle) return [];

  const oldLines = normalizeLineEndings(oldText).split("\n");
  const windowLineCount = Math.max(1, Math.min(80, oldLines.length + 4));
  const originalLines = normalizeLineEndings(originalCode).split("\n");
  const results = [];

  for (let startLine = 0; startLine < originalLines.length; startLine++) {
    const windowText = originalLines.slice(startLine, startLine + windowLineCount).join("\n");
    const normalizedWindow = normalizeWhitespace(windowText);
    if (!normalizedWindow) continue;

    const sharedLength = Math.min(needle.length, normalizedWindow.length);
    let matchingPrefix = 0;
    while (matchingPrefix < sharedLength && needle[matchingPrefix] === normalizedWindow[matchingPrefix]) {
      matchingPrefix++;
    }

    const tokenSet = new Set(needle.split(" ").filter(Boolean));
    const windowTokens = normalizedWindow.split(" ").filter(Boolean);
    const sharedTokens = windowTokens.filter((token) => tokenSet.has(token)).length;
    const score = matchingPrefix + sharedTokens * 6;

    if (score === 0) continue;

    results.push({
      startLine: startLine + 1,
      endLine: Math.min(originalLines.length, startLine + windowLineCount),
      score,
      matchingPrefix,
      sharedTokens,
      preview: previewText(windowText),
      hash: hashText(windowText),
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

function logPatchDiagnostic(reason, payload) {
  console.error(
    "[Patch Apply Diagnostic]",
    JSON.stringify(
      {
        reason,
        ...payload,
      },
      null,
      2,
    ),
  );
}

function buildNormalizedIndexMap(originalCode) {
  const normalizedChars = [];
  const normalizedToOriginalIndex = [];

  for (let originalIndex = 0; originalIndex < originalCode.length; originalIndex++) {
    const char = originalCode[originalIndex];

    if (char === "\r") {
      if (originalCode[originalIndex + 1] === "\n") {
        normalizedChars.push("\n");
        normalizedToOriginalIndex.push(originalIndex);
        originalIndex++;
      } else {
        normalizedChars.push("\n");
        normalizedToOriginalIndex.push(originalIndex);
      }
    } else {
      normalizedChars.push(char);
      normalizedToOriginalIndex.push(originalIndex);
    }
  }

  normalizedToOriginalIndex.push(originalCode.length);

  return {
    normalizedCode: normalizedChars.join(""),
    normalizedToOriginalIndex,
  };
}

function resolveLineEndingNormalizedReplacement(originalCode, oldText, newText) {
  const { normalizedCode, normalizedToOriginalIndex } = buildNormalizedIndexMap(originalCode);
  const normalizedOldText = normalizeLineEndings(oldText);
  const occurrences = countOccurrences(normalizedCode, normalizedOldText);

  if (occurrences !== 1) {
    return { occurrences };
  }

  const normalizedStart = normalizedCode.indexOf(normalizedOldText);
  const normalizedEnd = normalizedStart + normalizedOldText.length;
  const start = normalizedToOriginalIndex[normalizedStart];
  const end = normalizedToOriginalIndex[normalizedEnd];
  const lineEnding = getDominantLineEnding(originalCode.slice(start, end) || originalCode);

  return {
    occurrences,
    replacement: {
      start,
      end,
      newText: applyLineEnding(newText, lineEnding),
      appliedWith: "line-ending-normalized",
    },
  };
}

function boundedLevenshteinDistance(left, right, maxDistance) {
  if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1;

  let previous = new Array(right.length + 1);
  let current = new Array(right.length + 1);

  for (let column = 0; column <= right.length; column++) {
    previous[column] = column;
  }

  for (let row = 1; row <= left.length; row++) {
    current[0] = row;
    let rowMinimum = current[0];

    for (let column = 1; column <= right.length; column++) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      const distance = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + substitutionCost,
      );
      current[column] = distance;
      rowMinimum = Math.min(rowMinimum, distance);
    }

    if (rowMinimum > maxDistance) return maxDistance + 1;

    const temp = previous;
    previous = current;
    current = temp;
  }

  return previous[right.length];
}

function getNormalizedLineSpans(normalizedCode) {
  const lineStarts = [0];
  const lines = normalizedCode.split("\n");

  for (let index = 0; index < normalizedCode.length; index++) {
    if (normalizedCode[index] === "\n") {
      lineStarts.push(index + 1);
    }
  }

  return { lines, lineStarts };
}

function resolveNearExactReplacement(originalCode, oldText, newText) {
  const normalizedOldText = normalizeLineEndings(oldText);
  const oldLines = normalizedOldText.split("\n");
  const oldLineCount = oldLines.length;

  if (normalizedOldText.length < 80 && oldLineCount < 2) {
    return { accepted: false, reason: "snippet-too-small" };
  }

  if (normalizedOldText.length > 5000) {
    return { accepted: false, reason: "snippet-too-large" };
  }

  const maxDistance = Math.max(2, Math.min(12, Math.floor(normalizedOldText.length * 0.03)));
  const { normalizedCode, normalizedToOriginalIndex } = buildNormalizedIndexMap(originalCode);
  const { lines, lineStarts } = getNormalizedLineSpans(normalizedCode);
  const candidates = [];

  for (let startLineIndex = 0; startLineIndex <= lines.length - oldLineCount; startLineIndex++) {
    const candidateText = lines.slice(startLineIndex, startLineIndex + oldLineCount).join("\n");
    if (Math.abs(candidateText.length - normalizedOldText.length) > maxDistance) continue;

    const distance = boundedLevenshteinDistance(normalizedOldText, candidateText, maxDistance);
    if (distance > maxDistance) continue;

    const normalizedStart = lineStarts[startLineIndex];
    const nextLineStart = lineStarts[startLineIndex + oldLineCount];
    const normalizedEnd = nextLineStart === undefined ? normalizedCode.length : nextLineStart - 1;

    candidates.push({
      distance,
      startLine: startLineIndex + 1,
      endLine: startLineIndex + oldLineCount,
      normalizedStart,
      normalizedEnd,
      candidateText,
    });
  }

  candidates.sort((a, b) => a.distance - b.distance || a.startLine - b.startLine);

  if (candidates.length !== 1) {
    return {
      accepted: false,
      reason: candidates.length === 0 ? "no-near-match" : "ambiguous-near-match",
      candidateCount: candidates.length,
      maxDistance,
      bestDistance: candidates[0]?.distance ?? null,
      secondBestDistance: candidates[1]?.distance ?? null,
    };
  }

  const candidate = candidates[0];
  const start = normalizedToOriginalIndex[candidate.normalizedStart];
  const end = normalizedToOriginalIndex[candidate.normalizedEnd];
  const lineEnding = getDominantLineEnding(originalCode.slice(start, end) || originalCode);

  return {
    accepted: true,
    maxDistance,
    distance: candidate.distance,
    startLine: candidate.startLine,
    endLine: candidate.endLine,
    candidateHash: hashText(candidate.candidateText),
    candidatePreview: previewText(candidate.candidateText),
    replacement: {
      start,
      end,
      newText: applyLineEnding(newText, lineEnding),
      appliedWith: "near-exact",
    },
  };
}

function applyExactEdits(originalCode, edits, diagnosticContext = {}) {
  if (!Array.isArray(edits) || edits.length === 0) {
    logPatchDiagnostic("missing-edits", {
      ...diagnosticContext,
      editsType: typeof edits,
      editsIsArray: Array.isArray(edits),
    });
    throw new AppError("Patch response did not include any edits", 500, ERROR_CODES.AI_RESPONSE_INVALID);
  }

  const replacements = edits.map((edit, index) => {
    const oldText = typeof edit.oldText === "string" ? edit.oldText : "";
    const newText = typeof edit.newText === "string" ? edit.newText : "";
    const editNumber = index + 1;

    if (!oldText) {
      logPatchDiagnostic("missing-oldText", {
        ...diagnosticContext,
        editNumber,
        editKeys: edit && typeof edit === "object" ? Object.keys(edit) : [],
        newTextLength: newText.length,
        newTextHash: hashText(newText),
        newTextPreview: previewText(newText),
      });
      throw new AppError(`Patch edit ${editNumber} is missing oldText`, 500, ERROR_CODES.AI_RESPONSE_INVALID);
    }

    const occurrences = countOccurrences(originalCode, oldText);
    if (occurrences === 0) {
      const lineEndingOccurrences = countOccurrences(normalizeLineEndings(originalCode), normalizeLineEndings(oldText));
      const whitespaceOccurrences = countOccurrences(normalizeWhitespace(originalCode), normalizeWhitespace(oldText));

      if (lineEndingOccurrences === 1) {
        const normalizedResult = resolveLineEndingNormalizedReplacement(originalCode, oldText, newText);

        if (normalizedResult.replacement) {
          console.warn(
            "[Patch Apply Fallback]",
            JSON.stringify({
              reason: "line-ending-normalized-match",
              ...diagnosticContext,
              editNumber,
              editCount: edits.length,
              originalCodeLength: originalCode.length,
              originalCodeHash: hashText(originalCode),
              oldTextLength: oldText.length,
              oldTextHash: hashText(oldText),
              newTextLength: newText.length,
              newTextHash: hashText(newText),
            }),
          );

          return normalizedResult.replacement;
        }

        logPatchDiagnostic("line-ending-fallback-unexpected", {
          ...diagnosticContext,
          editNumber,
          editCount: edits.length,
          lineEndingOccurrences,
          normalizedResultOccurrences: normalizedResult.occurrences,
          originalCodeHash: hashText(originalCode),
          oldTextHash: hashText(oldText),
        });
      }

      const nearExactResult = resolveNearExactReplacement(originalCode, oldText, newText);
      if (nearExactResult.replacement) {
        console.warn(
          "[Patch Apply Fallback]",
          JSON.stringify({
            reason: "near-exact-match",
            ...diagnosticContext,
            editNumber,
            editCount: edits.length,
            originalCodeLength: originalCode.length,
            originalCodeHash: hashText(originalCode),
            oldTextLength: oldText.length,
            oldTextHash: hashText(oldText),
            newTextLength: newText.length,
            newTextHash: hashText(newText),
            maxDistance: nearExactResult.maxDistance,
            distance: nearExactResult.distance,
            startLine: nearExactResult.startLine,
            endLine: nearExactResult.endLine,
            candidateHash: nearExactResult.candidateHash,
            candidatePreview: nearExactResult.candidatePreview,
          }),
        );

        return nearExactResult.replacement;
      }

      logPatchDiagnostic("oldText-not-found", {
        ...diagnosticContext,
        editNumber,
        editCount: edits.length,
        originalCodeLength: originalCode.length,
        originalCodeHash: hashText(originalCode),
        oldTextLength: oldText.length,
        oldTextHash: hashText(oldText),
        oldTextPreview: previewText(oldText),
        newTextLength: newText.length,
        newTextHash: hashText(newText),
        newTextPreview: previewText(newText),
        normalizedChecks: {
          lineEndingOccurrences,
          whitespaceOccurrences,
          oldTextLineEndingHash: hashText(normalizeLineEndings(oldText)),
          originalLineEndingHash: hashText(normalizeLineEndings(originalCode)),
        },
        nearExact: {
          reason: nearExactResult.reason,
          candidateCount: nearExactResult.candidateCount,
          maxDistance: nearExactResult.maxDistance,
          bestDistance: nearExactResult.bestDistance,
          secondBestDistance: nearExactResult.secondBestDistance,
        },
        closestWindows: findClosestTextWindows(originalCode, oldText),
      });
      throw new AppError(`Patch edit ${editNumber} did not match the current code`, 500, ERROR_CODES.AI_RESPONSE_INVALID);
    }
    if (occurrences > 1) {
      logPatchDiagnostic("oldText-ambiguous", {
        ...diagnosticContext,
        editNumber,
        editCount: edits.length,
        occurrences,
        originalCodeLength: originalCode.length,
        originalCodeHash: hashText(originalCode),
        oldTextLength: oldText.length,
        oldTextHash: hashText(oldText),
        oldTextPreview: previewText(oldText),
      });
      throw new AppError(`Patch edit ${editNumber} matched multiple locations`, 500, ERROR_CODES.AI_RESPONSE_INVALID);
    }

    return {
      start: originalCode.indexOf(oldText),
      end: originalCode.indexOf(oldText) + oldText.length,
      newText,
      appliedWith: "exact",
    };
  });

  replacements.sort((a, b) => b.start - a.start);

  let patchedCode = originalCode;
  for (const replacement of replacements) {
    patchedCode = patchedCode.slice(0, replacement.start) + replacement.newText + patchedCode.slice(replacement.end);
  }

  return patchedCode;
}

function getVersionOwnerFilter(workshop) {
  if (workshop?.authMode === "api-key") {
    return {
      visitorId: workshop.visitorId,
      accessMode: "api-key",
      ownerTokenHash: workshop.ownerTokenHash,
    };
  }

  return {
    visitorId: workshop.visitorId,
    accessMode: { $ne: "api-key" },
  };
}

async function resolveParentVersion(parentVersionId, workshop) {
  if (!parentVersionId) return null;

  if (!mongoose.Types.ObjectId.isValid(parentVersionId)) {
    throw new AppError("Invalid parent version ID", 400, ERROR_CODES.INVALID_OBJECT_ID);
  }

  const parentVersion = await CodeVersion.findOne({
    _id: parentVersionId,
    ...getVersionOwnerFilter(workshop),
  });

  if (!parentVersion) {
    throw new AppError("Parent version not found", 404, ERROR_CODES.INVALID_OBJECT_ID);
  }

  return parentVersion;
}

/**
 * JSON String Stream Decoder
 *
 * Correctly decodes escape sequences from a streaming JSON string value.
 * Handles:
 * - Partial escape sequences across chunk boundaries
 * - Nested escapes (\\n → \n literal, not newline)
 * - Unicode escapes (\uXXXX)
 * - Proper string termination detection
 */
function createJsonStringDecoder() {
  let pendingEscape = ""; // Holds incomplete escape sequence
  let isComplete = false; // True when closing quote found

  // Escape sequence mapping per RFC 8259
  const escapeMap = {
    n: "\n",
    t: "\t",
    r: "\r",
    '"': '"',
    "\\": "\\",
    "/": "/",
    b: "\b",
    f: "\f",
  };

  /**
   * Decode a chunk of JSON string content (after the opening quote)
   * @param {string} chunk - Raw JSON string content (may contain escape sequences)
   * @returns {{ decoded: string, done: boolean, remaining: string }}
   */
  function decode(chunk) {
    if (isComplete) {
      return { decoded: "", done: true, remaining: chunk };
    }

    let decoded = "";
    let i = 0;
    const input = pendingEscape + chunk;
    pendingEscape = "";

    while (i < input.length) {
      const char = input[i];

      if (char === "\\") {
        // Check if we have the next character
        if (i + 1 >= input.length) {
          // Escape sequence incomplete - save for next chunk
          pendingEscape = "\\";
          break;
        }

        const nextChar = input[i + 1];

        // Handle unicode escape \uXXXX
        if (nextChar === "u") {
          if (i + 5 >= input.length) {
            // Unicode sequence incomplete - save for next chunk
            pendingEscape = input.substring(i);
            break;
          }
          // Parse the 4 hex digits
          const hex = input.substring(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            decoded += String.fromCharCode(parseInt(hex, 16));
            i += 6;
          } else {
            // Invalid unicode escape - pass through as-is
            decoded += "\\u";
            i += 2;
          }
          continue;
        }

        // Handle standard escapes
        if (Object.prototype.hasOwnProperty.call(escapeMap, nextChar)) {
          decoded += escapeMap[nextChar];
        } else {
          // Unknown escape - pass through (shouldn't happen in valid JSON)
          decoded += nextChar;
        }
        i += 2;
      } else if (char === '"') {
        // Unescaped quote = end of string
        isComplete = true;
        return {
          decoded,
          done: true,
          remaining: input.substring(i + 1),
        };
      } else {
        // Normal character
        decoded += char;
        i++;
      }
    }

    return {
      decoded,
      done: false,
      remaining: "",
    };
  }

  /**
   * Check if there's a pending incomplete escape sequence
   */
  function hasPending() {
    return pendingEscape.length > 0;
  }

  /**
   * Reset the decoder state
   */
  function reset() {
    pendingEscape = "";
    isComplete = false;
  }

  return { decode, hasPending, reset };
}

// Initialize Gemini AI client
const genAI = new GoogleGenAI({ apiKey: config.geminiApiKey });
const openAI = config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey }) : null;

// System instruction for clean code output
const SYSTEM_INSTRUCTION = `You are an expert web developer assistant. Your task is to generate or modify clean, production-ready HTML, CSS, and JavaScript code.

Reply in the same language as the user, and SUPER shortly tell what you did. SUPER short.

CRITICAL OUTPUT RULES - FOLLOW EXACTLY:
1. Return either a full replacement or exact patch edits using "editMode"
2. Return a SUPER short message in the "message" field in the SAME LANGUAGE as the user
3. Return a TWO-WORD project name in the "projectName" field in the SAME LANGUAGE as the user
4. For "replace_all", the "code" field should contain ONLY the complete code itself - start directly with <!DOCTYPE html> or the first line of code
5. NO markdown code fences (no \`\`\`html, no \`\`\`, nothing) in the code field
6. The message should be 1-2 sentences maximum
7. The projectName MUST be exactly TWO WORDS that describe the project creatively (e.g., "Solar Dashboard", "Pixel Art", "Magic Quiz")
8. For "patch", set "code" to an empty string and put all changes in "edits"
9. Put "editMode" before "code" in the JSON object

CODE MODIFICATION RULES:
- If existing code is provided, modify/extend it based on the user's request
- Maintain the existing structure and style unless explicitly asked to change it
- If user says "add", "modify", "change", or "update" - work with the existing code
- If user wants something completely new, you can start fresh
- Preserve working functionality unless asked to remove it
- Prefer "patch" for targeted changes when existing code is provided
- Use "replace_all" only for brand new projects or broad rewrites
- Patch edits must use exact oldText copied from the provided existing code
- Each oldText must match exactly one location in the existing code
- For translation requests, oldText must stay in the original language exactly as it appears in the code; translate only newText
- If multiple areas need changes, return multiple edits
- Do not use line numbers. Exact text replacement avoids line-number drift when several edits are applied.

IF YOU NEED IMAGES:
- Use https://static.photos/ for placeholder images, https://static.photos/CATEGORY/RESOLUTION/SEED
- Possible categories: nature, office, people, technology, minimal, abstract, cityscape, workspace, food, travel, finance, medical, wellness, education, industry, gaming, automotive
- Seed can be any integer to get different images
- Example https://static.photos/nature/640x360/1

CODE GENERATION RULES:
1. Generate complete, self-contained HTML files
2. Use inline <style> tags for CSS and inline <script> tags for JavaScript
3. Ensure code is production-ready and runs in any modern browser
4. Use modern, semantic HTML5
5. Create visually appealing designs with good styling
6. Include responsive design principles
7. Make interactive elements functional with proper JavaScript
8. Format code with proper indentation - each tag, style rule, and script line should be on its own line

REMEMBER: Return JSON fields in this exact order: "editMode", "code", "edits", "message", "projectName".`;

// JSON schema for structured output
const CODE_GENERATION_SCHEMA = {
  type: "object",
  properties: {
    editMode: {
      type: "string",
      enum: ["replace_all", "patch"],
      description: "Use replace_all for complete output, or patch for exact oldText/newText replacements.",
    },
    code: {
      type: "string",
      description: "Complete HTML/CSS/JS code for replace_all responses. Empty string for patch responses.",
    },
    edits: {
      type: "array",
      description: "Exact replacements for patch mode. Each oldText must match the existing code exactly once.",
      items: {
        type: "object",
        properties: {
          oldText: {
            type: "string",
            description: "Exact text copied from the existing code.",
          },
          newText: {
            type: "string",
            description: "Replacement text.",
          },
        },
        required: ["oldText", "newText"],
      },
    },
    message: {
      type: "string",
      description: "A very short response in the same language as the user describing what was done (1-2 sentences max)",
    },
    projectName: {
      type: "string",
      description: "A creative TWO-WORD name for this project in the same language as the user (e.g., 'Solar Dashboard', 'Pixel Art', 'Magic Quiz')",
    },
  },
  required: ["editMode", "code", "edits", "message", "projectName"],
};

// System instruction for ASK mode - answering questions without generating code
const ASK_SYSTEM_INSTRUCTION = `You are a helpful web development assistant. Your task is to answer questions about HTML, CSS, JavaScript, and web development in general.

Reply in the same language as the user. Be SHORT, CONCISE, and TO THE POINT. No long explanations.

CRITICAL OUTPUT RULES:
1. Return ONLY a "message" field in JSON format
2. The message should be a short, helpful response (2-4 sentences max)
3. Do NOT generate any code - just explain, suggest, or answer
4. If the user asks how to do something, explain the concept briefly
5. If they ask about the existing code, analyze and give feedback
6. Stay focused on the question - no unnecessary elaboration

REMEMBER: You are in ASK mode - your job is to help and advise, NOT to write or modify code. Keep responses SHORT.`;

// JSON schema for ASK mode structured output
const ASK_SCHEMA = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "A short, helpful response in the same language as the user (2-4 sentences max)",
    },
  },
  required: ["message"],
};

function addStrictJsonSchemaRules(schema) {
  if (!schema || typeof schema !== "object") return schema;

  if (schema.type === "object") {
    return {
      ...schema,
      additionalProperties: false,
      properties: Object.fromEntries(
        Object.entries(schema.properties || {}).map(([key, value]) => [key, addStrictJsonSchemaRules(value)]),
      ),
    };
  }

  if (schema.type === "array" && schema.items) {
    return {
      ...schema,
      items: addStrictJsonSchemaRules(schema.items),
    };
  }

  return schema;
}

function buildOpenAITextFormat(isAskMode) {
  return {
    format: {
      type: "json_schema",
      name: isAskMode ? "ask_response" : "code_generation_response",
      strict: true,
      schema: addStrictJsonSchemaRules(isAskMode ? ASK_SCHEMA : CODE_GENERATION_SCHEMA),
    },
  };
}

function combineUsageMetadata(first = {}, second = {}) {
  const keysToSum = ["promptTokenCount", "candidatesTokenCount", "thoughtsTokenCount", "cachedContentTokenCount", "totalTokenCount"];
  const combined = { ...(first || {}) };

  for (const key of keysToSum) {
    const firstValue = first?.[key] || 0;
    const secondValue = second?.[key] || 0;
    combined[key] = firstValue + secondValue;
  }

  return combined;
}

function toGeminiUsageMetadata(openAIUsage = {}) {
  const promptTokenCount = openAIUsage.input_tokens || 0;
  const thoughtsTokenCount = openAIUsage.output_tokens_details?.reasoning_tokens || 0;
  const outputTokenCount = openAIUsage.output_tokens || 0;
  const candidatesTokenCount = Math.max(0, outputTokenCount - thoughtsTokenCount);
  const cachedContentTokenCount = openAIUsage.input_tokens_details?.cached_tokens || 0;

  return {
    promptTokenCount,
    candidatesTokenCount,
    thoughtsTokenCount,
    cachedContentTokenCount,
    totalTokenCount: openAIUsage.total_tokens || promptTokenCount + outputTokenCount,
  };
}

function logStreamDiagnostic(event, payload) {
  console.info(`[AI Stream Diagnostic] ${event}`, JSON.stringify(payload));
}

async function createGeminiStream({ selectedModel, userPrompt, generationConfig, requestId, phase, apiKey }) {
  const client = apiKey ? new GoogleGenAI({ apiKey }) : genAI;
  const stream = await client.models.generateContentStream({
    model: selectedModel.model,
    contents: userPrompt,
    config: generationConfig,
  });

  return (async function* () {
    const diagnostics = {
      requestId,
      phase,
      provider: selectedModel.provider,
      model: selectedModel.model,
      textChunks: 0,
      textChars: 0,
      maxChunkChars: 0,
      usageChunks: 0,
      startedAt: Date.now(),
    };

    try {
      for await (const chunk of stream) {
        const text = chunk.text || chunk.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text) {
          diagnostics.textChunks += 1;
          diagnostics.textChars += text.length;
          diagnostics.maxChunkChars = Math.max(diagnostics.maxChunkChars, text.length);
        }
        if (chunk.usageMetadata) diagnostics.usageChunks += 1;

        yield {
          text,
          usageMetadata: chunk.usageMetadata || null,
        };
      }
    } finally {
      logStreamDiagnostic("provider-summary", {
        ...diagnostics,
        durationMs: Date.now() - diagnostics.startedAt,
      });
    }
  })();
}

async function createOpenAIStream({ selectedModel, userPrompt, isAskMode, systemInstruction, requestId, phase, apiKey }) {
  const client = apiKey ? new OpenAI({ apiKey }) : openAI;

  if (!client) {
    throw new AppError("OpenAI API key not configured", 500, ERROR_CODES.API_KEY_NOT_CONFIGURED);
  }

  const request = {
    model: selectedModel.model,
    instructions: systemInstruction || (isAskMode ? ASK_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION),
    input: userPrompt,
    text: buildOpenAITextFormat(isAskMode),
    reasoning: getOpenAIReasoningConfig(selectedModel),
    stream: true,
    store: false,
  };

  const stream = await client.responses.create(request);

  return (async function* () {
    const diagnostics = {
      requestId,
      phase,
      provider: selectedModel.provider,
      model: selectedModel.model,
      textChunks: 0,
      textChars: 0,
      maxChunkChars: 0,
      eventTypes: {},
      completed: false,
      startedAt: Date.now(),
    };

    try {
      for await (const event of stream) {
        diagnostics.eventTypes[event.type] = (diagnostics.eventTypes[event.type] || 0) + 1;

        if (event.type === "response.output_text.delta") {
          const text = event.delta || "";
          if (text) {
            diagnostics.textChunks += 1;
            diagnostics.textChars += text.length;
            diagnostics.maxChunkChars = Math.max(diagnostics.maxChunkChars, text.length);
          }

          yield {
            text,
            usageMetadata: null,
          };
        } else if (event.type === "response.completed") {
          diagnostics.completed = true;
          yield {
            text: "",
            usageMetadata: toGeminiUsageMetadata(event.response?.usage || {}),
          };
        } else if (event.type === "response.failed") {
          throw new Error(event.response?.error?.message || "OpenAI response failed");
        } else if (event.type === "response.incomplete") {
          throw new Error(event.response?.incomplete_details?.reason || "OpenAI response incomplete");
        } else if (event.type === "response.error") {
          throw new Error(event.error?.message || "OpenAI stream error");
        }
      }
    } finally {
      logStreamDiagnostic("provider-summary", {
        ...diagnostics,
        durationMs: Date.now() - diagnostics.startedAt,
      });
    }
  })();
}

async function createModelTextStream({ selectedModel, generationConfig, userPrompt, isAskMode, requestId, phase = "primary", apiKeys }) {
  if (selectedModel.provider === "openai") {
    return createOpenAIStream({
      selectedModel,
      userPrompt,
      isAskMode,
      systemInstruction: generationConfig?.systemInstruction,
      requestId,
      phase,
      apiKey: apiKeys?.openai,
    });
  }

  return createGeminiStream({ selectedModel, userPrompt, generationConfig, requestId, phase, apiKey: apiKeys?.gemini });
}

async function generateFullRewriteAfterPatchFailure({ selectedModel, generationConfig, userPrompt, sendSse, requestId, diagnosticContext, apiKeys }) {
  const retryConfig = {
    ...generationConfig,
    systemInstruction: `${SYSTEM_INSTRUCTION}

PATCH RETRY MODE:
- A previous patch response could not be applied safely to the current code.
- You MUST return editMode "replace_all".
- You MUST return the complete updated HTML document in "code".
- You MUST return edits as an empty array.
- Do not return patch edits in this retry.`,
  };

  const retryPrompt = `${userPrompt}

The previous patch could not be applied safely. Return the complete updated code instead of patch edits.`;

  console.warn(
    "[Patch Retry]",
    JSON.stringify({
      reason: "falling-back-to-full-rewrite",
      requestId,
      ...diagnosticContext,
    }),
  );

  let accumulatedText = "";
  let usageMetadata = null;
  let codeStarted = false;
  let codeComplete = false;
  let detectedEditMode = null;
  const retryCodeDecoder = createJsonStringDecoder();
  const retryCodeChunkBuffer = createCodeChunkSseBuffer(sendSse);

  const stream = await createModelTextStream({
    selectedModel,
    generationConfig: retryConfig,
    userPrompt: retryPrompt,
    isAskMode: false,
    requestId,
    phase: "patch-retry",
    apiKeys,
  });

  try {
    for await (const chunk of stream) {
      if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;

      const chunkText = chunk.text;
      if (!chunkText) continue;

      accumulatedText += chunkText;

      if (!detectedEditMode) {
        const editModeMatch = accumulatedText.match(/"editMode"\s*:\s*"(replace_all|patch)"/);
        if (editModeMatch) {
          detectedEditMode = editModeMatch[1];
        }
      }

      if (detectedEditMode === "patch") {
        continue;
      }

      if (!codeStarted && detectedEditMode === "replace_all") {
        const codeKeyIndex = accumulatedText.indexOf('"code"');
        if (codeKeyIndex !== -1) {
          const colonPos = accumulatedText.indexOf(":", codeKeyIndex + 6);
          if (colonPos !== -1) {
            let openQuotePos = colonPos + 1;
            while (openQuotePos < accumulatedText.length && /\s/.test(accumulatedText[openQuotePos])) {
              openQuotePos++;
            }

            if (accumulatedText[openQuotePos] === '"') {
              codeStarted = true;
              sendSse({ type: "code-start" });

              const initialContent = accumulatedText.substring(openQuotePos + 1);
              if (initialContent.length > 0) {
                const { decoded, done } = retryCodeDecoder.decode(initialContent);
                if (decoded) {
                  retryCodeChunkBuffer.push(decoded);
                }
                if (done) {
                  retryCodeChunkBuffer.flush();
                  codeComplete = true;
                  sendSse({ type: "code-complete" });
                }
              }
            }
          }
        }
      } else if (codeStarted && !codeComplete) {
        const { decoded, done } = retryCodeDecoder.decode(chunkText);

        if (decoded) {
          retryCodeChunkBuffer.push(decoded);
        }

        if (done) {
          retryCodeChunkBuffer.flush();
          codeComplete = true;
          sendSse({ type: "code-complete" });
        }
      }
    }

    retryCodeChunkBuffer.flush();
  } catch (error) {
    retryCodeChunkBuffer.cancel();
    throw error;
  }

  let structuredResponse;
  try {
    structuredResponse = JSON.parse(accumulatedText);
  } catch (parseError) {
    throw new AppError("Failed to parse AI retry response", 500, ERROR_CODES.AI_RESPONSE_PARSE_FAILED);
  }

  if (!structuredResponse.message || !structuredResponse.projectName || !structuredResponse.code) {
    throw new AppError("Invalid AI retry response structure", 500, ERROR_CODES.AI_RESPONSE_INVALID);
  }

  return {
    structuredResponse: {
      ...structuredResponse,
      editMode: "replace_all",
      edits: [],
    },
    usageMetadata,
    codeStarted,
    codeComplete,
  };
}

/**
 * Generate code using Gemini API with streaming structured outputs
 */
const generateCode = asyncHandler(async (req, res) => {
  const { prompt, existingCode, messageHistory, mode = "edit", modelPreference = DEFAULT_MODEL_PREFERENCE, parentVersionId } = req.body;
  const isAskMode = mode === "ask";
  const hasExistingCode = Boolean(existingCode && existingCode.trim());
  const allowCodeStreaming = !isAskMode;
  const isApiKeyMode = req.workshop?.authMode === "api-key";
  const apiKeys = isApiKeyMode ? req.apiKeyAuth?.apiKeys || {} : null;
  const selectedModel = await getModelPreference(modelPreference, { restrictToEnabled: !isApiKeyMode });
  const requestId = crypto.randomUUID();

  if (!prompt) {
    throw new AppError("Prompt is required", 400, ERROR_CODES.PROMPT_REQUIRED);
  }

  if (isApiKeyMode && !apiKeys?.[selectedModel.provider]) {
    throw new AppError(`${selectedModel.label} requires a ${selectedModel.provider === "openai" ? "OpenAI" : "Gemini"} API key`, 400, ERROR_CODES.API_KEY_REQUIRED);
  }

  if (!isApiKeyMode && selectedModel.provider === "gemini" && !config.geminiApiKey) {
    throw new AppError("Gemini API key not configured", 500, ERROR_CODES.API_KEY_NOT_CONFIGURED);
  }

  if (!isApiKeyMode && selectedModel.provider === "openai" && !config.openaiApiKey) {
    throw new AppError("OpenAI API key not configured", 500, ERROR_CODES.API_KEY_NOT_CONFIGURED);
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const sendSse = (data) => {
    if (!res.destroyed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  const endSse = () => {
    if (!res.destroyed && !res.writableEnded) {
      res.end();
    }
  };

  let accumulatedText = "";
  let codeStarted = false;
  let codeComplete = false;
  let codeFieldStartPos = -1; // Position after opening quote of code field
  const codeDecoder = createJsonStringDecoder();
  let latestUsageMetadata = null;
  let detectedEditMode = null;
  const codeStreamDiagnostics = {
    requestId,
    phase: "primary",
    provider: selectedModel.provider,
    model: selectedModel.model,
    mode,
    hasExistingCode,
    textChunks: 0,
    textChars: 0,
    maxTextChunkChars: 0,
    codeChunksSent: 0,
    codeCharsSent: 0,
    firstCodeChunkChars: null,
    detectedEditMode: null,
    codeKeySeenAtTextChunk: null,
    codeStartAtTextChunk: null,
    codeCompleteAtTextChunk: null,
    startedAt: Date.now(),
  };
  const codeChunkSseBuffer = createCodeChunkSseBuffer(sendSse, {
    onFlush: (chunk) => {
      codeStreamDiagnostics.codeChunksSent += 1;
      codeStreamDiagnostics.codeCharsSent += chunk.length;
      if (codeStreamDiagnostics.firstCodeChunkChars === null) {
        codeStreamDiagnostics.firstCodeChunkChars = chunk.length;
        logStreamDiagnostic("first-code-chunk", {
          requestId,
          provider: selectedModel.provider,
          model: selectedModel.model,
          chunkChars: chunk.length,
          textChunkNumber: codeStreamDiagnostics.textChunks,
        });
      }
    },
  });

  const sendCodeChunk = (decoded) => {
    if (!decoded) return;
    codeChunkSseBuffer.push(decoded);
  };

  try {
    // Configure generation with system instruction based on mode
    const generationConfig = {
      systemInstruction: isAskMode ? ASK_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: isAskMode ? ASK_SCHEMA : CODE_GENERATION_SCHEMA,
    };

    const geminiThinkingConfig = getGeminiThinkingConfig(selectedModel);
    if (geminiThinkingConfig) {
      generationConfig.thinkingConfig = geminiThinkingConfig;
    }

    // Build the user prompt with context
    let userPrompt = "";

    // Add message history if provided
    if (messageHistory && Array.isArray(messageHistory) && messageHistory.length > 0) {
      userPrompt += "CONVERSATION HISTORY:\n";
      messageHistory.forEach((msg, index) => {
        const roleLabel = msg.role === "user" ? "USER" : "ASSISTANT";
        userPrompt += `${roleLabel}: ${msg.content}\n\n`;
      });
      userPrompt += "---\n\n";
    }

    // Add existing code if provided
    if (existingCode && existingCode.trim()) {
      userPrompt += `EXISTING CODE:
\`\`\`html
${existingCode}
\`\`\`

`;
    }

    // Add current prompt
    if (existingCode && existingCode.trim()) {
      userPrompt += `USER REQUEST: ${prompt}

Modify or extend the existing code based on the user's request.`;
    } else {
      userPrompt += prompt;
    }

    // Generate content with streaming
    const stream = await createModelTextStream({
      selectedModel,
      generationConfig,
      userPrompt,
      isAskMode,
      requestId,
      phase: "primary",
      apiKeys,
    });

    // Process the stream
    for await (const chunk of stream) {
      try {
        if (chunk.usageMetadata) {
          latestUsageMetadata = chunk.usageMetadata;
        }

        // Extract text from the provider-normalized chunk
        const chunkText = chunk.text;

        if (chunkText) {
          codeStreamDiagnostics.textChunks += 1;
          codeStreamDiagnostics.textChars += chunkText.length;
          codeStreamDiagnostics.maxTextChunkChars = Math.max(codeStreamDiagnostics.maxTextChunkChars, chunkText.length);

          // Accumulate the text
          accumulatedText += chunkText;

          // In ASK mode, skip code streaming entirely - we just accumulate the response
          if (isAskMode) {
            // Just continue accumulating, we'll parse and send at the end
            continue;
          }

          if (!detectedEditMode) {
            const editModeMatch = accumulatedText.match(/"editMode"\s*:\s*"(replace_all|patch)"/);
            if (editModeMatch) {
              detectedEditMode = editModeMatch[1];
              codeStreamDiagnostics.detectedEditMode = detectedEditMode;
              logStreamDiagnostic("edit-mode-detected", {
                requestId,
                provider: selectedModel.provider,
                model: selectedModel.model,
                detectedEditMode,
                textChunkNumber: codeStreamDiagnostics.textChunks,
                accumulatedTextLength: accumulatedText.length,
              });
            }
          }

          const canStreamCode = allowCodeStreaming && (!hasExistingCode || detectedEditMode === "replace_all") && detectedEditMode !== "patch";

          // If code field hasn't started yet, look for it
          if (canStreamCode && !codeStarted) {
            // Look for "code": pattern
            const codeKeyIndex = accumulatedText.indexOf('"code"');
            if (codeKeyIndex !== -1) {
              if (codeStreamDiagnostics.codeKeySeenAtTextChunk === null) {
                codeStreamDiagnostics.codeKeySeenAtTextChunk = codeStreamDiagnostics.textChunks;
                logStreamDiagnostic("code-key-seen", {
                  requestId,
                  provider: selectedModel.provider,
                  model: selectedModel.model,
                  textChunkNumber: codeStreamDiagnostics.textChunks,
                  accumulatedTextLength: accumulatedText.length,
                  codeKeyIndex,
                });
              }

              // Find the colon after "code"
              const colonPos = accumulatedText.indexOf(":", codeKeyIndex + 6);
              if (colonPos !== -1) {
                // Skip whitespace after colon and find opening quote
                let openQuotePos = colonPos + 1;
                while (openQuotePos < accumulatedText.length && /\s/.test(accumulatedText[openQuotePos])) {
                  openQuotePos++;
                }

                if (accumulatedText[openQuotePos] === '"') {
                  codeStarted = true;
                  codeFieldStartPos = openQuotePos + 1; // Position after opening quote
                  codeStreamDiagnostics.codeStartAtTextChunk = codeStreamDiagnostics.textChunks;
                  logStreamDiagnostic("code-start-sent", {
                    requestId,
                    provider: selectedModel.provider,
                    model: selectedModel.model,
                    textChunkNumber: codeStreamDiagnostics.textChunks,
                    accumulatedTextLength: accumulatedText.length,
                    initialBufferedChars: accumulatedText.length - codeFieldStartPos,
                  });
                  sendSse({ type: "code-start" });

                  // Decode any content we already have after the opening quote
                  const initialContent = accumulatedText.substring(codeFieldStartPos);
                  if (initialContent.length > 0) {
                    const { decoded, done } = codeDecoder.decode(initialContent);
                    sendCodeChunk(decoded);
                    if (done) {
                      codeChunkSseBuffer.flush();
                      codeComplete = true;
                      codeStreamDiagnostics.codeCompleteAtTextChunk = codeStreamDiagnostics.textChunks;
                      logStreamDiagnostic("code-complete-sent", {
                        requestId,
                        provider: selectedModel.provider,
                        model: selectedModel.model,
                        textChunkNumber: codeStreamDiagnostics.textChunks,
                        codeChunksSent: codeStreamDiagnostics.codeChunksSent,
                        codeCharsSent: codeStreamDiagnostics.codeCharsSent,
                      });
                      sendSse({ type: "code-complete" });
                    }
                  }
                }
              }
            }
          } else if (codeStarted && !codeComplete) {
            // Code has started but not complete - decode the new chunk directly
            // We only pass the new chunk text to the decoder (it maintains state)
            const { decoded, done } = codeDecoder.decode(chunkText);

            sendCodeChunk(decoded);

            if (done) {
              codeChunkSseBuffer.flush();
              codeComplete = true;
              codeStreamDiagnostics.codeCompleteAtTextChunk = codeStreamDiagnostics.textChunks;
              logStreamDiagnostic("code-complete-sent", {
                requestId,
                provider: selectedModel.provider,
                model: selectedModel.model,
                textChunkNumber: codeStreamDiagnostics.textChunks,
                codeChunksSent: codeStreamDiagnostics.codeChunksSent,
                codeCharsSent: codeStreamDiagnostics.codeCharsSent,
              });
              sendSse({ type: "code-complete" });
            }
          }
        }
      } catch (chunkError) {
        console.error("Error processing chunk:", chunkError);
        // Continue processing other chunks
      }
    }

    if (codeStarted) {
      codeChunkSseBuffer.flush();
    }

    logStreamDiagnostic("code-stream-summary", {
      ...codeStreamDiagnostics,
      accumulatedTextLength: accumulatedText.length,
      codeStarted,
      codeComplete,
      durationMs: Date.now() - codeStreamDiagnostics.startedAt,
    });

    // Parse the final accumulated JSON response
    let structuredResponse;
    try {
      structuredResponse = JSON.parse(accumulatedText);
    } catch (parseError) {
      throw new AppError("Failed to parse AI response", 500, ERROR_CODES.AI_RESPONSE_PARSE_FAILED);
    }

    let finalCode = "";
    let savedVersion = null;
    let finalEditMode = "replace_all";
    let finalEdits = [];

    // Validate response has required fields based on mode
    if (isAskMode) {
      if (!structuredResponse.message) {
        throw new AppError("Invalid AI response structure", 500, ERROR_CODES.AI_RESPONSE_INVALID);
      }
    } else {
      if (!structuredResponse.message || !structuredResponse.projectName || !structuredResponse.editMode) {
        throw new AppError("Invalid AI response structure", 500, ERROR_CODES.AI_RESPONSE_INVALID);
      }

      finalEditMode = structuredResponse.editMode === "patch" && hasExistingCode ? "patch" : "replace_all";

      if (finalEditMode === "patch") {
        const patchDiagnosticContext = {
          requestId,
          visitorId: req.workshop?.visitorId,
          passwordId: req.workshop?.passwordId?.toString(),
          parentVersionId: parentVersionId || null,
          model: selectedModel.model,
          modelPreference,
          promptHash: hashText(prompt),
          promptPreview: previewText(prompt, 300),
          messageHistoryCount: Array.isArray(messageHistory) ? messageHistory.length : 0,
          structuredMessage: structuredResponse.message,
          projectName: structuredResponse.projectName,
        };

        try {
          finalCode = applyExactEdits(existingCode, structuredResponse.edits, patchDiagnosticContext);
          finalEdits = structuredResponse.edits.map((edit) => ({
            oldText: edit.oldText,
            newText: typeof edit.newText === "string" ? edit.newText : "",
          }));
        } catch (patchError) {
          if (!(patchError instanceof AppError) || patchError.errorCode !== ERROR_CODES.AI_RESPONSE_INVALID) {
            throw patchError;
          }

          const retryResult = await generateFullRewriteAfterPatchFailure({
            selectedModel,
            generationConfig,
            userPrompt,
            sendSse,
            requestId,
            diagnosticContext: {
              ...patchDiagnosticContext,
              patchError: patchError.message,
            },
            apiKeys,
          });

          latestUsageMetadata = combineUsageMetadata(latestUsageMetadata, retryResult.usageMetadata);
          structuredResponse = retryResult.structuredResponse;
          finalEditMode = "replace_all";
          finalEdits = [];
          finalCode = structuredResponse.code;
          codeStarted = codeStarted || retryResult.codeStarted;
          codeComplete = codeComplete || retryResult.codeComplete;
        }
      } else {
        if (!structuredResponse.code) {
          throw new AppError("Invalid AI response structure", 500, ERROR_CODES.AI_RESPONSE_INVALID);
        }
        finalCode = structuredResponse.code;
      }

      if (finalCode.length > 500000) {
        throw new AppError("Generated code cannot exceed 500KB", 400, ERROR_CODES.VALIDATION_FAILED);
      }
    }

    // Ensure code-complete was sent for EDIT mode (handles edge case where stream ends abruptly)
    if (!isAskMode && codeStarted && !codeComplete) {
      codeChunkSseBuffer.flush();
      codeComplete = true;
      codeStreamDiagnostics.codeCompleteAtTextChunk = codeStreamDiagnostics.codeCompleteAtTextChunk || codeStreamDiagnostics.textChunks;
      logStreamDiagnostic("code-complete-sent", {
        requestId,
        provider: selectedModel.provider,
        model: selectedModel.model,
        reason: "stream-ended-after-code-start",
        textChunkNumber: codeStreamDiagnostics.textChunks,
        codeChunksSent: codeStreamDiagnostics.codeChunksSent,
        codeCharsSent: codeStreamDiagnostics.codeCharsSent,
      });
      sendSse({ type: "code-complete" });
    }

    // Send message-complete event (message field is complete)
    const finalMessage = structuredResponse.message;
    sendSse({ type: "message-complete", message: finalMessage });

    if (!isAskMode && req.workshop?.visitorId) {
      const parentVersion = await resolveParentVersion(parentVersionId, req.workshop);
      const manualEditsSinceParent = Boolean(parentVersion && existingCode && parentVersion.code !== existingCode);
      const version = await CodeVersion.create({
        visitorId: req.workshop.visitorId,
        passwordId: req.workshop.passwordId || null,
        accessMode: isApiKeyMode ? "api-key" : "password",
        ownerTokenHash: isApiKeyMode ? req.workshop.ownerTokenHash : null,
        parentVersionId: parentVersion?._id || null,
        rootVersionId: parentVersion?.rootVersionId || parentVersion?._id || null,
        code: finalCode,
        prompt,
        message: structuredResponse.message,
        projectName: structuredResponse.projectName || null,
        modelProvider: selectedModel.provider,
        modelPreference: selectedModel.id,
        modelId: selectedModel.model,
        modelLabel: selectedModel.label,
        modelShortLabel: selectedModel.shortLabel,
        modelThinking: selectedModel.thinking,
        editMode: finalEditMode,
        editCount: finalEdits.length,
        edits: finalEdits,
        manualEditsSinceParent,
      });

      if (!version.rootVersionId) {
        version.rootVersionId = version._id;
        await version.save();
      }

      savedVersion = {
        id: version._id.toString(),
        visitorId: version.visitorId,
        passwordId: version.passwordId?.toString() || null,
        accessMode: version.accessMode,
        parentVersionId: version.parentVersionId?.toString() || null,
        rootVersionId: version.rootVersionId?.toString() || null,
        code: version.code,
        prompt: version.prompt,
        message: version.message,
        projectName: version.projectName,
        modelProvider: version.modelProvider,
        modelPreference: version.modelPreference,
        modelId: version.modelId,
        modelLabel: version.modelLabel,
        modelShortLabel: version.modelShortLabel,
        modelThinking: version.modelThinking,
        editMode: version.editMode,
        editCount: version.editCount,
        edits: version.edits,
        manualEditsSinceParent: version.manualEditsSinceParent,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
      };
    }

    let usageSummary = null;

    // Get token usage metadata from the stream
    try {
      const usageMetadata = latestUsageMetadata || {};

      // Extract token counts with fallbacks
      const promptTokens = usageMetadata.promptTokenCount || 0;
      const candidatesTokens = usageMetadata.candidatesTokenCount || 0;
      const thoughtsTokens = usageMetadata.thoughtsTokenCount || 0;
      const cachedTokens = usageMetadata.cachedContentTokenCount || 0;
      const totalTokens = usageMetadata.totalTokenCount || promptTokens + candidatesTokens + thoughtsTokens;
      const billableOutputTokens = candidatesTokens + thoughtsTokens;

      // Calculate estimated cost in cents
      const estimatedCost = calculateCostInCents(promptTokens, billableOutputTokens, selectedModel.pricing, cachedTokens);
      const codeChange = getCodeChangeSummary({
        mode,
        hasExistingCode,
        existingCode,
        finalCode,
        finalEdits,
      });

      usageSummary = {
        provider: selectedModel.provider,
        modelPreference: selectedModel.id,
        modelId: selectedModel.model,
        modelLabel: selectedModel.label,
        modelThinking: selectedModel.thinking,
        mode,
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

      console.log(
        `[Token Usage] Model: ${selectedModel.model}, Prompt: ${promptTokens}, Candidates: ${candidatesTokens}, Thoughts: ${thoughtsTokens}, Total: ${totalTokens}, Cost: ${estimatedCost.toFixed(6)} cents`,
      );

      // Log request to RequestLog and update Usage if we have usage data from workshopGuard
      if (req.workshop && req.workshop.passwordId && req.workshop.visitorId) {
        const tokenData = {
          promptTokens,
          candidatesTokens,
          thoughtsTokens,
          totalTokens,
          estimatedCost,
        };

        // Log the request details
        await RequestLog.logRequest({
          passwordId: req.workshop.passwordId,
          visitorId: req.workshop.visitorId,
          promptTokens,
          candidatesTokens,
          thoughtsTokens,
          cachedTokens,
          totalTokens,
          estimatedCost,
          model: selectedModel.model,
          generationType: isAskMode ? "ask" : "code-generation",
          mode: mode,
        });

        // Update aggregate usage tracking
        await Usage.trackTokenUsage(req.workshop.passwordId, req.workshop.visitorId, tokenData);

        console.log(`[Token Tracking] Logged request for visitor ${req.workshop.visitorId}`);
      }
    } catch (tokenError) {
      // Log the error but don't fail the request - token tracking is non-critical
      console.error("[Token Tracking Error] Failed to log token usage:", tokenError.message);
    }

    // Send the final complete response
    const finalData = {
      type: "done",
      message: structuredResponse.message,
      code: isAskMode ? "" : finalCode,
      projectName: isAskMode ? undefined : structuredResponse.projectName,
      editMode: isAskMode ? undefined : finalEditMode,
      version: savedVersion,
      remaining: req.workshop?.remaining,
      usage: usageSummary,
    };

    sendSse(finalData);
    endSse();
  } catch (error) {
    codeChunkSseBuffer.cancel();

    console.error("[AI Generation Error]", {
      requestId,
      visitorId: req.workshop?.visitorId,
      parentVersionId: parentVersionId || null,
      model: selectedModel.model,
      mode,
      authMode: req.workshop?.authMode || "password",
      error: sanitizeErrorForLog(error),
    });

    // Handle specific Gemini API errors
    let errorMessage = "AI generation failed";
    let statusCode = 500;
    let errorCode = ERROR_CODES.AI_GENERATION_FAILED;

    if (error.message?.includes("API key") || error.status === 401 || error.status === 403) {
      errorMessage = isApiKeyMode ? "Invalid API key for selected provider" : "Invalid API configuration";
      errorCode = ERROR_CODES.API_KEY_INVALID;
    } else if (error.message?.includes("quota")) {
      errorMessage = "API quota exceeded. Please try again later.";
      statusCode = 503;
      errorCode = ERROR_CODES.API_QUOTA_EXCEEDED;
    } else if (error.message?.includes("safety")) {
      errorMessage = "Request blocked due to safety filters";
      statusCode = 400;
      errorCode = ERROR_CODES.SAFETY_FILTER_BLOCKED;
    } else if (error.message?.includes("Failed to parse stream") || error.message?.includes("parse stream")) {
      errorMessage = "Failed to parse AI response";
      errorCode = ERROR_CODES.AI_RESPONSE_PARSE_FAILED;
    } else if (error instanceof AppError) {
      errorMessage = error.message;
      statusCode = error.statusCode;
      errorCode = error.errorCode || ERROR_CODES.AI_GENERATION_FAILED;
    } else {
      errorMessage = `AI generation failed: ${error.message}`;
    }

    // Send error event
    const errorData = {
      type: "error",
      error: errorMessage,
      errorCode: errorCode,
      statusCode: statusCode,
    };

    sendSse(errorData);
    endSse();
  }
});

module.exports = {
  generateCode,
};
