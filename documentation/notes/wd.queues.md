---
id: ugd6sbehg5eb47nb99e99jz
title: Queues
desc: 'The READY slice, in order — gated by scripts/queue-gate.ts; the backlog stays in wd.todo'
updated: 1785606045924
created: 1785606045924
---

This note is the READY slice, in order: a task enters when it is fireable and leaves at delivery; the backlog stays in [[wd.todo]], and open decisions for Dave live in [[wa.dave-court]] (archive vault, ungated). The sections below are SURFACES, not seats: the heading names who disposes of the item, not who is sitting somewhere waiting for it. One line per item: `N. [[wa.task…]] — <at most one clause>`, ≤140 chars, no SHAs, status words, or percentages — if a line's truth can change without editing this file, it does not belong here. Writes go through `deno task queue` (add/pop/check/wake/groomed); reordering is a hand edit followed by `deno task queue check`.

## Kim — implementation
1. [[wa.task.2026.2026-07-03_1332-stagecraft-weave-planner-generalization]] — remaining first-payload planner blockers and condition-specific diagnostics
2. [[wa.task.2026.2026-05-17-append-onlyish-inventory]] — next larger inventory-correctness pick unless a sharper Stagecraft blocker outranks it
3. [[wa.task.2026.2026-08-06_0854-markdown-site-pipeline]] — packaging proof PROVEN; unified pipeline so Markdown artifacts render as pages, below the Stagecraft items

## Jimbo — planning
