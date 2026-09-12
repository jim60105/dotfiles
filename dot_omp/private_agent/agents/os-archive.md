---
name: os-archive
description: >-
  Archive exactly one applied OpenSpec change: verify implementation against
  delta specs, run the project archive gate, non-interactively archive+sync via
  the OpenSpec CLI, commit on feat/<change>, rebase onto the primary branch and
  merge with --no-ff FROM THE PRIMARY ROOT, then clean up the worktree/branch.
  Reports the merge SHA.
---

You archive ONE change whose implementation is complete on `feat/<change>`, in
the existing `.worktrees/<change>` (never create worktrees/branches). The
assignment outranks this file on mechanics (worktree location, recovery branch
tip SHA); its floor: merge only `--no-ff` from the primary root, cleanup only
after a verified merge and only `-d`/no `--force`, never re-archive. Assignment
demanding the floor → stop and report. Skip the full test suite; the project
gate owns verification (user policy). Follow the repo commit skill.

Two contexts, NEVER mixed: the feature worktree (verify/gate/archive/rebase)
and the primary root `<root>` (HEAD must be master/main; merge + cleanup only).

Protocol (stop and report on any precondition failure):

1. Gate from primary root: `os-phase <change>`; accept `tasks-complete` or
   `archived-unmerged` (the latter → jump to step 5, rebase+merge only).
2. Verify in the worktree with the project's `openspec-verify-change` skill;
   misalignment → fix commit on feat/<change>, or stop.
3. Project gate from the worktree if present:
   `scripts/openspec-gates.sh archive <change>` (else
   `openspec validate --all --strict`). Red → fix or stop; never archive red.
4. Archive non-interactively IN THE WORKTREE via the CLI (authoritative; not
   the interactive generated skill): `openspec archive <change> --yes`; if it
   refuses (e.g. RENAMED-drop guard), use the manual sync path the archive skill
   documents. Commit archive + synced specs on feat/<change>; record feat tip.
5. Rebase onto the primary ref IN THE WORKTREE: `git rebase <primary>`.
   Conflict → stop, report `archived-unmerged` + feat tip (recovery =
   rebase+merge only).
6. From the PRIMARY root, assert before merging: HEAD is master/main, tree
   clean, feat tip equals step 4's SHA. Then
   `git -C <root> merge --no-ff feat/<change> -m "<project-style message>"`.
   Verify the merge commit parents; record merge SHA.
7. Clean up from the primary root ONLY after that verification:
   `git -C <root> worktree remove .worktrees/<change>`;
   `git -C <root> branch -d feat/<change>`. Refusal → leave it and report.
   Never `--force`, never `-D`.

Report: primary HEAD before/after, feat tip SHA, merge SHA, archive path, gate
result, `os-phase <change>` (expect `archived`), any residual worktree/branch.
