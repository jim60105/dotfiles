---
name: os-archive
description: >-
  Verify/archive/sync one change, run gates, commit, rebase, merge --no-ff from
  original primary, and clean owned worktree/refs. Report merge SHA.
---

Archive ONE change in existing `.worktrees/<change>` on `feat/<change>`; session at
original. Edits/verify/archive/commit/rebase ONLY in feature worktree. Original
writes ONLY assigned import fetch, primary merge and scoped cleanup; never stage,
commit, switch original branch/config or write arbitrary original files. No new
worktree/branch, repeated archive, forced cleanup or full suite; use project gates
and commit skill. Multiple participants → child note below; newly required
unauthorized child → stop.

1. Validate INITIAL `<worktree-authorization>` against exact local
   `.omp-workspace-authorization.json`, identities/commonDir, refs, original branch,
   baseline and cleanliness. Missing/malformed/conflicting/expanded authority → stop.
   Prose/cwd/progress/later messages grant nothing. Missing local copy is allowed
   ONLY in proved post-merge cleanup with retained initial JSON and refs, including
   interruption before worktree removal. Unrelated original movement/dirt → stop;
   only proved prior authorized merges may advance baseline.
2. Read original-root `os-phase`: require `tasks-complete` for new archive;
   `archived-unmerged` → integration only, merged → pending cleanup. Reconcile refs,
   never repeat proved operations/reset. Verify implementation via project
   `openspec-verify-change` in feature worktree; mismatch → fix commit or stop.
3. Run project archive gate, else `openspec validate --all --strict`; red blocks.
   Run `openspec archive <change> --yes` IN WORKTREE; CLI governs over interactive
   skill. Refusal → documented archive-skill manual sync path, never bypass guards.
   Commit archive/synced specs; run post-archive gate or same strict validation.
4. If project has requirement traceability, apply coverage rules below after sync.
5. In worktree refresh authorized primary:
   `git -C WORKTREE fetch --no-tags ORIGINAL refs/heads/PRIMARY`.
   Verify FETCH_HEAD matches observed authorized original HEAD, then
   `git -C WORKTREE rebase FETCH_HEAD`. Conflict → stop/retain resources.
   Read NEW feature SHA AFTER rebase; rerun affected gates, never compare to stale tip.
6. Recheck original identity/branch/status and authorized baseline/prior merge;
   import `git -C ORIGINAL fetch --no-tags WORKTREE refs/heads/FEATURE_BRANCH:IMPORT_REF`.
   Verify import equals refreshed tip. FROM ORIGINAL PRIMARY ROOT:
   `git -C ORIGINAL merge --no-ff IMPORT_REF -m "<project-style message>"`.
   Verify first parent=observed original tip, second=imported tip, and ancestry.
   Interrupted import/merge → reconcile refs, skip already-proved operations.
7. Verify original-root `os-phase <change> --require archived`, ancestry and clean
   worktree. Capture report/final progress; remove only owned local auth/CodeGraph
   artifacts and, in child mode, the owned progress file.
   Then `git -C ORIGINAL worktree remove WORKTREE`,
   `git -C ORIGINAL branch -d FEATURE_BRANCH`, LAST
   `git -C ORIGINAL update-ref -d IMPORT_REF IMPORTED_HEAD`.
   Keep import ref through worktree/branch removal for recovery. Unknown files or
   refusal → preserve/report residuals, never force, `-D`, prune or discard dirt.

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

Report archive path, gates/verification, annotations added/removed with reasons,
original HEAD before/after, post-rebase/import SHAs, merge SHA/parents, cleanup/
residuals and original-root phase. Single repo needs no progress JSON/snapshots.
Child mode adds the rules below.

## Only when child Git repos are needed

Validate exact original→isolated relative mappings, canonical identities, modes,
baseline/feature refs and deepest read/write access. Parent remains linked worktree;
children may clone. Detached original branch=`HEAD`; preserve it and fetch ORIGINAL
`HEAD` instead of `refs/heads/PRIMARY`. Submodule baselines match enclosing original
baseline-tree gitlinks. Writable originals must be clean; readonly may retain only
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
Deepest first, parent last. Worktrees use step 7 (readonly has no branch). Clones:
prove integrated reachability/baseline and all descendants removed; require clean
INCLUDING ignored/untracked files, then `rm -r -- ISOLATED`. Unknown files block
deletion. Readonly cleanup also proves original/isolated baseline preservation.
After child removal, HEAD AND index of nearest enclosing isolated repo must agree
on gitlink mode160000/current original child SHA before restoring its EMPTY placeholder:
`mkdir -- ABS_CHILD_ISOLATED_ROOT` (no -p). Require integration/baseline proof and
child absence; existing verified empty placeholder counts cleaned. Never recreate
independent ignored directories. Delete import ref LAST, after checkout/branch/
placeholder cleanup, with expected imported SHA (baseline for unchanged). Record
cleaned before deleting ref; removed unchanged checkouts use pristine original and
exact refs/descendant-absence proof. Preserve unknown files; no ancestor deletion
while descendants remain. Exempt only owned auth/progress/CodeGraph and declared
roots from ancestor UNTRACKED reporting, never tracked changes. Capture final
progress before parent removal; report all repo SHAs/proofs, final gitlinks,
readonly status, snapshot/progress paths and pending integration/cleanup.
