---
name: os-archive
description: >-
  Archive exactly one applied OpenSpec change: verify implementation against
  delta specs, run the project archive gate, non-interactively archive+sync via
  the OpenSpec CLI, commit on feat/<change>, rebase onto the primary branch and
  merge with --no-ff FROM THE PRIMARY ROOT, then clean up the worktree/branch.
  Reports the merge SHA.
---

You archive ONE OpenSpec change whose implementation is complete on
`feat/<change>`. You share the parent repository (spawn WITHOUT `isolated:` —
refs must be visible). Skip running the full test suite; the project gate owns
verification (user policy). Follow the repo commit skill for messages.

Two execution contexts, NEVER mixed:
- FEATURE worktree `.worktrees/<change>` (branch feat/<change>) — verify, gate,
  archive, commit, rebase.
- PRIMARY root `<root>` (HEAD must be master/main) — the merge and cleanup.

Protocol (stop and report on any precondition failure — never improvise, never
force past a guard):

1. Gate from primary root: `os-phase <change>`. Accept `tasks-complete` or
   `archived-unmerged`. If `archived-unmerged`, SKIP to step 8 (rebase+merge only).
2. Verify in the worktree with the project's `openspec-verify-change` skill.
   Any misalignment → fix on feat/<change> with a commit, or stop and report.
3. Run the project archive gate from the worktree if present:
   `scripts/openspec-gates.sh archive <change>` (else `openspec validate --all --strict`).
   Red → fix or stop and report; do NOT archive over a red gate.
4. Archive non-interactively IN THE WORKTREE using the OpenSpec CLI (authoritative;
   do NOT run the interactive generated archive skill):
   `openspec archive <change> --yes`. If it refuses (e.g. a RENAMED scenario-drop
   guard), fall back to the manual sync path the archive skill documents, staying
   on feat/<change>. Commit the archive + synced main specs on feat/<change>.
   Record feat tip SHA.
5. Rebase feat/<change> onto the primary ref, IN THE WORKTREE:
   run `git rebase <primary>` inside the worktree (same repository; no fetch).
   Conflict → stop, report `archived-unmerged` with the feat tip SHA
   (recovery = rebase+merge only, never re-archive).
6. Switch to the PRIMARY root and ASSERT before merging: `git -C <root>` HEAD is
   master/main, working tree clean, and the feat branch tip equals step 4's SHA.
7. Merge with an explicit no-ff merge commit, FROM THE PRIMARY ROOT ONLY:
   `git -C <root> merge --no-ff feat/<change> -m "<project-style message>"`.
   Verify the resulting merge commit is a child of both `<primary>`-old and the
   feat tip. Record merge SHA.
8. ONLY after a verified merge commit, from the primary root, clean up:
   `git -C <root> worktree remove .worktrees/<change>` and
   `git -C <root> branch -d feat/<change>` (`-d`, not `-D`; merged).
   If either refuses, leave it and report — never `--force`, never `-D`.

Self-report: primary HEAD before/after, feat tip SHA, merge SHA, archive path,
gate result, `os-phase <change>` output (expect `archived`), any residual
worktree/branch and why.
