// Render per-artwork light variants, then package both themes in standalone SVGs.
// Source PNGs remain unchanged. No whole-image inversion or decoration is added.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Resvg } = require(process.env.RESVG_MODULE_PATH || '@resvg/resvg-js');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'themes/theme-map.json'), 'utf8'));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const discrete = predicate => Array.from({ length: 256 }, (_, index) => predicate(index) ? '1' : '0').join(' ');
const transfer = (input, output, values) => `<feComponentTransfer in="${input}" result="${output}"><feFuncR type="discrete" tableValues="${values}"/><feFuncG type="discrete" tableValues="${values}"/><feFuncB type="discrete" tableValues="${values}"/></feComponentTransfer>`;
function selectiveFilter(maxChroma = 24, minChannel = 170) {
  const channel = (r,g,b,name) => `<feColorMatrix in="SourceGraphic" values="${r} ${g} ${b} 0 0 ${r} ${g} ${b} 0 0 ${r} ${g} ${b} 0 0 0 0 0 0 1" result="${name}"/>`;
  return `<filter id="foreground" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
${channel(1,0,0,'r')}${channel(0,1,0,'g')}${channel(0,0,1,'b')}
<feBlend in="r" in2="g" mode="lighten" result="rgMax"/><feBlend in="rgMax" in2="b" mode="lighten" result="maximum"/>
<feBlend in="r" in2="g" mode="darken" result="rgMin"/><feBlend in="rgMin" in2="b" mode="darken" result="minimum"/>
<feBlend in="maximum" in2="minimum" mode="difference" result="chroma"/>
${transfer('chroma','neutral',discrete(v=>v<=maxChroma))}${transfer('minimum','bright',discrete(v=>v>=minChannel))}
<feBlend in="neutral" in2="bright" mode="multiply" result="selection"/>
<feColorMatrix in="selection" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 0" result="selectionAlpha"/>
<feComposite in="SourceGraphic" in2="selectionAlpha" operator="out" result="preserved"/>
<feFlood flood-color="#17191C" result="ink"/><feComposite in="ink" in2="SourceGraphic" operator="in" result="inkAlpha"/>
<feComposite in="inkAlpha" in2="selectionAlpha" operator="in" result="changed"/>
<feMerge><feMergeNode in="preserved"/><feMergeNode in="changed"/></feMerge></filter>`;
}
const results = [];
for (const variant of ['light','adaptive']) fs.mkdirSync(path.join(root,'themes',variant),{recursive:true});
for (const item of manifest.items) {
  const bytes = fs.readFileSync(path.join(root,'badges/png',item.id+'.png'));
  if (sha(bytes) !== item.sourceSha256) throw new Error(`Re-audit changed source before rendering: ${item.id}`);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  const uri = 'data:image/png;base64,'+bytes.toString('base64');
  let light = bytes;
  if (item.mode !== 'preserve') {
    let defs, drawing;
    if (item.mode === 'monochrome') {
      defs = '<filter id="foreground" color-interpolation-filters="sRGB"><feColorMatrix values="0 0 0 0 0.090196 0 0 0 0 0.098039 0 0 0 0 0.109804 0 0 0 1 0"/></filter>';
      drawing = `<image href="${uri}" width="${width}" height="${height}" filter="url(#foreground)"/>`;
    } else if (item.mode === 'metallic') {
      defs = '<filter id="foreground" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="0.38" intercept="0.02"/><feFuncG type="linear" slope="0.38" intercept="0.02"/><feFuncB type="linear" slope="0.38" intercept="0.02"/></feComponentTransfer></filter>';
      drawing = `<image href="${uri}" width="${width}" height="${height}" filter="url(#foreground)"/>`;
    } else {
      const rectangles = item.regions.map(([x,y,w,h])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('');
      defs = selectiveFilter(item.maxChroma, item.minChannel) + `<clipPath id="region">${rectangles}</clipPath><mask id="outside" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="white"/><g fill="black">${rectangles}</g></mask>`;
      drawing = `<image href="${uri}" width="${width}" height="${height}" mask="url(#outside)"/><image href="${uri}" width="${width}" height="${height}" filter="url(#foreground)" clip-path="url(#region)"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${drawing}</svg>`;
    light = new Resvg(svg).render().asPng();
  }
  fs.writeFileSync(path.join(root,'themes/light',item.id+'.png'), light);
  const adaptive = bytes.equals(light)
    ? `<image href="${uri}" width="${width}" height="${height}"/>`
    : `<style>.on-light{display:inline}.on-dark{display:none}@media(prefers-color-scheme:dark){.on-light{display:none}.on-dark{display:inline}}</style><image class="on-light" href="data:image/png;base64,${light.toString('base64')}" width="${width}" height="${height}"/><image class="on-dark" href="${uri}" width="${width}" height="${height}"/>`;
  const output = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(item.name)}"><title>${esc(item.name)}</title><desc>Self-contained PNG variants. Light is the fallback; prefers-color-scheme selects the dark variant when supported by the consuming renderer. Original brand colors and transparency are preserved outside documented foreground adjustments.</desc>${adaptive}</svg>\n`;
  fs.writeFileSync(path.join(root,'themes/adaptive',item.id+'.svg'), output);
  results.push({id:item.id,mode:item.mode,sourceSha256:item.sourceSha256,lightSha256:sha(light),adaptiveSha256:sha(output),width,height});
}
fs.writeFileSync(path.join(root,'themes/build-manifest.json'),JSON.stringify({total:results.length,changed:results.filter(item=>item.mode!=='preserve').length,items:results},null,2)+'\n');
console.log(`Built ${results.length} light PNGs and adaptive SVGs; ${results.filter(item=>item.mode!=='preserve').length} per-artwork foreground adaptations.`);
