import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, open, readFile, rm, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { buildThemeSubscriptions, createThemeSubscriptions, normalizeSiteBase, prepareThemeBuild } from './build-theme-subscriptions.mjs';

const repository = 'fixture-owner/cine-marks';
const siteBase = 'https://fixture-owner.github.io/cine-marks';
const ref = 'a'.repeat(40);
const siblingBase = fileURLToPath(new URL('./build-github.mjs', import.meta.url));
const baseScript = existsSync(siblingBase) ? siblingBase : fileURLToPath(new URL('../../github-tools/scripts/build-github.mjs', import.meta.url));

function sourceConfig() {
  return {
    custom: { value: ['opaque', '\u0000', '\\n'] },
    groups: [{ id: 'g', name: '平台', extra: 17 }],
    filters: ['first', 'second'].map((id, index) => ({
      type: 'filter', id, name: `标签 ${index}`, groupId: 'g',
      pattern: '(?i)(?<=%[0-9A-Fa-f]{2})\\bX[._ -]+Y\\b|\u2063\u200b\u200c\u2064|\\\\u1234',
      imageURL: `badges/png/${id}.png`, isEnabled: index === 0, unknown: { order: index }
    }))
  };
}

function chunk(type, data) {
  const name = Buffer.from(type);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([name, data])) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length); name.copy(result, 4); data.copy(result, 8);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return result;
}

function png(red = 10) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, red, 20, 30, 255]))), chunk('IEND', Buffer.alloc(0))]);
}

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><style>rect{fill:#111}@media(prefers-color-scheme:dark){rect{fill:#fff}}</style><rect width="1" height="1"/></svg>\n';

async function runGit(root, ...args) {
  const ioRoot = await mkdtemp(path.join(tmpdir(), 'cine-marks-theme-test-git-'));
  const filename = path.join(ioRoot, 'stdout');
  const output = await open(filename, 'w+');
  try {
    const result = spawnSync('git', ['-C', root, '-c', 'core.autocrlf=false', '-c', 'core.hooksPath=disabled-hooks',
      '-c', 'commit.gpgsign=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args],
    { windowsHide: true, stdio: ['ignore', output.fd, 'inherit'] });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `git ${args[0]} failed`);
    return (await readFile(filename, 'utf8')).trim();
  } finally {
    await output.close(); await unlink(filename); await rmdir(ioRoot);
  }
}

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'cine-marks-theme-fixture-'));
  t.after(async () => {
    const relative = path.relative(path.resolve(tmpdir()), root);
    assert.ok(relative.startsWith('cine-marks-theme-fixture-') && !relative.includes(path.sep));
    await rm(root, { recursive: true, force: true });
  });
  for (const relative of ['scripts', 'badges/png', 'themes/light', 'themes/adaptive']) {
    await mkdir(path.join(root, ...relative.split('/')), { recursive: true });
  }
  await copyFile(baseScript, path.join(root, 'scripts', 'build-github.mjs'));
  await writeFile(path.join(root, 'badges.relative.json'), JSON.stringify(sourceConfig(), null, 2) + '\n');
  for (const filter of sourceConfig().filters) {
    await writeFile(path.join(root, 'badges', 'png', `${filter.id}.png`), png());
    await writeFile(path.join(root, 'themes', 'light', `${filter.id}.png`), png(40));
    await writeFile(path.join(root, 'themes', 'adaptive', `${filter.id}.svg`), svg);
  }
  await runGit(root, 'init', '--initial-branch=main');
  await runGit(root, 'add', '.'); await runGit(root, 'commit', '-qm', 'isolated theme assets');
  return { root, repository, siteBase, assetRef: await runGit(root, 'rev-parse', 'HEAD') };
}

test('all three subscriptions only replace imageURL and preserve opaque rules and metadata', () => {
  const source = sourceConfig();
  const before = structuredClone(source);
  const subscriptions = createThemeSubscriptions(source, { repository, assetRef: ref, siteBase });
  assert.deepEqual(source, before);
  assert.equal(subscriptions.dark.filters[0].imageURL, `https://raw.githubusercontent.com/${repository}/${ref}/badges/png/first.png`);
  assert.equal(subscriptions.light.filters[0].imageURL, `https://raw.githubusercontent.com/${repository}/${ref}/themes/light/first.png`);
  assert.equal(subscriptions.adaptive.filters[0].imageURL, `${siteBase}/themes/releases/${ref}/first.svg`);
  for (const subscription of Object.values(subscriptions)) {
    subscription.filters.forEach((filter, index) => { filter.imageURL = source.filters[index].imageURL; });
    assert.deepEqual(subscription, source);
  }
});

test('site base and explicit SHA/repository inputs reject malformed values', () => {
  for (const value of ['http://a.example/repo', 'https://user:pass@a.example/repo', `${siteBase}?x`, `${siteBase}#x`,
    `${siteBase}/../different`, `${siteBase}/%2e%2e`, ` ${siteBase}`, `${siteBase}\n`]) {
    assert.throws(() => normalizeSiteBase(value));
  }
  assert.equal(normalizeSiteBase(`${siteBase}/`), siteBase);
  assert.throws(() => createThemeSubscriptions(sourceConfig(), { repository, siteBase, assetRef: 'HEAD' }));
  assert.throws(() => createThemeSubscriptions(sourceConfig(), { repository: 'owner/../repo', siteBase, assetRef: ref }));
});

