import { spawn } from 'node:child_process';
import { lstat, mkdir, mkdtemp, open, readFile, realpath, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePaths = ['themes/light', 'themes/adaptive', 'themes/rex'];
const maxBytes = 128 * 1024 * 1024;

export function normalizeSiteBase(value) {
  if (typeof value !== 'string' || value !== value.trim()) throw new Error('Site base must be an explicit HTTPS URL.');
  let url;
  try { url = new URL(value); } catch { throw new Error('Site base must be an explicit HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash ||
      url.pathname.includes('//') || url.pathname.includes('%') ||
      url.href.replace(/\/$/, '') !== value.replace(/\/$/, '')) {
    throw new Error('Site base must be a canonical HTTPS site URL without credentials, query, fragment or encoded path.');
  }
  return url.href.replace(/\/$/, '');
}

export function createThemeSubscriptions(source, { repository, assetRef, siteBase }) {
  if (typeof repository !== 'string' || repository !== repository.trim() ||
      !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9_.-]{1,100}$/.test(repository) ||
      ['.', '..'].includes(repository.split('/')[1])) throw new Error('Repository must be owner/repo.');
  if (typeof assetRef !== 'string' || assetRef.length !== 40 || !/^[0-9a-f]{40}$/i.test(assetRef)) {
    throw new Error('Asset ref must be a complete 40-character commit SHA.');
  }
  const ref = assetRef.toLowerCase();
  const site = normalizeSiteBase(siteBase);
  if (!source || !Array.isArray(source.filters) || !source.filters.length || !Array.isArray(source.groups)) {
    throw new Error('Source must contain groups and filters arrays.');
  }
  const subscriptions = {};
  const ids = new Set();
  for (const filter of source.filters) {
    if (!filter || typeof filter.id !== 'string' || filter.id !== filter.id.trim() ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(filter.id) || ids.has(filter.id)) {
      throw new Error('Filter IDs must be unique safe path components.');
    }
    ids.add(filter.id);
  }
  for (const theme of ['dark', 'light', 'adaptive', 'web-adaptive']) {
    subscriptions[theme] = structuredClone(source);
    for (const filter of subscriptions[theme].filters) {
      filter.imageURL = theme === 'web-adaptive'
        ? `${site}/themes/releases/${ref}/${filter.id}.svg`
        : `https://raw.githubusercontent.com/${repository}/${ref}/${theme === 'dark' ? 'badges/png' : theme === 'light' ? 'themes/light' : 'themes/rex'}/${filter.id}.png`;
    }
  }
  return subscriptions;
}

async function git(root, args, input) {
  // File descriptors support Windows environments that prohibit child-process pipes.
  const ioRoot = await mkdtemp(path.join(tmpdir(), 'cine-marks-theme-git-'));
  const paths = [path.join(ioRoot, 'stdin'), path.join(ioRoot, 'stdout')];
  const handles = [];
  try {
    await writeFile(paths[0], input ?? '');
    handles.push(await open(paths[0], 'r'));
    handles.push(await open(paths[1], 'w+'));
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn('git', ['-C', root, ...args], {
        windowsHide: true, stdio: [handles[0].fd, handles[1].fd, 'ignore']
      });
      child.once('error', reject);
      child.once('close', resolve);
    });
    if (exitCode !== 0) throw Object.assign(new Error(`Git ${args[0]} failed (exit ${exitCode}).`), { exitCode });
    if ((await handles[1].stat()).size > maxBytes) throw new Error('Git output exceeds 128 MiB.');
    return await readFile(paths[1]);
  } finally {
    await Promise.allSettled(handles.map(handle => handle.close()));
    await Promise.allSettled(paths.map(filename => unlink(filename)));
    await rmdir(ioRoot);
  }
}

function samePath(a, b) {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

async function readSourceFile(root, relative) {
  const filename = path.join(root, ...relative.split('/'));
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || !samePath(await realpath(filename), filename)) {
    throw new Error(`Theme source must be a regular file without symlinks: ${relative}`);
  }
  return readFile(filename);
}

