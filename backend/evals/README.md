# Generation comparison

Model and reasoning defaults are unchanged. Compare settings in a local or staging
workshop through the existing admin model settings before changing a default.
Use the same model and prompts for both settings; only change reasoning effort.
These are paid provider runs when executed. Unit and integration tests use mocks.

`generation-cases.json` contains reproducible prompts, starting documents and
acceptance criteria. Use each `existingCode` as the editor contents, select its
artifact type and mode, then submit its prompt. Reset the document and clear chat
between trials. Run each case at least three times per setting, in alternating
order, and record whether every acceptance criterion passes in the browser.
Do not include earlier chats or unrelated code in these trials.

Capture the backend console log for each comparison. From `backend`:

```powershell
node scripts/summarize-generation-runs.js .\comparison.log
```

The report groups runs by provider, model, reasoning, mode and artifact type. It
reports completed-run p50/p95 latency, time to first response text, failures,
cancellations, timeouts, repair frequency and known token usage (including the
repair). Unknown usage remains unknown. Cancelled/failed requests may incur
provider costs even when no final usage arrives. These logs are diagnostic and do
not change workshop quota rules. Successful-run cost estimates use each attempt's
context size separately.

Keep a companion table: case, trial, reasoning, all criteria passed, unintended
changes, visual/runtime problems, and perceived wait. Successful validation alone
does not establish game correctness or visual quality. Pick a higher effort only
if it improves browser acceptance enough to justify latency and token cost.
Choose a latency budget before running the comparison; a small sample is
directional evidence, not a benchmark claim.

Also smoke-test Stop before output, during a full rewrite, and during repair. The
prior editor and preview should return, a new request should work, and no stopped
candidate should be applied. Stop is disabled during the final save; a disconnect
after saving has begun can still leave a durable version. Refresh version history
if the connection drops at that point. There is one five-minute generation budget
shared by the primary attempt and repair. Validation parses inline classic and
module JavaScript without executing it; runtime behavior still needs a preview.

## Prototype quality smoke trials — 2026-10-03

`scripts/evaluate-prototype.js` provides two paid local cases, `collector` and
`memory`, plus follow-ups against a prior result. It requires `--live`, permits
only GPT-6 Luna and DeepSeek V4.1 Flash, and calls `http://localhost:5010`.
Start the backend on that port with an **isolated test Mongo database** first.
Run the script from `backend` so it reads the local admin secret. It enables only
these two models in the local workshop, sets Luna to medium and DeepSeek to low,
and creates a one-day test access code. Never aim this workflow at production.

```powershell
node scripts/evaluate-prototype.js --live --model gpt56luna --case collector --output ../.cache/prototype-quality/luna-collector.json
node scripts/evaluate-prototype.js --live --model deepseekv4flash --case memory --output ../.cache/prototype-quality/deepseek-memory.json
# Follow-up: add --input <prior-result.json> --prompt-file <request.txt> instead of --case.
# Optional: --screenshot <small PNG/JPEG>; input.feedback can hold a real preview snapshot.
```

The runner records phases, duration, usage, validation/repair outcome and the
complete resulting HTML locally. It does not store credentials. Live results are
ignored under `.cache/`; inspect generated games in a browser before scoring them.

| Local trial | Reasoning | Completion | Result |
| --- | --- | ---: | --- |
| Luna: create seeded star collector | medium | 40.3 s | Full HTML; keyboard starts/moves player; restart restores initial state |
| Luna: change only Restart color | medium | 5.3 s | Exact patch, 137 visible output tokens; purple button verified |
| DeepSeek: create six-pair memory game | low | 39.0 s | Full HTML; keyboard flip, matches, mismatch recovery and win played in browser |
| Luna: screenshot + captured Starter state | medium | 3.7 s | Localized color patch through the complete workspace UI |
| DeepSeek: screenshot + captured memory state | low | 2.6 s | Localized color patch; game scripts unchanged |
| DeepSeek: Fix with AI for an injected runtime throw | low | 1.6 s | Removed the throw; error cleared and completed-round state survived |

All six completed in one provider attempt, without automatic repair. No Gemini
provider calls were made. The request validator also rejected a mislabeled image
before generation; the CLI now detects the file's actual PNG/JPEG format.

Browser checks covered the new Starter's repeatable layout, keyboard movement,
timer, restart, preview refresh, state transfer on the first manual edit, and
corrected runtime source lines. At 390×844, the workspace report flow and draft
survived panel switching; the new Finnish feedback strings rendered correctly.
With the local backend stopped, a submitted request failed without losing its
draft, screenshot or preview report, and the previous game stayed on screen.
The memory game recovered from an exported pending mismatch without getting stuck.
These checks do not establish touch-device, cross-browser or audible sound quality.

One Luna image response used Korean for its short chat message despite an English
request; the code edit itself was correct. The final request wording now explicitly
anchors response language to the user's request. This is a prompting improvement,
not a guaranteed language validator. DeepSeek used 7,924 reasoning tokens for its
creation trial versus Luna's 1,379 on a different game; these are **not** comparable
benchmark tasks. Keep effort configurable and run repeated matched cases before
changing production defaults.

The smoke trials motivated two host fixes: preserve progress when a Starter first
becomes a Saved Artifact, and ignore startup saves while restoration is pending.
Generated code can still mishandle state semantics, duplicate work or ignore a
recipe. For example, the memory game's restore intentionally clears all unmatched
open cards. Static syntax checks cannot establish gameplay correctness.

Next evaluations should cover held touch controls on real devices, repeated
state-preserving edits, model response language, and a matched set of website and
game tasks. Asset search/generation and autonomous browser-repair loops remain
deferred until their latency and success-rate benefit is demonstrated.

API references checked for this release: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna),
[DeepSeek model/pricing](https://api-docs.deepseek.com/quick_start/pricing/) and
[DeepSeek vision inputs](https://api-docs.deepseek.com/guides/vision/).
