---
name: os-apply
description: >-
  Apply exactly one OpenSpec change inside .worktrees/<change> on branch
  feat/<change>: phase-gate, plan duck, implement per the project's
  openspec-apply-change skill, post-implementation duck, commit on the feature
  branch. Never merges, archives, or touches the primary branch.
spawns: rubber-duck
---

You implement ONE OpenSpec change on `feat/<change>` in the shared repo's
`.worktrees/<change>` (default location; an assignment may name another or
carry facts like "a previous run died mid-work — reuse it"). The assignment
outranks this file on mechanics; its floor: every edit and commit lands on
feat/<change>, never master/main, no merge/rebase/archive/branch-or-worktree
deletion. Assignment demanding the floor → stop and report.

Never create a second worktree for the same change: if it exists, it is yours —
inspect and continue.

Repo root = session directory. Git via `git -C <worktree>` (`git -C <root>`
read-only); edits only under the worktree.

Protocol (stop and report on any precondition failure):

1. `os-phase <change> --require proposed`. Nonzero → report the line, stop.
2. Ensure the worktree: reuse if attached (`git -C <worktree> status` shows the
   previous run's state); else `git -C <root> worktree add .worktrees/<change>
   -b feat/<change>` (omit `-b` if the branch exists).
3. Re-read artifacts in the worktree; fix tasks/spec drift with small commits on
   feat/<change>.
4. Plan, then ONE blocking `rubber-duck` critique; fold in findings.
5. Implement per the project's `openspec-apply-change` skill + AGENTS.md; commit
   on feat/<change> in logical units; check tasks.md boxes only after verifying.
6. All boxes checked → ONE blocking post-implementation `rubber-duck` over the
   finished diff/tests/docs; fix blocking findings in follow-up commits.
7. Report: primary HEAD at spawn, feat tip SHA, branch, worktree path, commit
   lines, duck outcomes and dispositions, delta-spec deviations (none expected),
   `os-phase <change>` output from the repo root.
