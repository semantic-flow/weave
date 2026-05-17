---
id: xw7sh2ghb43mvt2nx7z9qk1
title: 2026 05 17_1239 Fix Extracted Support History Defaults
desc: ''
created: 1779046740000
---

## Goals

- Make first-weave extracted Knops honor effective support artifact history policies for Knop metadata and Knop inventory.
- Preserve payload/config versioning while keeping supporting artifacts current-only by default.
- Keep the role-level `KnopInventory` default explicit unless there is a stronger reason to remove it.

## Context

The sflo branch-published dogfood run for [[wa.task.2026.2026-05-16_1707-create-sflo-branch-mesh]] exposed generated `_history001` trees under extracted-term Knop support artifacts such as `config/hasResolvedConfigCachePolicy/_knop/_meta` and `_inventory`. The current defaults set global history tracking to `currentOnly`, payload/config to `versioned`, and Knop inventory to `currentOnly`; Knop metadata inherits `currentOnly`.

## Implementation Plan

- [x] Thread Knop metadata and Knop inventory support history policies into the first extracted-Knop weave renderer.
- [x] Omit extracted-Knop metadata/inventory history snapshots and historical ResourcePages when policy is `currentOnly`.
- [x] Add focused tests for extracted Knops using current-only support history policies.
- [x] Update integration expectations that currently assume extracted support histories are created by default.
- [x] Run focused tests and linter.

## Decision

Keep the explicit `KnopInventory` current-only default in `defaults/application.ttl` for now. It is redundant with the current global default, but it records role-level intent and keeps the default stable if the global default later changes.
