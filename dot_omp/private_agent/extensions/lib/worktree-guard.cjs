'use strict';

// A deterrent against a drifting model, NOT a sandbox. Shell variables,
// substitutions, scripts, aliases, symlinks, indirect tool dispatch and computed
// eval paths can evade lexical inspection. Git internals are not traced.
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { realpathSync, existsSync, readdirSync } = require('node:fs');
const capabilities = require('../worktree-guard.json');
const ALLOW = Object.freeze({ decision: 'allow' });
const READ_GIT = new Set(['status', 'log', 'show', 'diff', 'rev-parse', 'rev-list',
  'ls-files', 'ls-tree', 'cat-file', 'show-ref', 'for-each-ref', 'merge-base', 'describe']);
const READ_SHELL = new Set(['cat', 'head', 'tail', 'ls', 'pwd', 'grep', 'rg',
  'find', 'stat', 'test', '[', 'echo', 'printf']);
const MUTATORS = new Set(['cp', 'mv', 'rm', 'rmdir', 'tee', 'install', 'touch', 'mkdir', 'truncate']);
const block = reason => ({ decision: 'block', reason: `worktree-guard: ${reason}` });
const inside = (target, root) => target === root || target.startsWith(`${root}/`);

function restricted(agentKind, agentName) {
  return agentKind === 'sub' && Object.hasOwn(capabilities, agentName);
}

function captureAuthorization(messages) {
  const first = messages.find(message => message.role === 'user');
  if (!first) return undefined;
  const text = typeof first.content === 'string' ? first.content :
    (first.content || []).filter(part => part.type === 'text').map(part => part.text).join('\n');
  if (/<\/?worktree-authorization\b/.test(text)) {
    const matches = [...text.matchAll(/<worktree-authorization>([\s\S]*?)<\/worktree-authorization>/g)];
    if (matches.length !== 1 || [...text.matchAll(/<\/?worktree-authorization\b/g)].length !== 2)
      throw new Error('malformed workspace authorization');
    return authorization(JSON.parse(matches[0][1]));
  }
  throw new Error('missing workspace authorization');
}

// Authorization is immutable assignment data, never loaded from mutable progress.
function authorization(value) {
  const fail = () => { throw new Error('invalid workspace authorization'); };
  const keys = (object, names) => object && typeof object === 'object' && !Array.isArray(object) &&
    Object.keys(object).length === names.length && names.every(name => Object.hasOwn(object, name));
  const absolute = value => typeof value === 'string' && path.isAbsolute(value) &&
    path.normalize(value) === value && value !== '/';
  const branch = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value) &&
    !value.includes('..') && !value.includes('//') && !value.endsWith('/') &&
    !value.endsWith('.') && !value.split('/').some(part => part.endsWith('.lock'));
  if (!keys(value, ['version', 'change', 'parentRoot', 'workspace', 'participants']) ||
    value.version !== 1 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value.change) ||
    !absolute(value.parentRoot) || value.workspace !== path.join(value.parentRoot, '.worktrees', value.change) ||
    !Array.isArray(value.participants) || !value.participants.length) fail();
  const paths = new Set(), refs = new Set();
  const participants = value.participants.map(participant => {
    if (!keys(participant, ['path', 'mode', 'access', 'original', 'isolated', 'importRef']) ||
      typeof participant.path !== 'string' || !participant.path ||
      path.isAbsolute(participant.path) || path.normalize(participant.path) !== participant.path ||
      participant.path === '..' || participant.path.startsWith('../') ||
      participant.path.split('/').includes('.git') || paths.has(participant.path) ||
      !['clone', 'worktree'].includes(participant.mode) || !['write', 'read'].includes(participant.access) ||
      !keys(participant.original, ['root', 'commonDir', 'branch', 'head']) ||
      !keys(participant.isolated, ['root', 'branch']) ||
      participant.original.root !== path.resolve(value.parentRoot, participant.path) ||
      participant.isolated.root !== path.resolve(value.workspace, participant.path) ||
      !absolute(participant.original.commonDir) || !branch(participant.original.branch) ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(participant.original.head)) fail();
    if (participant.path === '.' && participant.original.branch === 'HEAD') fail();
    if (participant.path !== '.' && (inside(participant.original.root, path.join(value.parentRoot, '.worktrees')) ||
      participant.path.split('/').includes('.worktrees'))) fail();
    if (participant.access === 'write') {
      if (!branch(participant.isolated.branch) || participant.isolated.branch !== `feat/${value.change}` ||
        participant.original.branch === participant.isolated.branch ||
        typeof participant.importRef !== 'string' ||
        !participant.importRef.startsWith(`refs/omp/import/${value.change}/`) ||
        !branch(participant.importRef) || refs.has(participant.importRef)) fail();
      refs.add(participant.importRef);
    } else if (participant.isolated.branch !== null || participant.importRef !== null) fail();
    paths.add(participant.path);
    return Object.freeze({ ...participant, original: Object.freeze({ ...participant.original }),
      isolated: Object.freeze({ ...participant.isolated }) });
  });
  if (!participants.some(participant => participant.path === '.' &&
    participant.access === 'write' && participant.mode === 'worktree')) fail();
  return Object.freeze({ ...value, participants: Object.freeze(participants) });
}

