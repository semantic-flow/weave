---
id: mlnjj90xrpgzp11qnnaqxld
title: Testing
desc: ''
updated: 1773663293074
created: 1773662667920
---

## Purpose

This note defines the intended testing posture for Weave.

The goal is not maximum test count. The goal is high-signal tests that make semantic regressions, filesystem regressions, and contract drift hard to miss.

## Testing Philosophy

- tests should be meaningfully helpful; avoid useless tests for the sake of code coverage
- prefer TDD where practical
- write the smallest failing test that captures the intended behavior or bug before implementing the fix
- when the expected Semantic Flow behavior is still unclear, write or refine an `sf.spec.*` note first, then derive failing tests from it
- classify tests by scope, not by how they “feel”
- black-box functional tests are a testing style; many of them will still be integration tests by scope
- a spec note is not a substitute for executable tests
- use Accord as the preferred acceptance harness for externally visible Semantic Flow behavior when a behavior can be stated as a fixture transition or manifest-backed comparison
- Accord-style acceptance checks are useful for cross-file, cross-ref, and behavior-level validation, but they do not replace unit and integration tests

## Recommended Test Layers

### Unit

Use unit tests for narrow logic with small, local dependencies.

Typical candidates:

- request/result validation
- pure domain rules in `core`
- path and naming helpers
- RDF helper functions with tightly controlled inputs
- rendering helpers that can be asserted without a whole workspace

Preferred placement:

- co-locate unit tests beside the code they exercise, for example `src/**/foo_test.ts`

### Integration

Use integration tests when real subsystems must work together.

Typical candidates:

- CLI command routing calling `core` and `runtime`
- filesystem plus git plus RDF behavior
- version/validate/generate orchestration
- page generation over realistic fixture trees
- daemon handlers calling shared runtime logic

Preferred placement:

- `tests/integration/`

### End-to-End

Use end-to-end tests for the closest user-path executions.

Typical candidates:

- packaged or near-packaged CLI invocation
- daemon process startup plus HTTP job flow
- web-to-daemon flows once the web app exists

Preferred placement:

- `tests/e2e/`

### Acceptance and Accord

Use Accord when the most meaningful question is not “did this helper return the right shape?” but “did Weave produce the right externally visible repository state?”

Typical candidates:

- `mesh create` and later semantic operations compared against curated fixture repos
- filesystem plus RDF equivalence checks against `semantic-flow-framework` conformance manifests
- black-box CLI or daemon executions where the expected result is best expressed as before/after repo state
- cross-file semantic invariants that are awkward to assert through narrow unit tests

Practical guidance:

- treat Accord as the acceptance oracle for behavior-level Semantic Flow conformance
- prefer manifest-backed comparisons over ad hoc snapshot assertions when a reusable transition is available
- keep Accord checks black-box and implementation-agnostic
- remember that Accord checks transitions, not execution: run Weave or the fixture runner to produce the target checkout, then use Accord to ask whether expected paths, representative RDF facts, and generated support files landed
- for newly added RDF files, pair path expectations with semantic assertions for the facts that matter; do not rely on byte identity unless the manifest contract explicitly asserts bytes
- keep conformance harness files out of fixture rung refs by default; if a fixture repo must carry `conformance/`, either test those paths deliberately or ignore them with `conformance/**`
- use consumer fixture checks to validate a consumer's interpretation of the accepted checkout; use Accord to validate the ladder transitions that produced that checkout
- use Accord alongside narrower unit and integration tests rather than instead of them
- when a new externally visible Semantic Flow operation stabilizes, consider whether it should gain an `sf.spec.*` note and an Accord-backed acceptance path

### Shared Harness and Fixtures

Shared helpers should not be mixed into production source.

Preferred placement:

- `tests/support/` for harnesses, fake services, temp-repo builders, HTTP helpers, and assertion utilities
- `tests/fixtures/` for reusable fixture trees, manifests, and other durable test inputs

Temp workspaces created with `createTestTmpDir()` are registered with the test harness and cleaned after each test when tests are run through `deno task test` or `deno task test:coverage`. Set `WEAVE_KEEP_TEST_TMP=1` when running those tasks to preserve temp workspaces for debugging a failing test.

The test harness also sets `DENO_DIR` to `/tmp/semantic-flow-deno-test-cache` while each test runs. This keeps child `deno run` CLI subprocesses from rebuilding their dependency cache inside the per-test `XDG_CACHE_HOME`.

