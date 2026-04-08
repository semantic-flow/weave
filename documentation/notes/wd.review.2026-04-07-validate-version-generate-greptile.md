---
id: h33linvl7oeqesm2w65m2xg
title: 2026 04 07 Validate Version Generate Greptile
desc: ''
updated: 1775628892983
created: 1775628783322
---

- [ ] `P2 Return type annotation says ValidateRequest but the value is also used as GenerateRequest`

Worth implementing: probably not now.

Evaluation: `toSharedTargetRequest(...)` is a small local helper and the current code is already type-safe because `ValidateRequest` and `GenerateRequest` are intentionally structurally identical. A shared alias like `SharedTargetRequest` would make the intent a little clearer, but it does not change behavior and does not buy much unless those request types start to diverge or more helpers begin sharing the same contract.

Greptile note: `toSharedTargetRequest` is called for both `executeValidate` and `executeGenerate`. Both request types currently have the same shape (`targets?: readonly TargetSpec[]`), so TypeScript accepts the value in both positions even though the return type annotation names only `ValidateRequest`.

---

- [x] `Generic error message shadows the more specific per-field error`

Worth implementing: yes.

Evaluation: this was worth doing. The parser already knows which field key is missing a value, so returning the specific `${fieldName}.${key} is required` message is better than falling back to the generic `key=value` format error. Implemented in the CLI parser with e2e coverage.

Greptile note: when a target segment ends with the separator character, the early `key=value` guard fires before the later empty-value check, so the more specific per-field error never surfaces.

---

- [ ] `P2 recursive=false is silently normalised away`

Worth implementing: yes, but as clarification rather than a behavior change.

Evaluation: Greptile is right that `recursive=false` is currently accepted and then normalized to the same result as omitting `recursive` entirely. That is not a correctness bug because downstream resolution already treats `false` and `undefined` identically. The worthwhile follow-up is to document that normalization in the CLI help or error model, not to add a separate runtime meaning for `false`.

Greptile note: the parser currently accepts `recursive=false`, but returns `{ designatorPath }` instead of preserving `recursive: false`, which can surprise users even though the effective behavior is unchanged.

---
