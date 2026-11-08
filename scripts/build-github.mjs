import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstat, mkdtemp, open, readFile, realpath, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const safeId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const sourcePaths = ['badges.relative.json', 'badges/png'];
const maxBytes = 128 * 1024 * 1024;

export function normalizeRepository(value) {
  if (typeof value !== 'string' || value !== value.trim()) {
    throw new Error('Repository must be owner/repo without whitespace.');
  }
  const parts = value.split('/');
  if (parts.length !== 2 ||
      !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(parts[0]) ||
      !/^[A-Za-z0-9_.-]{1,100}$/.test(parts[1]) || ['.', '..'].includes(parts[1])) {
    throw new Error('Repository must be a valid GitHub owner/repo, without a URL or extra path.');
  }
  return value;
}

export function normalizeAssetRef(value) {
  if (typeof value !== 'string' || value.length !== 40 || !/^[0-9a-f]{40}$/i.test(value)) {
    throw new Error('Asset ref must be a complete 40-character commit SHA.');
  }
  return value.toLowerCase();
}

export function repositoryFromOrigin(value) {
  const remote = typeof value === 'string' ? value.trim() : '';
  const scp = /^git@github\.com:([^\s]+)$/.exec(remote);
  let repository;
  if (scp) {
    repository = scp[1];
  } else {
    let url;
    try { url = new URL(remote); } catch { throw new Error('Origin must be a GitHub HTTPS or SSH URL.'); }
    if (url.hostname.toLowerCase() !== 'github.com' || url.port || url.search || url.hash ||
        !['https:', 'ssh:'].includes(url.protocol) || url.password ||
        (url.protocol === 'https:' && url.username) ||
        (url.protocol === 'ssh:' && url.username !== 'git')) {
      throw new Error('Origin must be a GitHub HTTPS or SSH URL without credentials or extra URL fields.');
    }
    repository = url.pathname.slice(1);
  }
  return normalizeRepository(repository.replace(/\/$/, '').replace(/\.git$/, ''));
}