function inspectGit(directory, args) {
  return execFileSync('git', ['-C', directory, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000,
  }).trim();
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
  if (!restricted(payload.agentKind, payload.agentName)) return ALLOW;
  try {
    const contract = authorization(payload.authorization);
    const root = contract.parentRoot;
    const cwd = path.resolve(payload.cwd || root);
    const lease = contract.workspace;
    const participants = [...contract.participants].sort((a, b) =>
      b.original.root.length - a.original.root.length);
    const participantAt = (target, location) => participants.find(item => inside(target, item[location].root));
    const readGit = payload.inspectGit || inspectGit;
    const exists = payload.pathExists || existsSync;
    const directoryEntries = payload.readDirectory || readdirSync;
    const canonical = payload.inspectGit ? value => value : value => realpathSync(value);
    const identity = (participant, location) => {
      const directory = participant[location].root;
      const common = readGit(directory, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
      const expected = location === 'original' || participant.mode === 'worktree' ?
        participant.original.commonDir : path.join(directory, '.git');
      if (canonical(common) !== canonical(expected) ||
        canonical(readGit(directory, ['rev-parse', '--show-toplevel'])) !== canonical(directory))
        throw new Error(`repository identity mismatch: ${directory}`);
      return {
        branch: readGit(directory, ['rev-parse', '--abbrev-ref', 'HEAD']),
        head: readGit(directory, ['rev-parse', 'HEAD']),
      };
    };
    const gitlink = participant => {
      const parent = participants.find(item => item !== participant &&
        inside(participant.isolated.root, item.isolated.root));
      if (!parent || !exists(parent.isolated.root)) return null;
      const parentState = identity(parent, 'isolated');
      if (parentState.branch !== (parent.access === 'write' ? parent.isolated.branch : 'HEAD') ||
        parent.access === 'read' && parentState.head !== parent.original.head)
        throw new Error('enclosing isolated participant changed');
      const relative = path.relative(parent.isolated.root, participant.isolated.root);
      const index = readGit(parent.isolated.root, ['ls-files', '--stage', '-z', '--', relative]);
      const tree = readGit(parent.isolated.root, ['ls-tree', '-z', 'HEAD', '--', relative]);
      if (!index.startsWith('160000 ') && !tree.startsWith('160000 ')) return null;
      const [metadata, filename, ...extra] = index.split('\t');
      const fields = metadata.split(' ');
      if (extra.length || filename !== `${relative}\0` || fields.length !== 3 ||
        fields[0] !== '160000' || fields[2] !== '0' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(fields[1]))
        throw new Error('parent gitlink index is not an exact stage-zero entry');
      if (tree !== `160000 commit ${fields[1]}\t${relative}\0`)
        throw new Error('parent gitlink HEAD and index differ');
      return { parent, head: fields[1] };
    };
    const placeholder = participant => exists(participant.isolated.root) &&
      directoryEntries(participant.isolated.root).length === 0 && !!gitlink(participant);
    const activeDescendants = participant => participants.some(item => item !== participant &&
      inside(item.isolated.root, participant.isolated.root) &&
      exists(item.isolated.root) && !placeholder(item));
    const originalState = participant => {
      const state = identity(participant, 'original');
      if (state.branch !== participant.original.branch) throw new Error('original branch changed');
      if (state.head !== participant.original.head) {
        // Resumes and a final parent gitlink repair can advance the import ref.
        // Every primary first-parent step must still be an imported merge, not
        // an arbitrary original commit; progress text never grants authority.
        const imported = readGit(participant.original.root, ['rev-parse', '--verify', participant.importRef]);
        if (participant.access !== 'write') throw new Error('read-only original changed');
        let cursor = state.head;
        const seen = new Set();
        while (cursor !== participant.original.head) {
          if (seen.has(cursor)) throw new Error('invalid original merge history');
          seen.add(cursor);
          const parents = readGit(participant.original.root,
            ['show', '-s', '--format=%P', cursor === state.head ? 'HEAD' : cursor]).split(' ');
          if (parents.length !== 2 || readGit(participant.original.root,
            ['merge-base', imported, parents[1]]) !== parents[1])
            throw new Error('original HEAD diverged from authorization baseline');
          cursor = parents[0];
        }
      }
      return state;
    };
    const integrated = participant => {
      const state = originalState(participant);
      if (state.head === participant.original.head) {
        const status = readGit(participant.original.root,
          ['status', '--porcelain=v1', '--untracked-files=all', '--ignored']);
        const ownedWorkspace = `${path.relative(participant.original.root, contract.workspace)}/`;
        if (status.split('\n').some(line => line &&
          !(participant.path === '.' && line.startsWith(`!! ${ownedWorkspace}`))))
          throw new Error('unchanged original is not clean');
        if (exists(participant.isolated.root) && !placeholder(participant)) {
          const isolated = identity(participant, 'isolated');
          if (isolated.branch !== participant.isolated.branch || isolated.head !== state.head ||
            readGit(participant.isolated.root, ['status', '--porcelain=v1', '--untracked-files=all', '--ignored']))
            throw new Error('unchanged isolated participant is not clean at baseline');
        }
        // Absence is safe after no-op cleanup; never invent an import/merge.
        // Any extant feature/import ref must nevertheless prove the baseline.
        for (const ref of [participant.importRef,
          ...(participant.mode === 'worktree' ? [`refs/heads/${participant.isolated.branch}`] : [])]) {
          const tip = readGit(participant.original.root, ['for-each-ref', '--format=%(objectname)', '--', ref]);
          if (tip && tip !== state.head) throw new Error('unchanged participant ref differs from baseline');
        }
        return state.head;
      }
      const imported = readGit(participant.original.root, ['rev-parse', '--verify', participant.importRef]);
      if (readGit(participant.original.root, ['merge-base', state.head, imported]) !== imported)
        throw new Error('participant is not integrated');
      return imported;
    };
    const resolve = (value, base = cwd) => {
      // User-scope and artifact URIs are outside this repository.
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value === '~' || value.startsWith('~/')) return null;
      return path.resolve(base, value);
    };
    const check = (value, base = cwd) => {
      if (typeof value !== 'string' || !value) return block('missing write path');
      const target = resolve(value, base);
      if (!target || !inside(target, root)) return ALLOW;
      if (!inside(target, lease))
        return block(`write outside authorized workspace: ${target} (allowed: ${lease})`);
      const participant = participantAt(target, 'isolated');
      return participant && participant.access === 'read' ?
        block(`write to read-only participant: ${target}`) : ALLOW;
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
      if (verb === 'clone') {
        const positional = args.filter(arg => !arg.startsWith('-'));
        if (positional.length !== 2 || args.some(arg => arg.startsWith('-') &&
          !['--no-hardlinks', '--no-checkout', '--'].includes(arg)))
          return block('clone requires literal source and destination without unsupported options');
        const source = path.resolve(gitCwd, positional[0]), destination = path.resolve(gitCwd, positional[1]);
        if (!inside(source, root) && !inside(destination, root)) return ALLOW;
        const participant = participants.find(item => item.original.root === source && item.isolated.root === destination);
        if (!participant || participant.mode !== 'clone' || !args.includes('--no-hardlinks') ||
          !args.includes('--no-checkout')) return block('clone is not an authorized participant preparation');
        const hit = need('clone');
        if (hit.decision === 'block') return hit;
        if (originalState(participant).head !== participant.original.head)
          return block('clone preparation requires original baseline');
        return ALLOW;
      }
      if (!inside(gitCwd, root)) {
        if (verb === 'worktree' && ['add', 'remove'].includes(args[0])) {
          for (let index = 1; index < args.length; index++) {
            if (['-b', '-B', '--reason'].includes(args[index])) { index++; continue; }
            if (!args[index].startsWith('-')) {
              if (inside(path.resolve(gitCwd, args[index]), root))
                return block('worktree administration requires an authorized original repository');
              break;
            }
          }
        }
        return ALLOW;
      }
      for (let j = 0; j < args.length; j++) {
        if (args[j] === '--output' || args[j].startsWith('--output=')) {
          const hit = check(args[j] === '--output' ? args[++j] : args[j].slice(9), gitCwd);
          if (hit.decision === 'block') return hit;
        }
      }
      if (READ_GIT.has(verb)) return ALLOW;
      if (verb === 'branch' && args.every(arg =>
        ['--list', '-l', '-a', '-r', '--show-current', '--no-color', '-v', '-vv', '--verbose'].includes(arg)))
        return ALLOW;
      {
        const isolated = participantAt(gitCwd, 'isolated');
        const original = participantAt(gitCwd, 'original');
        const exactOriginal = original && gitCwd === original.original.root;
        if (verb === 'worktree') {
          if (args[0] === 'list') return ALLOW;
          if (args.some(arg => arg === '--force' || /^-f+$/.test(arg) || arg === '-B'))
            return block('forced worktree administration is forbidden');
          if (!exactOriginal) return block('worktree administration requires exact original repository');
          const hit = need(`worktree-${args[0]}`);
          if (hit.decision === 'block') return hit;
          if (args[0] === 'add') {
            const read = original.access === 'read';
            const expected = read ? ['add', '--detach', original.isolated.root, original.original.head] :
              ['add', '-b', original.isolated.branch, original.isolated.root, original.original.head];
            const normalized = [...args];
            const index = read ? 2 : 3;
            if (normalized[index]) normalized[index] = path.resolve(gitCwd, normalized[index]);
            if (original.mode !== 'worktree' || JSON.stringify(normalized) !== JSON.stringify(expected) ||
              originalState(original).head !== original.original.head)
              return block('worktree add differs from authorized participant');
            return ALLOW;
          }
          if (args[0] === 'remove' && args.length === 2 &&
            path.resolve(gitCwd, args[1]) === original.isolated.root && original.mode === 'worktree') {
            if (activeDescendants(original))
              return block('remove descendant participants before worktree cleanup');
            const state = identity(original, 'isolated');
            if (original.access === 'write') {
              const imported = integrated(original);
              if (state.branch !== original.isolated.branch ||
                ![imported, originalState(original).head].includes(state.head))
                return block('worktree cleanup would discard unintegrated work');
            } else if (originalState(original).head !== original.original.head ||
              state.head !== original.original.head || state.branch !== 'HEAD')
              return block('read-only participant changed');
            return ALLOW;
          }
          return block('unsupported worktree administration');
        }
        if (exactOriginal) {
          if (original.access !== 'write') return block('original participant is read-only');
          originalState(original);
          if (verb === 'fetch') {
            const hit = need('import');
            if (hit.decision === 'block') return hit;
            const expected = ['--no-tags', original.isolated.root,
              `refs/heads/${original.isolated.branch}:${original.importRef}`];
            if (JSON.stringify(args) !== JSON.stringify(expected))
              return block('fetch must import the exact isolated feature ref');
            if (identity(original, 'isolated').branch !== original.isolated.branch)
              return block('isolated feature branch changed');
            return ALLOW;
          }
          if (verb === 'merge') {
            const hit = need('merge');
            if (hit.decision === 'block') return hit;
            const mergeArgs = [...args];
            const message = mergeArgs.indexOf('-m');
            if (message >= 0) {
              if (message + 1 >= mergeArgs.length) return block('missing merge message');
              mergeArgs.splice(message, 2);
            }
            const noEdit = mergeArgs.indexOf('--no-edit');
            if (noEdit >= 0) mergeArgs.splice(noEdit, 1);
            if (mergeArgs.length !== 2 || mergeArgs[0] !== '--no-ff' || mergeArgs[1] !== original.importRef)
              return block('original merge requires --no-ff and authorized import ref');
            const isolatedState = identity(original, 'isolated');
            if (isolatedState.branch !== original.isolated.branch ||
              readGit(gitCwd, ['rev-parse', '--verify', original.importRef]) !== isolatedState.head)
              return block('import ref does not match isolated feature HEAD');
            return ALLOW;
          }
          if ((verb === 'checkout' || verb === 'switch') && args.length === 1 &&
            args[0] === original.original.branch) return need('checkout-primary');
          if (verb === 'branch' && args.length === 2 && args[0] === '-d' &&
            args[1] === original.isolated.branch && original.mode === 'worktree') {
            const hit = need('branch-delete');
            if (hit.decision === 'block') return hit;
            integrated(original);
            return ALLOW;
          }
          if (verb === 'update-ref' && args.length === 3 && args[0] === '-d' &&
            args[1] === original.importRef) {
            const hit = need('import-cleanup');
            if (hit.decision === 'block') return hit;
            const link = gitlink(original);
            if (exists(original.isolated.root) && !placeholder(original))
              return block('remove isolated repository before deleting its import ref');
            if (link && (!placeholder(original) || link.head !== originalState(original).head))
              return block('restore the integrated gitlink placeholder before deleting its import ref');
            if (original.mode === 'worktree' && readGit(original.original.root,
              ['for-each-ref', '--format=%(objectname)', '--', `refs/heads/${original.isolated.branch}`]))
              return block('delete the isolated feature branch before its import ref');
            return args[2] === integrated(original) ? ALLOW : block('import cleanup requires the exact imported HEAD');
          }
          return block(`git ${verb} cannot mutate an original repository`);
        }
        if (!isolated) return block('Git mutation outside declared isolated repositories');
        if (canonical(readGit(gitCwd, ['rev-parse', '--show-toplevel'])) !== canonical(isolated.isolated.root))
          return block('Git cwd belongs to an undeclared nested repository');
        const isolatedState = identity(isolated, 'isolated');
        if (isolated.access === 'read') {
          if (verb === 'checkout' && args.length === 2 && args[0] === '--detach' &&
            args[1] === isolated.original.head && gitCwd === isolated.isolated.root &&
            isolated.mode === 'clone' && originalState(isolated).head === isolated.original.head)
            return need('clone');
          return block('Git mutation in read-only participant');
        }
        if (['checkout', 'switch'].includes(verb)) {
          if (gitCwd === isolated.isolated.root && isolated.mode === 'clone' &&
            JSON.stringify(args) === JSON.stringify(['-b', isolated.isolated.branch, isolated.original.head]))
            return need('clone');
          if (args.length !== 1 || args[0] !== isolated.isolated.branch)
            return block('checkout must stay on authorized feature branch');
        } else if (isolatedState.branch !== isolated.isolated.branch)
          return block('isolated feature branch changed');
        if (verb === 'fetch') {
          const hit = need('import');
          if (hit.decision === 'block') return hit;
          if (JSON.stringify(args) !== JSON.stringify(['--no-tags', isolated.original.root,
            isolated.original.branch === 'HEAD' ? 'HEAD' : `refs/heads/${isolated.original.branch}`]))
            return block('isolated fetch must name the exact original primary ref');
          originalState(isolated);
          return ALLOW;
        }
        if (verb === 'merge' && args.length === 2 && args[0] === '--ff-only' && args[1] === 'FETCH_HEAD') {
          const hit = need('merge');
          if (hit.decision === 'block') return hit;
          const state = originalState(isolated);
          if (readGit(isolated.isolated.root, ['rev-parse', '--verify', 'FETCH_HEAD']) !== state.head)
            return block('FETCH_HEAD is not the original primary HEAD');
          return ALLOW;
        }
        if (verb === 'rebase') {
          const hit = need('rebase');
          if (hit.decision === 'block') return hit;
          const state = originalState(isolated);
          return args.length === 1 && [state.head, isolated.original.branch, 'FETCH_HEAD'].includes(args[0]) &&
            readGit(isolated.isolated.root, ['rev-parse', '--verify', args[0]]) === state.head ?
            ALLOW : block('rebase must target the authorized original primary HEAD');
        }
        if (!['add', 'commit', 'reset', 'restore', 'checkout', 'switch', 'update-index', 'rm', 'mv', 'merge'].includes(verb))
          return block('unsupported isolated Git mutation');
        if (args.some(arg => arg === '--recurse-submodules' || arg.startsWith('--recurse-submodules=')))
          return block('recursive submodule mutation is not authorized');
      }
      if (verb === 'merge') {
        if (!args.includes('--no-ff') || args.some(arg => ['--ff', '--ff-only', '--squash'].includes(arg)))
          return block('git merge requires --no-ff without conflicting merge options');
        return need('merge');
      }
      return ALLOW;
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
      if (executable === 'mkdir' && args.length === 2 && args[0] === '--') {
        const target = path.resolve(base, args[1]);
        const participant = participants.find(item => item.isolated.root === target);
        if (participant) {
          const hit = need('gitlink-placeholder');
          if (hit.decision === 'block') return hit;
          if (exists(target)) return block('gitlink placeholder must replace a removed participant');
          const link = gitlink(participant);
          if (!link) return block('placeholder requires an exact committed parent gitlink');
          if (participant.access === 'write') integrated(participant);
          const state = originalState(participant);
          if (link.head !== state.head ||
            participant.access === 'read' && state.head !== participant.original.head)
            return block('gitlink does not match integrated participant HEAD');
          return ALLOW;
        }
      }
      if (executable === 'rm' && args.length === 3 && args[0] === '-r' && args[1] === '--') {
        const target = path.resolve(base, args[2]);
        const participant = participants.find(item => item.isolated.root === target && item.mode === 'clone');
        if (participant) {
          const hit = need('clone-remove');
          if (hit.decision === 'block') return hit;
          if (activeDescendants(participant))
            return block('remove descendant participants before clone cleanup');
          if (readGit(target, ['status', '--porcelain=v1', '--untracked-files=all', '--ignored']))
            return block('clone cleanup refuses modified, untracked or ignored files');
          const state = identity(participant, 'isolated');
          if (participant.access === 'write') {
            const imported = integrated(participant);
            if (state.branch !== participant.isolated.branch ||
              ![imported, originalState(participant).head].includes(state.head))
              return block('clone cleanup would discard unintegrated work');
          } else if (state.head !== participant.original.head || state.branch !== 'HEAD' ||
            originalState(participant).head !== participant.original.head)
            return block('read-only clone changed before cleanup');
          return ALLOW;
        }
      }
      let operands = args.filter(arg => !arg.startsWith('-'));
      if (executable === 'cp' || executable === 'install') {
        const targetIndex = args.findIndex(arg => arg === '-t' || arg === '--target-directory');
        const targetOption = args.find(arg => arg.startsWith('--target-directory='));
        const shortTarget = args.find(arg => arg.startsWith('-t') && arg.length > 2);
        operands = targetIndex >= 0 ? [args[targetIndex + 1]] :
          targetOption ? [targetOption.slice(19)] : shortTarget ? [shortTarget.slice(2)] : operands.slice(-1);
      }
      if (MUTATORS.has(executable)) {
        if (executable === 'cp' &&
          args.some(arg => ['--recursive', '--archive'].includes(arg) || /^-[^-]*[rRa]/.test(arg))) {
          for (const operand of operands) {
            const target = resolve(operand, base);
            if (target && participants.some(item => item.access === 'read' &&
              inside(item.isolated.root, target)))
              return block('recursive copy could overwrite a read-only participant');
          }
        }
        for (const operand of operands) {
          const hit = check(operand, base);
          if (hit.decision === 'block') return hit;
          if (['rm', 'rmdir', 'mv'].includes(executable)) {
            const target = resolve(operand, base);
            if (target && participants.some(item => inside(item.isolated.root, target)))
              return block('participant roots require authorized archive cleanup');
          }
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

module.exports = { evaluate, restricted, captureAuthorization };
