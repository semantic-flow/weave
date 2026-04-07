---
id: weave-rdf-parsing-135m0q
title: 'weave rdf parsing'
desc: ''
created: 1775530714979
updated: 1775530714979
participants: [djradon, codex.gpt-5.4]
---

# User_2026-04-06_1952_55

weave rdf parsing

I think we're ready to tackle [[wd.task.2026.2026-04-04_0952-rdf-parsing]] 

Is this still the right approach? Any open issues?

# gpt-5.4_2026-04-06_1953_03

I’m reviewing the task note against the current repo state and the standing guidance first. I’ll read the product vision, `wd.general-guidance`, the RDF parsing task note, and then inspect the current parsing-related code to check whether the approach still fits and what is still unresolved.

I have the task note and repo guidance loaded. Next I’m checking the current source to see whether that inventory is still accurate and whether the sequencing still matches what the code is actually doing now.

The note’s main picture still matches the code, but the inventory is already a bit stale. I found additional live runtime `meshBase` regex readers outside the four called out there, so I’m checking those and the current weave/extract helpers before I answer on sequencing.

I’ve confirmed the main debt categories, and there’s one important correction: the note is not a full inventory of current RDF text-parsing debt any more. I’m checking whether there’s already a shared RDF helper seam elsewhere in the repo that this task should build around instead of inventing a second parsing path.

I found one more thing that changes the recommendation: there is already RDF-aware logic in `core/payload/update.ts`, so a new parsing helper layer does not need to start from zero. I’m reading that seam now because it looks like the natural place to centralize quad-based inventory lookups instead of letting `weave`, `extract`, and `payload.update` each invent their own parser helpers.

I have enough to answer substantively. I’m pulling exact code references now so I can call out the gaps cleanly instead of hand-waving about “some other files”.

