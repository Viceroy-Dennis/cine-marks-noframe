import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, open, readFile, writeFile, rm, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import {
  buildGithub, createSubscription, normalizeAssetRef, normalizeRepository,
  prepareGithubBuild, repositoryFromOrigin, validatePng
} from './build-github.mjs';

const ref = 'a'.repeat(40);
const repository = 'fixture-owner/cine-marks';

function sourceConfig() {
  return {
    customRoot: { note: 'preserve extra metadata' },
    groups: [{ id: 'group-a', name: '平台', extra: { order: 17 } }],
    filters: ['alpha', 'second_2'].map((id, index) => ({
      type: 'filter', id, name: `标签 ${index}`, groupId: 'group-a',
      pattern: '(?i)(?<=%[0-9A-Fa-f]{2})\\bX[._ -]+Y\\b|\u2063\u200b\u200c\u2064|\\\\u1234',
      imageURL: `badges/png/${id}.png`, isEnabled: index === 0,
      tagColor: '#00000000', borderColor: '#00000000', textColor: '#FFFFFF',
      unknown: { array: ['\u0000', '\n', '\\n'], value: index }
    }))
  };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  name.copy(result, 4); data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return result;
}

function png(red = 10, filter = 0) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([filter, red, 20, 30, 255]))), chunk('IEND', Buffer.alloc(0))
  ]);
}

async function runGit(root, ...args) {
  const ioRoot = await mkdtemp(path.join(tmpdir(), 'cine-marks-test-git-'));
  const outputPath = path.join(ioRoot, 'stdout');
  const output = await open(outputPath, 'w+');
  try {
    const result = spawnSync('git', ['-C', root, '-c', 'core.autocrlf=false', '-c', 'core.hooksPath=disabled-hooks',
      '-c', 'commit.gpgsign=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args],
    { windowsHide: true, stdio: ['ignore', output.fd, 'inherit'] });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `git ${args[0]} failed`);
    return (await readFile(outputPath, 'utf8')).trim();
  } finally {
    await output.close();
    await unlink(outputPath);
    await rmdir(ioRoot);
  }
}

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'cine-marks-github-'));
  t.after(async () => {
    const tempRoot = path.resolve(tmpdir());
    const relative = path.relative(tempRoot, root);
    assert.ok(relative.startsWith('cine-marks-github-') && !relative.includes(path.sep));
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, 'badges', 'png'), { recursive: true });
  await writeFile(path.join(root, 'badges.relative.json'), JSON.stringify(sourceConfig(), null, 2) + '\n');
  await writeFile(path.join(root, 'badges', 'png', 'alpha.png'), png());
  await writeFile(path.join(root, 'badges', 'png', 'second_2.png'), png(50));
  await runGit(root, 'init', '--initial-branch=main');
  await runGit(root, 'remote', 'add', 'origin', `https://github.com/${repository}.git`);
  await runGit(root, 'add', 'badges.relative.json', 'badges/png');
  await runGit(root, 'commit', '-qm', 'isolated test assets');
  return { root, assetRef: await runGit(root, 'rev-parse', 'HEAD') };
}

test('only imageURL changes; opaque regex, order, disabled rules and extra fields survive', () => {
  const source = sourceConfig();
  const original = structuredClone(source);
  const result = createSubscription(source, { repository, assetRef: ref });
  assert.deepEqual(source, original);
  assert.equal(result.filters.length, 2);
  for (let index = 0; index < result.filters.length; index++) {
    assert.equal(result.filters[index].imageURL,
      `https://raw.githubusercontent.com/${repository}/${ref}/badges/png/${source.filters[index].id}.png`);
    result.filters[index].imageURL = source.filters[index].imageURL;
  }
  assert.deepEqual(result, source);
});

test('repository and SHA reject paths, URLs, traversal, malformed values and abbreviated refs', () => {
  for (const value of ['https://github.com/a/b', 'a/b/c', '../b', 'a/..', 'a/b?x', 'a/b#x', ' a/b', 'a/b\n', '-a/b', 'a\\b', 'a/%2e']) {
    assert.throws(() => normalizeRepository(value));
  }
  for (const value of ['main', 'HEAD', 'a'.repeat(39), 'a'.repeat(41), 'g'.repeat(40), ` ${ref}`, `${ref}\n`]) {
    assert.throws(() => normalizeAssetRef(value));
  }
  assert.equal(normalizeAssetRef('ABCDEF'.repeat(6) + 'ABCD'), 'abcdef'.repeat(6) + 'abcd');
  for (const remote of [`https://github.com/${repository}.git`, `git@github.com:${repository}.git`, `ssh://git@github.com/${repository}.git`]) {
    assert.equal(repositoryFromOrigin(remote), repository);
  }
  for (const remote of ['https://github.com.evil.invalid/a/b', 'https://secret@github.com/a/b', 'https://github.com/a/b?x', 'file:///a/b']) {
    assert.throws(() => repositoryFromOrigin(remote));
  }
});

test('groups, duplicate IDs and unexpected image paths are rejected', () => {
  const cases = [
    data => data.groups.push(data.groups[0]),
    data => { data.filters[0].groupId = 'missing'; },
    data => { data.filters[1].id = data.filters[0].id; },
    data => { data.filters[0].imageURL = '../private.png'; },
    data => { data.filters[0].id = '../../private'; }
  ];
  for (const mutate of cases) {
    const data = sourceConfig(); mutate(data);
    assert.throws(() => createSubscription(data, { repository, assetRef: ref }));
  }
});

