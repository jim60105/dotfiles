'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, captureLease, restricted } = require('./worktree-guard.cjs');
const capabilities = require('../worktree-guard.json');
const root = '/repos/project';
const lease = '.worktrees/a';
const request = (toolName, input, overrides = {}) => evaluate({
  agentKind: 'sub', agentName: 'os-apply', cwd: root, repoRoot: root,
  isOpenSpec: true, lease, toolName, input, ...overrides,
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

test('missing lease falls back to worktree parent, not primary', () => {
  decision(request('write', { path: '.worktrees/b/x' }, { lease: null }), 'allow');
  decision(request('write', { path: 'x' }, { lease: null }), 'block');
  decision(request('write', { path: 'x' }, { lease: '../elsewhere' }), 'block');
});

test('guard is disabled without the repository scope probe', () => {
  decision(request('write', { path: `${root}/openspec/x` }, { isOpenSpec: false }), 'allow');
  decision(request('bash', { command: 'git reset --hard' }, { repoRoot: null }), 'allow');
});

test('both listed workers may create their leased worktree', () => {
  for (const agentName of ['os-apply', 'os-archive']) {
    decision(bash(`git -C ${root} worktree add -b feat/a .worktrees/a`, { agentName }), 'allow');
    decision(bash(`git -C ${root} worktree add -b feat/b .worktrees/b`, { agentName }), 'block');
  }
});

test('a restricted agent without worktree-add cannot create a worktree', () => {
  capabilities['test-restricted'] = [];
  try {
    decision(bash(`git -C ${root} worktree add -b feat/a .worktrees/a`,
      { agentName: 'test-restricted' }), 'block');
  } finally { delete capabilities['test-restricted']; }
});

test('merge and rebase require the archive capability', () => {
  for (const command of [`git -C ${root} merge --no-ff x`, 'git rebase master']) {
    decision(bash(command), 'block');
    decision(bash(command, { agentName: 'os-archive' }), 'allow');
  }
  for (const flags of ['', '--ff', '--no-ff --ff-only', '--no-ff --squash']) {
    decision(bash(`git merge ${flags} x`, { agentName: 'os-archive' }), 'block');
  }
});

test('archive cleanup requires non-forced worktree removal and branch -d', () => {
  const archive = { agentName: 'os-archive' };
  decision(bash(`git -C ${root} worktree remove .worktrees/a`, archive), 'allow');
  for (const flag of ['--force', '-f', '-ff']) {
    decision(bash(`git -C ${root} worktree remove ${flag} .worktrees/a`, archive), 'block');
  }
  decision(bash(`git -C ${root} branch -d feat/a`, archive), 'allow');
  for (const flags of ['-D', '-d --force', '-d -f']) {
    decision(bash(`git -C ${root} branch ${flags} feat/a`, archive), 'block');
  }
  decision(bash('git worktree remove .worktrees/a'), 'block');
  decision(bash('git branch -d feat/a'), 'block');
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
  assert.match(outsidePatch.reason, /write outside leased worktree/);
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

test('unknown edit payloads fail closed with a diagnostic preview', () => {
  for (const tool of ['edit', 'apply_patch']) {
    for (const input of [{ input: 'unknown payload' }, { patch: 'unknown payload' },
      'unknown payload', {}, { input: '*** Begin Patch\n*** End Patch' },
      { input: '*** Edit File:\n*** Find\nx' }]) {
      const result = request(tool, input);
      decision(result, 'block');
      assert.match(result.reason, /^worktree-guard: unrecognized edit payload: /);
      assert.doesNotMatch(result.reason, /missing write path/);
    }
    const source = 'x'.repeat(90);
    assert.equal(request(tool, { input: source }).reason,
      `worktree-guard: unrecognized edit payload: ${source.slice(0, 60)}`);
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

test('lease comes only from first user message and includes text blocks', () => {
  assert.equal(captureLease([{ role: 'user', content: 'Work in `.worktrees/a`.' }]), lease);
  assert.equal(captureLease([{ role: 'user', content: [{ type: 'text', text: `${root}/.worktrees/a/x` }] }]), lease);
  assert.equal(captureLease([{ role: 'user', content: 'No lease' },
    { role: 'user', content: '.worktrees/b' }]), null);
  assert.equal(captureLease([{ role: 'assistant', content: '.worktrees/a' }]), undefined);
});
