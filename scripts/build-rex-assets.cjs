// Build transparent PNGs for Rex's native monochrome adaptation setting.
// Original source artwork stays unchanged; only audited neutral silhouettes normalize to white.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Resvg } = require(process.env.RESVG_MODULE_PATH || '@resvg/resvg-js');

const root = path.resolve(__dirname, '..');
const mapPath = path.join(root, 'themes/rex-map.json');
const themeMap = JSON.parse(fs.readFileSync(path.join(root, 'themes/theme-map.json'), 'utf8'));
const rexMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const allowedModes = new Set(['monochrome-template', 'original']);
const allowedThemeModes = new Set(['preserve', 'monochrome', 'neutral-regions', 'metallic']);
const neutralAdditions = new Set([
  's-bluray', 'stream-nhk', 'custom_dolby-vision-p5',
  'custom_dolby-vision-p7', 'custom_dolby-vision-p8', 'custom_sdr_12',
]);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const validID = id => typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
const validHash = hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash);

if (!Array.isArray(themeMap.items) || !Array.isArray(rexMap.items)) {
  throw new Error('Both theme-map and rex-map must contain an items array.');
}
if (themeMap.items.length !== 310 || rexMap.items.length !== 310) {
  throw new Error('Re-audit asset coverage before changing the expected 310-item source collection.');
}
const sources = new Map();
for (const source of themeMap.items) {
  if (!validID(source.id) || sources.has(source.id)) throw new Error(`Invalid or duplicate theme-map ID: ${source.id}`);
  if (!allowedThemeModes.has(source.mode)) throw new Error(`Missing or unsupported theme mode: ${source.id}`);
  if (!validHash(source.sourceSha256)) throw new Error(`Missing or invalid audited source hash: ${source.id}`);
  sources.set(source.id, source);
}
const protectedIDs = new Set(themeMap.protectedNativeContainers || []);
const seen = new Set();

// Validate every input before writing any asset, including strict modes and source hashes.
const inputs = rexMap.items.map(item => {
  if (!validID(item.id) || seen.has(item.id)) throw new Error(`Invalid or duplicate Rex ID: ${item.id}`);
  seen.add(item.id);
  if (!allowedModes.has(item.mode)) throw new Error(`Missing or unsupported Rex mode: ${item.id}`);
  if (!validHash(item.sourceSha256)) throw new Error(`Missing or invalid Rex source hash: ${item.id}`);
  const source = sources.get(item.id);
  if (!source || source.sourceSha256 !== item.sourceSha256) throw new Error(`Rex source hash differs from theme audit: ${item.id}`);
  const expectedMode = source.mode === 'monochrome' || neutralAdditions.has(item.id)
    ? 'monochrome-template' : 'original';
  if (item.mode !== expectedMode) throw new Error(`Rex mode differs from the audited neutral selection: ${item.id}`);
  if (protectedIDs.has(item.id) && item.mode !== 'original') throw new Error(`Protected native artwork must stay original: ${item.id}`);
  const bytes = fs.readFileSync(path.join(root, 'badges/png', `${item.id}.png`));
  if (!bytes.subarray(0, 8).equals(pngSignature) || bytes.length < 33) throw new Error(`Invalid source PNG: ${item.id}`);
  if (sha(bytes) !== item.sourceSha256) throw new Error(`Re-audit changed source before rendering: ${item.id}`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!width || !height) throw new Error(`Invalid source dimensions: ${item.id}`);
  return { item, bytes, width, height };
});
const templateCount = inputs.filter(({ item }) => item.mode === 'monochrome-template').length;
if (templateCount !== 31 || inputs.length - templateCount !== 279) {
  throw new Error('Re-audit selection before changing the expected 31 templates and 279 originals.');
}

const outputDir = path.join(root, 'themes/rex');
fs.mkdirSync(outputDir, { recursive: true });
const results = [];
for (const { item, bytes, width, height } of inputs) {
  let output = bytes;
  if (item.mode === 'monochrome-template') {
    const uri = `data:image/png;base64,${bytes.toString('base64')}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><filter id="template" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter></defs><image href="${uri}" width="${width}" height="${height}" filter="url(#template)"/></svg>`;
    output = new Resvg(svg).render().asPng();
  }
  fs.writeFileSync(path.join(outputDir, `${item.id}.png`), output);
  results.push({
    id: item.id,
    mode: item.mode,
    sourceSha256: item.sourceSha256,
    outputSha256: sha(output),
    outputPath: `themes/rex/${item.id}.png`,
    sourceBytes: bytes.length,
    outputBytes: output.length,
    byteIdenticalToSource: bytes.equals(output),
    width,
    height,
  });
}
fs.writeFileSync(path.join(root, 'themes/rex-build-manifest.json'), JSON.stringify({
  description: 'Rex native PNG assets. Enable Rex monochrome icon adaptation; colorful and protected artwork retains its original source bytes.',
  total: results.length,
  monochromeTemplates: templateCount,
  originalCopies: results.length - templateCount,
  sourceMapSha256: sha(fs.readFileSync(path.join(root, 'themes/theme-map.json'))),
  rexMapSha256: sha(fs.readFileSync(mapPath)),
  renderer: '@resvg/resvg-js',
  items: results,
}, null, 2) + '\n');
console.log(`Built ${results.length} Rex PNGs: ${templateCount} white alpha templates, ${results.length - templateCount} original byte copies.`);