Curated Git fixture refs should be materialized through the shared fixture snapshot cache when possible. The cache stores immutable per-repo/per-commit snapshots under `/tmp/semantic-flow-fixture-snapshots`, keyed by resolved commit SHA, then copies from that snapshot into each test's private temp workspace. This keeps tests isolated while avoiding repeated per-file `git show` extraction.

Live Semantic Flow fixture ladder regeneration is a separate cross-repo workflow; see [[wd.testing.fixture-ladder-regeneration]].

### Codecov Test Analytics

GitHub Actions publishes JUnit XML to Codecov Test Analytics from the normal CI workflow. Treat Codecov as the canonical broad timing view for slowest suites and tests; add local timing instrumentation only when it answers a narrower question, such as setup time versus command execution inside one slow e2e suite.

`deno task test:coverage` writes Deno's raw JUnit report to `/tmp/semantic-flow-coverage/junit.xml`, normalizes it for Codecov at `/tmp/semantic-flow-coverage/codecov-junit.xml`, and writes raw coverage data in the same temp directory. `deno task coverage:lcov` writes LCOV to `/tmp/semantic-flow-coverage/lcov.info`.

Coverage-producing tasks create `/tmp/semantic-flow-coverage` if it does not exist, so a reboot-cleared `/tmp` does not require manual setup.

Local uploads are intentionally opt-in. Use `deno task test:analytics` when you want to run the coverage test suite and upload its JUnit results to Codecov. The local analytics task writes raw coverage data and JUnit XML outside the repository at `/tmp/semantic-flow-coverage`; the uploaded report is `/tmp/semantic-flow-coverage/codecov-junit.xml`. The task prefers the org-scoped `CODECOV_TOKEN_SEMANTIC_FLOW` environment variable, falls back to `CODECOV_TOKEN`, and requires either `codecovcli` or the `codecov` binary on `PATH`; install the CLI with `pip install codecov-cli` if needed. Use `CODECOV_TEST_RESULTS_FLAGS=flag1,flag2` to override the default local flags.

## TDD Workflow

When possible, the default loop should be:

1. Identify the intended behavior or the bug.
2. If the behavior is non-trivial or externally visible Semantic Flow behavior, write or update an `sf.spec.*` note first.
3. Add a failing test at the narrowest useful scope.
4. Implement the smallest change that makes the test pass.
5. Refactor while keeping tests green.
6. If the behavior changed materially, update the relevant spec/task/decision notes before closing the work.

For bug fixes, prefer a regression test that reproduces the bug before the code fix.

For new features, prefer:

- unit-first when the core behavior is local and well-bounded
- integration-first when the meaningful behavior only appears across subsystem boundaries

## Spec-Driven Testing

Weave uses Semantic Flow Framework `sf.spec.*` notes as behavior specs that drive tests.

Use an `sf.spec.*` note when:

- the behavior is externally visible or cross-cutting
- the behavior spans multiple files or subsystems
- the expected result is easier to state as observable behavior than as internal implementation detail
- the resulting tests are likely to be black-box or integration-style

A good `sf.spec.*` note should clarify:

- what the operation or behavior does
- what it does not do
- key invariants
- artifact placement or output expectations
- major edge cases and non-goals

Those notes may later drive:

- integration tests
- black-box functional tests
- Accord manifests or other acceptance-level checks

If an `sf.spec.*` note and executable tests disagree, do not let them silently drift. Resolve the contradiction explicitly.

## When Test-After Is Acceptable

TDD is preferred, but test-after work is acceptable when the task is genuinely exploratory.

Typical examples:

- proving out a third-party library
- exploratory RDF or filesystem interop work
- scaffolding that is likely to be reshaped immediately
- one-off diagnostic tooling

Even then:

- record the outcome in notes if it changes architectural direction
- add executable tests before considering the behavior settled

## Weave-Specific Priorities

Tests should focus especially on the things most likely to regress in Weave:

- semantic operation boundaries
- current-vs-historical artifact invariants
- filesystem placement rules
- RDF parsing, equivalence, and validation behavior
- page-generation output contracts
- daemon job behavior and failure handling
- local vs remote CLI parity where practical
- Accord-backed acceptance parity against curated fixtures where practical

## Practical Bias

When choosing between two possible tests, prefer the one that:

- would have caught a realistic regression
- constrains behavior rather than implementation trivia
- is cheap enough that people will keep running it
- fails with useful signal when something actually breaks
