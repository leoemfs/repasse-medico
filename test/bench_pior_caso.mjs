// Pior caso da conferência (auditoria 16/11/2026, P2): 3.000 linhas × 30 mil laudos com muitos homônimos, tolerância 7.
// Mede o tempo e a assinatura do resultado (tem de ser a mesma depois de qualquer otimização). Uso: node tools/build.mjs --harness && node test/bench_pior_caso.mjs [--perfil]
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname;
const browser = await chromium.launch(), page = await browser.newPage();
await page.goto('file://' + raiz + 'dist/harness.html'); await page.waitForFunction(() => window.PRONTO, null, { timeout: 30000 });
const perfil = process.argv.includes('--perfil'); let cdp;
if (perfil) { cdp = await page.context().newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); }
await page.evaluate(() => {
  const H = window.H; let s = 7; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648, pick = a => a[Math.floor(rnd() * a.length)];
  const N = ['MARIA', 'ANA', 'JOSE', 'JOAO', 'ANTONIO', 'FRANCISCA', 'CARLOS', 'PAULO'], SB = ['SILVA', 'SANTOS', 'OLIVEIRA', 'SOUZA', 'LIMA', 'COSTA'];
  const nome = () => `${pick(N)} ${pick(SB)} ${pick(SB)}`;
  const TIT = Array.from({ length: 400 }, (_, i) => ({ titulo: `ULTRASSONOGRAFIA TIPO ${i} ${pick(['ABDOME', 'MAMAS', 'TIREOIDE'])}${i % 7 === 0 ? ' COM DOPPLER' : ''}`, codigo: String(40901000 + i) }));
  const laudos = [], d0 = Date.UTC(2026, 8, 1);
  for (let k = 0; k < 30000; k++) { const t = pick(TIT), data = new Date(d0 + Math.floor(rnd() * 30) * 864e5), p = nome(), m = 'MEDICO ' + (k % 30);
    laudos.push({ i: k, linhaPlanilha: k + 2, idLaudo: String(k), unidade: 'AlphaSonic Palhano', paciente: p, pn: H.norm(p), idPac: String(k), titulo: t.titulo, tn: H.norm(t.titulo), data, dia: Math.round(data / 864e5), convenio: pick(['UNIMED', 'PARTICULAR', 'SUS']), modalidade: 'US', medico: m, mn: m, _cod: t.codigo }); }
  const eq = H.eqVazia(); for (const t of TIT.slice(0, 300)) eq.itens.push({ id: 'eq' + t.codigo, codigo: t.codigo, titulo: t.titulo, status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'B' });
  for (let c = 0; c < 10; c++) eq.compostas.push({ id: 'c' + c, nome: 'r' + c, titulos: [], palavras: { todas: ['DOPPLER'], umaDe: ['TIPO ' + (c * 7)] }, itens: [{ codigos: [TIT[c * 7].codigo], qtd: 1 }, { codigos: ['40901386'], qtd: 1 }], escopo: { unidade: '*', modalidade: '*' }, status: 'validada', historico: [] });
  eq.revisao = 1;
  const regs = []; for (let q = 0; q < 3000; q++) { const l = pick(laudos); regs.push({ seq: q + 1, codigo: l._cod, procDesc: l.titulo, grupoNome: 'ULTRASSONOGRAFIA', conta: String(1000 + q), atendimento: String(5000 + q), paciente: l.paciente, convenio: l.convenio, data: l.data, vlRepasse: 50, vlTotal: 100, prestadorCod: '15' }); }
  window.__pior = { rel: { regs, cab: { prestadorCod: '15', prestadorNome: 'MEDICO', repasse: 'USG' } }, apolo: { laudos }, cfg: H.configPadrao(), eq };
});
if (perfil) await cdp.send('Profiler.start');
const r = await page.evaluate(() => { const H = window.H, x = window.__pior, t = performance.now(), c = H.conferirCruzado(x.rel, x.apolo, x.cfg, x.eq, { unidadeCod: '17', tol: 7 }), ms = performance.now() - t;
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  return { ms: Math.round(ms), assinatura: fnv(c.linhas.map(y => `${y.r?.seq || ''}:${y.status}:${y.l?.i ?? ''}:${[...y.marcadores].sort().join(',')}`).join('|')), conferidos: c.porStatus.conferido.n }; });
console.log(JSON.stringify(r));
// Assinatura do resultado: qualquer otimização tem de mantê-la. Era '41a7085c' na v3.0.0-alpha.10 (antes das otimizações do P2).
// v3.0.0-alpha.23 (SOL-F47, mudança de regra, não de desempenho): o título do laudo desempata exames do mesmo paciente. Neste caso,
// linhas com laudo do próprio código 2.936 → 2.977 de 3.000, «ambíguo» 2.936 → 2.925, mesmas contagens por situação.
// v3.0.0-alpha.44 (mudança de regra, caso real de 25/11/2026): a mesma paciente na mesma data vem antes de um nome apenas semelhante.
// Neste caso, linhas com laudo da própria paciente 2.997 → 2.999, «nome apenas semelhante» 3 → 1, «Só no laudo» 27.003 → 27.002.
const ASSINATURA = 'ac021c51';
console.log((r.assinatura === ASSINATURA ? '✔ ' : '✘ ') + `resultado idêntico ao de antes das otimizações (assinatura ${r.assinatura})`); if (r.assinatura !== ASSINATURA) process.exitCode = 1;
console.log((r.ms < 8000 ? '✔ ' : '✘ ') + `pior caso em ${(r.ms / 1000).toFixed(1)} s (era 6,8 s na auditoria e 14,9 s nesta máquina antes do P2; limite do teste 8 s)`); if (r.ms >= 8000) process.exitCode = 1;
if (perfil) { const { profile } = await cdp.send('Profiler.stop'); const self = new Map(), dt = profile.timeDeltas; const byId = new Map(profile.nodes.map(n => [n.id, n]));
  profile.samples.forEach((id, i) => { const n = byId.get(id), k = `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); });
  console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => `${(v / 1000).toFixed(0)}ms ${k}`).join('\n')); }
await browser.close();
