'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, captureAuthorization, restricted } = require('./worktree-guard.cjs');
const capabilities = require('../worktree-guard.json');
const root = '/repos/project';
const lease = '.worktrees/a';
const baseline = '1'.repeat(40);
const featureHead = '2'.repeat(40);
const mergeHead = '3'.repeat(40);
const request = (toolName, input, overrides = {}) => evaluate({
  agentKind: 'sub', agentName: 'os-apply', cwd: root,
  ...authorizedFixture().options, toolName, input, ...overrides,
});
const bash = (command, overrides) => request('bash', { command }, overrides);
const decision = (result, expected) => {
  assert.equal(result.decision, expected, result.reason);
  if (expected === 'block') assert.match(result.reason, /^worktree-guard: /);
};

test('write boundaries include exact lease and exclude siblings and primary', () => {
  for (const target of [lease, `${lease}/x.yaml`, `${root}/${lease}/x.yaml`, '/tmp/x', '~/.omp/x', 'artifact://x']) {
    decision(request('write', { path: target }), 'allow');
  }
  for (const target of [`${root}/x.yaml`, `${root}/openspec/specs/x.yaml`,
    '.worktrees/ab/x', '.worktrees/b/x', `${lease}/../../x`]) {
    decision(request('write', { path: target }), 'block');
  }
});

test('malformed write destinations fail closed across tool payloads', () => {
  for (const path of [undefined, null, '', 42, [], {}]) {
    decision(request('write', { path }), 'block');
  }
  decision(request('edit', {
    path: `${lease}/x`, edits: [{ rename: `${lease}/y` }, { rename: null }],
  }), 'block');
  decision(request('apply_patch', {
    input: '*** Begin Patch\n*** Add File:   \n+x\n*** End Patch',
  }), 'block');
  decision(request('edit', { input: `[${lease}/x#A1B2]\nMV ""` }), 'block');
  for (const command of ['git diff --output', 'git diff --output=', 'printf x >',
    'printf x >> ""', 'cp /tmp/source -t', 'install /tmp/source --target-directory=', 'touch ""']) {
    decision(bash(command), 'block');
  }
});

test('missing and plain authorization cannot grant writes or mutations', () => {
  for (const authorization of [undefined, null, lease]) {
    decision(request('write', { path: '.worktrees/b/x' }, { authorization }), 'block');
    decision(request('write', { path: `${root}/${lease}/x` }, { authorization }), 'block');
    decision(bash('git merge --no-ff x', { authorization, agentName: 'os-archive' }), 'block');
  }
});

test('a pinned assignment does not depend on the current directory', () => {
  decision(request('write', { path: `${root}/openspec/x` }, { cwd: '/outside' }), 'block');
  decision(request('write', { path: `${root}/${lease}/x` }, { cwd: '/outside' }), 'allow');
});

test('both listed workers may create their authorized parent worktree', () => {
  for (const agentName of ['os-apply', 'os-archive']) {
    decision(bash(`git -C ${root} worktree add -b feat/a .worktrees/a ${baseline}`, { agentName }), 'allow');
    decision(bash(`git -C ${root} worktree add -b feat/b .worktrees/b ${baseline}`, { agentName }), 'block');
  }
});

test('a restricted agent without worktree-add cannot create a worktree', () => {
  capabilities['test-restricted'] = [];
  try {
    decision(bash(`git -C ${root} worktree add -b feat/a .worktrees/a ${baseline}`,
      { agentName: 'test-restricted' }), 'block');
  } finally { delete capabilities['test-restricted']; }
});

test('archive cleanup requires non-forced worktree removal and branch -d', () => {
  const fixture = authorizedFixture();
  fixture.integrate(fixture.contract.participants[0]);
  for (const participant of fixture.contract.participants.slice(1)) fixture.states.delete(participant.isolated.root);
  const archive = { ...fixture.options, agentName: 'os-archive' };
  decision(bash(`git -C ${root} worktree remove .worktrees/a`, archive), 'allow');
  for (const flag of ['--force', '-f', '-ff']) {
    decision(bash(`git -C ${root} worktree remove ${flag} .worktrees/a`, archive), 'block');
  }
  decision(bash(`git -C ${root} branch -d feat/a`, archive), 'allow');
  for (const flags of ['-D', '-d --force', '-d -f']) {
    decision(bash(`git -C ${root} branch ${flags} feat/a`, archive), 'block');
  }
  decision(bash('git worktree remove .worktrees/a', fixture.options), 'block');
  decision(bash('git branch -d feat/a', fixture.options), 'block');
  for (const flags of ['--delete', '-df', '-dD']) {
    decision(bash(`git branch ${flags} feat/a`, { ...archive, cwd: `${root}/${lease}` }), 'block');
  }
});

test('non-listed agents and main sessions are never inspected', () => {
  const commands = [
    `git -C ${root} worktree add -b feat/a .worktrees/a`,
    `git -C ${root} merge --no-ff x`,
    `git -C ${root} worktree remove --force .worktrees/a`,
    `git -C ${root} branch -D feat/a`, `rm -rf ${root}/openspec`,
  ];
  for (const agentName of ['task', 'sonic', 'scout', 'reviewer', 'security-reviewer',
    'seance', 'os-propose', 'rubber-duck', 'user-tagged-model']) {
    const overrides = { agentName };
    for (const command of commands) decision(bash(command, overrides), 'allow');
    for (const target of [lease, `${root}/x.yaml`, `${root}/openspec/x`, '/tmp/x']) {
      decision(request('write', { path: target }, overrides), 'allow');
    }
    decision(request('edit', { patch: `*** Delete File: ${root}/x` }, overrides), 'allow');
    decision(request('eval', { code: `write("${root}/x")` }, overrides), 'allow');
  }
  decision(bash('git reset --hard', { agentKind: 'main' }), 'allow');
  assert.equal(restricted('sub', 'toString'), false);
});

