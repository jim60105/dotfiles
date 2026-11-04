---
name: os-propose
description: >-
  Propose workday-sized OpenSpec changes, critique/validate, commit artifacts on
  primary, and report dependency/conflict matrix. Planning only.
blocking: true
spawns: rubber-duck
---

Planning ONLY. Follow project `openspec-propose`; resolve artifacts through CLI.
Commit only `openspec/changes/<change>/` on named primary via project commit skill;
never create branches/worktrees, implement, merge/rebase/archive. Conflicting
assignment or unrelated dirty tree → stop. Default single repo; only when a child
Git repo is needed for development/build/verification/archive, read
the child note below. Ordinary folders need no inventory; planning grants no child
mutation authority.

1. Pre-release unless stated otherwise: no compatibility layers/migrations.
   Size each change to one engineer-day, grounded in existing code/tests/config.
2. Requirements must be test-establishable mechanisms, not human-judged qualities.
   Put tone/polish/fidelity review in design's named review document, identify it
   as human-reviewed in proposal. Requirement body <500 characters: short SHALL,
   details in scenarios. No executable behavior change → at most the mechanism
   already covered by genuine parsing/schema/component tests; no invented second
   behavior requirement. Never require tests pinning shipped data/copy/markup/
   counts/wording. Traceability projects give no archive waiver for untestable specs.
3. Write explicit design/tasks for weak workers: exact file/symbol boundaries and
   non-goals, verbatim contracts, concrete approach, real dependency order, runnable
   acceptance commands/expected state. No generic exploration tasks or inferred intent.
4. Several changes → each proposal has `## Batch:` with `depends-on: <change>`
   lines and code-conflict notes. One change-directory-scoped commit per change.
5. Complete set → ONE blocking self-contained rubber-duck critique; fix blockers
   with follow-up commits. Run `openspec validate <change> --strict` per change;
   warnings fail: fix requirement shape, never weaken validation.

Report each name/scope/commit SHAs, original-root `os-phase` (expect `proposed`),
dependency/conflict matrix, requirement rewrites/reasons and duck outcome.

## Only when child Git repos are needed

In existing change artifacts, inventory required repos (including ignored/readonly):
canonical roots/commonDirs, exact relative paths, primary/baseline/status, access,
clone/worktree mode, per-repo/integrated gates and deepest-first integration back
to originals. Parent stays linked `.worktrees/<change>`; children occupy exact
original relative paths, not symlinks to originals. Deepest readonly wins.
Detached originals use branch HEAD/current SHA; submodule baselines must match
enclosing original baseline-tree gitlinks, including readonly deps. Missing/mismatched
inventory blocks apply; supervisor validates before immutable authorization.
Identify enclosing gitlink commits and final child SHA ownership. Parent phase is
not child integration evidence; unchanged children need pristine baseline proof,
not fake commits. No multi-repo records for ordinary single-repository changes.
