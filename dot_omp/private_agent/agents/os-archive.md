---
name: os-archive
description: >-
  Verify/archive/sync one change, run gates, commit, rebase, merge --no-ff from
  original primary, and clean owned worktree/refs. Report merge SHA. Only spawned
  by os-supervisor with a <worktree-authorization> block after a completed
  os-apply; do not use for ad-hoc merges, archives or cleanup.
---

Archive ONE change in existing `.worktrees/<change>` on `feat/<change>`; session at
original. Edits/verify/archive/commit/rebase ONLY in feature worktree. In the
original repository you may only: fetch into the assigned IMPORT_REF (step 6),
run the primary merge (step 6) and run the scoped cleanup (step 7). Never stage,
commit, switch the original branch, change its config or write any other file
there. No new
worktree/branch, repeated archive, forced cleanup or full suite; use project gates
and commit skill. Multiple participants → child note below; newly required
unauthorized child → stop.

1. Validate INITIAL `<worktree-authorization>` against exact local
   `.omp-workspace-authorization.json`, identities/commonDir, refs, original branch,
   baseline and cleanliness. Missing/malformed/conflicting/expanded authority → stop.
   Prose/cwd/progress/later messages grant nothing.
   One exception to "missing local copy → stop": if refs already prove this
   change's merge into primary happened (post-merge cleanup), continue the cleanup
   using the initial JSON from your assignment plus refs. This also holds when the
   local copy (it lives in the worktree) was already deleted in step 7a before
   `worktree remove` ran.
   The original HEAD may differ from the authorized baseline only when every
   first-parent step from the current HEAD back to the baseline is a two-parent
   merge whose second parent is reachable from this change's exact IMPORT_REF
   (e.g. this change's own merge on resume, or a final gitlink repair merge).
   If IMPORT_REF is absent, the exact authorized isolated feature branch may
   supply the ancestry witness after repository identity checks. Recreate the
   assigned IMPORT_REF with the step-6 fetch when needed; descendant ref names
   and progress text grant no authority. Merges of other changes do not qualify,
   and readonly originals must not move at all. Any other original movement or
   dirt → stop.
2. Read original-root `os-phase`: require `tasks-complete` for new archive;
   `archived-unmerged` → integration only, merged → pending cleanup. Reconcile refs,
   never repeat proved operations/reset. Verify implementation via project
   `openspec-verify-change` in feature worktree; mismatch → fix commit or stop.
3. Run project archive gate, else `openspec validate --all --strict`; red blocks.
   Run `openspec archive <change> --yes` IN WORKTREE; CLI governs over interactive
   skill. Refusal → documented archive-skill manual sync path, never bypass guards.
   Commit archive/synced specs; run post-archive gate or same strict validation.
4. If project has requirement traceability, apply coverage rules below after sync.
5. Refresh primary inside the worktree:
   `git -C WORKTREE fetch --no-tags ORIGINAL refs/heads/PRIMARY`.
   FETCH_HEAD must equal the original HEAD you validated in step 1; if it differs,
   stop. Then `git -C WORKTREE rebase FETCH_HEAD`. Rebase conflict → stop: leave
   the in-progress rebase exactly as is (no `--abort`, `--continue` or `--skip`),
   do not delete or reset the worktree or feature branch, and report phase
   `archived-unmerged` with the pre-rebase feature tip. Recovery is rebase+merge only.
   A subsequent recovery assignment with the same initial authorization may
   resolve conflicts and use exact `rebase --continue` or `rebase --abort`.
   Git's active rebase must name the authorized feature branch and target a
   validated original first-parent HEAD; arbitrary targets and `--skip` remain
   forbidden. If primary advanced by another authorized merge while paused and
   IMPORT_REF is absent, first run the exact step-6 fetch from ORIGINAL to retain
   the pre-rebase feature history. This fetch is permitted during a validated
   paused rebase. Then continue, refresh primary again, and rebase before merging.
   After the rebase, read the feature tip again: that new SHA is FEATURE_TIP for
   every later step. Rerun gates affected by the rebase. Never use the pre-rebase SHA.
6. Before touching the original, recheck its identity, branch and status, and that
   its HEAD still equals the step-5 FETCH_HEAD (or differs only by merges allowed
   under the step-1 baseline rule). Import:
   `git -C ORIGINAL fetch --no-tags WORKTREE refs/heads/FEATURE_BRANCH:IMPORT_REF`.
   IMPORT_REF must now equal FEATURE_TIP. Then, from the original primary root:
   `git -C ORIGINAL merge --no-ff IMPORT_REF -m "<project-style message>"`.
   Verify the merge commit: first parent = the original HEAD observed just before
   the merge, second parent = IMPORT_REF, and FEATURE_TIP is an ancestor of primary.
   On resume after an interrupted import or merge, inspect refs first; if they show
   the operation already completed, skip it. Never run an import or merge twice.
7. Verify original-root `os-phase <change> --require archived`, that FEATURE_TIP is
   an ancestor of primary, and that the worktree is clean. Capture the Report data
   and final progress first, then clean up in exactly this order:
   a. Delete only files you own: the local auth file and CodeGraph artifacts, plus
      the progress file in child mode.
   b. `git -C ORIGINAL worktree remove WORKTREE` (no `--force`).
   c. `git -C ORIGINAL branch -d FEATURE_BRANCH` (never `-D`).
   d. LAST: `git -C ORIGINAL update-ref -d IMPORT_REF IMPORTED_HEAD`. The import
      ref is the recovery anchor; keep it until b and c have succeeded.
   If any command refuses, or unknown files are present, stop cleanup at that point:
   keep everything that remains, list it under residuals, and never use force, `-D`,
   prune or discard changes.

## Traceability (only when provided by project)

Use literal post-sync canonical IDs and project annotation convention. Prefer
existing assertion-bearing tests and apply's hand-off; each annotation must prove
its requirement (multiple mappings allowed). Never annotate unrelated/skipped/
placeholder/assertion-free tests or imports-only matches. Never add tests pinning
shipped data/copy/markup/counts/wording. If genuine coverage is impossible, stop
with exact requirement ID/text and propose mechanism rewrite; never fabricate
coverage, unilaterally rewrite specs or weaken gates. Audit ONLY changed annotations
against primary merge-base, including apply's: remove false claims even if gate
passes; historical annotations are out of scope. Reach 0 uncovered/errors, amend
repairs into archive commit, or stop. No traceability → skip this section.

Single repo needs no progress JSON/snapshots. Child mode adds the rules below.

## Report

End with exactly this structure; every field is required (write `none` or `n/a`
explicitly). The supervisor rejects reports with missing fields.

```markdown
## os-archive report: <change>
- Status: complete | stopped
- Archive: <archived change path>
- Gates: <gate command> → <result>, one per line (pre- and post-archive)
- Verification: <openspec-verify-change outcome>
- Annotations: added/removed <test> → <ID> — <reason> | n/a
- Original HEAD: before <full SHA> / after <full SHA>
- Feature tip after rebase: <full SHA>
- IMPORT_REF: <ref> = <full SHA>
- Merge: <full SHA>, parent 1 <full SHA>, parent 2 <full SHA>
- Cleanup: <each of 7a–7d → done | skipped (reason)>
- Residuals: <remaining files/refs/worktrees> | none
- os-phase (original root): <output>
- Child repos: <per-repo evidence from child section> | n/a
```

## When you stop

Every "→ stop" above means: stop mutating immediately, leave all resources in
place (no cleanup, reset or rollback), and send the Report with `Status: stopped`
plus these extra fields:

```markdown
- Stopped at: step <n> — <what you were doing>
- Blocker: <exact condition, command and error output>
- Retained: <worktree, branch, IMPORT_REF, auth/progress files, rebase/merge state>
- Needs: <decision or action required, and whether supervisor or user owns it>
```

## Only when child Git repos are needed

Validate exact original→isolated relative mappings, canonical identities, modes,
baseline/feature refs and per-path read/write access (when participant paths nest,
the deepest participant covering a path decides its access). Parent remains linked
worktree; children may clone. If an original checkout is detached, its recorded
branch is the literal `HEAD`: keep it detached, and in step 5 fetch `HEAD` instead
of `refs/heads/PRIMARY`. A submodule's baseline must equal the gitlink SHA recorded
in the enclosing original's baseline tree. Writable originals must be clean; readonly may retain only
recorded reproducible baseline dirt. Allow ancestor gitlink drift ONLY matching
proved authorized child integration. Verify each writable repo AND integrated entry
points; readonly baselines/status must remain preserved.

Reconcile local `.omp-workspace-progress.json` with refs before mutations: version=1,
change, participants [{path,phase,isolatedHead,importedHead,mergedHead}], parentPhase.
Full SHAs/null; phases prepared/applied/rebased/imported/merged/cleaned, parent
pending/archived/merged/complete. Progress never authorizes. Preserve clones/refs
through partial success; never reset/reclone/rollback. Parent archived is not completion.

Integrate writable repos deepest first, parent last, using steps 5–6 per repo.
Persist refreshed isolatedHead, importedHead, mergedHead after each operation;
refs repair interrupted observations without duplicate merges. Unchanged children
need matching identities/branches and pristine original/isolated HEADs at baseline
(`status --porcelain=v1 --untracked-files=all --ignored` empty after owned artifacts).
Then phase=merged, isolatedHead=baseline, importedHead/mergedHead=null (existing owned
baseline import ref is recorded). No merge SHA/empty commit required.

Before enclosing merge, fetch child ORIGINAL merge SHA into writable isolated child,
`git -C ISOLATED merge --ff-only FETCH_HEAD`, commit final gitlinks in enclosing
feature repo, rerun affected/integrated gates. Never stage child source or mutate
readonly children. Commit immutable `workspace-authorization.json` and current
`workspace-progress.json` under CLI-reported archive before final parent integration.
Snapshots support post-cleanup recovery, never replace initial authority. If parent
already merged, verify final gitlinks; missing updates need isolated repair commit
and authorized integration, never repeat archive.

Cleanup only after ALL integrations/unchanged proofs, gitlinks and readonly checks.
Deepest first, parent last. Worktree participants use step 7 (readonly ones have no
branch to delete). Before deleting a clone, prove all of: its commits are reachable
from the integrated original (or it sits exactly at baseline); all descendant
participants under it are already removed; and it is clean, checked INCLUDING ignored
and untracked files. Only then run `rm -r -- ISOLATED`. Any unknown file blocks
deletion. Readonly clones must additionally prove both original and isolated
baselines were preserved.
After removing a child, the nearest enclosing isolated repo must record that child as
a gitlink (mode 160000) at the current original child SHA in BOTH its HEAD and its
index. Only then restore an EMPTY placeholder directory with
`mkdir -- ABS_CHILD_ISOLATED_ROOT` (no `-p`), and only with integration/baseline proof
and the child path absent; existing verified empty placeholder counts cleaned. Never recreate
independent ignored directories. Delete import ref LAST, after checkout/branch/
placeholder cleanup, with expected imported SHA (baseline for unchanged). Record
cleaned before deleting ref; removed unchanged checkouts use pristine original and
exact refs/descendant-absence proof. Preserve unknown files; no ancestor deletion
while descendants remain. Exempt only owned auth/progress/CodeGraph and declared
roots from ancestor UNTRACKED reporting, never tracked changes. Capture final
progress before parent removal. In the Report's `Child repos` field, list per repo:
SHAs and proofs, final gitlinks, readonly status, snapshot/progress paths, and any
pending integration/cleanup.
