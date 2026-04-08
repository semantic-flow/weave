---
id: y7bg8zome0i2bwb8scf1gcn
title: 2026 04 07 Validate Version Generate Coderabbit
desc: ''
updated: 1775608853131
created: 1775608817083
---

Verify each finding against the current code and only fix it if needed.

Outside diff comments:
[c] In `@tests/integration/weave_test.ts`:
Around line 352-361: The test currently asserts that `executeWeave` throws `WeaveInputError` for the missing source payload history but the runtime actually throws `WeaveRuntimeError`; update the assertion in the `assertRejects` call that wraps `executeWeave` (the test around `executeWeave({...})` and the error class argument) to expect `WeaveRuntimeError` instead of `WeaveInputError` so the test matches the runtime behavior.
Reason: stale against the current code. `executeWeave(...)` now routes that failure through `executeValidate(...)`, which returns a finding, and `executeWeave(...)` then rethrows the first finding as `WeaveInputError`.

---

Nitpick comments:


[c] In `@src/core/weave/weave.ts`:
Around line 283-310: The guard at the end of `filterWeaveableKnops` is redundant because `resolveTargetSelections` (called with `weaveableKnops.map(...)` and throwing `WeaveInputError` on no matches) already guarantees there will be matches, so remove the post-filter emptiness check and the throw that references `WeaveInputError`; simply return the filtered array from `filterWeaveableKnops`. Keep `resolveTargetSelections`, the requested `Set` creation, and the `weaveableKnops.filter` logic unchanged.
Reason: technically true, but not worth churn. The guard is harmless defensive code and removing it buys almost nothing.

[c] In `@src/runtime/weave/weave.ts`:
Around line 66-75: The `ValidateFinding` interface currently pins severity to the single literal `"error"`; update `ValidateFinding.severity` to a wider union (e.g. `"error" | "warning" | "info"`) or a named string literal type to allow future extensions, then ensure any code that constructs or switches on `ValidateFinding.severity` (search for uses of `ValidateFinding` and `ValidateResult`) is updated to handle the new variants or has a default/fallback branch.
Reason: speculative extensibility. The current first-pass contract only emits errors, so widening the type now weakens a useful invariant without buying actual behavior.

[x] In `@src/runtime/weave/weave.ts`:
Around line 383-414: `prepareVersionExecution` currently re-normalizes targets by calling `normalizeVersionRequest(request)`; change its signature to accept `NormalizedVersionTargetSpec[]` (e.g., replace `VersionRequest` param with `targets: NormalizedVersionTargetSpec[]`) and remove the `normalizeVersionRequest` call and any dependent variables; update the body to use the provided normalized targets when calling `loadWeaveableKnopCandidates` and `planVersion` (or construct a minimal request object if `planVersion` still needs other fields), and update all callers (`executeValidate`, `executeVersion`) to pass the already-normalized targets instead of a raw `VersionRequest`. Ensure type names referenced: `prepareVersionExecution`, `normalizeVersionRequest`, `VersionRequest`, `NormalizedVersionTargetSpec[]`, `executeValidate`, `executeVersion`, `loadWeaveableKnopCandidates`, `planVersion`.
Reason: worthwhile cleanup. The duplicate normalization is real and this would make the seam cleaner without broadening the contract.
