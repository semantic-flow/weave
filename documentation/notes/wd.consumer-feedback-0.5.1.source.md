---
id: wdconsumerfeedback051src
title: Consumer Feedback 0.5.1 Source Review
desc: Verbatim Stagecraft consumer review received 2026-07-28
updated: 1785297588142
created: 1785297588142
---

> Archived verbatim as received (source input for [[wd.consumer-feedback-0.5.1]]); claims are assessed and corrected in that note, not here.

# Consumer review of `@semantic-flow/weave` / `weave-lib` — input for 0.5.1

**From:** the Stagecraft platform team, as a downstream consumer.
**Basis:** `@semantic-flow/weave@0.3.0` in production use, `0.4.0` and `weave-lib@0.5.0` inspected from the registry, and `documentation/notes/wu.api-reference.md` at `main`.

Everything below is either measured or quoted. Where we could not verify something we say so rather than implying it. Several of these cost us real time on 2026-07-28 and we have said which.

---

## 0. How we actually consume weave, so you can weight the rest

- **One CLI call, in CI and locally:** `weave validate mesh --mesh-root <path>` (our `weave:validate` script).
- **One release-gate assertion:** our release stager runs `node_modules/.bin/weave --version` and **refuses unless the output string equals exactly `weave 0.3.0`**.
- **Zero programmatic use today.** We shell out; nothing imports a weave library.
- We pin `"@semantic-flow/weave": "0.3.0"` and treat it as an `executable` root dependency that gets staged into releases.

So we are a *validation* consumer and a *packaging* consumer, not (yet) a versioning consumer. That shapes which gaps below matter to us.

---

## 1. What is good, specifically — this is not padding, it is the baseline we are asking you to extend

- **`WeaveApiError` carrying `code` and `stage` as separate readonly fields is the right design.** Ten codes (`invalid-request`, `unsupported-content`, `unknown-target`, `not-a-payload`, `malformed-mesh`, `inconsistent-policy`, `unsupported-source`, `snapshot-conflict`, `plan-conflict`, `io-failure`) and four stages (`admit`/`load`/`plan`/`write`) let a caller branch on failure **without string-matching a message**. Message-matching is the thing that always rots; you have pre-empted it.
- **Explicit no-op idempotency** — *"a fully no-op request has empty `createdPaths` and `updatedPaths`, which makes blind retries safe"* — is stated as a contract rather than left to be inferred.
- **The concurrency section is honest in a way most libraries are not:** *"The caller owns single-writer serialization per mesh. There is no lock, journal, rollback, or filesystem transaction."* Saying this plainly is worth more than a vague reassurance. See §3 for the consequence.
- **Absolute `meshRoot` with "no current-directory default"** kills an entire defect class before it starts.
- **Write failures disclose `completedPaths` / `completedCreatedPaths` / `completedUpdatedPaths` / `possiblyTouchedPaths`.** Most libraries throw and leave you guessing.

---

## 2. HIGHEST VALUE, AND CHEAPEST: expose the `plan` stage. You have already built it.

**The observation.** `versionPayloads` mutates. It updates working files and writes history snapshots. There is **no documented dry-run, preview, plan, or inspect mode**. A caller's only way to find out what will happen is to make it happen.

**Why this is the top item and not a nice-to-have:** *your own error taxonomy already models planning as a distinct phase.* `stage` is `"admit" | "load" | "plan" | "write"`, and there is a dedicated `plan-conflict` code. **The phase exists; it is simply not reachable.** You are one option away from exposing something you already compute.

**The ask:**

```ts
versionPayloads({ ..., dryRun: true })
```

returning the same `VersionPayloadsResult` shape — `meshBase`, `outcomes` (with `status: "applied" | "alreadyCurrent"` reported as *would-be*), `createdPaths`, `updatedPaths` — **having stopped at the end of `plan` and written nothing.**

**Why it matters to a consumer like us.** We can only use a mutating-only API inside a work lane. With a plan mode we can use it **in a gate** — "does this change what we think it changes?" — which is where we would get the most value. Right now the answer to *"what would this do?"* is *"run it and look at the diff,"* and that is not available in a check that must not mutate.

**Secondary benefit you may care about more than we do:** `dryRun` makes `plan-conflict` diagnosable *before* a partial write instead of after one.

---

## 3. `"The caller owns single-writer serialization per mesh"` — please give callers a way to actually own it

**The observation.** The contract is stated clearly and we are not disputing it. But it is a precondition the library provides no means to satisfy: no lock, no advisory lockfile, no `meshLockPath`, no "is this mesh currently being written" query.

**Why it bites us specifically.** Our meshes live in a repository tree that **four autonomous desks and detached build seats write concurrently**. "Single-writer per mesh" is not a discipline we can assert; it is something we have to *build* — and we are currently building a lease/claim substrate partly for this reason. Every consumer with more than one writer will build the same thing, differently, and each one will be subtly wrong.

**The ask, in ascending order of effort — any one of these helps:**
1. **Document the recommended locking pattern.** Even "take an exclusive `flock` on `<meshRoot>/.weave.lock` for the duration" as *guidance* would mean consumers converge instead of each inventing one.
2. **Accept an optional `lockPath`** and take the lock yourself for the duration of the call.
3. **Expose `isMeshBusy(meshRoot)` / a lock-holder query**, so a caller can fail fast with a useful message instead of corrupting.

We would take (1) tomorrow and be satisfied. It costs a paragraph.

---

## 4. `plan-conflict` names a remedy the API does not provide

**Quoted:** *"a retry after partial support-artifact writes can refuse with `plan-conflict` until repaired."*

