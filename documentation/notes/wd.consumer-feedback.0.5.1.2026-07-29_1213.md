---
id: wdconsumerfeedback0729src
title: Consumer Feedback 0.5.1 Source Review 2026-07-29
desc: Verbatim Stagecraft consumer follow-up received 2026-07-29
updated: 1785352796403
created: 1785352796403
---

> Archived verbatim as received (source input for the 2026-07-29 follow-up round). Claims are assessed and dispositioned in the task notes, not here: §1 (packaging/consumption model) and §2 (`hasResourcePage` — dispositioned as reply-only, owned by the landed extract lifecycle + the wd.todo extracted-term-weave scale item) in `wa.task.2026.2026-07-29_1219-programmatic-validate-mesh-api`; §3 (validate memory ceiling) in `wa.task.2026.2026-07-29_1220-whole-mesh-validate-bounded-memory`. Both task notes carry a folded Codex r1 review (2026-07-29). The prior round is [[wd.consumer-feedback.0.5.1]] / [[wd.consumer-feedback.0.5.1.2026-07-28_0849]].

# To the Semantic Flow / Weave maintainers — two open questions from the Stagecraft mesh

We consume `@semantic-flow/weave` as a CLI (currently pinned `0.3.0`) over RDF meshes generated from a D&D 5.2.1 SRD corpus and a set of campaign/test fixture meshes. We're preparing to move to `0.5.1`. Two things we'd like your read on before we do, plus one packaging question.

---

## 1. Packaging — what is the intended consumption model for `weave` vs `weave-lib`?

The registry currently has two packages at `0.5.1`:

- **`@semantic-flow/weave`** — *"Semantic Flow Weave CLI"*, `bin: { weave: bin/weave.js }`, version history `0.1.0 … 0.3.0, 0.4.0, 0.5.1`
- **`@semantic-flow/weave-lib`** — *"Programmatic library surface … batch payload versioning via versionPayloads"*, `main: ./script/api/mod.js`, versions **`0.5.0`, `0.5.1` only**

We invoke the CLI (`weave validate mesh --mesh-root …`) from a package script and don't currently use the programmatic API.

**Questions:**
- Is `weave-lib` intended to *replace* CLI consumption for programmatic callers, or to sit alongside it?
- Should CLI consumers stay on `@semantic-flow/weave`, or is the CLI expected to become a thin wrapper over `weave-lib`?
- Are the two versioned in lockstep going forward? (`weave-lib` starting at `0.5.0` suggests a split partway through.)

---

## 2. `sflo:hasResourcePage` on extracted-term Knops

**What we observed** (first big publication run, 2026-07-21, on `weave 0.3.0`): Knops produced by term extraction did not carry `sflo:hasResourcePage` claims.

**What we do about it:** our publication step synthesises them deterministically — for each term we emit

```turtle
<term> sflo:hasResourcePage <pagePath> .
<pagePath> a sflo:ResourcePage, sflo:LocatedFile .
```

That workaround is still in our tree today.

**Questions:**
- Is emitting `hasResourcePage` for extracted terms something Weave intends to do itself, or is downstream synthesis the expected pattern?
- If Weave should emit it, is that addressed in `0.4.0`/`0.5.1`? We'd like to drop the workaround rather than carry it indefinitely — it's the kind of local patch that quietly becomes load-bearing.

---

## 3. `weave validate` memory ceiling — **and we want to be upfront that we can no longer reproduce this**

**What we observed** (same 2026-07-21 run, `0.3.0`): an untargeted `weave validate` over a mesh of roughly **6,900 files** exhausted a fixed **4 GiB** heap and did not complete. The practical consequence for us was that **no whole-mesh validation green has ever existed** on this project — we've only ever validated targeted subsets.

**Why we're flagging our own uncertainty:** that mesh no longer exists in our tree. We dropped its generated output as part of unrelated cleanup, and the largest mesh we can validate today is **442 tracked files / 19 `_knop` directories**. On that one, `0.5.1` behaves fine and is indistinguishable from `0.3.0`:

| | rc | wall | peak RSS |
|---|---|---|---|
| `0.3.0` | 0 | 0.90 s | 193 MB |
| `0.5.1` | 0 | 0.90 s | 185 MB |

So **we cannot currently demonstrate the failure**, and we're not asking you to chase a ghost.

**Questions:**
- Is there a known memory ceiling or a fixed heap allocation in `validate`, and did anything change in `0.4.0`/`0.5.1`?
- Is whole-mesh validation expected to scale to the ~10⁴-file range, or is targeted validation the intended pattern at that size?
- If it would help, we can reconstruct a mesh of comparable size and give you a reproducible case — say the word and we'll build one rather than leave this as an anecdote.

---

## Context that may be useful

- We're mid-way through migrating our RDF vocabulary from a set of v1 modules to a seven-vocabulary family, so our meshes are in flux; some of the above may look different next time you see it.
- We are deliberately **not** running `weave publish` until we're ready to publish publicly (weeks to months out), so anything we test is `validate`/read-only for now.
- Happy to file these as issues if you'd prefer them tracked separately — tell us which repo and we'll split them up.