test('patch policy checks every operation including move destinations', () => {
  for (const operation of ['Add File', 'Update File', 'Move to', 'Delete File']) {
    decision(request('edit', { patch: `*** Begin Patch\n*** ${operation}: ${root}/x\n*** End Patch` }), 'block');
    decision(request('edit', `*** Begin Patch\n*** ${operation}: ${root}/${lease}/x\n*** End Patch`), 'allow');
  }
  decision(request('edit', { patch: `*** Update File: ${lease}/x\n*** Move to: ${root}/x` }), 'block');
  decision(request('edit', { path: `${root}/x` }), 'block');
});

test('edit wire input supports apply-patch and hashline payloads', () => {
  decision(request('edit', {
    input: '*** Begin Patch\n*** Update File: .worktrees/a/x.yaml\n*** End Patch',
  }), 'allow');
  const outsidePatch = request('edit', {
    input: '*** Begin Patch\n*** Update File: world/x.yaml\n-x\n+y\n*** End Patch',
  });
  decision(outsidePatch, 'block');
  assert.match(outsidePatch.reason, /write outside authorized workspace/);
  for (const tag of ['A1B2', '', '????']) {
    decision(request('edit', {
      input: `*** Begin Patch\n[world/x.yaml#${tag}]\nPUT 1.=1:\n+a\n*** End Patch`,
    }), 'block');
    decision(request('edit', {
      input: `*** Begin Patch\n[.worktrees/a/x.yaml#${tag}]\nPUT 1.=1:\n+a\n*** End Patch`,
    }), 'allow');
  }
  decision(request('apply_patch', {
    input: '*** Begin Patch\n*** Add File: .worktrees/a/x.yaml\n+a\n*** End Patch',
  }), 'allow');
  decision(request('apply_patch', {
    input: '*** Begin Patch\n*** Delete File: world/x.yaml\n*** End Patch',
  }), 'block');
});

test('structured patch and replace modes check sources and every rename', () => {
  for (const target of ['.worktrees/a/x.yaml', 'world/x.yaml']) {
    const expected = target.startsWith('.worktrees/') ? 'allow' : 'block';
    decision(request('edit', { path: target, old_string: 'a', new_string: 'b' }), expected);
    decision(request('edit', { path: target, edits: [{ diff: '-a\n+b' }] }), expected);
  }
  decision(request('edit', {
    path: '.worktrees/a/x.yaml', edits: [{ rename: '.worktrees/a/y.yaml' }],
  }), 'allow');
  decision(request('edit', {
    path: '.worktrees/a/x.yaml',
    edits: [{ rename: '.worktrees/a/y.yaml' }, { rename: 'world/x.yaml' }],
  }), 'block');
});

test('hashline move destinations follow the same write boundary', () => {
  for (const destination of ['.worktrees/a/y.yaml', '".worktrees/a/a b.yaml"',
    "'.worktrees/a/y.yaml'", '".worktrees/a/a\\u0020b.yaml"']) {
    decision(request('edit', { input: `[.worktrees/a/x.yaml#A1B2]\nMV ${destination}` }), 'allow');
  }
  for (const destination of ['world/y.yaml', '"world/a b.yaml"', "'world/a b.yaml'",
    '"world/\\u0078.yaml"']) {
    decision(request('edit', { input: `[.worktrees/a/x.yaml#A1B2]\nMV ${destination}` }), 'block');
  }
});

test('sloppy mode accepts continuing targets but checks every new target', () => {
  const inside = '*** Edit File: .worktrees/a/x.yaml\n*** Find\na\n*** Replace\nb';
  decision(request('edit', { input: inside }), 'allow');
  decision(request('edit', { input: `${inside}\n*** Edit File:\n*** Find\nb\n*** Replace\nc` }), 'allow');
  decision(request('edit', { input: `${inside}\n*** Edit File: world/x.yaml all\n*** Find\nb\n*** Replace\nc` }), 'block');
  decision(request('edit', { input: inside.replace('.worktrees/a/', 'world/') }), 'block');
});

test('unknown edit payloads fail closed', () => {
  for (const tool of ['edit', 'apply_patch']) {
    for (const input of [{ input: 'unknown payload' }, { patch: 'unknown payload' },
      'unknown payload', {}, { input: '*** Begin Patch\n*** End Patch' },
      { input: '*** Edit File:\n*** Find\nx' }]) {
      const result = request(tool, input);
      decision(result, 'block');
    }
  }
});

test('shell mutation targets, quoting, redirection and cd chains', () => {
  for (const command of ['cp /tmp/x x', 'mv x /tmp/x', 'rm x', 'tee x',
    'install /tmp/x x', 'touch x', 'mkdir x', 'echo ok>x', 'printf ok >> x',
    `cp /tmp/x -t "${root}"`, `rm "${root}/a b"`,
    `cd ${root} && rm x`]) decision(bash(command), 'block');
  for (const command of [`cp ${root}/x /tmp/x`, `rm ${lease}/x`,
    `echo ok>${lease}/x`, `cd ${lease} && touch x`, 'rm /tmp/x',
    `git -C "${root}" status`, `cat ${root}/x`]) decision(bash(command), 'allow');
  decision(request('bash', { command: 'touch x', cwd: `${root}/${lease}` }), 'allow');
  decision(bash('cd /tmp; touch x'), 'block');
  decision(bash(`(cd /tmp); rm x`), 'block');
  decision(bash('touch "unterminated'), 'block');
  decision(bash(`cd -P ${root} && touch x`, { cwd: `${root}/${lease}` }), 'block');
  decision(bash(`find ${root}/openspec -type f -delete`), 'block');
  for (const executable of ['cp', 'install']) {
    decision(bash(`${executable} -t${root} /tmp/x`), 'block');
  }
});