Yes, broadly. The sequencing in [[wd.task.2026.2026-04-04_0952-rdf-parsing#L70]] is still the right one: fix live runtime readers first, then tighten `core/weave`, and leave the big graph-mutation rewrites for later. That still matches the code in [weave.ts](../../src/runtime/weave/weave.ts#L158), [extract.ts](../../src/runtime/extract/extract.ts#L188), [create.ts](../../src/core/knop/create.ts#L165), and [integrate.ts](../../src/core/integrate/integrate.ts#L218).

The main issue is that the note is underscoped now, so I would update it before implementation.

- The inventory is incomplete. The note says “four runtime loaders” still regex `meshBase`, but there are at least two more live runtime readers in [update.ts](../../src/runtime/payload/update.ts#L315) and [add_reference.ts](../../src/runtime/knop/add_reference.ts#L201). `runtime/payload/update` also still block-parses Knop inventory text in [update.ts](../../src/runtime/payload/update.ts#L354).
- I would not treat `core/weave` as the only existing RDF-aware seam. `core/payload/update` already has a better “required triples over parsed quads” pattern in [update.ts](../../src/core/payload/update.ts#L227), and it already has an equivalent-format test in [update_test.ts](../../src/core/payload/update_test.ts#L53). That should inform the shared helper design.
- Step 2 should probably widen from just `extract` and `weave` to `payload.update` too. Otherwise we will centralize parsed inventory discovery for two runtime paths and leave a third sibling on the old block-parser pattern.
- Step 3 needs a strict boundary before coding: convert `core/weave` from substring checks to parsed-quad “required fact” checks, not to a generic validator. Right now both slice detection and shape assertions are still formatting-coupled in [weave.ts](../../src/core/weave/weave.ts#L279) and [weave.ts](../../src/core/weave/weave.ts#L844). If that target is fuzzy, this step will balloon.
- There is one more deferred mutation bucket not called out in the note: `core/knop/add_reference` still does line-oriented KnopInventory surgery in [add_reference.ts](../../src/core/knop/add_reference.ts#L205). I would group that with the later `core/knop/create` and `core/integrate` graph-mutation rewrite rather than leaving it orphaned.

So: yes, ready to tackle, but I’d amend the note first to cover all six runtime `meshBase` readers, pull `payload.update` into the shared-runtime-reader phase, and explicitly define step 3 as “graph-aware carried-slice assertions” rather than “generic RDF validation.” If you want, I can update the task note and then start the first code slice from there.

# User_2026-04-06_1958_27

Please update and then let me review before starting implementation.

# gpt-5.4_2026-04-06_1958_42

I’m updating the task note now to fix the stale inventory and narrow the intended implementation boundary. The changes will fold in `runtime/payload.update`, `runtime/knop/add_reference`, the existing quad-based seam in `core/payload.update`, and the deferred `core/knop/add_reference` mutation work, without starting code implementation.

# gpt-5.4_2026-04-06_1959_18

The note is patched. I’m doing one pass over the result to make sure the scope changes read cleanly and that I didn’t accidentally blur the “shared runtime cleanup first, graph rewrites later” boundary.

# gpt-5.4_2026-04-06_1959_25

I updated [wd.task.2026.2026-04-04_0952-rdf-parsing.md](wd.task.2026.2026-04-04_0952-rdf-parsing.md).

The main changes are:

- expanded the stale `meshBase` inventory from four to six runtime readers by adding `runtime/payload.update` and `runtime/knop/add_reference`
- widened the shared runtime-reader phase to include `payload.update`, not just `extract` and `weave`
- made the existing RDF-aware seams explicit in both `core/weave` and `core/payload.update`
- tightened the boundary for step 3 so it stays “carried-slice required-fact checks” rather than drifting into generic validation
- added `core/knop/add_reference` to the deferred graph-mutation rewrite bucket

I did not start implementation. Review the note and tell me what you want changed before I touch code.

# User_2026-04-06_2109_56

claude feedback:

Priority 1 implementation plan checkbox should say loadMeshState not loadCurrentMeshState for extract.ts.
The existing payloadMentionsTarget n3 usage in extract.ts is worth calling out in the "partial progress" section of Priority 3 or Priority 2, since it's an existing RDF-aware seam in the runtime layer (not just core).

# gpt-5.4_2026-04-06_2110_10

I’m applying the two note fixes now: correcting the `extract.ts` function name in the Priority 1 inventory, and adding the existing runtime `payloadMentionsTarget` quad-parsing seam so the note reflects that runtime progress more accurately.

# gpt-5.4_2026-04-06_2110_15

Updated [wd.task.2026.2026-04-04_0952-rdf-parsing.md](wd.task.2026.2026-04-04_0952-rdf-parsing.md).

I corrected the `extract.ts` Priority 1 function name to `loadMeshState` and added `runtime/extract`’s existing `payloadMentionsTarget` `n3` seam under Priority 2 partial progress so the note now reflects the runtime-side RDF-aware work already in place.

No implementation started.

# User_2026-04-06_2127_41

There's still no daemon, but eventually we will want to support reading some or all of a mesh's RDF into memory. Maybe before the "markdown payload publishing" slice, because it might be helpful for keeping track of job status/rollback/mesh awareness. Maybe I'm way off?

# gpt-5.4_2026-04-06_2127_52

I’m checking the current daemon scaffold and any notes that already constrain job state or rollback assumptions. Then I’ll answer whether “load mesh RDF into memory” is a good pre-publishing step or a distraction.

# gpt-5.4_2026-04-06_2127_58

I’ve confirmed the daemon is still just a stub, so the answer is architectural rather than “what the code already expects.” I’m pulling the decision-log lines that matter here, because the right answer depends on whether we mean per-operation graph loading, a daemon-wide mesh cache, or something stronger like transactional state.

# gpt-5.4_2026-04-06_2128_16

You’re not way off, but I would split that idea in two.

A daemon-side, long-lived in-memory mesh model is not something I’d do before Markdown publishing. The daemon is still a stub at [mod.ts](../../src/daemon/mod.ts), and the current architecture explicitly keeps semantic logic in shared `core`/`runtime` below the daemon in [wd.decision-log.md](wd.decision-log.md). If we jump straight to a resident mesh cache, we take on invalidation, locking, coherence, and partial-failure semantics before we even have real daemon job flow.

What I do think is worth doing before Markdown publishing is a smaller thing: operation-scoped RDF read models. That is very close to the current RDF-parsing cleanup task. A publishing slice will likely want to read current mesh facts, current Knop facts, payload facts, and link relationships in memory for one operation. That helps with mesh awareness. It does not require a daemon-global graph cache.

I’d be more explicit about the three concerns:

- Job status: this should not depend on loading mesh RDF into memory. It wants a durable job store and explicit status records. The project already wants job-centric operations in [wd.decision-log.md](wd.decision-log.md), but that is separate from mesh graph loading.
- Rollback: this is currently filesystem staging plus rename/backup logic in [add_reference.ts](../../src/runtime/knop/add_reference.ts) and [update.ts](../../src/runtime/payload/update.ts). In-memory RDF does not solve rollback.
- Mesh awareness: yes, this is where parsed in-memory graph views help, especially for publishing and later daemon handlers.

So my recommendation is:

1. Finish the RDF read-path cleanup as operation-local parsed helpers and small read models.
2. Use that same seam for Markdown publishing.
3. Defer any daemon-wide mesh cache or resident graph index until there is a real daemon job loop and a measured need.

If you want, I can turn that into one short paragraph in the RDF parsing note or the Markdown publishing note so the sequencing is recorded.

# User_2026-04-06_2130_27

maybe just make a note in [wd.todo.md](wd.todo.md) 

You want to proceed with implementation in this chat?

# gpt-5.4_2026-04-06_2130_33

I’m opening [wd.todo.md](wd.todo.md) to match its existing structure, then I’ll add a short follow-up note about operation-scoped in-memory RDF read models and deferring any daemon-wide mesh cache.

# gpt-5.4_2026-04-06_2130_39

`wd.todo.md` is effectively blank, so I’m adding one narrow backlog item rather than inventing a whole todo structure. The note will point at operation-scoped parsed RDF read models as a possible pre-publishing seam and explicitly defer any daemon-wide mesh cache until daemon job flow is real.

# gpt-5.4_2026-04-06_2130_49

Added the backlog note to [wd.todo.md](wd.todo.md).

Yes, I can proceed with implementation in this chat. The right first slice is still narrow: Priority 1 from [wd.task.2026.2026-04-04_0952-rdf-parsing.md](wd.task.2026.2026-04-04_0952-rdf-parsing.md), meaning one shared RDF-aware `meshBase` reader, replace the six runtime regex call sites, and add tests. I would not jump straight to daemon-oriented caching work.

# User_2026-04-06_2131_22

proceed

# gpt-5.4_2026-04-06_2131_32

I’m starting the first implementation slice from the RDF parsing task: shared runtime `meshBase` parsing only. I’ll inspect the six call sites and current test coverage, then wire in one helper, add focused tests, and run the matching test/lint commands before stopping.

# gpt-5.4_2026-04-06_2131_53

I’ve got the six readers and the current test surface. Next I’m reading the exact runtime functions so I can put the helper in the right place and avoid introducing another ad hoc parsing path or awkward export boundary.

# gpt-5.4_2026-04-06_2132_23

I’ve narrowed the seam. I’m going to add a shared mesh-metadata helper under `runtime/mesh`, use the pure parse helper from the five multi-file readers, use the file-loading wrapper for `knop.add_reference`, and then add focused tests around equivalent Turtle formatting and the affected runtimes.

# gpt-5.4_2026-04-06_2133_28

I’m editing the runtime now. First pass is the shared mesh-metadata helper plus replacing the regex extraction in the runtime call sites. After that I’ll add focused parser tests and a small equivalent-metadata integration test for each affected operation.

# gpt-5.4_2026-04-06_2134_07

The shared helper is in and the six regex readers are replaced. I’m adding the focused tests now: one parser unit test file and one “equivalent mesh metadata” runtime success test per affected operation so this slice is locked before I run the suite.

# gpt-5.4_2026-04-06_2134_40

The code and tests are in. I’m formatting and running the targeted test set first so I can catch any type or import mistakes before I run lint over the whole repo.

# gpt-5.4_2026-04-06_2134_45

The targeted test run is still executing. I’m polling for the result; if anything fails, I’ll fix it before I touch the broader lint step.

# gpt-5.4_2026-04-06_2134_47

The first test run failed on a small typing issue in the new helper, not on behavior. I’m tightening the `n3` types now and rerunning the same targeted suite before moving on.

# gpt-5.4_2026-04-06_2135_04

The code-level test run hit the repo’s existing `n3` permission requirement, not a regression in the new logic. I’m checking the project test task and then rerunning the same targeted tests with the normal env permission the repo already expects.

# gpt-5.4_2026-04-06_2135_10

The remaining failures are just from me running the tests too narrowly on permissions. I’m rerunning the same targeted suite with the repo’s normal test permissions now; after that I’ll run lint.

# gpt-5.4_2026-04-06_2135_27

The targeted tests are green so far, including the new equivalent-metadata runtime cases. I’m waiting for the tail of the run, then I’ll do `deno task lint` as required for the change set.

# gpt-5.4_2026-04-06_2135_36

The behavior slice is passing. I’m running repo-wide lint and type-check now because this touched shared runtime structure, not just one isolated function.

# gpt-5.4_2026-04-06_2135_47

Validation is clean: targeted tests passed, `deno task lint` passed, and `deno task check` passed. I’m doing one last diff/status pass so I can summarize the exact slice cleanly and give you a concrete commit message.

# gpt-5.4_2026-04-06_2136_11

**Implemented**
Priority 1 of the RDF parsing task is now in code.

- Added a shared RDF-aware mesh metadata helper in [metadata.ts](../../src/runtime/mesh/metadata.ts) and parser coverage in [metadata_test.ts](../../src/runtime/mesh/metadata_test.ts).
- Replaced the runtime `meshBase` regex extraction in [create.ts](../../src/runtime/knop/create.ts), [integrate.ts](../../src/runtime/integrate/integrate.ts), [extract.ts](../../src/runtime/extract/extract.ts), [weave.ts](../../src/runtime/weave/weave.ts), [update.ts](../../src/runtime/payload/update.ts), and [add_reference.ts](../../src/runtime/knop/add_reference.ts).
- Added equivalent-metadata integration coverage for each affected runtime path in [knop_create_test.ts](../../tests/integration/knop_create_test.ts), [integrate_test.ts](../../tests/integration/integrate_test.ts), [extract_test.ts](../../tests/integration/extract_test.ts), [weave_test.ts](../../tests/integration/weave_test.ts), [payload_update_test.ts](../../tests/integration/payload_update_test.ts), and [knop_add_reference_test.ts](../../tests/integration/knop_add_reference_test.ts), using [mesh_metadata.ts](../../tests/support/mesh_metadata.ts).

**Verification**
Passed:

- `deno test --allow-read --allow-write --allow-run=git,deno --allow-env src/runtime/mesh/metadata_test.ts tests/integration/knop_create_test.ts tests/integration/integrate_test.ts tests/integration/extract_test.ts tests/integration/weave_test.ts tests/integration/payload_update_test.ts tests/integration/knop_add_reference_test.ts`
- `deno task lint`
- `deno task check`

**Commit Message**
`runtime: replace meshBase regex readers with RDF-aware mesh metadata helper`

- add shared runtime mesh metadata parser based on `n3` quads
- replace six runtime `meshBase` regex extraction call sites with shared helper usage
- add unit coverage for equivalent mesh metadata Turtle and invalid meshBase shapes
- add integration coverage proving affected runtime operations still succeed with semantically equivalent mesh metadata formatting