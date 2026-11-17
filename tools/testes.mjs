// Roda os testes que não dependem da pasta dados/ (arquivos reais, fora do Git) e resume o resultado.
// Os que dependem de dados/ rodam só quando a pasta existe. Uso: node tools/testes.mjs [nome…]
// É o mesmo comando do GitHub (.github/workflows/testes.yml), a cada envio.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const temDados = fs.existsSync(path.join(raiz, 'dados'));
const so = process.argv.slice(2);
for (const a of [[], ['--harness']]) { const r = spawnSync('node', ['tools/build.mjs', ...a], { cwd: raiz, encoding: 'utf8' }); process.stdout.write(r.stdout); if (r.status) { console.error(r.stderr); process.exit(1); } }
const SEM_ASSERCOES = new Set(['bench_motor']);   // só mede e imprime
const testes = fs.readdirSync(path.join(raiz, 'test')).filter(f => f.endsWith('.mjs')).map(f => f.slice(0, -4)).sort().filter(n => !so.length || so.includes(n));
const res = [];
for (const n of testes) {
  const fonte = fs.readFileSync(path.join(raiz, 'test', n + '.mjs'), 'utf8');
  if (SEM_ASSERCOES.has(n)) { res.push({ n, pulado: 'só medição' }); continue; }
  if (/['"`]dados\//.test(fonte) && !temDados) { res.push({ n, pulado: 'precisa de dados/' }); continue; }
  const t0 = Date.now(), r = spawnSync('node', [path.join('test', n + '.mjs')], { cwd: raiz, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
  const saida = (r.stdout || '') + (r.stderr || ''), okN = (saida.match(/^✔/gm) || []).length, falhas = saida.split('\n').filter(l => l.startsWith('✘'));
  const falhou = r.status !== 0 || falhas.length > 0 || okN === 0;
  res.push({ n, okN, falhas, falhou, s: ((Date.now() - t0) / 1000).toFixed(0), erro: falhou && !falhas.length ? saida.split('\n').filter(Boolean).slice(-15).join('\n') : '' });
  console.log(`${falhou ? '✘' : '✔'} ${n}: ${okN} verificação(ões)${falhas.length ? `, ${falhas.length} falha(s)` : ''} · ${res.at(-1).s} s`);
  for (const f of falhas) console.log('    ' + f);
  if (res.at(-1).erro) console.log(res.at(-1).erro.replace(/^/gm, '    '));
}
const rodados = res.filter(x => !x.pulado), falhos = rodados.filter(x => x.falhou), pulados = res.filter(x => x.pulado);
console.log(`\n${rodados.length - falhos.length} de ${rodados.length} teste(s) sem falha · ${rodados.reduce((s, x) => s + x.okN, 0)} verificações`);
if (pulados.length) console.log(`Pulados: ${pulados.map(x => `${x.n} (${x.pulado})`).join(', ')}`);
if (falhos.length) { console.log(`Com falha: ${falhos.map(x => x.n).join(', ')}`); process.exit(1); }