test('build emits three theme JSON files, identical PNG Rex aliases and immutable release SVG copies', async t => {
  const options = await fixture(t);
  const build = await buildThemeSubscriptions(options);
  assert.equal(build.filters, 2);
  for (const theme of ['dark', 'light', 'adaptive']) {
    assert.deepEqual(JSON.parse(await readFile(path.join(options.root, `badges-${theme}.json`), 'utf8')), build.subscriptions[theme]);
  }
  for (const [alias, theme] of [['rex', 'light'], ['rex-dark', 'dark']]) {
    const aliasBytes = await readFile(path.join(options.root, `badges-${alias}.json`));
    assert.deepEqual(aliasBytes, await readFile(path.join(options.root, `badges-${theme}.json`)));
    for (const filter of JSON.parse(aliasBytes.toString('utf8')).filters) {
      assert.ok(new URL(filter.imageURL).pathname.endsWith('.png'));
    }
  }
  for (const id of ['first', 'second']) {
    assert.equal(await readFile(path.join(options.root, 'themes', 'releases', options.assetRef, `${id}.svg`), 'utf8'), svg);
  }
  assert.equal(await runGit(options.root, 'rev-parse', 'HEAD'), options.assetRef);
  await buildThemeSubscriptions(options);
});

test('modified light PNG is rejected before generated JSON and Rex aliases are overwritten', async t => {
  const options = await fixture(t);
  const priorOutputs = ['badges-light.json', 'badges-rex.json', 'badges-rex-dark.json'];
  for (const filename of priorOutputs) await writeFile(path.join(options.root, filename), `prior ${filename}`);
  await writeFile(path.join(options.root, 'themes', 'light', 'first.png'), png(42));
  await assert.rejects(buildThemeSubscriptions(options), /Uncommitted|differ/);
  for (const filename of priorOutputs) {
    assert.equal(await readFile(path.join(options.root, filename), 'utf8'), `prior ${filename}`);
  }
});

test('both Rex alias destinations are validated before any output is written', async t => {
  for (const alias of ['rex', 'rex-dark']) {
    await t.test(alias, async child => {
      const options = await fixture(child);
      await mkdir(path.join(options.root, `badges-${alias}.json`));
      await writeFile(path.join(options.root, 'badges-light.json'), 'prior subscription');
      await assert.rejects(buildThemeSubscriptions(options), /Output path must contain only regular directories\/files/);
      assert.equal(await readFile(path.join(options.root, 'badges-light.json'), 'utf8'), 'prior subscription');
      assert.equal(existsSync(path.join(options.root, 'badges-dark.json')), false);
      assert.equal(existsSync(path.join(options.root, 'badges-adaptive.json')), false);
      assert.equal(existsSync(path.join(options.root, 'themes', 'releases', options.assetRef)), false);
    });
  }
});

test('assume-unchanged SVG modifications cannot bypass blob equality', async t => {
  const options = await fixture(t);
  await runGit(options.root, 'update-index', '--assume-unchanged', 'themes/adaptive/first.svg');
  await writeFile(path.join(options.root, 'themes', 'adaptive', 'first.svg'), svg.replace('#111', '#222'));
  await assert.rejects(prepareThemeBuild(options), /source bytes differ/);
});

test('staged theme modifications, untracked images and missing explicit options are rejected', async t => {
  const options = await fixture(t);
  await assert.rejects(prepareThemeBuild({ root: options.root }), /supplied explicitly/);
  await writeFile(path.join(options.root, 'themes', 'light', 'extra.png'), png());
  await assert.rejects(prepareThemeBuild(options), /Untracked/);
  await unlink(path.join(options.root, 'themes', 'light', 'extra.png'));
  const filename = path.join(options.root, 'themes', 'light', 'first.png');
  await writeFile(filename, png(42)); await runGit(options.root, 'add', 'themes/light/first.png');
  await writeFile(filename, png(40));
  await assert.rejects(prepareThemeBuild(options), /Uncommitted/);
});

test('existing release bytes cannot be overwritten and previous release directories survive', async t => {
  const options = await fixture(t);
  const oldRelease = path.join(options.root, 'themes', 'releases', ref);
  const targetRelease = path.join(options.root, 'themes', 'releases', options.assetRef);
  await mkdir(oldRelease, { recursive: true });
  await writeFile(path.join(oldRelease, 'first.svg'), 'older immutable payload');
  await mkdir(targetRelease, { recursive: true });
  await writeFile(path.join(targetRelease, 'first.svg'), 'conflicting payload');
  await writeFile(path.join(options.root, 'badges-adaptive.json'), 'prior subscription');
  await assert.rejects(buildThemeSubscriptions(options), /Immutable release already exists/);
  assert.equal(await readFile(path.join(options.root, 'badges-adaptive.json'), 'utf8'), 'prior subscription');
  assert.equal(await readFile(path.join(oldRelease, 'first.svg'), 'utf8'), 'older immutable payload');
});
