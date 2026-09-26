const { ArtifactEditError, applyArtifactEdits, validateGeneratedArtifact } = require("./artifactEditing");

function invalid(feedback) {
  throw new ArtifactEditError("Invalid AI response structure", "invalid-response", { feedback });
}

function resolveArtifactResponse(text, { responseMode, existingCode = "" }) {
  let response;
  try { response = JSON.parse(text); }
  catch { invalid("Return valid JSON only, matching the requested response schema."); }
  if (!response || typeof response !== "object" || Array.isArray(response)) invalid();
  const mode = responseMode === "auto" ? response.action : responseMode;
  if (!["ask", "edit"].includes(mode)) invalid('action must be "ask" or "edit".');
  if (typeof response.message !== "string" || !response.message.trim()) invalid("message must be a non-empty string.");
  if (mode === "ask") {
    if (responseMode === "auto" && (response.code !== "" || !Array.isArray(response.edits) || response.edits.length || response.projectName !== "" || response.editMode !== "replace_all" || response.changeScope !== "localized")) {
      invalid('An ask response must have code and projectName empty, edits [], editMode "replace_all", and changeScope "localized".');
    }
    return { mode, message: response.message, code: "", edits: [], patchApplyMethod: null };
  }
  if (typeof response.projectName !== "string" || !response.projectName.trim()) invalid("projectName must be a non-empty string.");
  if (!["patch", "replace_all"].includes(response.editMode)) invalid('editMode must be "patch" or "replace_all".');
  if (!["localized", "cross_cutting", "rewrite"].includes(response.changeScope)) invalid("Use a valid changeScope.");
  if (typeof response.code !== "string" || !Array.isArray(response.edits)) invalid("code must be a string and edits must be an array.");

  let code = response.code;
  let edits = [];
  let patchApplyMethod = null;
  if (response.editMode === "patch") {
    if (!existingCode.trim()) invalid("There is no existing document. Use replace_all.");
    if (response.code !== "") invalid("In patch mode, code must be empty.");
    const result = applyArtifactEdits(existingCode, response.edits);
    code = result.code;
    edits = result.appliedEdits.map(({ oldText, newText }) => ({ oldText, newText }));
    const methods = [...new Set(result.appliedEdits.map((edit) => edit.appliedWith))];
    patchApplyMethod = methods.length === 1 ? methods[0] : "mixed";
  } else if (response.edits.length) {
    invalid("In replace_all mode, edits must be empty.");
  }
  validateGeneratedArtifact(code);
  return { mode, message: response.message, projectName: response.projectName, code, edits,
    editMode: response.editMode, changeScope: response.changeScope, patchApplyMethod };
}

async function resolveWithOneRepair({ text, responseMode, existingCode, repair, signal, onValidation = () => {} }) {
  let candidate = text;
  let repairReason = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    signal?.throwIfAborted();
    onValidation(attempt);
    try {
      const result = resolveArtifactResponse(candidate, { responseMode, existingCode });
      return { ...result, repairAttempted: attempt === 1, repairReason };
    } catch (error) {
      if (!(error instanceof ArtifactEditError) || attempt === 1) throw error;
      repairReason = error.reason;
      signal?.throwIfAborted();
      candidate = await repair({ error, candidate });
    }
  }
}

module.exports = { resolveArtifactResponse, resolveWithOneRepair };
