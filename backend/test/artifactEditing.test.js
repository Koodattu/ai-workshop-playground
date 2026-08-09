const test = require("node:test");
const assert = require("node:assert/strict");

const { ArtifactEditError, applyArtifactEdits, validateGeneratedArtifact } = require("../src/services/artifactEditing");

const document = (body, script = "") => `<!DOCTYPE html>
<html lang="en">
<head><title>Test</title></head>
<body>${body}${script ? `<script>${script}</script>` : ""}</body>
</html>`;

test("applies multiple exact edits atomically", () => {
  const original = document("<h1>Hello</h1><p>Old copy</p>");
  const result = applyArtifactEdits(original, [
    { oldText: "<h1>Hello</h1>", newText: "<h1>Welcome</h1>" },
    { oldText: "<p>Old copy</p>", newText: "<p>New copy</p>" },
  ]);

  assert.match(result.code, /<h1>Welcome<\/h1>/);
  assert.match(result.code, /<p>New copy<\/p>/);
  assert.equal(result.stats.editCount, 2);
});

test("accepts a unique match with different line endings", () => {
  const original = document("<main>\n  <p>Hello</p>\n</main>").replace(/\n/g, "\r\n");
  const result = applyArtifactEdits(original, [
    { oldText: "<main>\n  <p>Hello</p>\n</main>", newText: "<main>\n  <p>Welcome</p>\n</main>" },
  ]);

  assert.match(result.code, /<p>Welcome<\/p>/);
  assert.equal(result.appliedEdits[0].appliedWith, "line-ending-normalized");
});

test("rejects a near match instead of guessing", () => {
  assert.throws(
    () => applyArtifactEdits(document("<p>Actual text</p>"), [{ oldText: "<p>Actuel text</p>", newText: "<p>Changed</p>" }]),
    (error) => error instanceof ArtifactEditError && error.reason === "not-found",
  );
});

test("rejects ambiguous and overlapping edits", () => {
  assert.throws(
    () => applyArtifactEdits(document("<span>x</span><span>x</span>"), [{ oldText: "<span>x</span>", newText: "<span>y</span>" }]),
    (error) => error instanceof ArtifactEditError && error.reason === "ambiguous",
  );

  const original = document("<main><p>Hello</p></main>");
  assert.throws(
    () =>
      applyArtifactEdits(original, [
        { oldText: "<main><p>Hello</p></main>", newText: "<main><p>Welcome</p></main>" },
        { oldText: "<p>Hello</p>", newText: "<p>Hi</p>" },
      ]),
    (error) => error instanceof ArtifactEditError && error.reason === "overlap",
  );
});

test("rejects no-op and document-scale patches", () => {
  const original = document("x".repeat(100));
  assert.throws(
    () => applyArtifactEdits(original, [{ oldText: "x", newText: "x" }]),
    (error) => error instanceof ArtifactEditError && error.reason === "no-op",
  );
  assert.throws(
    () => applyArtifactEdits(original, [{ oldText: "x".repeat(100), newText: "y".repeat(100) }]),
    (error) => error instanceof ArtifactEditError && error.reason === "change-too-large",
  );
});

test("validates a complete document and classic inline JavaScript", () => {
  assert.doesNotThrow(() => validateGeneratedArtifact(document("<button>Play</button>", "const score = 0;")));
  assert.throws(
    () => validateGeneratedArtifact(document("<button>Play</button>", "const = ;")),
    (error) => error instanceof ArtifactEditError && error.reason === "inline-script-syntax",
  );
});

test("allows import maps and module scripts that require browser parsing", () => {
  const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <script type="importmap">{"imports":{"three":"https://example.com/three.js"}}</script>
</head>
<body><script type="module">import * as THREE from "three"; window.scene = new THREE.Scene();</script></body>
</html>`;

  assert.doesNotThrow(() => validateGeneratedArtifact(code));
});

test("rejects wrappers, incomplete documents, and omission placeholders", () => {
  assert.throws(() => validateGeneratedArtifact(`\`\`\`html\n${document("ok")}\n\`\`\``), /Markdown wrapper/);
  assert.throws(() => validateGeneratedArtifact("<main>Fragment</main>"), /complete HTML shell/);
  assert.throws(() => validateGeneratedArtifact(document("<!-- rest unchanged -->")), /placeholder content/);
});