export function createSubscription(source, { repository, assetRef }) {
  const repo = normalizeRepository(repository);
  const ref = normalizeAssetRef(assetRef);
  if (!source || !Array.isArray(source.groups) || !source.groups.length ||
      !Array.isArray(source.filters) || !source.filters.length) {
    throw new Error('Source must contain nonempty groups and filters arrays.');
  }
  const groupIds = new Set();
  for (const group of source.groups) {
    if (!group || typeof group.id !== 'string' || !group.id || groupIds.has(group.id)) {
      throw new Error('Group IDs must be nonempty, unique strings.');
    }
    groupIds.add(group.id);
  }
  const ids = new Set();
  const result = structuredClone(source);
  for (let index = 0; index < source.filters.length; index++) {
    const filter = source.filters[index];
    if (!filter || typeof filter.id !== 'string' || filter.id !== filter.id.trim() ||
        !safeId.test(filter.id) || ids.has(filter.id)) {
      throw new Error(`Invalid or duplicate filter ID at index ${index}.`);
    }
    ids.add(filter.id);
    if (!groupIds.has(filter.groupId)) throw new Error(`Unknown group for filter ${filter.id}.`);
    if (typeof filter.pattern !== 'string' || typeof filter.name !== 'string' ||
        typeof filter.isEnabled !== 'boolean') {
      throw new Error(`Missing rule fields for filter ${filter.id}.`);
    }
    const imagePath = `badges/png/${filter.id}.png`;
    if (filter.imageURL !== imagePath) throw new Error(`Unexpected source image path for ${filter.id}.`);
    result.filters[index].imageURL = `https://raw.githubusercontent.com/${repo}/${ref}/${imagePath}`;
  }
  return result;
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function validatePng(bytes, label = 'image') {
  const fail = message => { throw new Error(`Invalid PNG ${label}: ${message}`); };
  if (!Buffer.isBuffer(bytes) || bytes.length < 45 || !bytes.subarray(0, 8).equals(pngSignature)) {
    fail('signature or length');
  }
  let offset = 8, width, height, depth, color, interlace, seenPalette = false, idatEnded = false, ended = false;
  const idats = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) fail('truncated chunk');
    const size = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(type) || size > bytes.length - offset - 12) fail('chunk type or size');
    const data = bytes.subarray(offset + 8, offset + 8 + size);
    if (crc32(bytes.subarray(offset + 4, offset + 8 + size)) !== bytes.readUInt32BE(offset + 8 + size)) {
      fail(`CRC mismatch in ${type}`);
    }
    if (offset === 8 && type !== 'IHDR') fail('IHDR must be first');
    if (type === 'IHDR') {
      if (width !== undefined || size !== 13) fail('invalid IHDR');
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; color = data[9]; interlace = data[12];
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!width || !height || width > 0x7fffffff || height > 0x7fffffff ||
          !depths[color]?.includes(depth) || data[10] !== 0 || data[11] !== 0 || interlace > 1) {
        fail('unsupported or invalid header fields');
      }
    } else if (type === 'PLTE') {
      if (seenPalette || idats.length || !size || size % 3 || size > 768 || [0, 4].includes(color) ||
          (color === 3 && size / 3 > 2 ** depth)) fail('invalid palette');
      seenPalette = true;
    } else if (type === 'IDAT') {
      if (idatEnded || (color === 3 && !seenPalette)) fail('invalid IDAT order or missing palette');
      idats.push(data);
    } else if (type === 'IEND') {
      if (size || !idats.length || offset + 12 !== bytes.length) fail('invalid IEND or trailing bytes');
      ended = true;
    } else if (type[0] === type[0].toUpperCase()) {
      fail(`unknown critical chunk ${type}`);
    }
    if (idats.length && type !== 'IDAT') idatEnded = true;
    offset += size + 12;
  }
  if (!ended) fail('missing IEND');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
  const passes = interlace ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4],
    [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
  const rows = [];
  let expected = 0;
  for (const [x, y, stepX, stepY] of passes) {
    const passWidth = Math.max(0, Math.ceil((width - x) / stepX));
    const passHeight = Math.max(0, Math.ceil((height - y) / stepY));
    if (!passWidth || !passHeight) continue;
    const rowBytes = 1 + Math.ceil(passWidth * channels * depth / 8);
    expected += rowBytes * passHeight;
    rows.push({ rowBytes, count: passHeight });
  }
  if (!Number.isSafeInteger(expected) || expected > maxBytes) fail('decoded image exceeds 128 MiB');
  const compressed = Buffer.concat(idats);
  let inflated;
  try { inflated = inflateSync(compressed, { maxOutputLength: expected, info: true }); }
  catch { fail('invalid compressed pixels'); }
  if (inflated.buffer.length !== expected || inflated.engine.bytesWritten !== compressed.length) {
    fail('pixel data length or compressed stream mismatch');
  }
  let rowOffset = 0;
  for (const { rowBytes, count } of rows) {
    for (let row = 0; row < count; row++, rowOffset += rowBytes) {
      if (inflated.buffer[rowOffset] > 4) fail('invalid scanline filter');
    }
  }
  return { width, height };
}

async function git(root, args, input) {
  // File descriptors also work in Windows environments that disallow child-process pipes.
  const ioRoot = await mkdtemp(path.join(tmpdir(), 'cine-marks-git-'));
  const inputPath = path.join(ioRoot, 'stdin');
  const outputPath = path.join(ioRoot, 'stdout');
  const handles = [];
  try {
    await writeFile(inputPath, input ?? '');
    handles.push(await open(inputPath, 'r'));
    handles.push(await open(outputPath, 'w+'));
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn('git', ['-C', root, ...args], {
        windowsHide: true, stdio: [handles[0].fd, handles[1].fd, 'ignore']
      });
      child.once('error', reject);
      child.once('close', resolve);
    });
    if (exitCode !== 0) {
      throw Object.assign(new Error(`Git ${args[0]} failed (exit ${exitCode}).`), { exitCode });
    }
    if ((await handles[1].stat()).size > maxBytes) throw new Error('Git output exceeds 128 MiB.');
    return await readFile(outputPath);
  } finally {
    await Promise.allSettled(handles.map(handle => handle.close()));
    await Promise.allSettled([inputPath, outputPath].map(filename => unlink(filename)));
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
    throw new Error(`Source must be a regular file without symlinks: ${relative}`);
  }
  return readFile(filename);
}

async function ensureCleanSources(root, ref) {
  for (const args of [
    ['diff', '--quiet', ref, '--', ...sourcePaths],
    ['diff', '--cached', '--quiet', ref, '--', ...sourcePaths]
  ]) {
    try { await git(root, args); }
    catch (error) {
      if (error.exitCode === 1) throw new Error('Uncommitted or changed source configuration/images differ from the asset commit.');
      throw error;
    }
  }
  const untracked = await git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...sourcePaths]);
  if (untracked.length) throw new Error('Untracked source configuration/images must be committed before publishing.');
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

