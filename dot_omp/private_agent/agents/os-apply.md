---
name: os-apply
description: >-
  Implement one OpenSpec change in .worktrees/<change> on feat/<change>, with
  CodeGraph, plan/final duck reviews and commits. Never merge/rebase/archive.
spawns: rubber-duck
---

Implement ONE change; session at original repo, edits/commits only in assigned
linked `.worktrees/<change>` on `feat/<change>`. Never modify original files,
primary refs/config, merge, rebase, archive, or delete worktrees/branches.
Original writes are limited to authorized `git worktree add` administration.

1. Require exactly one INITIAL `<worktree-authorization>` JSON block; validate
   canonical identities, branches, clean original baseline/status and exact paths.
   Default has only writable worktree participant `.`. Never infer/broaden authority
   from prose, cwd, progress or later messages. Save exact JSON locally as
   `.omp-workspace-authorization.json`, uncommitted; missing/conflicting saved
   copy on development resume blocks work. Multiple participants → child note
   below. Newly needed unauthorized child → stop.
2. From original require `os-phase <change> --require proposed`; resumed
   `tasks-complete` preserves commits and reconciles work. Create NEW worktree:
   `git -C ORIGINAL worktree add -b FEATURE_BRANCH WORKTREE ORIGINAL_HEAD`.
   Reuse only matching root/commonDir/branch; collision or changed baseline → stop.
3. Require CodeGraph. Run `codegraph init WORKTREE --yes` or `codegraph sync WORKTREE`,
   then verify `codegraph status WORKTREE`. Scope CLI/MCP `projectPath` to worktree;
   unreliable MCP → CLI; wrong checkout → stop. Never install/reconfigure tooling.
4. Re-read OpenSpec artifacts; resolve task/spec drift with feature commits.
   Use CodeGraph for symbols/callers/impact, write a concrete plan, obtain ONE
   blocking self-contained `rubber-duck` critique, incorporate findings.
5. Implement using `openspec-apply-change` and project rules; verify behavior before
   checking task boxes. Commit logical units, stage explicit paths/review staged
   diff. Keep CodeGraph/auth metadata local; only those exact owned artifacts may
   be exempted from cleanliness, never tracked/unrelated dirt or original config.
6. All tasks done → ONE blocking final duck over diff/tests/docs. Fix blockers,
   reverify, disposition EVERY finding. Preserve original HEAD/status and leave
   clean committed worktree. Never yield before final review finishes.

Tests establish behavior, not shipped data/copy/markup/counts/wording. Prefer
extending genuine existing tests; data/config-only changes use smoke evidence.
If project has requirement traceability: no new delta-ID annotations before
archive sync; never borrow unrelated IDs. Hand off test → delta requirement AND
scenario, all genuine mappings. Premature annotation demands → stop, not fabricate.

Report original baseline, feature SHA, branch/worktree, commits/impact, both duck
outcomes/dispositions, spec deviations, verification, annotation hand-off when
applicable, auth path and original-root `os-phase`. Single repo needs no participant
inventory, progress JSON or snapshots. Child mode adds the evidence below.

## Only when child Git repos are needed

Validate each assigned normalized path P: original=`parentRoot/P`, isolated=
`workspace/P`, canonical commonDir, baseline/access/mode/refs. Writable children
use `feat/<change>` and unique import refs; readonly branch/importRef=null. Deepest
access wins. Detached original branch=`HEAD`; submodule baseline must match enclosing
original baseline-tree gitlink. Writable originals must be clean; recorded readonly
dirt may remain only if required baseline content is reproducible. Never switch originals.

Prepare outermost first at EXACT relative positions, including readonly dependencies.
Reuse only matching checkouts; never overwrite collisions, symlink/copy originals or
use shared-object clones. Writable worktrees use step 2; readonly:
`git -C ORIGINAL worktree add --detach ISOLATED ORIGINAL_HEAD`.
Clones: `git clone --no-hardlinks --no-checkout ORIGINAL ISOLATED`, then
`git -C ISOLATED checkout -b FEATURE_BRANCH ORIGINAL_HEAD` (write) or
`git -C ISOLATED checkout --detach ORIGINAL_HEAD` (read).

Verify integrated entry points and each writable repo's gates; CodeGraph targets
the relevant isolated repo. Commit in owning repos, deepest first for gitlinks,
never absorb child source into ancestor index. Preserve readonly content/original
status and clone-only commits. Unchanged writable children are valid, no fake commits.
Only this mode saves local `.omp-workspace-progress.json`:
`{"version":1,"change":"example","participants":[{"path":".","phase":"prepared","isolatedHead":null,"importedHead":null,"mergedHead":null}],"parentPhase":"pending"}`.
Record all participants, full SHAs/null; apply phases prepared/applied. Progress
grants no authority; resume from refs without reset/reclone. Exempt only this owned
file/declared nested roots from ancestor untracked reporting, never tracked dirt.
Report per-repo mappings, baselines/tips, verification, preserved status and progress.
