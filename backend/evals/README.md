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
