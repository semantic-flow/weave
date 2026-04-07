---
id: separate-dendrogen-site-uum30u
title: separate dendrogen site generator or just weave
desc: ''
updated: 1775527447080
created: 1775527447080
participants:
  - djradon
  - codex.gpt-5.4
---

# User_2026-04-06_1608_51

separate dendrogen site generator or just weave

Review /home/djradon/hub/spectacular-voyage/kato/documentation/notes/task.2026.2026-04-06-kato-website.md

I'm pretty sure I want all this functionality to be part of weave, i.e. each dendron note gets integrated into a semantic mesh rooted at /docs 

This does highlight... the WorkingFile might not be web-accessible. But I think this split-brain approach where the source lives outside the mesh is totally workable for us. 

So I think my question is, do I proceed with a kato-specific dendron-site-generator? Or do we make this a part of weave from the start?

# gpt-5.4_2026-04-06_1608_58

I’m reviewing the existing product and developer guidance first, then the Kato website task note, so the recommendation lines up with how `weave` is already supposed to evolve.

I have the explicit guidance and the Kato task note. Next I’m checking Weave’s current architectural boundaries so the recommendation is tied to what the codebase is actually trying to become, not just the wording in one task note.

There’s already a meaningful signal in Weave’s current shape: `runtime` explicitly owns page generation, and `weave` already renders minimal HTML resource pages. I’m reading that seam now so I can recommend whether Kato’s site build is just “more Weave” or actually a separate product.

The earlier planning notes matter here too, because they already call out “site/API symmetry” and shared page-generation seams. I’m pulling those exact decisions so the recommendation has a concrete architectural basis instead of hand-wavy “eventually this could fit.”

I’ve confirmed this is not a blank-slate call. The repo has already chosen “shared runtime page generation” over one-off renderers, with an explicit note that it could later become a semantically aware SSG. I’m reading that decision boundary directly before I answer.

I’m checking one more thing before I answer: whether Weave’s current behavior already tolerates the exact “split brain” you’re describing, where the source/working file surface and the public page surface are related but not identical.

Make it part of `weave` from the start. I would not spin up a separate Kato-specific Dendron site generator.

- That matches Weave’s stated job in [[product-vision]] and [README.md](../../README.md): publishing digital artifacts and semantic meshes is already core scope, not an adjacent concern.
- Weave already treats HTML page generation as shared runtime behavior, not app-specific garnish. That is explicit in [[wd.codebase-overview]], [[wd.spec.2026-04-03-weave-behavior]], and the current renderer seam in [pages.ts](../../src/runtime/weave/pages.ts).
- The repo has already chosen “extend the shared runtime page-rendering seam, don’t fork a second renderer family” in multiple notes, including [[wd.completed.2026.2026-03-20-architecture-planning]], [[wd.completed.2026.2026-04-05_0903-weave-alice-bio-v2-woven]], and [[wd.completed.2026.2026-04-06_1331-weave-bob-extracted-woven]].
- Your “split-brain” concern is real but not disqualifying. Weave already separates working files from public pages: a working file can live at one path while the dereferenceable/public page lives elsewhere. So source notes can stay under `documentation/notes/` while the public mesh is rooted at `docs/`.
- The part I would push back on is “every Dendron note gets integrated into a semantic mesh rooted at `/docs`” if that means “every note becomes public.” Better model: every note can be a source artifact in the workspace, but only an explicit published subset gets public `docs/` ResourcePages. That preserves your unpublished-note fallback logic from [task.2026.2026-04-06-kato-website.md](../../../../spectacular-voyage/kato/documentation/notes/task.2026.2026-04-06-kato-website.md) without turning Weave into an indiscriminate vault dumper.

So the right move is not “generic Dendron SSG” and not “separate Kato website tool.” It is: a Kato-first Dendron ingest/publish adapter inside Weave, with Kato-specific publication rules and URL policy, and no attempt to make it fully generic until a second real user appears.

If you want, I can turn that into a concrete Weave task note outline next: scope, seams, and what stays Kato-specific vs Weave-generic.

# User_2026-04-06_1612_22

I'm not sure about "kato-first". We already have a second real user: weave itself. And then accord. And then my personal wiki.