async function ensureClean(root, ref) {
  for (const args of [
    ['diff', '--quiet', ref, '--', ...sourcePaths],
    ['diff', '--cached', '--quiet', ref, '--', ...sourcePaths]
  ]) {
    try { await git(root, args); }
    catch (error) {
      if (error.exitCode === 1) throw new Error('Uncommitted theme sources differ from the asset commit.');
      throw error;
    }
  }
  if ((await git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...sourcePaths])).length) {
    throw new Error('Untracked theme sources must be committed before publishing.');
  }
}

function readTree(raw) {
  const tree = new Map();
  for (const entry of raw.toString('utf8').split('\0').filter(Boolean)) {
    const match = /^(\d+) (\w+) ([a-f0-9]{40})\t([\s\S]+)$/.exec(entry);
    if (!match) throw new Error('Unexpected Git tree entry.');
    tree.set(match[4], { mode: match[1], type: match[2], oid: match[3] });
  }
  return tree;
}

function readBlobs(raw, oids) {
  const blobs = new Map();
  let offset = 0;
  for (const oid of oids) {
    const newline = raw.indexOf(10, offset);
    if (newline < 0) throw new Error('Truncated Git blob response.');
    const match = /^([a-f0-9]{40}) blob (\d+)$/.exec(raw.toString('ascii', offset, newline));
    if (!match || match[1] !== oid) throw new Error('Unexpected Git blob response.');
    const size = Number(match[2]);
    offset = newline + 1;
    if (!Number.isSafeInteger(size) || offset + size >= raw.length || raw[offset + size] !== 10) {
      throw new Error('Truncated Git blob bytes.');
    }
    blobs.set(oid, raw.subarray(offset, offset + size));
    offset += size + 1;
  }
  if (offset !== raw.length) throw new Error('Unexpected trailing Git blob response.');
  return blobs;
}

export async function prepareThemeBuild({ root = defaultRoot, repository, assetRef, siteBase } = {}) {
  if (repository === undefined || assetRef === undefined || siteBase === undefined) {
    throw new Error('Repository, asset ref and site base must all be supplied explicitly.');
  }
  const resolvedRoot = await realpath(path.resolve(root));
  const base = await import(pathToFileURL(path.join(resolvedRoot, 'scripts', 'build-github.mjs')).href);
  const repo = base.normalizeRepository(repository);
  const ref = base.normalizeAssetRef(assetRef);
  const site = normalizeSiteBase(siteBase);
  // Reuse the dark/source-config validation, including exact committed PNG bytes and Git-root checks.
  const dark = await base.prepareGithubBuild({ root: resolvedRoot, repository: repo, assetRef: ref });
  await ensureClean(resolvedRoot, ref);
  const tree = readTree(await git(resolvedRoot, ['ls-tree', '-r', '-z', '--full-tree', ref, '--', ...sourcePaths]));
  const files = [];
  for (const filter of dark.subscription.filters) {
    for (const [theme, extension] of [['light', 'png'], ['adaptive', 'svg'], ['rex', 'png']]) {
      const relative = `themes/${theme}/${filter.id}.${extension}`;
      const entry = tree.get(relative);
      if (!entry || entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode)) {
        throw new Error(`Theme source is not a tracked regular file in the asset commit: ${relative}`);
      }
      files.push({ relative, id: filter.id, theme, oid: entry.oid, bytes: await readSourceFile(resolvedRoot, relative) });
    }
  }
  const oids = [...new Set(files.map(file => file.oid))];
  const blobs = readBlobs(await git(resolvedRoot, ['cat-file', '--batch'], `${oids.join('\n')}\n`), oids);
  for (const file of files) {
    if (!file.bytes.equals(blobs.get(file.oid))) throw new Error(`Theme source bytes differ from asset commit: ${file.relative}`);
    if (file.theme !== 'adaptive') base.validatePng(file.bytes, file.relative);
    else {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(file.bytes);
      if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/.test(text) ||
          !/\bxmlns\s*=\s*['"]http:\/\/www\.w3\.org\/2000\/svg['"]/.test(text) ||
          !/<\/svg>\s*$/.test(text)) throw new Error(`Invalid SVG document: ${file.relative}`);
    }
  }
  await ensureClean(resolvedRoot, ref);
  return {
    root: resolvedRoot, repository: repo, assetRef: ref, siteBase: site,
    subscriptions: createThemeSubscriptions(dark.subscription, { repository: repo, assetRef: ref, siteBase: site }),
    releaseRelative: `themes/releases/${ref}`,
    adaptiveFiles: files.filter(file => file.theme === 'adaptive'),
    filters: dark.subscription.filters.length,
    lightBytes: files.filter(file => file.theme === 'light').reduce((sum, file) => sum + file.bytes.length, 0),
    rexBytes: files.filter(file => file.theme === 'rex').reduce((sum, file) => sum + file.bytes.length, 0),
    adaptiveBytes: files.filter(file => file.theme === 'adaptive').reduce((sum, file) => sum + file.bytes.length, 0)
  };
}

