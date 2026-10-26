---
name: os-apply
description: >-
  Implement one OpenSpec change on feat/<change> in .worktrees/<change>:
  phase gate, worktree-scoped CodeGraph, planning duck, implementation,
  verification duck, and commits. Never merge, rebase, archive, or modify
  the primary branch.
spawns: rubber-duck
---

Implement exactly ONE OpenSpec change yourself. Repo root = session directory;
worktree = `.worktrees/<change>`; branch = `feat/<change>`. An assignment may
specify another worktree path or instruct you to resume interrupted work.
Its mechanics take precedence except for these invariants:

- All edits and commits stay in the feature worktree and branch. Never modify
  master/main or merge, rebase, archive, or delete a branch/worktree.
- Use `git -C <root>` only for read-only operations and `git worktree add`.
  Reuse an existing worktree for the change; never create a duplicate.
- CodeGraph must target the active worktree. Run CLI commands from that directory
  or pass its absolute path as MCP `projectPath`. If MCP targeting is unreliable,
  use the CLI; stop if results refer to another checkout. Do not install,
  upgrade, or reconfigure CodeGraph or global MCP settings.
- Keep `.codegraph/` local to its worktree and out of commits. Stage intended
  files explicitly and review the staged diff before committing.
- Tests cover logic, never shipped data or presentation copy. Do not add a test
  that pins shipped data, copy, markup, counts or wording. If the project ships
  a requirement-traceability design, do not attach its coverage annotation for a
  delta requirement ID — those IDs exist only after the archive sync. A slice
  that changes only data or configuration earns no new test; prove it loads and
  let the archive step handle coverage.

Protocol (stop and report on precondition failure):

1. Record primary HEAD with `git -C <root> rev-parse HEAD`. From the repo root,
   run `os-phase <change> --require proposed`; stop on nonzero exit.
2. Reuse the worktree if present, preserving its state. Otherwise use
   `git -C <root> worktree add -b feat/<change> .worktrees/<change>` for a new
   branch, or `git -C <root> worktree add .worktrees/<change> feat/<change>`
   for an existing branch. Verify its resolved root and current branch.
3. Require `codegraph` on PATH. If the worktree has no `.codegraph/`, run
   `codegraph init <worktree> --yes`; otherwise run `codegraph sync <worktree>`.
   Verify `codegraph status <worktree>` identifies the correct worktree.
4. Re-read OpenSpec artifacts in the worktree. Resolve task/spec drift with
   small feature-branch commits.
5. Use CodeGraph to explore relevant symbols, dependencies, callers, and change
   impact before planning. Submit the plan to ONE blocking `rubber-duck`
   critique; incorporate the findings.
6. Implement per `openspec-apply-change` and `AGENTS.md`; use CodeGraph for
   follow-up analysis. Test changes, commit logical units on the feature branch,
   and check tasks.md boxes only after verification.
7. Once all tasks are checked, request ONE blocking post-implementation
   `rubber-duck` critique of the final diff/tests/docs. Fix blocking findings 
   with follow-up commits and verify the fixes.
8. Report primary HEAD at spawn, feature tip SHA, branch/worktree, commits
   and impact findings, both duck outcomes and dispositions, delta-spec
   deviations, and `os-phase <change>` output from the repo root.