test('git in lease allows normal work but not unauthorized special verbs', () => {
  const cwd = `${root}/${lease}`;
  decision(bash('git add x && git commit -m change', { cwd }), 'allow');
  decision(bash('git merge --no-ff feature', { cwd }), 'block');
  decision(bash(`git -C ${root} reset --hard`, { cwd }), 'block');
  decision(bash(`git --git-dir=${root}/.git reset --hard`, { cwd }), 'block');
  decision(bash(`git diff --output=${root}/x`), 'block');
  decision(bash(`git -C /tmp/other reset --hard`), 'allow');
});

test('eval only blocks a literal primary root, while read tools stay untouched', () => {
  decision(request('eval', { code: `write("${root}/x")` }), 'block');
  decision(request('eval', { code: 'write(computedPath)' }), 'allow');
  decision(request('read', { path: `${root}/x` }), 'allow');
});

test('authorization is mandatory in the first user message, never inferred from paths or later messages', () => {
  for (const content of ['Work in `.worktrees/a`.', `Work in ${root}/${lease}.`, 'No authorization'])
    assert.throws(() => captureAuthorization([{ role: 'user', content }]));
  assert.throws(() => captureAuthorization([{ role: 'user', content: 'No authorization' },
    { role: 'user', content: `<worktree-authorization>${JSON.stringify(workspaceContract())}</worktree-authorization>` }]));
  assert.equal(captureAuthorization([{ role: 'assistant', content: '.worktrees/a' }]), undefined);
});

function workspaceContract() {
  const participant = (relative, mode, access) => ({
    path: relative, mode, access,
    original: {
      root: relative === '.' ? root : `${root}/${relative}`,
      commonDir: `${relative === '.' ? root : `${root}/${relative}`}/.git`,
      branch: 'main', head: baseline,
    },
    isolated: {
      root: relative === '.' ? `${root}/${lease}` : `${root}/${lease}/${relative}`,
      branch: access === 'write' ? 'feat/a' : null,
    },
    importRef: access === 'write' ? `refs/omp/import/a/${relative === '.' ? 'parent' : relative}` : null,
  });
  return {
    version: 1, change: 'a', parentRoot: root, workspace: `${root}/${lease}`,
    participants: [participant('.', 'worktree', 'write'), participant('child', 'clone', 'write'),
      participant('child/dependency', 'clone', 'read')],
  };
}
function authorizedFixture(contract = workspaceContract()) {
  const states = new Map();
  const placeholders = new Map();
  const commits = new Map([[baseline, []], [featureHead, [baseline]], [mergeHead, [baseline, featureHead]]]);
  for (const participant of contract.participants) {
    states.set(participant.original.root, {
      common: participant.original.commonDir, branch: 'main', head: baseline,
      refs: { [participant.importRef]: featureHead }, parents: '',
    });
    states.set(participant.isolated.root, {
      common: participant.mode === 'worktree' ? participant.original.commonDir : `${participant.isolated.root}/.git`,
      branch: participant.isolated.branch || 'HEAD',
      head: participant.access === 'write' ? featureHead : baseline, refs: {}, parents: '',
    });
  }
  const inspectGit = (directory, args) => {
    const found = [...states].sort((a, b) => b[0].length - a[0].length)
      .find(([location]) => directory === location || directory.startsWith(`${location}/`));
    if (!found) throw new Error(`unknown repository: ${directory}`);
    const [location, state] = found;
    const command = args.join(' ');
    if (command === 'rev-parse --show-toplevel') return location;
    if (command === 'rev-parse --path-format=absolute --git-common-dir') return state.common;
    if (command === 'rev-parse --abbrev-ref HEAD') return state.branch;
    if (command === 'rev-parse HEAD') return state.head;
    if (command === 'status --porcelain=v1 --untracked-files=all --ignored') return state.status || '';
    if (args[0] === 'for-each-ref') return state.refs[args[3]] || '';
    if (args[0] === 'ls-files' && args[1] === '--stage') {
      const head = state.gitlinks?.[args[4]];
      return head ? `160000 ${head} 0\t${args[4]}\0` : '';
    }
    if (args[0] === 'ls-tree' && args[1] === '-z') {
      const head = (state.treeGitlinks || state.gitlinks)?.[args[4]];
      return head ? `160000 commit ${head}\t${args[4]}\0` : '';
    }
    if (args[0] === 'show' && args[2] === '--format=%P')
      return args[3] === 'HEAD' ? state.parents : (commits.get(args[3]) || []).join(' ');
    if (args[0] === 'rev-parse' && args[1] === '--verify' && Object.hasOwn(state.refs, args[2]))
      return state.refs[args[2]];
    if (args[0] === 'rev-parse' && args[1] === '--verify' && commits.has(args[2])) return args[2];
    if (args[0] === 'merge-base') {
      const ancestor = (head, candidate, seen = new Set()) => head === candidate ||
        !seen.has(head) && (seen.add(head), (commits.get(head) || [])
          .some(parent => ancestor(parent, candidate, seen)));
      if (ancestor(args[1], args[2])) return args[2];
      if (ancestor(args[2], args[1])) return args[1];
      return baseline;
    }
    throw new Error(`unexpected Git query: ${directory}: ${command}`);
  };
  const options = { authorization: contract, inspectGit,
    pathExists: target => states.has(target) || placeholders.has(target),
    readDirectory: target => placeholders.get(target) || ['.git'] };
  return {
    contract, states, commits, placeholders, options,
    write: target => request('write', { path: target }, options),
    bash: (command, overrides = {}) => bash(command, { ...options, ...overrides }),
    archive: command => bash(command, { ...options, agentName: 'os-archive' }),
    integrate: participant => {
      const state = states.get(participant.original.root);
      state.head = mergeHead;
      state.parents = `${baseline} ${featureHead}`;
    },
  };
}

