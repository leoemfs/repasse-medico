// SOL-F40 — Conferência por causa, com os arquivos reais da competência 10/2026 (dados/comp_10-2026, fora do Git):
// resultado em uma frase, «O que falta decidir» agrupado pela decisão, validar → conferir de novo, ver linhas, Excel.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', pasta = raiz + 'dados/comp_10-2026/', d = f => raiz + 'dados/' + f;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const info = m => console.log('· ' + m);
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Causas')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const okDlg = async (v = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${v}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(250); };
await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub]'); await p.click('[data-bsub="prestadores"]'); await p.setInputFiles('#prCtrlArq', d('repasse_10-2026_controle.xlsx')); await okDlg();
await p.goto(html + '#equivalencias'); await p.waitForSelector('#eqArqX', { state: 'attached' }); await p.setInputFiles('#eqArqX', d('equivalencias_tuss.xlsx'));
await p.waitForFunction(() => window.__RM.S.eq.itens.length > 900, null, { timeout: 60000 }); if (await p.isVisible('#dlg[open]')) await okDlg();
await p.evaluate(() => { const { S, t } = window.__RM; t.alterarStatusEq(S.eq, S.eq.itens.filter(e => e.confianca === 'Alta').map(e => e.id), 'validada', 'Teste Causas', 'confiança alta', '2026-10'); });
await p.goto(html + '#inicio'); await p.setInputFiles('#inMV', pasta + 'MV_USG_15_un17.pdf'); await p.waitForFunction(() => window.__RM.S.relatorios.length === 1, null, { timeout: 120000 });
await p.setInputFiles('#inApolo', pasta + 'APOLO_10-2026_ref_09-2026.xlsx'); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 300000 });
await p.setInputFiles('#inPBI', pasta + 'POWERBI_10-2026_ref_09-2026.xlsx'); await p.waitForFunction(() => !!window.__RM.S.pbi, null, { timeout: 300000 });
while (await p.isVisible('#dlg[open]')) await okDlg();
await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar'); await p.selectOption('#cfUn', '17'); await p.waitForTimeout(150);
if (!(await p.$eval('#cfMed option[value="@prest"]', o => !o.disabled))) await p.selectOption('#cfMed', '*');
const rodar = async () => { const n0 = await p.evaluate(() => window.__RM.S.rodadas.length); await p.click('#cfRodar'); await p.waitForFunction(n => window.__RM.S.rodadas.length > n, n0, { timeout: 120000 }); await p.waitForSelector('.cf-frase'); };
await rodar();
const frase = async () => (await p.textContent('.cf-frase p')).replace(/\s+/g, ' ');
const f0 = await frase(); info(f0);
const conferidas = t => +(t.match(/(\d+) de \d+ linhas/) || [])[1];
ok(/\d+ de \d+ linhas do MV conferidas/.test(f0) && /Faltam \d+ decisão/.test(f0), 'resultado em uma frase, com barra de progresso');
const causas = await p.$$eval('#cfCausas .cz', els => els.map(e => ({ t: e.querySelector('b').textContent, n: +e.querySelector('.cz-n').firstChild.textContent })));
info(`decisões: ${causas.slice(0, 5).map(c => `${c.n} · ${c.t.slice(0, 70)}`).join(' | ')}`);
const grupos = causas.filter(c => !/Só no laudo/.test(c.t)), ordenado = grupos.slice(0, grupos.findIndex(c => c.n === 1) >= 0 ? grupos.findIndex(c => c.n === 1) : grupos.length).every((c, i, a) => !i || a[i - 1].n >= c.n);
ok(causas.length > 0 && ordenado, `«O que falta decidir»: ${causas.length} decisão(ões), da que resolve mais linhas para a que resolve menos`);
const soma = await p.evaluate(() => { const { S } = window.__RM, res = S.conf.res; return res.linhas.filter(x => !x.decisao && x.status !== 'conferido' && x.status !== 'nao-procedimental').length; });
ok(causas.reduce((s, c) => s + c.n, 0) === soma, `cada linha pendente está em exatamente uma decisão (${soma} linhas)`);
// «Só no laudo» com o Power BI: separa correção de prestador e NC; apontar correção vira NC «Prestador incorreto».
const sl = causas.map(c => c.t).filter(t => /Só no laudo|outro prestador|outro relatório/i.test(t));
info(`«Só no laudo» separados: ${sl.join(' | ') || '(nenhum)'}`);
ok(!sl.includes('Laudos sem lançamento neste relatório (Só no laudo)'), 'com o Power BI, os «Só no laudo» vêm separados pelo que aconteceu (outro prestador, sem lançamento, conta aberta…)');
const btCp = p.locator('#cfCausas [data-cza="corrprest"]').first();
if (await btCp.count()) { await btCp.click(); await p.waitForSelector('#dlg[open]'); ok(/Prestador incorreto/.test(await p.textContent('#dlgCorpo')), '«Apontar correção de prestador» abre o registro como NC «Prestador incorreto»'); await okDlg(''); }
await p.screenshot({ path: out + 'conferencia_causas.png', fullPage: false });
await p.locator('#cfCausas').screenshot({ path: out + 'conferencia_causas_lista.png' });
// Ver as linhas de uma decisão.
await p.locator('#cfCausas [data-cza="ver"]').first().click(); await p.waitForSelector('.cf-fl');
const nVer = +(await p.textContent('.cf-fl')).match(/(\d+) linha/)[1], nTab = await p.$$eval('#cfTab tbody tr:not(.det-row)', trs => trs.filter(t => !t.classList.contains('detalhe')).length);
ok(nVer === causas[0].n, `«Ver as linhas» filtra a tabela nas ${nVer} linhas da decisão`);
const cab = await p.$$eval('#cfTab thead th', ths => ths.map(t => t.textContent.trim()).filter(Boolean));
ok(cab.slice(0, 6).join('|') === 'Situação|Paciente|Data|Procedimento no MV|Laudo (Apolo)|O que falta / por quê', `colunas na ordem de quem confere (${cab.join(' · ')})`);
// Validar uma equivalência pela causa: a conferência roda de novo e a barra anda.
const btVal = p.locator('#cfCausas [data-cza="validar"], #cfCausas [data-cza="cadastrar"]').first();
if (await btVal.count()) {
  const alvo = await btVal.evaluate(b => b.closest('.cz').querySelector('b').textContent), nAlvo = +(await btVal.evaluate(b => b.closest('.cz').querySelector('.cz-n').firstChild.textContent));
  const n0 = await p.evaluate(() => window.__RM.S.rodadas.length);
  await btVal.click(); await okDlg(); await p.waitForFunction(n => window.__RM.S.rodadas.length > n, n0, { timeout: 120000 }); await p.waitForSelector('.cf-frase'); await p.waitForTimeout(300);
  const f1 = await frase(); info(f1);
  const ainda = await p.$$eval('#cfCausas .cz b', bs => bs.map(x => x.textContent));
  ok(conferidas(f1) > conferidas(f0) && !ainda.includes(alvo), `validar pela causa confere de novo sozinho: ${conferidas(f0)} → ${conferidas(f1)} conferidas (decisão de ${nAlvo} linha(s) saiu da lista)`);
} else info('sem decisão de equivalência pendente neste relatório');
// Aceitar em lote (convênio/data/nome) quando existir.
const btAc = p.locator('#cfCausas [data-cza="aceitar"]').first();
if (await btAc.count()) {
  const nAc = +(await btAc.evaluate(b => b.closest('.cz').querySelector('.cz-n').firstChild.textContent)), d0 = await p.evaluate(() => window.__RM.S.conf.res.linhas.filter(x => x.decisao).length);
  const tAc = await btAc.evaluate(b => b.closest('.cz').querySelector('b').textContent);
  await btAc.click(); await p.waitForSelector('#dlg[open]'); const sug = await p.inputValue('#dlgCorpo [name="just"]');
  if (/^(Convênio|Data|Nome|Linha repetida)/.test(tAc)) ok(sug.length > 5, `aceitar já sugere a justificativa («${sug}»)`); else { info(`aceitar em «${tAc.slice(0, 60)}»: justificativa digitada`); await p.fill('#dlgCorpo [name="just"]', 'conferido manualmente no teste'); }
  await okDlg();
  const d1 = await p.evaluate(() => window.__RM.S.conf.res.linhas.filter(x => x.decisao).length);
  ok(d1 - d0 === nAc, `aceitar em lote registra a decisão nas ${nAc} linha(s)`);
}
// Excel: 1ª aba «O que falta decidir».
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#cfExcel')]); const xl = out + 'conferencia_causas.xlsx'; await dl.saveAs(xl);
const xs = JSON.parse(execFileSync('python3', ['-I', '-c', `import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1]); f=wb['O que falta decidir']
print(json.dumps({'abas':wb.sheetnames[:2],'cab':[c.value for c in f[1]][:4],'n':sum(1 for r in f.iter_rows(min_row=2,values_only=True) if isinstance(r[0],int))}))`, xl]).toString());
const pend = await p.evaluate(() => window.__RM.S.conf.res.linhas.filter(x => !x.decisao && x.status !== 'conferido' && x.status !== 'nao-procedimental').length);
ok(xs.abas[0] === 'O que falta decidir' && xs.cab.join('|') === 'Decisão|O que decidir|Ação sugerida|Linhas na decisão' && xs.n === pend, `Excel: 1ª aba «O que falta decidir» com as ${xs.n} linhas, por decisão e ação sugerida`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + [...new Set(erros)].slice(0, 3).join(' | ') : ''));
await b.close();