**The gap: there is no documented `repair` operation.** The failure mode has a name, a code, and a stated exit condition — *"until repaired"* — and no documented way to reach that condition. Combined with §3's *"no rollback, no filesystem transaction"* and the `possiblyTouchedPaths` field (which is explicitly an *uncertainty* set — the library knows it may have touched things but not that it did), a consumer who hits this is left to reconcile a partially-written mesh by hand, with an ambiguous list of suspects.

**The ask:** either a `repairMesh(meshRoot)` / `reconcile` entry point, **or** — much cheaper and probably sufficient — **a documented manual repair procedure** that says what "repaired" means and how to verify you have got there. Right now `plan-conflict` is the only error whose recovery path is undefined.

---

## 5. Releases are not verifiable from the artifact. This cost us hours today.

**What we hit, exactly.** You ruled a behaviour change on 2026-07-21 (raw-source inline limit 1 MiB → 4 MiB, commit `23f50af`). We needed to answer one question: **is that fix in the `0.4.0` we would consume?** We could not answer it.

- **`git describe` on the source shows `v0.3.0-16-g37f4b8f` — there is no `v0.4.0` tag**, so we could not identify the release by commit.
- **The published npm package cannot be inspected.** `@semantic-flow/weave@0.4.0` ships **four files** — `README.md`, `LICENSE`, `package.json`, and `bin/weave.js` at **1,709 bytes**, which is a `spawnSync` launcher. The product is in `optionalDependencies` platform binaries (`weave-{linux-x64,windows-x64,macos-x64,macos-arm64}`). A source-level grep of the package returns zero for *everything*, which is indistinguishable from "the fix is absent."
- We ultimately fell back on **publish-timing correlation** — the local tip is `2026-07-21 23:51 UTC`, `0.4.0` published `2026-07-22 06:02 UTC`, so the release post-dates the fix — which is *suggestive and not proof*. It does not exclude a publish from a different branch.

**The asks, cheapest first:**
1. **Tag releases in git.** `v0.4.0`, `v0.5.0`. This alone would have closed our question in one command.
2. **Embed the commit SHA in the build and expose it.** `weave --version --json` emitting `{ "version": "0.5.1", "commit": "<sha>", "built": "<iso8601>" }`. A binary that can state its own provenance is verifiable; one that cannot is taken on trust.
3. **A changelog that names *behavioural* changes**, not just fixes. "Raw-source inline limit raised 1 MiB → 4 MiB" is exactly the line that would have told us we needed to move, and its absence is part of why a ruled behaviour sat undelivered downstream for seven days.

**Framing, so this reads as it is meant:** none of this is a defect in weave. It is that **a native-binary distribution makes a consumer's normal verification tools useless**, so the burden of provenance moves onto the publisher. (2) is the one that generalises.

---

## 6. Machine-readable `--version`

We assert `weave --version` output **by string equality** in a release gate — `if (version !== 'weave 0.3.0') refuse(...)`. That is deliberate on our side: a release rehearsal should certify an exact executable. But it means **a human-formatted string is load-bearing in someone's CI**, and any cosmetic change to it breaks us.

**The ask:** `--version --json` (see §5.2). We would move our assertion onto the structured field immediately and stop depending on your prose.

---

## 7. Version-line relationship between `weave` and `weave-lib`

`weave-lib` is at **0.5.0**; the `weave` CLI's latest published is **0.4.0**. Independent version lines are a legitimate choice, but **consumers will assume they track** — we did, briefly, and had to check.

**The ask:** one line in both READMEs stating the relationship. If they are independent, say so. If `weave-lib@X` requires `weave@Y`, state the constraint — ideally as a `peerDependency` so it is enforced rather than documented.

---

## 8. The gap that decides whether we can adopt `weave-lib` at all

**`weave-lib`'s surface is `versionPayloads` + `WeaveApiError`. There is no validation export.**

**Our only use of weave is `weave validate mesh`.** So today the library cannot replace the CLI for us — not because it is deficient at what it does, but because it does a different thing. We would adopt a programmatic `validateMesh(meshRoot, options)` returning structured diagnostics **the day it shipped**, because our current integration is: shell out, parse nothing, and trust an exit code.

**Concretely, what we would want from it:** structured findings (path, severity, code, message) rather than formatted text — so that a validation failure can be *routed* rather than *read*. This is the same argument as `WeaveApiError`'s `code`/`stage`, applied to validation output.

---

## Priority, if you only take some

| | Item | Cost to you | Value to us |
|---|---|---|---|
| 1 | **`dryRun` / plan mode** (§2) — the phase already exists | Low | Very high — moves us from lane-only to gate-usable |
| 2 | **Tag releases + `--version --json` with commit** (§5, §6) | Low | High — makes releases verifiable at all |
| 3 | **`validateMesh` export** (§8) | Medium | High — decides whether we adopt the lib |
| 4 | **Document the locking pattern** (§3) | Very low | Medium-high — stops every consumer inventing one |
| 5 | **Define "repaired" for `plan-conflict`** (§4) | Low | Medium — closes the one undefined recovery path |
| 6 | **Behavioural changelog** (§5.3) | Low | Medium |
| 7 | **State the `weave`/`weave-lib` version relationship** (§7) | Trivial | Low-medium |

---

## What we have NOT verified, stated so you can discount appropriately

- We have **not** run `weave-lib` — this review is of its documented contract and package metadata, not its behaviour.
- We have **not** confirmed whether `0.4.0` actually contains commit `23f50af`. Our timing argument is correlation. The check that would settle it is behavioural — run `0.4.0` against a raw source between 1 MiB and 4 MiB and observe whether it inlines — and we have not run it.
- Our reading of the API is from `wu.api-reference.md` at `main`, which may be ahead of or behind `0.5.0`.
- We are one consumer with an unusual topology (many concurrent writers, heavy gating). Weight §3 accordingly.