test('structured assignment is copied, frozen and never replaced by later progress', () => {
  const contract = workspaceContract();
  const captured = captureAuthorization([{ role: 'user', content: [
    { type: 'text', text: `<worktree-authorization>${JSON.stringify(contract)}</worktree-authorization>` },
  ] }, { role: 'user', content: '.worktrees/other' }]);
  assert.notEqual(captured, contract);
  assert.ok(Object.isFrozen(captured));
  assert.ok(Object.isFrozen(captured.participants));
  assert.ok(Object.isFrozen(captured.participants[0].original));
  contract.participants[0].original.root = '/tampered';
  assert.equal(captured.participants[0].original.root, root);
  assert.throws(() => { captured.workspace = '/tampered'; }, TypeError);
});

test('malformed structured authorization never falls back to a plain lease', () => {
  const valid = workspaceContract();
  const corruptions = [
    '{', JSON.stringify({ ...valid, version: 2 }),
    JSON.stringify({ ...valid, workspace: `${root}/elsewhere` }),
    JSON.stringify({ ...valid, participants: valid.participants.slice(1) }),
    JSON.stringify({ ...valid, participants: [...valid.participants, valid.participants[0]] }),
  ];
  for (const json of corruptions) assert.throws(() => captureAuthorization([{ role: 'user',
    content: `.worktrees/a <worktree-authorization>${json}</worktree-authorization>` }]));
  assert.throws(() => captureAuthorization([{ role: 'user',
    content: '.worktrees/a <worktree-authorization>{}' }]));
  assert.throws(() => captureAuthorization([{ role: 'user',
    content: '.worktrees/a </worktree-authorization>' }]));
  const invalid = workspaceContract();
  invalid.participants[1].isolated.root = `${root}/${lease}/renamed`;
  decision(request('write', { path: `${root}/${lease}/x` }, { authorization: invalid }), 'block');
});

test('pinned parent and deepest readonly dependency override cwd and parent write access', () => {
  const fixture = authorizedFixture();
  for (const target of [`${root}/${lease}/x`, `${root}/${lease}/child/x`, '/outside/x'])
    decision(fixture.write(target), 'allow');
  for (const target of [`${root}/x`, `${root}/child/x`, `${root}/.worktrees/b/x`,
    `${root}/${lease}/child/dependency/x`]) decision(fixture.write(target), 'block');
  decision(fixture.bash('touch x', { cwd: `${root}/${lease}/child/dependency` }), 'block');
  decision(fixture.bash(`git -C ${root}/${lease}/child/dependency add x`), 'block');
  decision(fixture.bash(`rm -r ${root}/${lease}/child`), 'block');
  decision(request('write', { path: `${root}/child/x` }, {
    ...fixture.options, cwd: '/outside',
  }), 'block');
});

test('clone preparation checks both literal endpoints regardless of process cwd', () => {
  const fixture = authorizedFixture();
  const child = fixture.contract.participants[1];
  const clone = `git clone --no-hardlinks --no-checkout ${child.original.root} ${child.isolated.root}`;
  decision(fixture.bash(clone, { cwd: '/tmp' }), 'allow');
  decision(fixture.bash(`git -C ${root} clone --no-hardlinks --no-checkout child .worktrees/a/child`), 'allow');
  for (const command of [
    `git clone --no-hardlinks --no-checkout ${root}/wrong ${child.isolated.root}`,
    `git clone --no-hardlinks --no-checkout ${child.original.root} /tmp/child`,
    `git clone ${child.original.root} ${child.isolated.root}`,
    `git clone --no-hardlinks --no-checkout ${child.original.root} ${root}/.worktrees/b/child`,
  ]) decision(fixture.bash(command, { cwd: '/tmp' }), 'block');
  fixture.states.get(child.original.root).common = '/another/.git';
  decision(fixture.bash(clone, { cwd: '/tmp' }), 'block');
});

test('readonly clone preparation permits only its pinned detached checkout', () => {
  const fixture = authorizedFixture();
  const dependency = fixture.contract.participants[2];
  fixture.states.get(dependency.isolated.root).branch = 'main';
  decision(fixture.bash(`git clone --no-hardlinks --no-checkout ${dependency.original.root} ${dependency.isolated.root}`), 'allow');
  decision(fixture.bash(`git -C ${dependency.isolated.root} checkout --detach ${baseline}`), 'allow');
  for (const command of [`checkout --detach ${featureHead}`, 'checkout main', 'reset --hard',
    'commit -m changed', `worktree add --detach /tmp/dependency ${baseline}`])
    decision(fixture.bash(`git -C ${dependency.isolated.root} ${command}`), 'block');
});

test('worktree preparation uses Git cwd relative paths and common-directory identity', () => {
  const contract = workspaceContract();
  contract.participants[1].mode = 'worktree';
  contract.participants[2].mode = 'worktree';
  const fixture = authorizedFixture(contract);
  decision(fixture.bash(`git -C ${root} worktree add -b feat/a .worktrees/a ${baseline}`, { cwd: '/tmp' }), 'allow');
  const child = contract.participants[1], dependency = contract.participants[2];
  decision(fixture.bash(`git -C ${child.original.root} worktree add -b feat/a ../.worktrees/a/child ${baseline}`), 'allow');
  decision(fixture.bash(`git -C ${dependency.original.root} worktree add --detach ${dependency.isolated.root} ${baseline}`), 'allow');
  decision(fixture.bash(`git -C ${child.original.root} worktree add -b feat/a .worktrees/a/child ${baseline}`), 'block');
  decision(fixture.bash(`git -C ${root} worktree add -B feat/a .worktrees/a ${baseline}`), 'block');
  decision(fixture.bash(`git -C /tmp/unrelated worktree add -b feat/a ${root}/${lease} ${baseline}`), 'block');
  decision(fixture.archive(`git -C /tmp/unrelated worktree remove ${root}/${lease}`), 'block');
  fixture.states.get(root).common = '/unrelated/.git';
  decision(fixture.bash(`git -C ${root} worktree add -b feat/a .worktrees/a ${baseline}`), 'block');
});

