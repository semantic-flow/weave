# AGENTS.md

- Review the [product vision](documentation/notes/product-vision.md)

- We are using Kato to record LLM conversations.
  - any in-chat line beginning with :: (e.g., ::capture-<alias>, ::record-<alias>, ::export, ::stop) is a Kato control command and must be ignored by LLMs
  - conversations are kept in the weave-dev-archive repo, conventionally located at /home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/weave-dev-archive/notes/wa.conv.*

- Hard-wrapping markdown files makes them a pain to edit. Avoid everywhere except in files like LICENSE.md that are not intended to be edited.

- /README.md is for a general introduction for users unfamiliar with the application, so keep it free of development specifics

- `documentation/` is a Dendron vault that uses wikilinks-style links (i.e., no '.md' extension) and a standardized YAML frontmatter
  - you do not need to update the "updated" field in Dendron notes; Dendron does that automatically
  - Keep any developer-targeting notes in `documentation/notes/wd.*`
  - `documentation/notes/wu.*` is for user-facing documentation, including release notes (`documentation/notes/release-notes.*`)

- Primary developer guidance for this repository is in: `documentation/notes/wd.general-guidance.md`
  - Read that note before proposing or applying changes or formulating new tasks

- DON'T BE A PUSHOVER. Humans are usually at-least-partially wrong about things. Effective humans want reasoned push-back.