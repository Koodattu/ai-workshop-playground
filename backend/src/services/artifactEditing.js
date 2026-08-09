const vm = require("node:vm");

const MAX_ARTIFACT_SIZE = 500000;
const MAX_PATCH_EDITS = 8;
const MAX_PATCH_CHANGE_RATIO = 0.35;

class ArtifactEditError extends Error {
  constructor(message, reason, details = {}) {
    super(message);
    this.name = "ArtifactEditError";
    this.reason = reason;
    this.details = details;
    this.retryFeedback = buildRetryFeedback(reason, details);
  }
}

function buildRetryFeedback(reason, details) {
  switch (reason) {
    case "missing-edits":
      return "Patch mode requires at least one exact oldText/newText edit.";
    case "too-many-edits":
      return `The patch contained ${details.editCount} edits; return at most ${MAX_PATCH_EDITS} non-overlapping edits.`;
    case "missing-old-text":
      return `Edit ${details.editNumber} has an empty oldText. Copy a non-empty block verbatim from the current code.`;
    case "invalid-new-text":
      return `Edit ${details.editNumber} has an invalid newText. It must be a string; use an empty string only to delete the matched block.`;
    case "no-op":
      return `Edit ${details.editNumber} does not change anything. Remove it or provide the intended replacement.`;
    case "not-found":
      return `Edit ${details.editNumber} does not match the current code. Copy oldText verbatim from the supplied current code, including whitespace.`;
    case "ambiguous":
      return `Edit ${details.editNumber} matches ${details.occurrences} locations. Include more surrounding context so it matches exactly once.`;
    case "overlap":
      return `Edits ${details.firstEditNumber} and ${details.secondEditNumber} overlap. Combine them into one replacement or make them disjoint.`;
    case "change-too-large":
      return `The patch changes about ${Math.round(details.changeRatio * 100)}% of the document. Use replace_all with changeScope "cross_cutting" or "rewrite" if that much code truly must change; otherwise return smaller edits.`;
    case "artifact-empty":
      return "The resulting document is empty. Return a complete runnable HTML document.";
    case "artifact-too-large":
      return `The resulting document exceeds the ${MAX_ARTIFACT_SIZE}-character limit. Remove unnecessary generated content.`;
    case "markdown-wrapper":
      return "Return raw HTML only, without Markdown fences or explanatory text around it.";
    case "missing-document-shell":
      return "Return a complete HTML document beginning with <!DOCTYPE html> and containing closed html and body elements.";
    case "placeholder-content":
      return "Do not use placeholders such as 'rest unchanged'. Include the actual resulting code.";
    case "inline-script-syntax":
      return `An inline script is not valid JavaScript: ${details.syntaxMessage}. Correct the script syntax.`;
    default:
      return "Return a safe, complete artifact update that satisfies the output contract.";
  }
}

