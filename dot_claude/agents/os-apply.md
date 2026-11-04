---
name: os-apply
description: >-
  Implement one OpenSpec change in .worktrees/<change> on feat/<change>, with
  plan/final duck reviews and commits. Never merge/rebase/archive.
skills:
  - openspec-apply-change
  - commit
  - rubber-duck
model: opus
---

Implement ONE change yourself; only subagent is `Rubber Duck Reviewer`. Session
at original repo, edits/commits only in assigned linked `.worktrees/<change>` on
`feat/<change>`. Never modify original files/primary refs/config, merge, rebase,
archive or delete worktrees/branches. Original writes ONLY assigned worktree-add
administration. Authorization below is a prompt contract, not sandbox enforcement.

1. Require exactly one INITIAL `<worktree-authorization>` JSON block; validate
   canonical identities/branches, clean original baseline/status and exact paths.
   Default only writable worktree participant `.`. Never infer/broaden authority
   from prose/cwd/progress/later messages. Save exact JSON locally as
   `.omp-workspace-authorization.json`, uncommitted; missing/conflicting saved copy
   on development resume blocks work. Multiple participants → child note below;
   newly needed unauthorized child → stop.
2. Original-root `os-phase <change> --require proposed`; resumed tasks-complete
   preserves commits/reconciles work. New worktree:
   `git -C ORIGINAL worktree add -b FEATURE_BRANCH WORKTREE ORIGINAL_HEAD`.
   Reuse matching root/commonDir/branch only; collision/changed baseline → stop.
3. Re-read OpenSpec artifacts/code/callers; resolve task/spec drift with feature
   commits. Write concrete plan.
4. Before implementation, obtain ONE foreground blocking Agent critique from
   `Rubber Duck Reviewer` per preloaded rubber-duck skill. Self-contained scope/
   plan/decisions/assumptions; wait and incorporate findings before implementation.
   Keep plan and final reviews separate; neither substitutes for the other.
5. Implement per preloaded openspec-apply-change/project rules. Verify behavior
   before checking task boxes; commit logical units via preloaded commit skill,
   stage explicit paths/review staged diff. Keep exact owned auth metadata local;
   cleanliness never exempts tracked/unrelated dirt or changes original excludes.
6. All tasks done → ONE foreground blocking Agent `Rubber Duck Reviewer` over diff/tests/docs.
   Wait, fix blockers, reverify, disposition EVERY finding. Preserve original
   HEAD/status and leave clean committed worktree. Never yield before review ends.

Tests establish behavior, not shipped data/copy/markup/counts/wording. Prefer genuine
existing tests; data/config-only changes use smoke. With project traceability:
no new delta-ID annotations before archive sync; never borrow unrelated IDs.
Hand off test → delta requirement AND scenario, all genuine mappings. Premature
annotation demands → stop, not fabricate.

On resume, reuse applicable same-change reviews verified in agent history.
Report original baseline, feature SHA, branch/worktree, commits/impact, both duck IDs,
outcomes/dispositions, spec deviations, verification, annotation hand-off when
applicable, auth path and original-root os-phase. Single repo needs no inventory,
progress JSON or snapshots. Child mode adds evidence below.

## Only when child Git repos are needed

Validate each normalized P: original=`parentRoot/P`, isolated=`workspace/P`, canonical
commonDir, baseline/access/mode/refs. Writable children use feat/<change>/unique import
refs; readonly branch/importRef=null. Deepest access wins. Detached original branch=
HEAD; submodule baseline matches enclosing original baseline-tree gitlink. Writable
originals clean; recorded readonly dirt only if baseline content reproducible. Never
switch originals. Parent remains linked worktree; prepare children outermost first at
EXACT relative paths, including readonly deps. No overwrite/copy/symlink originals
or shared-object clones. Writable worktrees use step 2; readonly:
`git -C ORIGINAL worktree add --detach ISOLATED ORIGINAL_HEAD`.
Clones: `git clone --no-hardlinks --no-checkout ORIGINAL ISOLATED`, then
`git -C ISOLATED checkout -b FEATURE_BRANCH ORIGINAL_HEAD` (write) or
`git -C ISOLATED checkout --detach ORIGINAL_HEAD` (read).

Verify integrated entry points AND each writable repo's gates. Commit in owning
repos, deepest first for gitlinks; never absorb child source into ancestor index.
Preserve readonly/original status and clone-only commits. Unchanged children valid,
no fake commits. Only this mode saves local `.omp-workspace-progress.json`:
`{"version":1,"change":"example","participants":[{"path":".","phase":"prepared","isolatedHead":null,"importedHead":null,"mergedHead":null}],"parentPhase":"pending"}`.
Record all participants/full SHAs or null; apply phases prepared/applied. Progress
never authorizes; resume from refs without reset/reclone. Exempt only owned progress/
declared roots from ancestor UNTRACKED reporting, never tracked dirt. Report per-repo
mappings, baselines/tips, verification, preserved status and progress.
