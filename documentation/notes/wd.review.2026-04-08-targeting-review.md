---
id: to6kpa4g183qo0c5vob4qrv
title: 2026 04 08 Targeting Review
desc: ''
updated: 1775682073513
created: 1775680710976
---


## Coderabbit 1

Verify each finding against the current code and only fix it if needed.

Inline comments:
In `@documentation/notes/wd.general-guidance.md`:
- [x] Line 5: Revert the manual change to the Dendron frontmatter by removing the
updated: 1775613039084 entry and any other hand-edited timestamps; ensure the
note's metadata relies on Dendron to manage the updated field (do not hard-code
'updated' in documentation/notes/wd.general-guidance.md) so future saves won't
churn the file.

In `@src/runtime/weave/weave.ts`:
- [x] Around line 408-426: The code seeds remainingDesignatorPaths from
initialWeaveableKnops which silently drops requested designators that are not
currently weaveable; change the guard to validate that every
requestedDesignatorPath is present in the initialWeaveableKnops result and throw
a WeaveInputError if any are missing before entering the overlay loop (use
loadWeaveableKnopCandidates, initialWeaveableKnops, remainingDesignatorPaths and
the existing WeaveInputError path), and add a regression test that submits a
mixed batch (e.g. [already-woven, pending]) to assert the call fails rather than
partially succeeding.

---

Outside diff comments:
In `@documentation/notes/wd.general-guidance.md`:
- [x] Around line 49-53: Update the paragraph in
documentation/notes/wd.general-guidance.md to align with the repository rule by
removing the recommendation to rename wd.task.* notes to wd.completed.* by
default and instead state that wd.task.* notes must not be renamed to
wd.completed.* unless the user explicitly asks; also correct the typo
"deferrment" to "deferment" and ensure the file-name examples and the phrase
"`documentation/notes/wd.task.*.md`: Do not rename wd.task.* notes to
wd.completed.* unless the user explicitly asks you to." are present to make the
policy unambiguous.

---

Nitpick comments:
In `@tests/e2e/weave_cli_test.ts`:
- [x] Around line 48-86: Add two black-box tests alongside the existing "weave
accepts payload history/state naming flags as a black-box CLI run": one that
runs the same Deno.Command invocation with the payload flags
(--payload-history-segment / --payload-state-segment) but omits any --target and
asserts the command fails (output.success is false) and stderr contains the CLI
error about requiring exactly one --target; and another that supplies multiple
--target arguments (e.g., two "designatorPath=..." entries) with the payload
flags and similarly asserts failure and that stderr reports the cardinality
guard. Reuse the same workspace setup helpers (createTestTmpDir,
materializeMeshAliceBioBranch) and the same output decoding logic to check
success/failure and error text so the tests pin the CLI boundary behavior for
zero-target and multi-target cases.

## Coderabbit 2

Verify each finding against the current code and only fix it if needed.

Duplicate comments:
In `@src/runtime/weave/weave.ts`:
- [c] Around line 430-448: initialWeaveableKnops is used to build
remainingDesignatorPaths which silently drops requestedDesignatorPaths that
resolved but aren't weaveable; change the logic after
loadWeaveableKnopCandidates to detect when requestedDesignatorPaths (or targets)
were provided and at least one requested designator did not appear in
initialWeaveableKnops, and in that case throw a WeaveInputError instead of
continuing. Concretely, compute the set of designatorPath values from
initialWeaveableKnops and compare it to requestedDesignatorPaths (or targets);
if any requested items are missing, throw WeaveInputError with a clear message
listing the missing designators (use the existing WeaveInputError and the
symbols initialWeaveableKnops, remainingDesignatorPaths,
requestedDesignatorPaths/targets to locate where to implement this check).

---

Nitpick comments:
In `@tests/e2e/weave_cli_test.ts`:
- [c] Around line 137-157: Replace the duplicated Deno.Command construction and
output invocation with the existing helper runCliCommand; specifically, remove
the new Deno.Command(...) block and the subsequent await command.output() and
call runCliCommand with the same CLI args (e.g.
["run","--allow-read","--allow-write","--allow-env","src/main.ts","--target","designatorPath=alice/bio","--payload-history-segment","releases","--payload-state-segment","v0.0.1","--workspace",
workspaceRoot]) and the same cwd (new URL(".", repoRoot)) so tests use
runCliCommand(...) consistently; update the other duplicated blocks mentioned
(around the other test ranges) in the same way and ensure any expected
stdout/stderr assertions still reference the returned output from runCliCommand.

