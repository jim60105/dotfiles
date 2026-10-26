'use strict';

// A deterrent against a drifting model, NOT a sandbox. Shell variables,
// substitutions, scripts, aliases, symlinks, indirect tool dispatch and computed
// eval paths can evade lexical inspection. Git internals are not traced.
const path = require('node:path');
const capabilities = require('../worktree-guard.json');
const ALLOW = Object.freeze({ decision: 'allow' });
const READ_GIT = new Set(['status', 'log', 'show', 'diff', 'rev-parse', 'rev-list',
  'ls-files', 'ls-tree', 'cat-file', 'show-ref', 'merge-base', 'describe']);
const READ_SHELL = new Set(['cat', 'head', 'tail', 'ls', 'pwd', 'grep', 'rg',
  'find', 'stat', 'test', '[', 'echo', 'printf']);
const MUTATORS = new Set(['cp', 'mv', 'rm', 'rmdir', 'tee', 'install', 'touch', 'mkdir', 'truncate']);
const block = reason => ({ decision: 'block', reason: `worktree-guard: ${reason}` });
const inside = (target, root) => target === root || target.startsWith(`${root}/`);

function restricted(agentKind, agentName) {
  return agentKind === 'sub' && Object.hasOwn(capabilities, agentName);
}

function captureLease(messages) {
  const first = messages.find(message => message.role === 'user');
  if (!first) return undefined;
  const text = typeof first.content === 'string' ? first.content :
    (first.content || []).filter(part => part.type === 'text').map(part => part.text).join('\n');
  const match = text.match(/(?:^|[\s/`"'(])(\.worktrees\/[A-Za-z0-9][A-Za-z0-9._-]*)(?=$|[\s/`"'),.:;])/);
  return match ? match[1] : null;
}

// Tokenize literal argv, retaining shell separators and redirections. No expansion.
function tokens(source) {
  const result = [];
  let word = '', quote = '', started = false;
  const flush = () => { if (started) result.push(word); word = ''; started = false; };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '\\' && quote !== "'") {
      const next = source[++i];
      if (next === undefined) throw new Error('incomplete shell escape');
      if (next !== '\n') { word += next; started = true; }
    } else if (quote) {
      if (char === quote) quote = '';
      else word += char;
    } else if (char === "'" || char === '"') {
      quote = char; started = true;
    } else if (';&|\n><()'.includes(char)) {
      flush();
      if (source[i + 1] === char && '&|><'.includes(char)) result.push(char + source[++i]);
      else result.push(char);
    } else if (/\s/.test(char)) flush();
    else { word += char; started = true; }
  }
  if (quote) throw new Error('unterminated shell quote');
  flush();
  return result;
}

function evaluate(payload) {
  if (!restricted(payload.agentKind, payload.agentName) || !payload.isOpenSpec || !payload.repoRoot) return ALLOW;
  try {
    const root = path.resolve(payload.repoRoot);
    const cwd = path.resolve(payload.cwd || root);
    const worktrees = path.join(root, '.worktrees');
    const lease = payload.lease ? path.resolve(root, payload.lease) : worktrees;
    if (!inside(lease, worktrees)) return block('invalid worktree lease');
    const resolve = (value, base = cwd) => {
      // User-scope and artifact URIs are outside this repository.
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value === '~' || value.startsWith('~/')) return null;
      return path.resolve(base, value);
    };
    const check = (value, base = cwd) => {
      if (typeof value !== 'string' || !value) return block('missing write path');
      const target = resolve(value, base);
      return target && inside(target, root) && !inside(target, lease) ?
        block(`write outside leased worktree: ${target} (allowed: ${lease})`) : ALLOW;
    };
    const input = payload.input || {};
    if (payload.toolName === 'write') return check(input.path);
    if (payload.toolName === 'edit' || payload.toolName === 'apply_patch') {
      const patch = typeof input === 'string' ? input : input.input ?? input.patch;
      const targets = [];
      if (typeof input.path === 'string' && input.path) {
        targets.push(input.path);
        for (const edit of input.edits || []) {
          if (edit.rename !== undefined) targets.push(edit.rename);
        }
      }
      if (typeof patch === 'string') {
        let hashline = false;
        let sloppyTarget = false;
        for (const line of patch.split(/\r?\n/)) {
          const file = line.match(/^\*\*\* (?:Add File|Update File|Move to|Delete File): (.+)$/);
          const section = line.match(/^\[([^\]\n]+)#[0-9A-F?]{0,4}\]$/);
          const sloppy = line.match(/^\*\*\* Edit File:(?: (.*))?$/);
          if (file) {
            targets.push(file[1].trim());
            hashline = false;
          } else if (section) {
            targets.push(section[1]);
            hashline = true;
          } else if (sloppy) {
            const target = (sloppy[1] || '').replace(/ all$/, '').trim();
            if (target) { targets.push(target); sloppyTarget = true; }
            else if (!sloppyTarget) return block(`unrecognized edit payload: ${patch.slice(0, 60)}`);
            hashline = false;
          } else if (hashline && line.startsWith('MV ')) {
            const destination = line.slice(3).trim();
            // Hashline moves accept quoted destinations; double quotes use JSON escapes.
            if (destination.startsWith('"')) {
              const target = JSON.parse(destination);
              if (typeof target !== 'string') throw new Error('invalid hashline move destination');
              targets.push(target);
            } else if (destination.startsWith("'")) {
              const parsed = tokens(destination);
              if (parsed.length !== 1) throw new Error('invalid hashline move destination');
              targets.push(parsed[0]);
            } else targets.push(destination);
          }
        }
      }
      if (!targets.length) {
        const description = typeof patch === 'string' ? patch : JSON.stringify(input);
        return block(`unrecognized edit payload: ${description.slice(0, 60)}`);
      }
      for (const target of targets) {
        const hit = check(target);
        if (hit.decision === 'block') return hit;
      }
      return ALLOW;
    }
    if (payload.toolName === 'eval') {
      const source = typeof input === 'string' ? input : input.code ?? input.source ?? '';
      return typeof source === 'string' && source.includes(root) ?
        block(`eval source mentions primary repository: ${root}`) : ALLOW;
    }
    if (payload.toolName !== 'bash') return ALLOW;
    if (typeof input.command !== 'string') return block('missing bash command');
    let base = input.cwd ? path.resolve(cwd, input.cwd) : cwd;
    const words = tokens(input.command);
    const allowed = capabilities[payload.agentName];
    const need = capability => allowed.includes(capability) ? ALLOW :
      block(`${payload.agentName} lacks git capability: ${capability}`);
    const git = argv => {
      let gitCwd = base, i = 0;
      while (i < argv.length && argv[i].startsWith('-')) {
        const arg = argv[i++];
        if (arg === '-C') {
          if (!argv[i]) return block('missing git -C path');
          gitCwd = path.resolve(gitCwd, argv[i++]);
        } else if (arg.startsWith('-C') && arg.length > 2) gitCwd = path.resolve(gitCwd, arg.slice(2));
        else if (arg === '--no-pager' || arg === '--no-optional-locks' || arg === '--literal-pathspecs') continue;
        else return block(`unsupported git global option: ${arg}`);
      }
      const verb = argv[i++], args = argv.slice(i);
      if (!inside(gitCwd, root)) return ALLOW;
      for (let j = 0; j < args.length; j++) {
        if (args[j] === '--output' || args[j].startsWith('--output=')) {
          const hit = check(args[j] === '--output' ? args[++j] : args[j].slice(9), gitCwd);
          if (hit.decision === 'block') return hit;
        }
      }
      if (READ_GIT.has(verb)) return ALLOW;
      if (verb === 'merge') {
        if (!args.includes('--no-ff') || args.some(arg => ['--ff', '--ff-only', '--squash'].includes(arg)))
          return block('git merge requires --no-ff without conflicting merge options');
        return need('merge');
      }
      if (verb === 'rebase') return need('rebase');
      if (verb === 'worktree') {
        const action = args[0];
        if (action === 'list') return ALLOW;
        if (!['add', 'remove'].includes(action)) return block(`unsupported git worktree action: ${action}`);
        if (action === 'remove' && args.some(arg => arg === '--force' || /^-f+$/.test(arg)))
          return block('git worktree remove refuses --force');
        const hit = need(`worktree-${action}`);
        if (hit.decision === 'block') return hit;
        let target;
        for (let j = 1; j < args.length; j++) {
          if (['-b', '-B', '--reason'].includes(args[j])) { j++; continue; }
          if (!args[j].startsWith('-')) { target = args[j]; break; }
        }
        return check(target, gitCwd);
      }
      if (verb === 'branch') {
        const shorts = args.filter(arg => /^-[^-]/.test(arg)).join('');
        if (shorts.includes('D') || shorts.includes('f') || args.includes('--force'))
          return block('git branch deletion requires -d, never -D or --force');
        if (args.includes('--delete')) return block('git branch deletion requires explicit -d');
        if (args.includes('-d')) return need('branch-delete');
        if (!args.length || args.every(arg => ['--list', '-l', '-a', '-r', '--show-current'].includes(arg))) return ALLOW;
        return block('unsupported git branch mutation');
      }
      return inside(gitCwd, lease) ? ALLOW : block(`git ${verb || '(missing verb)'} writes outside leased worktree`);
    };
    let segment = [];
    const run = separator => {
      if (!segment.length) return ALLOW;
      const args = [];
      for (let i = 0; i < segment.length; i++) {
        if (['>', '>>'].includes(segment[i])) {
          const hit = check(segment[++i], base);
          if (hit.decision === 'block') return hit;
        } else if (segment[i] === '<') i++;
        else args.push(segment[i]);
      }
      while (args.length && /^[A-Za-z_]\w*=/.test(args[0])) args.shift();
      while (['command', 'builtin', 'env', 'sudo'].includes(args[0])) args.shift();
      const executable = path.basename(args.shift() || '');
      if (executable === 'cd') {
        if (separator !== '&&' || words.includes('(') || words.includes(')') ||
          args.length !== 1 || args[0].startsWith('-'))
          return block('directory changes require a simple cd path && command chain');
        base = path.resolve(base, args[0] || '~');
        return ALLOW;
      }
      if (executable === 'git') return git(args);
      if (executable === 'find' && args.some(arg => ['-delete', '-exec', '-execdir', '-ok', '-okdir', '-fprint', '-fprintf', '-fls'].includes(arg)))
        return block('find mutation actions are not supported');
      if (READ_SHELL.has(executable)) return ALLOW;
      let operands = args.filter(arg => !arg.startsWith('-'));
      if (executable === 'cp' || executable === 'install') {
        const targetIndex = args.findIndex(arg => arg === '-t' || arg === '--target-directory');
        const targetOption = args.find(arg => arg.startsWith('--target-directory='));
        const shortTarget = args.find(arg => arg.startsWith('-t') && arg.length > 2);
        operands = targetIndex >= 0 ? [args[targetIndex + 1]] :
          targetOption ? [targetOption.slice(19)] : shortTarget ? [shortTarget.slice(2)] : operands.slice(-1);
      }
      if (MUTATORS.has(executable)) {
        for (const operand of operands) {
          const hit = check(operand, base);
          if (hit.decision === 'block') return hit;
        }
      } else {
        for (const arg of args.filter(arg => arg.startsWith('/'))) {
          const hit = check(arg, base);
          if (hit.decision === 'block') return hit;
        }
      }
      return ALLOW;
    };
    for (const word of [...words, ';']) {
      if (['&&', '||', ';', '&', '|', '\n'].includes(word)) {
        const hit = run(word);
        if (hit.decision === 'block') return hit;
        segment = [];
      } else segment.push(word);
    }
    return ALLOW;
  } catch (error) {
    return block(`policy error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

module.exports = { evaluate, restricted, captureLease };
