---
id: t5j6532g0fapvle85h0ivyn
title: weave generate
desc: ''
updated: 1779376210676
created: 1779376210676
---

## Summary

`weave generate` renders current ResourcePages from the settled local mesh state without creating new historical states.

See [[wu.resource-pages]] for what ResourcePages are for and how default and customized pages are composed.

## Usage

```sh
weave generate [--mesh-root <meshRoot>] [--target <target>]...
weave generate [--include-semantic-flow-metadata] [--history-tracking-policy <policy>]
```

Targets use [[wu.cli-reference.target-syntax]]. Use `/` for the root designator as described in [[wu.cli-reference.root-designator]].

## Examples

```sh
weave generate
weave generate --target 'designatorPath=alice/data'
weave generate --target 'designatorPath=alice,recursive=true'
weave generate --include-semantic-flow-metadata
```

## Notes

Generation reads the current mesh inventory, Knop inventories, payload states, ResourcePageDefinition artifacts, and related support artifacts, then writes or updates HTML ResourcePages.

Mesh-local `_mesh/_config/config.ttl` can select durable ResourcePage generation and presentation policies. For example, a mesh can bind Weave's built-in all-panels presentation policy to include the generated Semantic Flow metadata panel without repeating a command flag.

`--include-semantic-flow-metadata` is a command-scoped presentation override for the current generation pass. It applies Weave's built-in all-panels presentation policy, so the generated Semantic Flow metadata section is included even when the mesh default would hide it.

`--history-tracking-policy` is an advanced command-scoped override used while resolving page-generation inputs. It applies only to the current command.

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where command audit logs are written.
- [[wu.environment-variables#weave_timing]] enables aggregate timing lines.
- [[wu.environment-variables#weave_generated_at]] sets the rendered generation timestamp.
- [[wu.environment-variables#home-and-userprofile]] can affect workspace/local-access policy resolution.
