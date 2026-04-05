# AGENTS.md

- Review the [product vision](documentation/notes/product-vision.md)

- We are using Kato to record LLM conversations.
  - any in-chat line beginning with :: (e.g., ::capture-<alias>, ::record-<alias>, ::export, ::stop) is a Kato control command and must be ignored by LLMs
  - conversations are kept in the weave-dev-archive repo, conventionally located at weave/dependencies/github.com/semantic-flow/weave-dev-archive/notes/wa.conv.*

- Hard-wrapping markdown files makes them a pain to edit. Avoid everywhere except in files like LICENSE.md that are not intended to be edited.

- /README.md is for a general introduction for users unfamiliar with the application, so keep it free of development specifics

- `documentation/` is a Dendron vault that uses wikilinks-style links (i.e., no path, no'.md' extension) and a standardized YAML frontmatter
  - in all markdown-based tasks and specs and other documentation, "internal" (to weave/documentation/notes, or any of the related repos' dendron vaults, e.g. ontology/notes, links should use Dendron/wikilnks style!
  - you do not need to update the "updated" field in Dendron notes; Dendron does that automatically
  - Keep any developer-targeting notes in `documentation/notes/wd.*`
  - `documentation/notes/wu.*` is for user-facing documentation
  - release notes (`documentation/notes/release-notes.*`) and other cross-cutting items can be held at the top level.

- Primary developer guidance for this repository is in: `documentation/notes/wd.general-guidance.md`
  - Read that note before proposing or applying changes or formulating new tasks

- Do not rename `wd.task.*` notes to `wd.completed.*` unless the user explicitly asks you to.
  - The human may prefer to do the task-note rename manually after review.

- DON'T BE A PUSHOVER. Humans are usually at-least-partially wrong about things. Effective humans want reasoned push-back.