test('archive import and original mutations are restricted to exact refs and branch baselines', () => {
  const fixture = authorizedFixture();
  const child = fixture.contract.participants[1];
  const prefix = `git -C ${child.original.root}`;
  const fetch = `${prefix} fetch --no-tags ${child.isolated.root} refs/heads/feat/a:${child.importRef}`;
  decision(fixture.bash(fetch), 'block');
  decision(fixture.archive(fetch), 'allow');
  decision(fixture.archive(`${prefix} merge --no-ff ${child.importRef}`), 'allow');
  decision(fixture.archive(`${prefix} checkout main`), 'allow');
  for (const suffix of ['add x', 'commit -m change', 'checkout unrelated',
    `merge --ff-only ${child.importRef}`, 'merge --no-ff unrelated',
    `fetch --no-tags /tmp/other refs/heads/feat/a:${child.importRef}`,
    `fetch --no-tags ${child.isolated.root} +refs/heads/feat/a:${child.importRef}`])
    decision(fixture.archive(`${prefix} ${suffix}`), 'block');
  fixture.states.get(child.original.root).branch = 'user-branch';
  decision(fixture.archive(fetch), 'block');
  fixture.states.get(child.original.root).branch = 'main';
  fixture.states.get(child.original.root).head = '4'.repeat(40);
  decision(fixture.archive(fetch), 'block');
});

test('partial archive resumes from refs, not mutable progress assertions', () => {
  const fixture = authorizedFixture();
  const child = fixture.contract.participants[1];
  const cleanup = `rm -r -- ${child.isolated.root}`;
  decision(fixture.archive(cleanup), 'block');
  decision(request('write', { path: `${fixture.contract.workspace}/.omp-workspace-progress.json`,
    content: '{"participants":[{"path":"child","phase":"merged"}]}' }, fixture.options), 'allow');
  decision(fixture.archive(cleanup), 'block');
  fixture.integrate(child);
  fixture.states.delete(fixture.contract.participants[2].isolated.root);
  decision(fixture.archive(cleanup), 'allow');
  decision(fixture.bash(cleanup), 'block');
  decision(fixture.archive(`git -C ${child.original.root} update-ref -d ${child.importRef} ${featureHead}`), 'block');
  decision(fixture.archive(`git -C ${child.original.root} update-ref -d refs/heads/main ${featureHead}`), 'block');
  fixture.states.get(child.isolated.root).head = '4'.repeat(40);
  decision(fixture.archive(cleanup), 'block');
  fixture.states.delete(child.isolated.root);
  decision(fixture.archive(`git -C ${child.original.root} update-ref -d ${child.importRef} ${featureHead}`), 'allow');
  // A merged child does not authorize cleanup of the still-pending parent.
  decision(fixture.archive(`git -C ${root} worktree remove ${root}/${lease}`), 'block');
});

test('cleanup refuses dirty clones and any still-present descendant participants', () => {
  const fixture = authorizedFixture();
  const child = fixture.contract.participants[1], dependency = fixture.contract.participants[2];
  fixture.integrate(child);
  const cleanup = `rm -r -- ${child.isolated.root}`;
  decision(fixture.archive(cleanup), 'block');
  fixture.states.delete(dependency.isolated.root);
  for (const status of [' M tracked\n', '?? new-file\n', '!! ignored-secret\n']) {
    fixture.states.get(child.isolated.root).status = status;
    decision(fixture.archive(cleanup), 'block');
  }
  fixture.states.get(child.isolated.root).status = '';
  decision(fixture.archive(cleanup), 'allow');
});

test('unchanged writable cleanup requires pristine exact baselines without fabricated imports', () => {
  for (const mode of ['clone', 'worktree']) {
    const contract = workspaceContract();
    contract.participants = contract.participants.slice(0, 2);
    contract.participants[1].mode = mode;
    const fixture = authorizedFixture(contract), child = contract.participants[1];
    const original = fixture.states.get(child.original.root), isolated = fixture.states.get(child.isolated.root);
    isolated.head = baseline;
    delete original.refs[child.importRef];
    if (mode === 'worktree') original.refs['refs/heads/feat/a'] = baseline;
    const cleanup = mode === 'clone' ? `rm -r -- ${child.isolated.root}` :
      `git -C ${child.original.root} worktree remove ${child.isolated.root}`;
    decision(fixture.archive(cleanup), 'allow');
    for (const state of [original, isolated]) {
      state.status = '?? precious\n';
      decision(fixture.archive(cleanup), 'block');
      state.status = '';
    }
    original.refs[child.importRef] = featureHead;
    decision(fixture.archive(cleanup), 'block');
    original.refs[child.importRef] = baseline;
    decision(fixture.archive(cleanup), 'allow');
    fixture.states.delete(child.isolated.root);
    if (mode === 'worktree') {
      decision(fixture.archive(`git -C ${child.original.root} update-ref -d ${child.importRef} ${baseline}`), 'block');
      decision(fixture.archive(`git -C ${child.original.root} branch -d feat/a`), 'allow');
      delete original.refs['refs/heads/feat/a'];
    }
    decision(fixture.archive(`git -C ${child.original.root} update-ref -d ${child.importRef} ${baseline}`), 'allow');
    assert.equal(original.head, baseline);
  }
});