async function inspectDestination(root, relative) {
  const parts = relative.split('/');
  let current = root;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    let stat;
    try { stat = await lstat(current); }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
      throw new Error(`Output path must contain only regular directories/files: ${relative}`);
    }
  }
  return true;
}

export async function buildThemeSubscriptions(options = {}) {
  const build = await prepareThemeBuild(options);
  const jsonOutputs = new Map(Object.entries(build.subscriptions).map(([theme, subscription]) =>
    [`badges-${theme}.json`, JSON.stringify(subscription, null, 2) + '\n']));
  // Rex's own monochrome detection and label-color tint implement theme switching.
  // No theme or rendering-mode key is added to the imported rule schema.
  jsonOutputs.set('badges-rex.json', jsonOutputs.get('badges-adaptive.json'));
  jsonOutputs.set('badges-rex-adaptive.json', jsonOutputs.get('badges-adaptive.json'));
  jsonOutputs.set('badges-rex-dark.json', jsonOutputs.get('badges-dark.json'));
  const releases = [];
  for (const file of build.adaptiveFiles) {
    const relative = `${build.releaseRelative}/${file.id}.svg`;
    const exists = await inspectDestination(build.root, relative);
    const filename = path.join(build.root, ...relative.split('/'));
    if (exists && !(await readFile(filename)).equals(file.bytes)) {
      throw new Error(`Immutable release already exists with different bytes: ${relative}`);
    }
    releases.push({ filename, exists, bytes: file.bytes });
  }
  for (const filename of jsonOutputs.keys()) {
    await inspectDestination(build.root, filename);
  }
  // Validate every destination before producing output. Existing release bytes are never rewritten.
  await mkdir(path.join(build.root, ...build.releaseRelative.split('/')), { recursive: true });
  for (const release of releases) if (!release.exists) await writeFile(release.filename, release.bytes, { flag: 'wx' });
  for (const [filename, content] of jsonOutputs) {
    await writeFile(path.join(build.root, filename), content, 'utf8');
  }
  return build;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    const key = { '--repository': 'repository', '--asset-ref': 'assetRef', '--site-base': 'siteBase' }[arg];
    if (!key || options[key] !== undefined || !argv[index + 1] || argv[index + 1].startsWith('--')) {
      throw new Error('Usage: node scripts/build-theme-subscriptions.mjs --repository owner/repo --asset-ref <40-character commit SHA> --site-base https://owner.github.io/repo');
    }
    options[key] = argv[++index];
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node scripts/build-theme-subscriptions.mjs --repository owner/repo --asset-ref <40-character commit SHA> --site-base https://owner.github.io/repo\nAll arguments are required. Reads committed source assets. Writes native PNG badges-adaptive.json with identical badges-rex.json and badges-rex-adaptive.json aliases; fixed badges-light.json and badges-dark.json with badges-rex-dark.json alias; browser badges-web-adaptive.json. Preserves SVG releases under themes/releases/<full SHA>/. No commits, pushes or network requests.');
    return;
  }
  const build = await buildThemeSubscriptions(options);
  console.log(JSON.stringify({
    repository: build.repository, assetRef: build.assetRef, siteBase: build.siteBase,
    filters: build.filters, lightBytes: build.lightBytes, adaptiveBytes: build.adaptiveBytes, rexBytes: build.rexBytes,
    releaseDirectory: build.releaseRelative,
    note: 'Built locally. Commit and push generated JSON and release SVG files. Rex native PNG requires its monochrome adaptation setting; runtime display must be verified on the consumer device.'
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(`Theme build failed: ${error.message}`); process.exitCode = 1; });
}
