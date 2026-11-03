// Teste SOL-F9: conciliação com o Power BI — explica os «Só no laudo» e sugere natureza e responsável.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', d = f => raiz + 'dados/' + f;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste PBI')));
await p.goto(html + '#inicio');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });

// 1) Motor com lançamentos fictícios: cada situação.
const sit = await p.evaluate(() => {
  const { t, S: E } = window.__RM, dt = new Date(Date.UTC(2026, 8, 10)), dia = t.diaSerial(dt);
  const L = (pn, extra) => ({ pn, data: dt, unidadeCod: '1', grupo: 'ULTRASSONOGRAFIA - OUTROS', codigo: '40901300', desc: 'US ABDOME', conta: '900', atendimento: '800', prestador: '15', contaFechada: 'S', remessa: '77', faturista: 'FATURISTA.TESTE', convenio: 'X', ...extra });
  const pbi = { linhas: [L('PACIENTE OUTRO PRESTADOR', { prestador: '7' }), L('PACIENTE CONTA ABERTA', { contaFechada: 'N' }), L('PACIENTE SEM REMESSA', { remessa: '' }), L('PACIENTE LANCADO', {})] };
  const opc = { unidadeCod: '1', tol: 0, prestadorCod: '15', cfg: E.cfg };
  const c = pn => t.conciliarLaudo(pbi, { pn, dia, titulo: 'USG ABDOME TOTAL', modalidade: 'US' }, opc);
  return ['PACIENTE SEM LANCAMENTO', 'PACIENTE OUTRO PRESTADOR', 'PACIENTE CONTA ABERTA', 'PACIENTE SEM REMESSA', 'PACIENTE LANCADO'].map(pn => { const r = c(pn); return [r.situacao, r.natureza, r.faturista || ''].join('|'); });
});
ok(sit.join(' ; ') === 'sem-lancamento|nao-lancado| ; outro-prestador|prestador-incorreto|FATURISTA.TESTE ; conta-aberta|conta-aberta|FATURISTA.TESTE ; sem-remessa|sem-remessa|FATURISTA.TESTE ; lancado|apos-geracao|FATURISTA.TESTE', `situações: ${sit.map(x => x.split('|')[0]).join(', ')}`);

// 2) Com os arquivos de dados: conferência do prestador 15 com o Power BI carregado.
await p.setInputFiles('#inMV', [d('mv_usg_medico15_unidade1.pdf')]); await p.waitForFunction(() => window.__RM.S.relatorios.length === 1, null, { timeout: 60000 });
await p.setInputFiles('#inApolo', d('apolo_09-2026.xlsx')); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 60000 });
await p.setInputFiles('#inPBI', d('powerbi_09-2026.xlsx')); await p.waitForFunction(() => !!window.__RM.S.pbi, null, { timeout: 120000 });
await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar'); await p.selectOption('#cfUn', '1'); await p.selectOption('#cfMed', '*'); await p.click('#cfRodar'); await p.waitForSelector('#cfPBI');
const r = await p.evaluate(() => { const c = window.__RM.S.conf, cands = window.__RM.S.ncCand.at(-1).itens.filter(x => x.tipo === 'so-laudo');
  return { resumo: c.ctx.pbiResumo, soLaudo: cands.length, comPBI: cands.filter(x => x.pbi).length, natur: [...new Set(cands.filter(x => x.pbi).map(x => x.natureza))], motivo: cands.find(x => x.pbi)?.motivo.replace(/[A-Z]{3,}( [A-Z]{2,})+/g, '<nome>') || '' }; });
const soma = Object.values(r.resumo).reduce((s, n) => s + n, 0);
ok(r.soLaudo > 0 && r.comPBI === r.soLaudo && soma === r.soLaudo, `todos os ${r.soLaudo} «Só no laudo» conciliados com o Power BI (${Object.entries(r.resumo).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ')})`);
ok(/Power BI:/.test(r.motivo) && r.natur.length >= 1, `candidato com natureza sugerida (${r.natur.join(', ')}) e o motivo do Power BI`);
ok(/Power BI/.test(await p.textContent('#cfPBI')), 'resumo do Power BI no resultado da conferência');
await p.locator('#cfPBI').screenshot({ path: out + 'conciliacao_pbi.png' });
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
