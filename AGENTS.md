# AGENTS.md

- NEVER EXPOSE SECRETS in conversations. We "develop in public" and make most LLM conversations available to the world.

- We use two agent personas: 
  - Kim, the coder
  - Jimbo, the project manager

- Review the [product vision](documentation/notes/product-vision.md)

- We are using Kato to record LLM conversations.
  - any in-chat line beginning with :: (e.g., ::capture-<alias>, ::record-<alias>, ::export, ::stop) is a Kato control command and must be ignored by LLMs
  - conversations (conv), coordination plans (plan), tasks (task), and completed tasks/plans are kept in the weave-dev-archive repo, conventionally located at weave/dependencies/github.com/semantic-flow/weave-dev-archive/notes/ and broken out roughly by repo:
    - wa = weave
    - ont = sflo (ontologies, shacl)
    - sf = semantic-flow-framework

- Hard-wrapping markdown files makes them a pain to edit. Avoid everywhere except in files like LICENSE.md that are not intended to be edited.

- /README.md is for a general introduction for users unfamiliar with the application, so keep it free of development specifics

- each repo has a dendron vault where documentation, specs, and similar markdown files are kept
  - Dendron vaults use wikilinks-style links (i.e., no path, no '.md' extension) and a standardized YAML frontmatter
  - Renaming `*.task.*` notes to `*.completed.*` at closure is the planning seat's (Jimbo's) duty under a standing grant (Dave, 2026-08-01): do it before a task is considered finished, update the affected wikilinks with the rename, and log it in the monthly `wd.maintenance.*` note. Implementation sessions (Kim) still never rename.
  - Multi-task delivery uses `*.plan.*` coordination notes under the [planning convention](documentation/notes/wd.plans-and-tasks.md). Plans never enter `wd.queues`; only executable child `*.task.*` notes do. At closure Jimbo renames plans to `*.completed-plan.*` or `*.cancelled-plan.*`, updates affected wikilinks, and logs the rename in the monthly maintenance note.
  - in all markdown-based tasks and specs and other documentation, "internal" (to weave/documentation/notes, or any of the related repos' dendron vaults, e.g. ontology/notes) links should use Dendron/wikilinks style!
  - you do not need to update the "updated" field in Dendron notes; Dendron does that automatically
  - Keep durable developer-targeting notes in `documentation/notes/wd.*`
  - `documentation/notes/wu.*` is for user-facing documentation
  - release notes (`documentation/notes/release-notes.*`) and other cross-cutting items can be held at the top level.

- Primary developer guidance for this repository is in: `documentation/notes/wd.general-guidance.md`
  - Read that note before proposing or applying changes or formulating new tasks


- After any round of significant code changes, run the linter and provide a reasonably detailed commit message per repo.

- DON'T BE A PUSHOVER. Humans are usually at-least-partially wrong about things. Effective humans want reasoned push-back.