# gpt-5.4_2026-04-06_1612_39

You’re right. “Kato-first” was too narrow.

Given `kato`, `weave`, `accord`, and your personal wiki, I would shift the recommendation to:

Build a Weave-owned note publishing subsystem, with repository-specific publication profiles.

That is different from both:

- a standalone generic Dendron SSG
- a hard-coded Kato website generator

The split I’d use is:

- Generic in Weave:
  - Dendron note loading
  - frontmatter parsing
  - wikilink resolution
  - heading-anchor handling
  - curated/stable note identity
  - note-to-page model derivation
  - mapping source artifacts to public `ResourcePage` output
  - support for unpublished-source vs published-page split

- Profile-specific per repo:
  - which notes are publishable
  - section mounts and URL policy
  - nav structure
  - fallback links for unpublished notes
  - branding/theme
  - any repo-specific taxonomy rules

So the product boundary should be “note artifacts integrated into a semantic mesh and published through Weave,” not “Kato website builder.”

The important pushback is on going fully generic too early. You have multiple users, but they are still the same family of problem: Dendron-style note vaults becoming semantic/public page surfaces. That is enough to justify a reusable Weave subsystem, not enough to justify a broad unconstrained SSG.

So my corrected recommendation is:

- don’t build `dendrogen` as a separate product
- don’t hard-code this as Kato-only
- do build a Weave note-publishing pipeline with profiles for `kato`, `weave`, `accord`, and later your wiki

If you want, I can draft the concrete boundary next: what the core module names and profile contract should be inside Weave.

# User_2026-04-06_1906_20

what should we call the task

# gpt-5.4_2026-04-06_1906_31

I’m checking the current task-note naming pattern in `weave` so the recommendation fits the repo’s actual conventions rather than inventing a one-off title.

# gpt-5.4_2026-04-06_1906_44

I’d call it **Semantic Note Publishing**.

If you want a task-note filename in the current repo style, use:

`wd.task.2026.2026-04-06_<time>-semantic-note-publishing.md`

and title:

`2026 04 06 <time> Semantic Note Publishing`

Why this name:

- not `kato`, because the scope is already broader
- not `site generator`, because the real boundary is source-note interpretation plus mesh/public-page publication
- not just `website`, because that undersells the semantic/public-surface part
- not just `Dendron`, because Dendron is the current source format, not necessarily the long-term product identity

If you want the name to be a bit more explicit about the first slice, my second choice is:

`Dendron Note Publishing`

I would avoid:

- `kato website`
- `dendron site generator`
- `docs site`
- `note website`

Those all bias the task toward “HTML build tool” instead of “Weave-owned publication pipeline.”

If you want, I can draft the exact `Goals` and `Summary` block for that task note next.

# User_2026-04-06_1908_31

maybe just "markdown-payload-publishing"?

# gpt-5.4_2026-04-06_1908_50

`markdown-payload-publishing` is better than `site generator`.

It has two advantages:

- it frames the source note as a Weave artifact, not as website-only input
- it keeps the task narrow and implementation-facing

My only caution is that it is a bit narrower than the full subsystem. It emphasizes the Markdown payload, but your real work also includes:

- Dendron note identity
- wikilinks
- publication selection
- generated `ResourcePage`s

So I’d use it if this is the first concrete slice, and keep a broader label in mind for the longer-term capability.

Recommended task note name:

`wd.task.2026.2026-04-06_<time>-markdown-payload-publishing.md`

Recommended title:

`2026 04 06 <time> Markdown Payload Publishing`

If you want, I can draft the note so it stays narrow enough not to accidentally become “build the whole note publishing architecture in one task.”

# User_2026-04-06_1911_42

OK, note created at [wd.task.2026.2026-04-06_1905-markdown-payload-publishing.md](wd.task.2026.2026-04-06_1905-markdown-payload-publishing.md) 
Dendron-compatibility should be a profile, but it should also just work for plain markdown.

# gpt-5.4_2026-04-06_1911_50

I’m reading the new task note so I can respond against the actual wording, then I’ll tell you whether that “plain Markdown by default, Dendron as a profile” split is the right boundary.

