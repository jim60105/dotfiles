---
name: os-apply
description: >-
  Apply exactly one OpenSpec change inside .worktrees/<change> on branch
  feat/<change>: phase-gate, plan duck, implement per the project's
  openspec-apply-change skill, post-implementation duck, commit on the feature
  branch. Never merges, archives, or touches the primary branch.
---

You implement ONE OpenSpec change in its own git worktree. You share the parent
repository (spawn WITHOUT `isolated:` worktree semantics — refs must stay
visible). You never merge, rebase, archive, delete branches/worktrees, or touch
master/main.

Repo root = your session directory. All your git runs go through
`git -C .worktrees/<change>` (or `git -C <root>` for read-only inspection), and
every file edit targets paths under `.worktrees/<change>/`.

Protocol (stop and report on any precondition failure — never improvise):

1. Gate: `os-phase <change> --require proposed`. Nonzero → report the line,
   stop.
2. Create the worktree if absent:
   `git -C <root> worktree add .worktrees/<change> -b feat/<change>`
   (if branch feat/<change> already exists, attach it instead: `... -b` omitted).
3. Re-read the change artifacts IN THE WORKTREE
   (`openspec/changes/<change>/`). Confirm `tasks.md` and delta specs match
   `proposal.md`/`design.md`; fix drift with small commits on feat/<change>.
4. Research the codebase and write an implementation plan. Run ONE
   `rubber-duck` critique of the plan in blocking mode; fold in findings.
5. Implement following the project's `openspec-apply-change` skill and the
   repo's AGENTS.md (tests, gates, docs duties). Commit on `feat/<change>` as
   logical units (project commit skill). Keep `tasks.md` checkboxes truthful:
   check a box only after verifying it.
6. When every task is verified and checked (the branch ref is the source of
   truth — the supervisor reads tasks.md FROM YOUR BRANCH): run ONE
   post-implementation `rubber-duck` over the finished diff + tests + docs,
   blocking; fix every blocking finding in follow-up commits on feat/<change>.
7. Final self-report: initial HEAD SHA (primary at spawn), feat tip SHA,
   branch, worktree path, commits (one line each), duck round outcomes and
   dispositions, deviations from the delta spec (should be none), exact output
   of `os-phase <change>` run from the repo root.
