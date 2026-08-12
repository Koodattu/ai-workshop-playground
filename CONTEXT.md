# AI Workshop Playground

AI Workshop Playground lets participants create and evolve browser artifacts during a facilitated workshop while access and usage remain controlled.

## Language

**Artifact**:
A self-contained browser experience, such as a website or game, that a participant can create, change, and preview in the workspace.
_Avoid_: Project, code document

**Artifact Generation Run**:
A single attempt to answer a participant request or change their artifact. It begins after workshop access is granted and ends with either a completed outcome or a failure.
_Avoid_: Generation request, AI request

**Artifact Generation View**:
A cumulative, provisional picture of an Artifact Generation Run that may be superseded while the run continues. It is not the durable result of the run.
_Avoid_: Stream event, chunk

**Artifact Generation Outcome**:
The single terminal result of an Artifact Generation Run: completed, failed, or cancelled. A completed artifact outcome identifies the durable artifact version created by the run.
_Avoid_: Done event, final callback

**Artifact Version**:
A durable snapshot created by a completed Artifact Generation Run. Manual workspace edits do not become an Artifact Version until a later run completes successfully.
_Avoid_: Code version, autosave

**Artifact Version Lineage**:
The participant-owned history formed by an Artifact Version and the descendant versions created from it.
_Avoid_: Version list, client-side version tree

**Model Option**:
A workshop-configured generation choice that a participant may request for an Artifact Generation Run. The requested option may differ from the option ultimately selected under current workshop settings.
_Avoid_: Model preference, provider model

**Participant Model Key**:
A participant-supplied credential that authorizes use of a model provider for their Artifact Generation Runs. It is ephemeral, request-scoped, and never retained by the workshop backend.
_Avoid_: Stored API key, workshop key

**Starter**:
A curated Artifact provided as a beginning for participant work. It is not participant-owned and is not changed in place.
_Avoid_: Built-in template, default project

**Saved Artifact**:
A participant-owned Artifact retained for continued work across workspace visits.
_Avoid_: Custom template, local template

**Shared Artifact**:
An Artifact made available through a share reference and opened as a starting point for participant work. It is not changed in place by the recipient.
_Avoid_: Shared template

**Artifact Library**:
The participant-visible collection of Starters, Saved Artifacts, and Shared Artifacts available to open in the workspace.
_Avoid_: Template list, template catalog

**Workspace Artifact**:
The active working copy of an Artifact currently open for editing and preview. It may originate from a Starter, Saved Artifact, or Shared Artifact; mutating an immutable source creates a Saved Artifact.
_Avoid_: Current template, editor code

**Workshop Access Grant**:
Verified permission for one participant to use protected workshop capabilities under the applicable access and usage rules.
_Avoid_: Auth context, session token

**Workshop Quota**:
The number of Artifact Generation Runs a participant may start under password-based workshop access. One unit is consumed atomically before each run begins.
_Avoid_: Rate limit, use count