test('PNG validation checks bytes, CRC, complete chunks and decoded scanline filters', () => {
  assert.deepEqual(validatePng(png()), { width: 1, height: 1 });
  const corrupt = png(); corrupt[20] ^= 1;
  for (const bytes of [Buffer.from('not a png'), png().subarray(0, 33), corrupt, Buffer.concat([png(), Buffer.from('extra')]), png(10, 5)]) {
    assert.throws(() => validatePng(bytes), /Invalid PNG/);
  }
});

test('build defaults to origin and HEAD, verifies tracked bytes and writes root JSON', async t => {
  const { root, assetRef } = await fixture(t);
  const build = await buildGithub({ root });
  assert.equal(build.assetRef, assetRef);
  assert.equal(build.repository, repository);
  assert.equal(build.pngFiles, 2);
  assert.deepEqual(JSON.parse(await readFile(path.join(root, 'badges-noframe.json'), 'utf8')), build.subscription);
  assert.equal(build.subscription.filters[0].imageURL,
    `https://raw.githubusercontent.com/${repository}/${assetRef}/badges/png/alpha.png`);
  assert.equal(await runGit(root, 'rev-parse', 'HEAD'), assetRef);
  assert.equal(await runGit(root, 'diff', '--name-only'), '');
});

test('Git-normalized CRLF configuration preserves all JSON values', async t => {
  const { root } = await fixture(t);
  await writeFile(path.join(root, '.gitattributes'), '*.json text eol=lf\n');
  await runGit(root, 'add', '.gitattributes');
  await runGit(root, 'commit', '-qm', 'normalize fixture JSON line endings');
  await writeFile(path.join(root, 'badges.relative.json'), JSON.stringify(sourceConfig(), null, 2).replace(/\n/g, '\r\n') + '\r\n');
  const build = await prepareGithubBuild({ root });
  assert.equal(build.subscription.filters[0].pattern, sourceConfig().filters[0].pattern);
  assert.equal(build.pngFiles, 2);
});

test('modified image is rejected before overwriting any subscription', async t => {
  const { root, assetRef } = await fixture(t);
  const output = path.join(root, 'badges-noframe.json');
  await writeFile(output, 'existing output');
  await writeFile(path.join(root, 'badges', 'png', 'alpha.png'), png(11));
  await assert.rejects(buildGithub({ root, repository, assetRef }), /Uncommitted|differ/);
  assert.equal(await readFile(output, 'utf8'), 'existing output');
});

test('staged modification hidden by restoring working-tree bytes is rejected', async t => {
  const { root, assetRef } = await fixture(t);
  const image = path.join(root, 'badges', 'png', 'alpha.png');
  await writeFile(image, png(12)); await runGit(root, 'add', 'badges/png/alpha.png');
  await writeFile(image, png());
  await assert.rejects(prepareGithubBuild({ root, repository, assetRef }), /Uncommitted|differ/);
});

test('assume-unchanged does not bypass committed byte verification', async t => {
  const { root, assetRef } = await fixture(t);
  await runGit(root, 'update-index', '--assume-unchanged', 'badges/png/alpha.png');
  await writeFile(path.join(root, 'badges', 'png', 'alpha.png'), png(13));
  await assert.rejects(prepareGithubBuild({ root, repository, assetRef }), /Source bytes differ/);
});

test('untracked PNGs and committed configuration referencing an untracked PNG are rejected', async t => {
  const { root, assetRef } = await fixture(t);
  await writeFile(path.join(root, 'badges', 'png', 'extra.png'), png());
  await assert.rejects(prepareGithubBuild({ root, repository, assetRef }), /Untracked/);
  await writeFile(path.join(root, '.gitignore'), 'badges/png/extra.png\n');
  const source = sourceConfig();
  source.filters.push({ ...source.filters[0], id: 'extra', imageURL: 'badges/png/extra.png' });
  await writeFile(path.join(root, 'badges.relative.json'), JSON.stringify(source));
  await runGit(root, 'add', 'badges.relative.json', '.gitignore');
  await runGit(root, 'commit', '-qm', 'test missing tracked image');
  const newRef = await runGit(root, 'rev-parse', 'HEAD');
  await assert.rejects(prepareGithubBuild({ root, repository, assetRef: newRef }), /not a tracked regular file/);
});

test('a committed invalid PNG is rejected and an asset tag object is not a commit SHA', async t => {
  const { root } = await fixture(t);
  await writeFile(path.join(root, 'badges', 'png', 'alpha.png'), png().subarray(0, 33));
  await runGit(root, 'add', 'badges/png/alpha.png'); await runGit(root, 'commit', '-qm', 'invalid fixture PNG');
  await assert.rejects(prepareGithubBuild({ root }), /Invalid PNG/);
  await runGit(root, 'tag', '-a', 'fixture-tag', '-m', 'annotated fixture');
  const tagRef = await runGit(root, 'rev-parse', 'fixture-tag');
  await assert.rejects(prepareGithubBuild({ root, repository, assetRef: tagRef }), /not a tag object/);
});
