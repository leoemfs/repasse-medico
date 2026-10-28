// Monta o HTML único: estilos, motor, interface e bibliotecas embutidas em base64.
// Uso: node tools/build.mjs [--harness]
import fs from 'fs';
import path from 'path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ler = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const juntar = dir => fs.readdirSync(path.join(raiz, dir)).filter(f => f.endsWith('.js')).sort()
  .map(f => `/* ---- ${dir}/${f} ---- */\n${ler(path.join(dir, f))}`).join('\n');
const b64 = p => fs.readFileSync(path.join(raiz, p)).toString('base64');

const harness = process.argv.includes('--harness');
const versao = (ler('src/engine/00-util.js').match(/MOTOR_VERSAO = '([^']+)'/) || [])[1];
let html = ler(harness ? 'tools/harness.html' : 'src/index.html');
const partes = {
  '@@CSS@@': harness ? '' : ler('src/styles.css'),
  '@@ENGINE@@': juntar('src/engine'),
  '@@UI@@': harness ? '' : juntar('src/ui'),
  '@@VERSAO@@': versao,
  '@@ICONE@@': b64('src/icone.svg'),
  '@@LIB_JSZIP@@': b64('lib/jszip.min.js'),
  '@@LIB_PDF@@': b64('lib/pdf.min.mjs'),
  '@@LIB_WORKER@@': b64('lib/pdf.worker.min.mjs')
};
for (const [k, v] of Object.entries(partes)) html = html.split(k).join(v);
const nome = harness ? 'harness.html' : `Repasse_Medico_v${versao}.html`;
fs.mkdirSync(path.join(raiz, 'dist'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'dist', nome), html);
console.log(`dist/${nome} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