function committedBlobs(raw, oids) {
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

export async function prepareGithubBuild({ root = defaultRoot, repository, assetRef } = {}) {
  const resolvedRoot = await realpath(path.resolve(root));
  const gitRoot = await realpath((await git(resolvedRoot, ['rev-parse', '--show-toplevel'])).toString('utf8').trim());
  if (!samePath(resolvedRoot, gitRoot)) throw new Error('Build root must be the Git repository root.');
  const repo = repository === undefined
    ? repositoryFromOrigin((await git(resolvedRoot, ['remote', 'get-url', 'origin'])).toString('utf8'))
    : normalizeRepository(repository);
  const ref = assetRef === undefined
    ? normalizeAssetRef((await git(resolvedRoot, ['rev-parse', '--verify', 'HEAD^{commit}'])).toString('utf8').trim())
    : normalizeAssetRef(assetRef);
  const resolvedRef = (await git(resolvedRoot, ['rev-parse', '--verify', `${ref}^{commit}`])).toString('utf8').trim();
  if (resolvedRef !== ref) throw new Error('Asset ref must identify a commit directly, not a tag object.');
  await ensureCleanSources(resolvedRoot, ref);
  const configurationBytes = await readSourceFile(resolvedRoot, 'badges.relative.json');
  const source = JSON.parse(configurationBytes.toString('utf8'));
  const subscription = createSubscription(source, { repository: repo, assetRef: ref });
  const tree = readTree(await git(resolvedRoot, ['ls-tree', '-r', '-z', '--full-tree', ref, '--', ...sourcePaths]));
  const files = [{ relative: 'badges.relative.json', bytes: configurationBytes }];
  for (const filter of source.filters) {
    const relative = `badges/png/${filter.id}.png`;
    files.push({ relative, bytes: await readSourceFile(resolvedRoot, relative) });
  }
  for (const file of files) {
    const entry = tree.get(file.relative);
    if (!entry || entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode)) {
      throw new Error(`Source is not a tracked regular file in the asset commit: ${file.relative}`);
    }
    file.oid = entry.oid;
  }
  const oids = [...new Set(files.map(file => file.oid))];
  const blobs = committedBlobs(await git(resolvedRoot, ['cat-file', '--batch'], `${oids.join('\n')}\n`), oids);
  let pngBytes = 0;
  for (const file of files) {
    const committed = blobs.get(file.oid);
    const equal = file.relative === 'badges.relative.json'
      ? file.bytes.toString('utf8').replace(/\r\n/g, '\n') === committed.toString('utf8').replace(/\r\n/g, '\n')
      : file.bytes.equals(committed);
    if (!equal) throw new Error(`Source bytes differ from asset commit: ${file.relative}`);
    if (file.relative.endsWith('.png')) {
      validatePng(file.bytes, file.relative);
      pngBytes += file.bytes.length;
    }
  }
  await ensureCleanSources(resolvedRoot, ref);
  return {
    root: resolvedRoot, repository: repo, assetRef: ref, subscription,
    outputPath: path.join(resolvedRoot, 'badges-noframe.json'),
    pngFiles: source.filters.length, pngBytes,
    configurationSha256: createHash('sha256').update(configurationBytes).digest('hex')
  };
}

export async function buildGithub(options = {}) {
  const build = await prepareGithubBuild(options);
  let stat;
  try { stat = await lstat(build.outputPath); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error('Output must be a regular file, not a symlink.');
  await writeFile(build.outputPath, JSON.stringify(build.subscription, null, 2) + '\n', 'utf8');
  return build;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    const key = { '--repository': 'repository', '--asset-ref': 'assetRef' }[arg];
    if (!key || options[key] !== undefined || !argv[index + 1] || argv[index + 1].startsWith('--')) {
      throw new Error('Usage: node scripts/build-github.mjs [--repository owner/repo] [--asset-ref <40-character commit SHA>]');
    }
    options[key] = argv[++index];
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node scripts/build-github.mjs [--repository owner/repo] [--asset-ref <40-character commit SHA>]\nDefaults: repository from origin; asset commit from HEAD; source/output root is the parent of scripts/.\nReads only committed source configuration and PNGs; writes badges-noframe.json. No commits, pushes or network requests.');
    return;
  }
  const build = await buildGithub(options);
  console.log(JSON.stringify({
    outputPath: build.outputPath,
    repository: build.repository,
    assetRef: build.assetRef,
    filters: build.subscription.filters.length,
    groups: build.subscription.groups.length,
    pngBytes: build.pngBytes,
    note: 'Built locally. Commit and push the output and its asset commit before using the subscription.'
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(`Build failed: ${error.message}`); process.exitCode = 1; });
}
