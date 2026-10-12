// 打包「單機版」：把遊戲核心、題庫、Three.js、3D 模型與材質全部內嵌成單一 HTML（可離線、雙擊即玩）
// 執行：node tools/build-standalone.js  →  dist/小屋大亨.html、dist/artifact.html
const fs = require('fs'), path = require('path');
const esbuild = require('esbuild');
const root = path.join(__dirname, '..');
const nm = path.join(root, 'node_modules');

function walk(dir, out = []) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; }
const embed = {};
for (const sub of ['models', 'textures']) for (const f of walk(path.join(root, 'public', sub))) {
  const rel = path.relative(path.join(root, 'public'), f).replace(/\\/g, '/');
  embed[rel] = (f.endsWith('.glb') ? 'data:model/gltf-binary;base64,' : 'data:image/png;base64,') + fs.readFileSync(f).toString('base64');
}

const r = esbuild.buildSync({
  entryPoints: [path.join(root, 'src', 'entry.js')], bundle: true, write: false, minify: true, format: 'iife', platform: 'browser', target: 'es2020', legalComments: 'none',
  alias: { 'three/jsm': path.join(root, 'public', 'vendor', 'three', 'jsm'), three: path.join(root, 'public', 'vendor', 'three', 'three.module.js'), fs: path.join(root, 'src', 'stub-fs.js'), path: path.join(root, 'src', 'stub-path.js') },
  define: { __dirname: '"/"', 'process.env.FUNNY_RATE': 'undefined' },
  nodePaths: [nm], logLevel: 'error',
});
const bundle = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const src = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const style = src.match(/<style>([\s\S]*?)<\/style>/)[1];
const title = src.match(/<title>([\s\S]*?)<\/title>/)[1];
let body = src.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
const scripts = `<script>window.__EMBED=${JSON.stringify(embed)};</script>\n<script>${bundle}</script>`;

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', '小屋大亨.html'), `<!doctype html>\n<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${style}</style></head><body>${body}\n${scripts}\n</body></html>`);
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), `<title>${title}</title>\n<style>${style}</style>\n${body}\n${scripts}\n`);
const mb = (f) => (fs.statSync(path.join(root, 'dist', f)).size / 1048576).toFixed(1) + ' MB';
console.log('完成：', '小屋大亨.html', mb('小屋大亨.html'), '／ artifact.html', mb('artifact.html'));
