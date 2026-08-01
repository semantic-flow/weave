---
id: wdconsumerfeedback051reply
title: Consumer Feedback 0.5.1 Reply
desc: 'Draft reply to Stagecraft covering both feedback rounds (2026-07-28 and 2026-07-29); send after v0.6.0 publishes'
updated: 1785527000000
created: 1785527000000
---

> Draft for the maintainer to send (paste below this line). Covers [[wd.consumer-feedback.0.5.1.2026-07-28_0849]] and [[wd.consumer-feedback.0.5.1.2026-07-29_1213]]. Verify v0.6.0 is live on npm before sending.

---

# To the Stagecraft platform team — replies to your 2026-07-28 and 2026-07-29 reviews

Thanks for both rounds — they were unusually well-evidenced, and several items below shipped because of them. Short version: **skip `0.5.1` and pin `0.6.0`.** It contains everything from both replies, including a fix for the exact memory failure you reported and then couldn't reproduce. You weren't chasing a ghost; we reproduced it, found the mechanism, and killed it.

## Your 2026-07-29 questions

**1. Packaging — `weave` vs `weave-lib`.** Alongside, not replacement: `weave-lib` is the programmatic surface; the CLI remains a first-class supported consumption path indefinitely, and it is not becoming a wrapper over the lib. Both packages are built from the same commit and released together — one version line (`weave-lib@X` matches `weave@X`). The `weave-lib@0.5.0`-only history you noticed was a one-time first-publish artifact, now deprecated on the registry, not a versioning split. This is documented durably in the API reference ("Which package do I consume?"), not just in this reply. For your current CLI-only usage: stay on `@semantic-flow/weave`.

**2. `sflo:hasResourcePage` on extracted-term Knops.** Extraction is deliberately non-publication-bearing — by ruled spec, extraction never emits page claims; the subsequent `weave` step owns page materialization. So no, `0.4.0`/`0.5.1` didn't add those claims at extraction and no version will. Your synthesis workaround exists because the supported extract→weave→generate sequence wasn't viable on your mesh — we diagnosed why on your exact corpus shape: a planner defect (the nested-source root-Knop assumption) plus per-term cost at ~1,700-term cardinality. That viability work is a named backlog item; **keep your workaround until we tell you the supported sequence is proven at your scale** — we'll say so explicitly. Related: the `extract --all-terms` file-URL crash from the same run was fixed in `0.5.1` (checked-in file URLs are excluded from the census), so the census side of your workaround can retire on upgrade.

**3. The `validate` memory ceiling.** Everything you asked, in order:

- *Known ceiling?* The 4 GiB was V8's **default** old-space limit in the compiled binary — Weave sets no heap flags anywhere. Your "fixed 4 GiB heap" observation was correct; it just wasn't ours.
- *Did anything change in 0.4.0/0.5.1?* No — your before/after table is exactly what we'd expect; the validate path was byte-identical across those versions.
- *Why couldn't you reproduce it?* Settled meshes short-circuit the expensive path entirely. Your surviving 442-file mesh is settled; the 6,900-file mesh was fresh extraction output with ~1,700 *pending* Knops — the shape that triggered it.
- *What actually happened:* we rebuilt a pending-heavy mesh at your scale synthetically and reproduced the failure exactly — V8 heap exhaustion in ~14 seconds at 4.14 GiB. Mechanism: every pending extracted-term candidate held its own private copies of the full source payload text (twice per candidate — ~3,400 copies of the same ~2 MB string).
- *Fixed in `0.6.0`:* candidates now share one immutable string per file. The same benchmark completes cleanly in ~3.5 minutes at ~554 MiB peak. Whole-mesh validation at the 10⁴-file range is the product intent, and it now holds at your reported scale; targeted validation is a convenience, not a requirement.
- *Your reconstruction offer:* no longer needed for diagnosis — but if you do regenerate the big mesh, a confirmation run would be a welcome datapoint. `WEAVE_MEMORY_STATS=1` (optionally with `--v8-flags=--expose-gc`) prints the receipts if you want to see the retention profile yourself.

## Still open from your 2026-07-28 review

- **§5.1 tags:** every release tag back to `v0.0.2` exists on the canonical repo — run `git fetch --tags origin` in your checkout. (There is deliberately no `v0.5.0`; it was folded into `v0.5.1`.)
- **Your 1 MiB→4 MiB question:** settled — that change shipped in `v0.4.0` (commit `23f50af`); your publish-timing correlation was right. It's now retroactively named in the release notes, and naming behavioral changes is release process from `0.5.1` onward.
- **§2 dry run:** `versionPayloads({ dryRun: true })` shipped in `0.5.1` with an explicit `executed: false` discriminant; forecast and effect derive from one write manifest.
- **§5.2/§6 machine-readable version:** `weave --version --json` shipped in `0.5.1` → `{"version","commit","built"}`; please migrate your release gate from string-matching the plain line to the JSON `version` field (the plain line stays byte-stable meanwhile).
- **§3/§4 locking and repair:** documented in the API reference — the advisory-lock pattern (`<meshRoot>/.weave/lock`, exclusive for every mutating invocation) and the restore-verify-validate-retry repair procedure that defines the `plan-conflict` exit condition.
- **§8 programmatic validation — delivered, not deferred:** `0.6.0` ships `validateMesh` in `@semantic-flow/weave-lib`: structured findings with a stable 14-code registry (severity/code/message + path/designator attribution), explicit coverage counts, typed cannot-validate errors, and CLI parity guaranteed by construction (one findings pipeline; the CLI text is a rendering of it). Honest scope notes: v1 coverage is planner/preflight + publication-readiness (not a per-file integrity traversal — that's documented, with growth planned), it preserves fail-fast (at most one mesh finding per run today), and meshes using repository-backed floating sources refuse with a typed `unsupported-source` under the lib (validate those via the CLI). Contract details are in the API reference; when your CI is ready to consume findings programmatically instead of exit codes, this is the surface we'll keep stable.

## Issues

Happy to have these tracked as GitHub issues on `semantic-flow/weave` next time — one issue per topic works best for us, but consolidated write-ups like yours are genuinely fine too.