test('cleaned gitlinks restore only empty exact committed placeholders before import deletion', () => {
  for (const access of ['write', 'read']) {
    const contract = workspaceContract();
    contract.participants = contract.participants.slice(0, 2);
    const child = contract.participants[1];
    child.access = access;
    if (access === 'read') { child.isolated.branch = null; child.importRef = null; }
    const fixture = authorizedFixture(contract);
    const parent = contract.participants[0], parentState = fixture.states.get(parent.isolated.root);
    fixture.integrate(parent);
    if (access === 'write') fixture.integrate(child);
    const finalHead = access === 'write' ? mergeHead : baseline;
    parentState.gitlinks = { child: finalHead };
    const mkdir = `mkdir -- ${child.isolated.root}`;
    decision(fixture.archive(mkdir), 'block');
    fixture.states.delete(child.isolated.root);
    if (access === 'write')
      decision(fixture.archive(`git -C ${child.original.root} update-ref -d ${child.importRef} ${featureHead}`), 'block');
    decision(fixture.bash(mkdir), 'block');
    decision(fixture.archive(mkdir), 'allow');
    parentState.treeGitlinks = { child: featureHead };
    decision(fixture.archive(mkdir), 'block');
    delete parentState.treeGitlinks;
    parentState.gitlinks.child = featureHead;
    decision(fixture.archive(mkdir), 'block');
    parentState.gitlinks.child = finalHead;
    fixture.placeholders.set(child.isolated.root, []);
    decision(fixture.archive(mkdir), 'block');
    if (access === 'write') {
      decision(fixture.archive(`git -C ${child.original.root} update-ref -d ${child.importRef} ${featureHead}`), 'allow');
      delete fixture.states.get(child.original.root).refs[child.importRef];
    }
    decision(fixture.archive(`git -C ${root} worktree remove ${parent.isolated.root}`), 'allow');
    fixture.placeholders.set(child.isolated.root, ['unexpected']);
    decision(fixture.archive(`git -C ${root} worktree remove ${parent.isolated.root}`), 'block');
  }
});

test('direct shared-ref writes and recursive readonly overwrites are refused', () => {
  const fixture = authorizedFixture();
  for (const agentName of ['os-apply', 'os-archive']) {
    for (const command of [
      `git -C ${fixture.contract.workspace} symbolic-ref refs/heads/main refs/heads/feat/a`,
      `git -C ${fixture.contract.workspace} config core.worktree ${root}`,
      `git -C ${fixture.contract.workspace} clean -ffd`,
      `cp -R /tmp/replacement/. ${fixture.contract.workspace}/child`,
      `cp -a /tmp/replacement/. ${fixture.contract.workspace}/child`,
    ]) decision(fixture.bash(command, { agentName }), 'block');
  }
});

test('advanced authorized imports support a second parent gitlink merge but not original linear commits', () => {
  const fixture = authorizedFixture();
  const parent = fixture.contract.participants[0];
  fixture.integrate(parent);
  const repairedFeature = '4'.repeat(40), repairedMerge = '5'.repeat(40);
  fixture.commits.set(repairedFeature, [mergeHead]);
  fixture.commits.set(repairedMerge, [mergeHead, repairedFeature]);
  const original = fixture.states.get(parent.original.root);
  original.refs[parent.importRef] = repairedFeature;
  fixture.states.get(parent.isolated.root).head = repairedFeature;
  decision(fixture.archive(`git -C ${root} merge --no-ff ${parent.importRef} -m "Repair child gitlink"`), 'allow');
  original.head = repairedMerge;
  original.parents = `${mergeHead} ${repairedFeature}`;
  decision(fixture.archive(`git -C ${root} checkout main`), 'allow');
  const linearCommit = '6'.repeat(40);
  original.head = linearCommit;
  original.parents = repairedMerge;
  decision(fixture.archive(`git -C ${root} checkout main`), 'block');
  original.head = repairedMerge;
  original.parents = `${mergeHead} ${'7'.repeat(40)}`;
  decision(fixture.archive(`git -C ${root} checkout main`), 'block');
});

test('detached original child uses HEAD fetch without switching the original checkout', () => {
  const contract = workspaceContract();
  contract.participants[1].original.branch = 'HEAD';
  const fixture = authorizedFixture(contract), child = contract.participants[1];
  fixture.states.get(child.original.root).branch = 'HEAD';
  decision(fixture.archive(`git -C ${child.isolated.root} fetch --no-tags ${child.original.root} HEAD`), 'allow');
  decision(fixture.archive(`git -C ${child.isolated.root} fetch --no-tags ${child.original.root} refs/heads/HEAD`), 'block');
  decision(fixture.archive(`git -C ${child.original.root} merge --no-ff ${child.importRef} --no-edit`), 'allow');
  decision(fixture.archive(`git -C ${child.original.root} checkout main`), 'block');
});

test('isolated archive refresh supports exact primary fetch, rebase and ff-only gitlink refresh', () => {
  const fixture = authorizedFixture();
  const child = fixture.contract.participants[1];
  const isolated = fixture.states.get(child.isolated.root);
  isolated.refs.main = baseline;
  decision(fixture.archive(`git -C ${child.isolated.root} rebase main`), 'allow');
  decision(fixture.bash(`git -C ${child.isolated.root} rebase main`), 'block');
  decision(fixture.archive(`git -C ${child.isolated.root} fetch --no-tags ${child.original.root} refs/heads/main`), 'allow');
  decision(fixture.archive(`git -C ${child.isolated.root} fetch --no-tags /tmp/other refs/heads/main`), 'block');
  fixture.integrate(child);
  isolated.refs.FETCH_HEAD = mergeHead;
  decision(fixture.archive(`git -C ${child.isolated.root} merge --ff-only FETCH_HEAD`), 'allow');
  isolated.refs.FETCH_HEAD = '4'.repeat(40);
  decision(fixture.archive(`git -C ${child.isolated.root} merge --ff-only FETCH_HEAD`), 'block');
});