function fail(message, reason, details) {
  throw new ArtifactEditError(message, reason, details);
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;

  let count = 0;
  let position = 0;
  while (position !== -1) {
    position = haystack.indexOf(needle, position);
    if (position !== -1) {
      count += 1;
      position += needle.length;
    }
  }
  return count;
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function getDominantLineEnding(text) {
  const crlfCount = (text.match(/\r\n/g) || []).length;
  const lfCount = (text.replace(/\r\n/g, "").match(/\n/g) || []).length;
  return crlfCount > lfCount ? "\r\n" : "\n";
}

function applyLineEnding(text, lineEnding) {
  return normalizeLineEndings(text).replace(/\n/g, lineEnding);
}

function buildNormalizedIndexMap(originalCode) {
  const normalizedChars = [];
  const normalizedToOriginalIndex = [];

  for (let originalIndex = 0; originalIndex < originalCode.length; originalIndex += 1) {
    const char = originalCode[originalIndex];
    normalizedToOriginalIndex.push(originalIndex);

    if (char === "\r") {
      normalizedChars.push("\n");
      if (originalCode[originalIndex + 1] === "\n") originalIndex += 1;
    } else {
      normalizedChars.push(char);
    }
  }

  normalizedToOriginalIndex.push(originalCode.length);
  return { normalizedCode: normalizedChars.join(""), normalizedToOriginalIndex };
}

function resolveLineEndingNormalizedReplacement(originalCode, oldText, newText) {
  const { normalizedCode, normalizedToOriginalIndex } = buildNormalizedIndexMap(originalCode);
  const normalizedOldText = normalizeLineEndings(oldText);
  const occurrences = countOccurrences(normalizedCode, normalizedOldText);

  if (occurrences !== 1) return { occurrences };

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

function countChangedCharacters(oldText, newText) {
  const sharedLength = Math.min(oldText.length, newText.length);
  let prefixLength = 0;
  while (prefixLength < sharedLength && oldText[prefixLength] === newText[prefixLength]) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < sharedLength - prefixLength &&
    oldText[oldText.length - 1 - suffixLength] === newText[newText.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  return Math.max(oldText.length - prefixLength - suffixLength, newText.length - prefixLength - suffixLength);
}

function applyArtifactEdits(originalCode, edits) {
  if (!Array.isArray(edits) || edits.length === 0) {
    fail("Patch response did not include any edits", "missing-edits", { editCount: Array.isArray(edits) ? edits.length : null });
  }
  if (edits.length > MAX_PATCH_EDITS) {
    fail("Patch response included too many edits", "too-many-edits", { editCount: edits.length });
  }

  let changedCharacters = 0;
  const replacements = edits.map((edit, index) => {
    const editNumber = index + 1;
    const oldText = typeof edit?.oldText === "string" ? edit.oldText : "";
    const newText = edit?.newText;

    if (!oldText) fail(`Patch edit ${editNumber} is missing oldText`, "missing-old-text", { editNumber });
    if (typeof newText !== "string") fail(`Patch edit ${editNumber} has invalid newText`, "invalid-new-text", { editNumber });
    if (oldText === newText) fail(`Patch edit ${editNumber} does not change the code`, "no-op", { editNumber });

    changedCharacters += countChangedCharacters(oldText, newText);
    const exactOccurrences = countOccurrences(originalCode, oldText);

    let replacement;
    if (exactOccurrences === 1) {
      const start = originalCode.indexOf(oldText);
      replacement = { start, end: start + oldText.length, newText, appliedWith: "exact" };
    } else if (exactOccurrences > 1) {
      fail(`Patch edit ${editNumber} matched multiple locations`, "ambiguous", {
        editNumber,
        occurrences: exactOccurrences,
      });
    } else {
      const normalizedResult = resolveLineEndingNormalizedReplacement(originalCode, oldText, newText);
      if (normalizedResult.replacement) {
        replacement = normalizedResult.replacement;
      } else if (normalizedResult.occurrences > 1) {
        fail(`Patch edit ${editNumber} matched multiple locations after normalizing line endings`, "ambiguous", {
          editNumber,
          occurrences: normalizedResult.occurrences,
        });
      } else {
        fail(`Patch edit ${editNumber} did not match the current code`, "not-found", { editNumber });
      }
    }

    return { ...replacement, editNumber, oldText, newText };
  });

  const ascending = [...replacements].sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < ascending.length; index += 1) {
    const previous = ascending[index - 1];
    const current = ascending[index];
    if (current.start < previous.end) {
      fail("Patch edits overlap", "overlap", {
        firstEditNumber: previous.editNumber,
        secondEditNumber: current.editNumber,
      });
    }
  }

  const changeRatio = changedCharacters / Math.max(originalCode.length, 1);
  if (changeRatio > MAX_PATCH_CHANGE_RATIO) {
    fail("Patch changes too much of the document", "change-too-large", { changeRatio, changedCharacters });
  }

  let code = originalCode;
  for (const replacement of [...replacements].sort((left, right) => right.start - left.start)) {
    code = code.slice(0, replacement.start) + replacement.newText + code.slice(replacement.end);
  }

  return {
    code,
    appliedEdits: replacements.map(({ oldText, newText, appliedWith }) => ({ oldText, newText, appliedWith })),
    stats: { editCount: replacements.length, changedCharacters, changeRatio },
  };
}

function validateClassicInlineScripts(code) {
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  let scriptNumber = 0;

  while ((match = scriptPattern.exec(code)) !== null) {
    scriptNumber += 1;
    const attributes = match[1];
    const source = match[2];
    if (/\bsrc\s*=/i.test(attributes)) continue;

    const typeMatch = attributes.match(/\btype\s*=\s*["']?([^\s"'>]+)/i);
    const type = typeMatch?.[1]?.toLowerCase();
    if (type && type !== "text/javascript" && type !== "application/javascript") continue;
    if (!source.trim()) continue;

    try {
      new vm.Script(source, { filename: `inline-script-${scriptNumber}.js` });
    } catch (error) {
      const syntaxMessage = error instanceof Error ? error.message.split("\n")[0] : "Unknown syntax error";
      fail(`Inline script ${scriptNumber} has invalid JavaScript`, "inline-script-syntax", {
        scriptNumber,
        syntaxMessage,
      });
    }
  }
}

function validateGeneratedArtifact(code) {
  if (typeof code !== "string" || !code.trim()) fail("Generated document is empty", "artifact-empty");
  if (code.length > MAX_ARTIFACT_SIZE) {
    fail("Generated document exceeds the size limit", "artifact-too-large", { codeLength: code.length });
  }

  const trimmed = code.trim();
  if (trimmed.startsWith("```") || trimmed.endsWith("```")) {
    fail("Generated document contains a Markdown wrapper", "markdown-wrapper");
  }
  if (
    !/^<!doctype\s+html\s*>/i.test(trimmed) ||
    !/<html\b[^>]*>/i.test(trimmed) ||
    !/<\/html\s*>\s*$/i.test(trimmed) ||
    !/<body\b[^>]*>/i.test(trimmed) ||
    !/<\/body\s*>/i.test(trimmed)
  ) {
    fail("Generated document is missing a complete HTML shell", "missing-document-shell");
  }
  if (/<!--\s*(?:the\s+)?(?:rest|remaining|remainder)[\s\S]{0,80}?(?:unchanged|same)[\s.!-]*-->/i.test(code)) {
    fail("Generated document contains omitted placeholder content", "placeholder-content");
  }

  validateClassicInlineScripts(code);
  return { codeLength: code.length };
}

module.exports = {
  ArtifactEditError,
  MAX_ARTIFACT_SIZE,
  MAX_PATCH_CHANGE_RATIO,
  MAX_PATCH_EDITS,
  applyArtifactEdits,
  validateGeneratedArtifact,
};
