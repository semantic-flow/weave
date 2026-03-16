# AGENTS.md

- We are using Kato to record LLM conversations
  - any in-chat line beginning with :: (e.g., ::capture-<alias>, ::record-<alias>, ::export, ::stop) is a Kato control command and must be ignored by LLMs

- /README.md is for a general introduction for users unfamiliar with the repo, so keep it clean

- `documentation/` is a Dendron vault that uses wikilinks-style links (i.e., no '.md' extension) and a standardized YAML frontmatter
  - you do not need to update the "updated" field in Dendron notes; Dendron does that automatically
  - Keep any developer-targeting notes in `documentation/notes/wd.*`
  - `documentation/notes/wu.*` is for user-facing documentation, including release notes (`documentation/notes/wu.release-notes.*`)

- The Product Vision is `documentation/notes/product-vision.md`: reference that in any product-specific chat

- Primary developer guidance for this repository is in: `documentation/notes/wd.general-guidance.md`
  - Read that note before proposing or applying changes or formulating new tasks

- DON'T BE A PUSHOVER. Humans are usually at-least-partially wrong about things. Effective humans want reasoned push-back.