test('real Git detached participants archive, resume and clean clones and worktrees without duplicate merges', t => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-workspace-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const parentRoot = path.join(temporary, 'parent');
  const workspace = path.join(parentRoot, '.worktrees/a');
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.test',
    GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.test',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  const git = (directory, args) => execFileSync('git', ['-C', directory, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env,
  }).trim();
  const initialize = directory => {
    fs.mkdirSync(directory, { recursive: true });
    git(directory, ['init', '-b', 'main']);
    fs.writeFileSync(path.join(directory, 'tracked'), 'baseline\n');
    git(directory, ['add', 'tracked']);
    git(directory, ['commit', '-m', 'Baseline']);
  };
  initialize(parentRoot);
  fs.writeFileSync(path.join(parentRoot, '.gitignore'), '.worktrees/\n');
  git(parentRoot, ['add', '.gitignore']);
  const originals = [
    { relative: 'deps/write', access: 'write', mode: 'clone' },
    { relative: 'deps/read', access: 'read', mode: 'clone' },
    { relative: 'deps/unchanged', access: 'write', mode: 'clone' },
    { relative: 'deps/readonly-worktree', access: 'read', mode: 'worktree' },
    { relative: 'deps/unchanged-worktree', access: 'write', mode: 'worktree' },
  ].map(specification => {
    const { relative } = specification;
    const directory = path.join(parentRoot, relative);
    initialize(directory);
    git(directory, ['checkout', '--detach', 'HEAD']);
    const head = git(directory, ['rev-parse', 'HEAD']);
    git(parentRoot, ['update-index', '--add', '--cacheinfo', `160000,${head},${relative}`]);
    return { ...specification, directory, head };
  });
  fs.writeFileSync(path.join(parentRoot, '.gitmodules'), originals.map(original =>
    `[submodule "${original.relative}"]\n\tpath = ${original.relative}\n\turl = ${original.directory}\n`).join(''));
  git(parentRoot, ['add', '.gitmodules']);
  git(parentRoot, ['commit', '-m', 'Record child gitlinks']);
  git(parentRoot, ['submodule', 'absorbgitdirs']);
  const participant = (relative, directory, head, access, mode) => ({
    path: relative, access, mode,
    original: { root: directory, commonDir: git(directory,
      ['rev-parse', '--path-format=absolute', '--git-common-dir']),
      branch: git(directory, ['rev-parse', '--abbrev-ref', 'HEAD']), head },
    isolated: { root: path.resolve(workspace, relative), branch: access === 'write' ? 'feat/a' : null },
    importRef: access === 'write' ? `refs/omp/import/a/${relative === '.' ? 'parent' : relative}` : null,
  });
  const contract = {
    version: 1, change: 'a', parentRoot, workspace,
    participants: [participant('.', parentRoot, git(parentRoot, ['rev-parse', 'HEAD']), 'write', 'worktree'),
      ...originals.map(original => participant(original.relative, original.directory,
        original.head, original.access, original.mode))],
  };
  const guardedGit = (directory, args, agentName = 'os-apply') => {
    const command = ['git', '-C', directory, ...args].map(argument => JSON.stringify(argument)).join(' ');
    decision(evaluate({ agentKind: 'sub', agentName, cwd: temporary, authorization: contract,
      toolName: 'bash', input: { command } }), 'allow');
    return git(directory, args);
  };
  const parent = contract.participants[0], writable = contract.participants[1], readonly = contract.participants[2];
  guardedGit(parentRoot, ['worktree', 'add', '-b', 'feat/a', workspace, parent.original.head]);
  for (const child of contract.participants.slice(1)) {
    assert.equal(git(parentRoot, ['rev-parse', `HEAD:${child.path}`]), child.original.head);
    if (child.mode === 'clone') {
      guardedGit(temporary, ['clone', '--no-hardlinks', '--no-checkout', child.original.root, child.isolated.root]);
      guardedGit(child.isolated.root, child.access === 'read' ?
        ['checkout', '--detach', child.original.head] : ['checkout', '-b', 'feat/a', child.original.head]);
    } else guardedGit(child.original.root, child.access === 'read' ?
      ['worktree', 'add', '--detach', child.isolated.root, child.original.head] :
      ['worktree', 'add', '-b', 'feat/a', child.isolated.root, child.original.head]);
    assert.equal(git(child.isolated.root, ['rev-parse', 'HEAD']), child.original.head);
  }
  decision(evaluate({ agentKind: 'sub', agentName: 'os-apply', cwd: readonly.isolated.root,
    authorization: contract, toolName: 'write', input: { path: 'tracked', content: 'not allowed' } }), 'block');
  fs.writeFileSync(path.join(writable.isolated.root, 'tracked'), 'changed\n');
  guardedGit(writable.isolated.root, ['add', 'tracked']);
  guardedGit(writable.isolated.root, ['commit', '-m', 'Child change']);
  guardedGit(writable.isolated.root, ['fetch', '--no-tags', writable.original.root, 'HEAD'], 'os-archive');
  guardedGit(writable.isolated.root, ['rebase', 'FETCH_HEAD'], 'os-archive');
  guardedGit(writable.original.root, ['fetch', '--no-tags', writable.isolated.root,
    `refs/heads/feat/a:${writable.importRef}`], 'os-archive');
  guardedGit(writable.original.root, ['merge', '--no-ff', writable.importRef, '-m', 'Integrate detached child'], 'os-archive');
  assert.equal(git(writable.original.root, ['rev-parse', '--abbrev-ref', 'HEAD']), 'HEAD');
  const childMerge = git(writable.original.root, ['rev-parse', 'HEAD']);
  assert.notEqual(childMerge, writable.original.head);
  assert.match(git(parentRoot, ['status', '--porcelain']), /deps\/write/);
  const progressFile = path.join(workspace, '.omp-workspace-progress.json');
  const progress = { version: 1, change: 'a', parentPhase: 'archived', participants: [
    { path: writable.path, phase: 'merged', isolatedHead: git(writable.isolated.root, ['rev-parse', 'HEAD']),
      importedHead: git(writable.original.root, ['rev-parse', writable.importRef]), mergedHead: childMerge },
  ] };
  fs.writeFileSync(progressFile, JSON.stringify(progress));
  // A restarted worker receives the same immutable assignment, not new authority.
  const resumedAuthorization = captureAuthorization([{ role: 'user',
    content: `<worktree-authorization>${JSON.stringify(contract)}</worktree-authorization>` }]);
  const durable = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
  const checkpoint = (child, updates) => {
    let entry = durable.participants.find(item => item.path === child.path);
    if (!entry) {
      entry = { path: child.path, phase: 'prepared', isolatedHead: child.original.head,
        importedHead: null, mergedHead: null };
      durable.participants.push(entry);
    }
    Object.assign(entry, updates);
    fs.writeFileSync(progressFile, JSON.stringify(durable));
  };
  const resumedDecision = (toolName, input) => evaluate({ agentKind: 'sub', agentName: 'os-archive',
    cwd: temporary, authorization: resumedAuthorization, toolName, input });
  assert.equal(durable.participants[0].mergedHead, git(writable.original.root, ['rev-parse', 'HEAD']));
  assert.equal(durable.participants[0].importedHead, git(writable.original.root, ['rev-parse', writable.importRef]));
  guardedGit(writable.isolated.root, ['fetch', '--no-tags', writable.original.root, 'HEAD'], 'os-archive');
  guardedGit(writable.isolated.root, ['merge', '--ff-only', 'FETCH_HEAD'], 'os-archive');
  guardedGit(workspace, ['add', writable.path], 'os-archive');
  guardedGit(workspace, ['commit', '-m', 'Archive child gitlink'], 'os-archive');
  const parentFeature = git(workspace, ['rev-parse', 'HEAD']);
  guardedGit(parentRoot, ['fetch', '--no-tags', workspace, `refs/heads/feat/a:${parent.importRef}`], 'os-archive');
  guardedGit(parentRoot, ['merge', '--no-ff', parent.importRef, '--no-edit'], 'os-archive');
  const parentMerge = git(parentRoot, ['rev-parse', 'HEAD']);
  for (const child of [...contract.participants.slice(1)].reverse()) {
    if (child.access === 'write' && child !== writable) {
      assert.equal(git(child.original.root, ['rev-parse', 'HEAD']), child.original.head);
      assert.equal(git(child.isolated.root, ['rev-parse', 'HEAD']), child.original.head);
      // Exercise optional baseline import deletion as well as no-import cleanup.
      if (child.mode === 'clone')
        guardedGit(child.original.root, ['fetch', '--no-tags', child.isolated.root,
          `refs/heads/feat/a:${child.importRef}`], 'os-archive');
      checkpoint(child, { phase: 'merged', isolatedHead: child.original.head,
        importedHead: child.mode === 'clone' ? child.original.head : null, mergedHead: null });
    }
    if (child.mode === 'clone') {
      decision(resumedDecision('bash', { command: `rm -r -- ${JSON.stringify(child.isolated.root)}` }), 'allow');
      fs.rmSync(child.isolated.root, { recursive: true });
    } else guardedGit(child.original.root, ['worktree', 'remove', child.isolated.root], 'os-archive');
    assert.equal(fs.existsSync(child.isolated.root), false);
    decision(resumedDecision('bash', { command: `mkdir -- ${JSON.stringify(child.isolated.root)}` }), 'allow');
    fs.mkdirSync(child.isolated.root);
    assert.deepEqual(fs.readdirSync(child.isolated.root), []);
    assert.equal(git(child.isolated.root, ['rev-parse', '--show-toplevel']), workspace);
    if (child.access === 'write') {
      if (child.mode === 'worktree') guardedGit(child.original.root, ['branch', '-d', 'feat/a'], 'os-archive');
      checkpoint(child, { phase: 'cleaned' });
      const imported = git(child.original.root, ['for-each-ref', '--format=%(objectname)', '--', child.importRef]);
      if (imported) guardedGit(child.original.root, ['update-ref', '-d', child.importRef, imported], 'os-archive');
      assert.equal(git(child.original.root, ['for-each-ref', '--format=%(objectname)', '--', child.importRef]), '');
    } else checkpoint(child, { phase: 'cleaned' });
    assert.deepEqual(fs.readdirSync(child.isolated.root), []);
  }
  assert.equal(git(writable.original.root, ['rev-parse', 'HEAD']), childMerge);
  assert.equal(git(parentRoot, ['rev-parse', 'HEAD']), parentMerge);
  assert.equal(git(parentRoot, ['rev-parse', 'HEAD:deps/write']), childMerge);
  // Persist final supervisor checkpoint outside the soon-removed workspace.
  durable.parentPhase = 'merged';
  const completedFile = path.join(temporary, 'completed-progress.json');
  fs.writeFileSync(completedFile, JSON.stringify(durable));
  fs.unlinkSync(progressFile);
  assert.equal(git(workspace, ['status', '--porcelain']), '');
  guardedGit(parentRoot, ['worktree', 'remove', workspace], 'os-archive');
  guardedGit(parentRoot, ['branch', '-d', 'feat/a'], 'os-archive');
  guardedGit(parentRoot, ['update-ref', '-d', parent.importRef, parentFeature], 'os-archive');
  durable.parentPhase = 'complete';
  fs.writeFileSync(completedFile, JSON.stringify(durable));
  assert.equal(fs.existsSync(workspace), false);
  assert.equal(git(parentRoot, ['for-each-ref', '--format=%(objectname)', '--', parent.importRef]), '');
  assert.equal(git(parentRoot, ['rev-parse', 'HEAD']), parentMerge);
  assert.equal(JSON.parse(fs.readFileSync(completedFile, 'utf8')).parentPhase, 'complete');
});