## Coderabbit 3

Verify each finding against the current code and only fix it if needed.

Inline comments:
In `@src/core/designator_segments.ts`:
- [x] Around line 104-106: The helper isDirectChildMeshPath currently treats "" as a
direct child of "", so update its root-branch logic to reject empty childPath:
when parentPath.length === 0 return childPath.length > 0 &&
!childPath.includes("/"); this ensures the root only accepts single-segment
non-empty children and prevents "" being considered a direct child of "".

In `@src/core/integrate/integrate.ts`:
- [c] Around line 155-160: The call to normalizeSafeDesignatorPath currently passes
{ allowRoot: true } which accepts the internal root designator but the rest of
this module (e.g. fromKnopPath and code that constructs existingDesignatorPath +
"/index.html") assumes a non-empty designator; either reject root here or
explicitly handle root downstream. Fix by removing or setting allowRoot: false
in the normalizeSafeDesignatorPath call in integrate.ts (so IntegrateInputError
is thrown for root), or if you prefer to accept root, add explicit guards where
fromKnopPath("_knop") may return undefined and where templates build
`${existingDesignatorPath}/index.html` to avoid producing "/index.html". Ensure
the chosen approach updates normalizeSafeDesignatorPath usage and the
existingDesignatorPath construction to handle the root case consistently.

In `@src/core/weave/weave.ts`:
- [x] Around line 1421-1426: The extracted-weave prefix-check incorrectly fails when
payloadArtifact.designatorPath is empty because it tests
latestHistoricalStatePath.startsWith("/") which won't match mesh-relative paths;
update the conditional that checks payloadArtifact.latestHistoricalStatePath and
payloadArtifact.designatorPath so it treats an empty designatorPath as a special
case (e.g., skip the leading-slash prefix requirement or compute the prefix as
`${payloadArtifact.designatorPath}${payloadArtifact.designatorPath ? '/' : ''}`)
and ensure the equality check payloadArtifact.latestHistoricalStatePath ===
payloadArtifact.designatorPath still behaves correctly; modify the if
surrounding those variables in the extracted-weave validation to accept
mesh-relative paths when designatorPath === "".

In `@src/runtime/weave/pages.ts`:
- [x] Around line 79-81: The pinned-link branch still uses escapedTargetHref as the
anchor text so pinned root targets render as relative paths; change the
pinned-link branch to use escapedTargetPath (the value produced by
formatDesignatorPathForDisplay and escapeHtml) as the anchor text instead of
escapedTargetHref so root targets display as “/” consistent with the unpinned
case, and keep escapedTargetHref only for the href attribute as intended.

---

Outside diff comments:
In `@src/core/extract/extract.ts`:
- [x] Around line 182-187: assertCurrentMeshInventoryShapeForExtract currently
assumes rootKnopPath and sourceKnopPath are distinct and enforces exactly two
_mesh knop entries, which breaks when normalizeSafeDesignatorPath returns "" for
top-level sources; update assertCurrentMeshInventoryShapeForExtract to compute
the set of expected knop ids (including rootKnopPath and sourceKnopPath),
deduplicate that set (e.g., via a Set or unique filter) and then validate the
inventory against the deduplicated expected knop set before enforcing the count
and raising errors so single-top-level cases pass correctly.

In `@src/runtime/weave/weave.ts`:
- [x] Around line 374-387: toSharedTargetRequest currently strips fields from
request.targets which can hide malformed target shapes and let a TypeError occur
later; update toSharedTargetRequest to first validate each raw WeaveRequest
target (presence and type of designatorPath, optional boolean recursive, and any
other expected properties) and either throw a WeaveInputError for invalid
entries or normalize them safely before mapping, so
executeValidate/executeGenerate see the same vetted/normalized target shape as
executeVersion when called via executeWeave; reference functions/types:
toSharedTargetRequest, executeWeave, executeValidate, executeGenerate,
executeVersion, WeaveRequest, ValidateRequest.

---

