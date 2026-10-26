---
name: os-archive
description: >-
  Archive exactly one applied OpenSpec change: verify implementation against
  delta specs, run the project archive gate, non-interactively archive+sync via
  the OpenSpec CLI, run the post-sync gate and — when the project ships a
  requirement-traceability lint — repair uncovered requirements,
  commit on feat/<change>, rebase onto the primary branch and merge with --no-ff
  FROM THE PRIMARY ROOT, then clean up the worktree/branch. Reports the merge
  SHA.
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
   `archived-unmerged` (the latter → jump to step 6, rebase+merge only).
2. Verify in the worktree with the project's `openspec-verify-change` skill;
   misalignment → fix commit on feat/<change>, or stop.
3. Project gate from the worktree if present: the repository's own archive gate
   script, else `openspec validate --all --strict`. Red → fix or stop; never
   archive red.
4. Archive non-interactively IN THE WORKTREE via the CLI (authoritative; not
   the interactive generated skill): `openspec archive <change> --yes`; if it
   refuses (e.g. RENAMED-drop guard), use the manual sync path the archive skill
   documents. Commit archive + synced specs on feat/<change>; record feat tip.
5. Post-sync gate from the worktree: the repository's own post-archive gate
   script, else `openspec validate --all --strict`.
   IF the project ships a requirement-traceability design — canonical
   requirement IDs plus a coverage lint that fails on uncovered requirements —
   follow it here; it is authoritative:
   - The sync just put this change's own requirements into `openspec/specs/`,
     so uncovered requirements surface now. This step, not apply, is where
     annotation belongs: a delta requirement ID does not exist before sync, so
     never write one earlier.
   - Take literal IDs from the repository's traceability tool and apply whatever
     coverage-annotation mechanism the project defines (test decorator, registry
     entry, manifest — read its convention first) to discoverable test functions
     that substantively establish each clause; one requirement may need several
     annotations. Never annotate an unrelated, skipped, placeholder, or
     assertion-free test, and never annotate a test whose only relevance is that
     it imports the same module.
   - Prefer existing assertion-bearing logic tests. NEVER add a test whose
     purpose is to pin shipped data, copy, markup, counts or wording.
   - If an uncovered requirement could only be covered that way, it is an
     unshaped requirement from the proposal: stop, report its exact ID and
     wording, and propose a mechanism-level rewrite. Do not fabricate coverage,
     do not rewrite the synced main spec unilaterally, and do not touch the gate.
   - Re-run until 0 uncovered / 0 errors, amending the repairs into the step 4
     archive commit on feat/<change>. Never weaken or bypass the gate; cannot
     satisfy → stop and report.
   IF the project ships no such design, skip the annotation repair, keep the
   post-sync gate result, and say so in the report.
6. Rebase onto the primary ref IN THE WORKTREE: `git rebase <primary>`.
   Conflict → stop, report `archived-unmerged` + feat tip (recovery =
   rebase+merge only).
7. From the PRIMARY root, assert before merging: HEAD is master/main, tree
   clean, feat tip equals step 4's SHA. Then
   `git -C <root> merge --no-ff feat/<change> -m "<project-style message>"`.
   Verify the merge commit parents; record merge SHA.
8. Clean up from the primary root ONLY after that verification:
   `git -C <root> worktree remove .worktrees/<change>`;
   `git -C <root> branch -d feat/<change>`. Refusal → leave it and report.
   Never `--force`, never `-D`.

Report: primary HEAD before/after, feat tip SHA, merge SHA, archive path, gate
results (pre-archive + post-sync, including any requirement left uncovered and
why), the exact coverage annotations made, `os-phase <change>` (expect
`archived`), any residual worktree/branch.
