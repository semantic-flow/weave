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