Duplicate comments:
In `@src/runtime/weave/weave.ts`:
- [c] Around line 434-452: The code seeds remainingDesignatorPaths from
initialWeaveableKnops which allows partial-success by silently dropping
non-weaveable requests; before proceeding after loadWeaveableKnopCandidates
(function loadWeaveableKnopCandidates) compare requestedDesignatorPaths against
the designatorPath values in initialWeaveableKnops and if any requested path is
missing throw a WeaveInputError (use the same messaging style as existing
throw), otherwise proceed and set remainingDesignatorPaths from
initialWeaveableKnops as currently implemented.

---

Nitpick comments:
In `@src/core/knop/add_reference.ts`:
- [c] Around line 107-108: Replace the manual concatenation that builds the
reference catalog path with the shared helper toReferenceCatalogPath for
consistency: instead of computing knopPath = toKnopPath(designatorPath) then
referenceCatalogPath = `${knopPath}/_references`, call
toReferenceCatalogPath(designatorPath) wherever referenceCatalogPath is created
(the current referenceCatalogPath variable and the usage at the other location
that already uses toReferenceCatalogPath) so all code uses the single helper;
update variable names if needed to avoid shadowing with knopPath.

In `@src/runtime/weave/weave.ts`:
- [c] Around line 459-467: The loop repeatedly calls loadMeshState and
loadWeaveableKnopCandidates for each iteration (inside the while over
remainingDesignatorPaths), causing quadratic work; change weave.ts to compute
stagedMeshState = await loadMeshState(...) and stagedWeaveableKnops = await
loadWeaveableKnopCandidates(...) once before the while, then inside the loop
reuse those cached values and only filter or re-evaluate the subset of
candidates affected by nextPlan instead of reloading everything; alternatively,
if some candidates must be recomputed, limit calls to
loadWeaveableKnopCandidates to the specific designator paths returned by
nextPlan (use unique symbols remainingDesignatorPaths, stagedMeshState,
stagedWeaveableKnops, and nextPlan to locate and update the logic).

In `@tests/integration/validate_version_generate_test.ts`:
- [c] Around line 404-466: Extract the three fixture helper functions
addSupplementalKnopToMeshInventory,
addSupplementalPayloadArtifactToMeshInventory, and writeSupplementalKnopSurface
into a new shared test helper module under tests/support (e.g., export them from
a single file) and update both
tests/integration/validate_version_generate_test.ts and
tests/integration/weave_test.ts to import and use these exported helpers; ensure
writeSupplementalKnopSurface’s directory setup includes the same _references
creation (or make that optional via a parameter) so both callers get identical
fixture layout, and remove the duplicated function definitions from the two test
files.

## Entelligence 1


Not safe to merge — this PR introduces multiple compounding runtime crashes across its core execution path. planFirstKnopWeave is called with 4 arguments but only accepts 3, making this a TypeScript compile error that blocks the entire weave operation; replaceSubjectBlock throws WeaveInputError on first-knop weaves because no subject block yet exists (confirmed by two independent reviews); and requirePayloadCurrentStatePathFromInventory throws instead of returning undefined in detectPendingWeaveSlice, silently breaking the candidate-skipping logic that loadWeaveableKnopCandidates depends on. The PR's goals — root designator support, repeatable --target CLI, shared path utilities — are architecturally sound, but these defects mean the happy path cannot complete successfully for first-knop weaves or knops lacking historical state.

Key Findings:

- [c] planFirstKnopWeave in weave.ts is a compile-breaking arity mismatch: target is passed as a 4th argument to a function declared with only 3 parameters, meaning this code cannot compile or execute as written.
- [c] replaceSubjectBlock throws WeaveInputError when the subject block for knopPath is absent — exactly the condition that holds for every first-knop weave — so the entire first-knop weave path will throw unconditionally instead of inserting the new block; this bug is flagged in both the current and previous unresolved reviews.
- [x] normalizeCliDesignatorPath in designator_segments.ts bypasses all safety checks from normalizeSafeDesignatorPath for non-root, non-empty inputs, meaning path traversal strings like ../../../etc/passwd or segments containing ?/# are passed through unchecked to path builders and inventory lookups.
- [c] The target: undefined ambiguity in resolveTargetSelections causes matched candidates with no specific version spec to be silently dropped from filtered because Map.get() returning undefined is indistinguishable from a missing key — this is an unresolved comment from a previous review that has not been addressed.