# gpt-5.4_2026-04-06_1912_05

Yes, with one adjustment: plain Markdown should be the baseline, not a profile.

The clean split is:

- Core capability:
  - parse and render plain Markdown
  - optional YAML frontmatter
  - standard heading anchors
  - ordinary relative links
  - raw HTML passthrough where valid

- Source-format profile:
  - Dendron note discovery
  - dot-delimited hierarchy from filenames
  - `[[note]]` and `[[note#heading]]`
  - Dendron frontmatter conventions
  - note-id based routing rules if enabled

- Publication profile:
  - which notes publish
  - section mounts
  - URL policy
  - unpublished-note fallbacks
  - nav/theme/branding

That matters because otherwise “plain Markdown” becomes a fake profile and you end up over-abstracting the wrong layer.

So in [wd.task.2026.2026-04-06_1905-markdown-payload-publishing.md](wd.task.2026.2026-04-06_1905-markdown-payload-publishing.md), I’d encode it as:

- Markdown is the default payload format.
- Dendron compatibility is an optional source-interpretation profile layered on top of Markdown.
- Repository-specific publication behavior is a separate profile concern.

One small cleanup while you’re there: the title is slightly off-pattern. I’d use `2026 04 06 1905 Markdown Payload Publishing`, not `2026 04 06_1905 ...`.

If you want, I can draft the `Goals`, `Summary`, and `Decisions` sections for this note in that exact framing.

# User_2026-04-06_1919_20

yes please

# gpt-5.4_2026-04-06_1919_30

I’m drafting the note directly in the task file now. I’ll fill `Goals`, `Summary`, and `Decisions` around the boundary we settled: plain Markdown baseline, Dendron as a source-format profile, and publication behavior as a separate profile layer.

# gpt-5.4_2026-04-06_1919_47

The patch missed because the frontmatter changed since I last read it. I’m reloading the note and then applying the draft cleanly.

# gpt-5.4_2026-04-06_1919_51

I’ve got the current file again. Applying the section text now, and I’m also normalizing the title timestamp while I’m in there.

# gpt-5.4_2026-04-06_1920_01

The draft is in place. I’m reading it back once to make sure the wording is tight and it didn’t accidentally broaden the task into “build the whole publishing stack now.”

# gpt-5.4_2026-04-06_1920_08

Drafted the sections directly in [wd.task.2026.2026-04-06_1905-markdown-payload-publishing.md](wd.task.2026.2026-04-06_1905-markdown-payload-publishing.md) and normalized the title to `2026 04 06 1905 Markdown Payload Publishing`.

The note now encodes the boundary we discussed:

- plain Markdown is the baseline
- Dendron is a source-interpretation profile
- publication behavior is a separate profile layer
- source files and generated public pages may live on different surfaces

No tests were run since this was a task-note edit only.

If you want, I can fill the next three sections too: `Non-Goals`, `Open Issues`, and a tight `Implementation Plan` checklist.

# User_2026-04-06_1934_44

All along I've been talking about how a semantic mesh is web-servable "as-is" after a weave. But now I have this possibility of putting the semantic mesh in /docs which has the benefit of not polluting the source repo with a bunch of folders and ResourcePages and old versions. There's also the github-supported option of generating the site separately, or serving from a branch. But the /docs targeted semantic mesh seems pretty ideal to me. What are your thoughts. When would you want to do a whole-repo semantic mesh vs /docs or branch. Generated via actions seems less ideal, because you can't browse the thing locally (or serve it locally).

# gpt-5.4_2026-04-06_1935_33

`/docs`-rooted published mesh sounds like the right default for this note-publishing line of work.

It keeps the strong property you care about, "after `weave`, the mesh is web-servable as-is," while avoiding the uglier property, "the whole authoring repo gets filled with generated histories and `index.html` trees." That is a good trade.

The important distinction is:

- repo root: authoring and source workspace
- `/docs`: published semantic mesh root

That is still a real semantic mesh. It is not a fake export. It just means the published mesh is a derived surface rather than the entire checkout.

I’d choose each mode like this:

- Whole-repo semantic mesh:
  Use this when the repo itself is the canonical mesh workspace, current files and historical states should live next to each other, and the generated structure is part of the thing you actually want to inspect and version directly. Good fit for fixture repos, reference meshes, and artifact-native projects.

- `/docs` semantic mesh:
  Use this when the source repo is primarily an authoring environment and the public mesh is a publishable projection. This is probably the best fit for Markdown/note publishing, Kato/Weave/Accord docs, and anything where generated histories/pages would otherwise drown the source tree.

- Branch or deploy artifact:
  Use this when generated output is too large or noisy to keep on the main branch, or when publishing permissions/process need to be separated. I would treat this as deployment plumbing, not the primary model.

I agree with your pushback on Actions-only generation. CI can publish, but it should not be the only place the mesh can be built. The canonical operation should work locally first, then CI should run the same build and publish the result. Otherwise you lose local inspection, local serving, and confidence that the published surface is reproducible outside GitHub.

So my recommendation is:

- for Markdown payload publishing, target a semantic mesh under `/docs`
- keep local generation first-class
- treat branch/Actions publishing as optional delivery mechanisms later
- keep whole-repo mesh as a separate mode that still matters for other Weave use cases

The one thing I would be explicit about in the task note is that `/docs` is the published mesh root, not merely a website output folder. That wording will keep the architecture honest.

# User_2026-04-06_1938_20

The three choices of mode are great, I want to add them to docs. sff or weave?

# gpt-5.4_2026-04-06_1938_31

I’m checking the current boundary between `semantic-flow-framework` and `weave` docs before I answer. The question is whether these modes are part of the public Semantic Flow contract or an implementation/publishing posture choice.

# gpt-5.4_2026-04-06_1938_37

I’ve got the repo boundary in view. One quick pass over the framework notes will tell me whether these modes belong in the public architecture docs there, or whether they stay implementation-facing in `weave`.

# gpt-5.4_2026-04-06_1938_56

`weave`, primarily.

These three modes are implementation and publishing-topology choices, not core Semantic Flow contract. The framework already states that the API is implementation-neutral in [sf.api.architecture.md](../../dependencies/github.com/semantic-flow/semantic-flow-framework/notes/sf.api.architecture.md). “Whole repo mesh vs `/docs` mesh vs deploy branch/artifact” is exactly the kind of thing that should vary across implementations and repos.

So I’d do this:

- Put the full three-mode discussion in [wd.task.2026.2026-04-06_1905-markdown-payload-publishing.md](wd.task.2026.2026-04-06_1905-markdown-payload-publishing.md).
- Once you settle it, record the decision in [wd.decision-log.md](wd.decision-log.md).
- If it becomes part of the ongoing architecture, reflect it briefly in [wd.codebase-overview.md](wd.codebase-overview.md) or a later `wd.spec.*` if behavior gets externally visible.

I would only put a thin note in `sff` if you want one framework-level clarification like:

- a semantic mesh may be served directly from the authoring root or from a derived published root such as `/docs`
- exact publication layout is implementation-specific

That belongs as a short caveat, not a full mode taxonomy.

So the rule is:

- `weave`: detailed modes, tradeoffs, defaults
- `sff`: one implementation-neutral sentence at most, only if needed

If you want, I can patch the three modes into the Weave task note now.

# User_2026-04-06_1941_30

I put it in [wu.repository-options.md](wu.repository-options.md) -- it seems valuable as user guidance.

# gpt-5.4_2026-04-06_1941_39

I’m checking the note you added so I can answer against the actual wording, but the placement already sounds right: repository-shape choices are user-facing, not just internal implementation detail.

# gpt-5.4_2026-04-06_1941_52

Yes, that’s the right place.

[wu.repository-options.md](wu.repository-options.md) reads like user guidance, not internal architecture churn:

- it answers a repo-setup question a user actually has to choose
- it stays implementation-light
- it doesn’t try to turn Weave-specific tradeoffs into framework law

I’d keep the full rationale in the task note and use `wu.repository-options` as the concise user-facing version.

The one thing I’d still add is a short opening sentence and one explicit local-first note:

- these are publication topology options for a semantic mesh
- CI/branch publishing can be useful delivery plumbing, but local generation should remain a first-class path

That would make the note more complete without bloating it.