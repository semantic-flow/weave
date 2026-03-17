---
id: ls7gy1x4oj43fpgctvsqbp3
title: Alice Bio
desc: ''
updated: 1773736118052
created: 1773730267525
---

## Designator Table

This sketch assumes:

* `alice/` and `alice/bio/` are the only non-supporting designators.
* `alice/` denotes the person Alice.
* `alice/bio/` denotes the bio `AbstractArtifact` directly.
* `alice/_knop/` and `alice/bio/_knop/` denote the corresponding `Knop`s.
* `_mesh/` denotes the mesh surface itself.
* historical states are explicit, while a working `LocatedFile` may hang directly off the `AbstractArtifact` without requiring separate working-state resources.

| designator | referent | classes |
| --- | --- | --- |
| `_mesh/` | The mesh surface for this Alice example | `sflo:Mesh` |
| `_mesh/.semantic-mesh-metadata.ttl` | Located Turtle file providing bytes for the mesh metadata artifact | `sflo:MeshMetadata`, `sflo:LocatedFile`, `sflo:RdfDocument` |
| `_mesh/.semantic-mesh-inventory.ttl` | Located Turtle file providing bytes for the mesh inventory artifact | `sflo:MeshInventory`, `sflo:LocatedFile`, `sflo:RdfDocument` |
| `alice/` | Alice the person | `schema:Person` |
| `alice/_knop/` | The Knop for `alice/` | `sflo:Knop` |
| `alice/_knop/_meta/` | Knop metadata artifact for `alice/` | `sflo:KnopMetadata`, `sflo:AbstractArtifact`, `sflo:RdfDocument` |
| `alice/_knop/_meta.ttl` | Located Turtle file providing bytes for `alice/_knop/_meta/` | `sflo:KnopMetadata`, `sflo:LocatedFile`, `sflo:RdfDocument` |
| `alice/_knop/_inventory/` | Knop inventory artifact for `alice/` | `sflo:KnopInventory`, `sflo:AbstractArtifact`, `sflo:RdfDocument` |
| `alice/_knop/_inventory.ttl` | Located Turtle file providing bytes for `alice/_knop/_inventory/` | `sflo:KnopInventory`, `sflo:LocatedFile`, `sflo:RdfDocument` |
| `alice/bio/` | Alice bio as the primary artifact identified by this designator | `sflo:PayloadArtifact`, `sflo:AbstractArtifact` |
| `alice/bio/_knop/` | The Knop for `alice/bio/` | `sflo:Knop` |
| `alice/bio/_knop/_meta/` | Knop metadata artifact for `alice/bio/` | `sflo:KnopMetadata`, `sflo:AbstractArtifact`, `sflo:RdfDocument` |
| `alice/bio/_knop/_meta.ttl` | Located Turtle file providing bytes for `alice/bio/_knop/_meta/` | `sflo:KnopMetadata`, `sflo:LocatedFile`, `sflo:RdfDocument` |
| `alice/bio/_knop/_inventory/` | Knop inventory artifact for `alice/bio/` | `sflo:KnopInventory`, `sflo:AbstractArtifact`, `sflo:RdfDocument` |
| `alice/bio/_knop/_inventory.ttl` | Located Turtle file providing bytes for `alice/bio/_knop/_inventory/` | `sflo:KnopInventory`, `sflo:LocatedFile`, `sflo:RdfDocument` |
| `alice/bio/_knop/_history/h1/` | First published historical state of the bio artifact | `sflo:HistoricalState` |
| `alice/bio/_knop/_history/h1/bio-md/` | Markdown artifact manifestation for historical state `h1` | `sflo:ArtifactManifestation` |
| `alice/bio/_knop/_history/h1/bio-md/bio.md` | Located markdown file providing bytes for `alice/bio/_knop/_history/h1/bio-md/` | `sflo:LocatedFile` |
| `alice/bio/bio.md` | Working located markdown file currently associated directly with `alice/bio/` | `sflo:LocatedFile` |
