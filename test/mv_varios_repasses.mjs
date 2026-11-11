// v3.0.0-alpha.5 — PDF do MV com mais de um repasse do mesmo prestador (geração original, geração complementar com contas
// fechadas depois e lançamento manual, um repasse por lançamento). Não é erro: cada linha guarda o seu repasse e os
// totais são conferidos por repasse. Linhas fictícias no formato do relatório do MV.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname;
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), p = await b.newPage();
await p.goto('file://' + raiz + 'dist/harness.html'); await p.waitForFunction(() => window.PRONTO, null, { timeout: 30000 });
const cab = n => ['Grupo de Repasse: 10264 - MELANIE EIKO A L M BUTARELLO', 'Prestador: 10264 - MELANIE EIKO A L M BUTARELLO', `Repasse: ${n} Dt. Repasse: 10/11/2026 Descrição: REPASSE IMG 13/11/2026`, 'Competência: 11/2026'];
const sec = (n, linhas, total = true) => [...cab(n), 'Grupo de Procedimento: 30 - ULTRASSONOGRAFIA - OUTROS', 'Procedimento: 40901220 - USG ARTICULAR (POR ARTICULACAO) - OP', ...linhas.map(l => l[0]),
  `Total do Procedimento: ${linhas.map(l => l[1]).reduce((a, x) => a + x, 0).toFixed(2).replace('.', ',')} ${linhas.map(l => l[2]).reduce((a, x) => a + x, 0).toFixed(2).replace('.', ',')}`,
  `Total do Grupo de Procedimento: ${linhas.map(l => l[1]).reduce((a, x) => a + x, 0).toFixed(2).replace('.', ',')} ${linhas.map(l => l[2]).reduce((a, x) => a + x, 0).toFixed(2).replace('.', ',')}`,
  ...(total ? [`Total Geral do Repasse: ${linhas.map(l => l[1]).reduce((a, x) => a + x, 0).toFixed(2).replace('.', ',')} ${linhas.map(l => l[2]).reduce((a, x) => a + x, 0).toFixed(2).replace('.', ',')}`] : [])];
const L1 = [['122899 2549590 2214126 LUCIANY APARECIDA SANCHES N CLINICO HOSPITAL EVANGELICO DE 19/10/26 1 0 24,50 50,00 49,00', 24.5, 49], ['122899 2549591 2214127 PACIENTE DOIS N CLINICO HOSPITAL EVANGELICO DE 20/10/26 1 0 24,50 50,00 49,00', 24.5, 49]];
const L2 = [['123500 2551000 2215000 PACIENTE TRES N CLINICO UNIMED 25/10/26 1 0 30,00 50,00 60,00', 30, 60]];
const L3 = [['2551999 PACIENTE MANUAL N CLINICO PARTICULAR 26/10/26 1 0 10,00 50,00 20,00', 10, 20]];   // manual: sem remessa e sem atendimento
const r = await p.evaluate(blocos => {
  const H = window.H, lin = t => t.map((texto, i) => ({ pagina: 1 + Math.floor(i / 20), texto }));
  const ler = textos => { const x = H.interpretarMV(lin(textos), '10264.pdf'); return { ok: x.ok, avisos: x.avisos, notas: x.notas, repasse: x.cab.repasse, repasses: x.cab.repasses.map(y => `${y.numero}:${y.linhas}:${y.vlRepasse}`), porLinha: x.regs.map(y => y.repasse), total: x.totExtraido, geral: x.totalGeral }; };
  return { porRepasse: ler(blocos.porRepasse), umTotal: ler(blocos.umTotal), umSo: ler(blocos.umSo) };
}, {
  porRepasse: [...sec('25022', L1), ...sec('25029', L2), ...sec('25031', L3)],
  umTotal: [...sec('25022', L1, false), ...sec('25029', L2, false), 'Total Geral do Repasse: 79,00 158,00'],
  umSo: sec('25022', L1)
});
ok(r.porRepasse.ok && !r.porRepasse.avisos.length, `três repasses (original, complementar e manual), com total geral cada: sem aviso, totais conferem (${r.porRepasse.avisos.join(' | ') || 'ok'})`);
ok(r.porRepasse.repasses.join(',') === '25022:2:49,25029:1:30,25031:1:10' && r.porRepasse.porLinha.join(',') === '25022,25022,25029,25031', `cada linha guarda o seu repasse (${r.porRepasse.repasses})`);
ok(r.porRepasse.repasse === '25022' && /3 repasses do prestador/.test(r.porRepasse.notas.join(' ')), `cabeçalho fica com o 1º repasse (o original); a nota lista os três (${r.porRepasse.notas.find(n => /repasses/.test(n))})`);
ok(r.porRepasse.geral.join() === '89,178', `total geral = soma dos repasses (${r.porRepasse.geral})`);
ok(r.umTotal.ok && !r.umTotal.avisos.length, `um só «Total Geral» no fim do PDF: confere com a soma de tudo (${r.umTotal.avisos.join(' | ') || 'ok'})`);
ok(r.umSo.ok && !r.umSo.notas.some(n => /repasses do prestador/.test(n)) && r.umSo.repasses.length === 1, 'PDF com um repasse só: igual a antes');
await b.close();
