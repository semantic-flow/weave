---
id: 36d9c914-1201-4672-a165-cf886eb26a67
title: Plans And Tasks
desc: 'Coordination-plan and executable-task conventions for cross-task delivery arcs'
created: 1787439044000
---

## Purpose

This note defines when Weave uses a coordination plan, how plans relate to executable task notes, and how both participate in backlog, queue, review, and closure workflows.

The formal artifact name is **plan**. "Epic" may be used informally for a large plan, but there is no separate epic note genre. One genre avoids recurring arguments about whether a coordination artifact is a plan, epic, initiative, or umbrella task.

## Plan Versus Task

A task is an independently executable unit of work. It owns its implementation contract, tests, documentation changes, and repository commits. Active tasks use names such as `wa.task.2026.2026-08-22_1112-founding-referent-data` and follow [[template.task]].

A plan coordinates two or more independently executable tasks, repositories, phase gates, or conditional branches. It owns ordering and exit criteria, not the child tasks' implementation detail. Active plans use names such as `wa.plan.2026.2026-08-22_1550-stagecraft-iri-initialization` and follow [[template.plan]].

Cut a plan when at least one of these is true:

- delivery spans two or more task notes whose order matters
- a later task is conditional on a measured receipt or human ruling
- work spans repositories with independently reviewable/committable contracts
- closing one task could otherwise orphan a required follow-up
- the overall outcome needs an exit criterion that no single child task owns

Do not cut a plan for one large task that can be decomposed internally without independent queueing or closure. Do not use a plan as a substitute for refining an oversized task.

## Naming And Scope

Use `<repo-prefix>.plan.<year>.<date-time>-<slug>`:

- `wa.plan.*` for Weave-led or cross-repository delivery whose runtime/product integration is owned by Weave
- `ont.plan.*` for SFLO ontology-led delivery
- `sf.plan.*` for Semantic Flow Framework-led delivery

A plan may link tasks from any repository prefix. Choose the plan prefix by primary delivery ownership, not by where the note file happens to live.

Plans and workflow task notes live in the weave-dev-archive vault. Durable product/developer rules derived from a plan live in the appropriate `wd.*`, `ont.*`, `sf.*`, or user-facing note rather than relying on the plan forever.

## Required Shape

Every active plan contains:

- `Status`: active, blocked on a named gate, or ready for closure
- `Goals`: the cross-task outcome
- `Summary`: why coordination is necessary
- `Child Tasks`: each executable owner and its role
- `Sequence`: phase order and permitted parallel work
- `Gates`: evidence or rulings required between phases
- `Decisions`: settled coordination choices
- `Open Issues`: only unresolved plan-level questions
- `Testing And Receipts`: cross-task evidence no child owns alone
- `Non-Goals`: boundaries of the plan artifact
- `Exit Criteria`: the conditions under which the plan closes
- `Plan Checklist`: phase-level checkboxes, normally linking child task notes

Plans summarize child status but do not duplicate child specifications, test lists, implementation progress, or commit receipts. If detail changes in a child, update the child first and keep the plan to a one-line consequence.

## Queue And Backlog

Plans never enter [[wd.queues]]. The queue gate accepts only `<repo-prefix>.task.*` notes by design. A plan cannot be executed as one bite and must not occupy a READY position that an actionable child needs.

The earliest fireable child task enters the queue. Later children remain in [[wd.todo]] or only in the plan until their gates are satisfied. Parallel children may each enter the queue when independently ready.

`wd.todo` may carry one roll-up line for the plan plus independently important child-task lines. Avoid repeating a complete phase list in the backlog; the plan owns that sequence.

## Ownership And Updates

The planning seat owns plan creation, phase/gate updates, and closure hygiene. Implementation sessions update their child task and return any plan-level delta; they do not silently rewrite sibling scope.

When a gate is reached:

1. record the evidence in the task or receipt that produced it
2. record the resulting decision in the plan
3. create or refine the next child task if the branch is taken
4. update `wd.todo` and admit the child to `wd.queues` only when it is fireable

A conditional branch that is not taken remains recorded as a ruled-off branch. Do not create speculative child tasks merely to make the plan look complete.

## Reviews

Deep reviews target the artifact that owns the disputed contract:

- review the plan for sequencing, missing gates, orphan work, and exit criteria
- review a task for ontology/API/runtime/test correctness
- review both only when the finding changes the dependency boundary

Review notes link the plan or task they reviewed. Dispositions are folded into the owning artifact rather than maintained only in the review note.

## Closure

A plan is ready for closure when:

- every required phase is represented by a completed/cancelled child task or an explicit ruled-off branch
- all cross-task gates and receipts are recorded
- no actionable work remains only in plan prose
- backlog, queue, roadmap, decision-log, and durable-guidance links reflect the final outcome

At closure, the planning seat renames:

- `<prefix>.plan.*` to `<prefix>.completed-plan.*` when the coordinated outcome was delivered
- `<prefix>.plan.*` to `<prefix>.cancelled-plan.*` when the coordinated outcome was abandoned or superseded

Update affected wikilinks and log the rename in the monthly `wd.maintenance.*` note, parallel to task-note closure. Child tasks retain their own independent `task` → `completed`/`cancelled` lifecycle.

Plans are not closed merely because all currently known child tasks ended; conditional gates and the plan's exit criteria must also be resolved.
