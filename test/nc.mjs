// Teste da aba Não conformidades: candidatos da conferência, registro, importação da planilha manual,
// ações em lote, exportação, retenção dos dados de pacientes e ligação com o Fluxo mensal.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', d = f => raiz + 'dados/' + f;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste NC')));
await p.goto(html + '#inicio');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const S = expr => p.evaluate(expr);
const okDlg = async () => { await p.waitForSelector('#dlg[open]'); await p.click('#dlgBotoes button[value=ok]'); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(150); };

ok(await S(() => window.__RM.S.cfg.unidades.find(u => u.cod === '17').apolo.includes('MedicalShare')), 'MedicalShare cadastrada como nome do Apolo da unidade 17 (Palhano)');
ok(await S(() => window.__RM.S.cfg.faturistas.map(f => f.nome).join('|')) === 'FATURISTA DA UNIDADE|PARTICULAR - EQUIPE UNIDADE', 'faturistas genéricos já cadastrados');

// 1) Conferência com todos os médicos da unidade: os laudos sem lançamento viram candidatos.
await p.setInputFiles('#inMV', [d('mv_usg_medico15_unidade1.pdf'), d('mv_correcao_unidade2.pdf')]);
await p.waitForFunction(() => window.__RM.S.relatorios.length === 2, null, { timeout: 60000 });
await p.setInputFiles('#inApolo', d('apolo_09-2026.xlsx')); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 60000 });
await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar');
await p.selectOption('#cfRel', { index: 0 }); await p.selectOption('#cfUn', '1'); await p.selectOption('#cfMed', '*');
await p.click('#cfRodar'); await p.waitForSelector('.nc-cartao');
const cand = await S(() => { const f = window.__RM.S.ncCand[0]; return { n: f.itens.length, tipos: [...new Set(f.itens.map(c => c.tipo))], comp: f.itens[0]?.competencia }; });
ok(cand.n > 0 && cand.tipos.includes('so-laudo') && cand.comp === '2026-10', `candidatos separados pela conferência: ${cand.n} (${cand.tipos.join(', ')}) · competência ${cand.comp}`);
ok(await S(() => window.__RM.S.nc.itens.length) === 0, 'nada vira NC sozinho');

// 2) Apontar uma linha pela tabela da conferência.
await p.click('#cfTab tbody tr.clicavel'); await p.click('[data-nc-linha]');
await p.waitForSelector('#dlg[open]'); await p.selectOption('#dlgCorpo select[name=natureza]', 'conta-aberta'); await okDlg();
ok(await S(() => window.__RM.S.nc.itens.length === 1 && window.__RM.S.nc.itens[0].natureza === 'conta-aberta'), 'linha apontada como NC pelo detalhe da conferência');

// 3) Revisar na aba e registrar 3 candidatos de uma vez.
await p.click('[data-revisar-nc]'); await p.waitForSelector('#rvTab table');
ok(await p.textContent('#titulo') === 'Não conformidades', 'atalho abre a aba Não conformidades com a revisão');
const boxes = await p.$$('#rvTab tr:has(td:text-is("Só no laudo")) input[data-cand]'); for (const x of boxes.slice(0, 3)) await x.check();
await p.click('#rvReg'); await p.waitForSelector('#dlg[open]');
ok(await p.inputValue('#dlgCorpo select[name=natureza]') === 'nao-lancado', 'natureza sugerida para «Só no laudo»: procedimento não lançado');
await p.fill('#dlgCorpo input[name=responsavel]', 'GISLAINE.CARVALHO'); await p.fill('#dlgCorpo input[name=detalhe]', 'RX patela'); await okDlg();
const reg = await S(() => window.__RM.S.nc.itens.slice(1).map(x => [x.competencia, x.natureza, x.responsavel, x.detalhe, x.situacao, x.origem.tipo].join('/')));
ok(reg.length === 3 && reg.every(r => r === '2026-10/nao-lancado/GISLAINE.CARVALHO/RX patela/aberta/conferencia'), `3 NCs registradas em 10/2026 (${reg[0]})`);
ok(await S(() => !!document.querySelector('#rvTab .s-reg')), 'candidatos registrados aparecem como «registrada» na revisão');
await p.screenshot({ path: out + 'nc_revisao.png', fullPage: true });

// 4) Importar a planilha manual de 09/2026.
await p.setInputFiles('#ncArq', d('nao_conformidades_09-2026.xlsx')); await p.waitForSelector('#dlg[open]');
ok(await p.inputValue('#dlgCorpo input[name=competencia]') === '2026-09', 'competência 09/2026 lida do nome do arquivo');
await okDlg(); await p.waitForFunction(() => window.__RM.S.nc.itens.some(x => x.competencia === '2026-09'));
const imp = await S(() => { const it = window.__RM.S.nc.itens.filter(x => x.competencia === '2026-09'), c = k => it.filter(x => x.categoria === k).length, n = k => it.filter(x => x.natureza === k).length;
  return { total: it.length, part: c('particular'), conv: c('convenio'), prest: c('prestador'), guia: n('guia-negada'), outras: n('outras'), medical: it.filter(x => x.unidade === 'MedicalShare').map(x => x.unidadeCod).join(','),
    obs: it.find(x => x.obs.includes('Texto original: NÃO POSSUI ATENDIMENTO'))?.natureza, fat: window.__RM.S.cfg.faturistas.length }; });
ok(imp.part === 31 && imp.prest === 149 && imp.conv >= 60, `importadas: ${imp.total} (particular ${imp.part}, convênios ${imp.conv}, correção ${imp.prest})`);
ok(imp.guia === 17 && imp.outras <= 6, `naturezas padronizadas (guia negada ${imp.guia}, outras ${imp.outras})`);
ok(imp.obs === 'sem-atendimento', 'texto original preservado nas observações');
ok(/^17(,17)*$/.test(imp.medical), `MedicalShare ligada à unidade 17 (${imp.medical})`);
ok(imp.fat === 12, `responsáveis da planilha cadastrados como faturistas (${imp.fat})`);
await p.setInputFiles('#ncArq', d('nao_conformidades_09-2026.xlsx')); await okDlg();
ok(await S(() => window.__RM.S.nc.itens.filter(x => x.competencia === '2026-09').length) === imp.total, 'reimportar o mesmo arquivo não duplica');
await p.screenshot({ path: out + 'nc_aba.png', fullPage: true });
const kpi = await p.$$eval('.nc-kpi b', e => e.map(x => x.textContent));
ok(+kpi[0] === imp.total, `indicador total = ${kpi[0]}`);

// 5) Aba Particular, seleção e «Marcar como enviadas».
await p.click('[data-aba="particular"]'); await p.waitForSelector('#ncTab table');
ok(await p.$$eval('#ncTab tbody tr', e => e.length) === 31, 'aba Particular mostra 31 NCs');
await p.click('[data-lote="tudo"]'); await p.click('[data-lote="enviada"]');
await p.waitForFunction(() => window.__RM.S.nc.itens.filter(x => x.categoria === 'particular' && x.competencia === '2026-09' && x.situacao === 'enviada').length === 31);
ok(await S(() => window.__RM.S.nc.itens.find(x => x.categoria === 'particular' && x.competencia === '2026-09').enviadaEm) === '2026-10-30', 'marcadas como enviadas com a data de hoje');

// 6) Editar uma NC pela tabela.
await p.click('[data-aba="convenio"]'); await p.waitForSelector('#ncTab table');
await p.click('#ncTab tbody tr:first-child td:nth-child(3)'); await p.waitForSelector('#dlg[open]');
await p.fill('#dlgCorpo input[name=detalhe]', 'teste de edição'); await p.selectOption('#dlgCorpo select[name=situacao]', 'tratativa'); await okDlg();
const ed = await S(() => window.__RM.S.nc.itens.find(x => x.detalhe === 'teste de edição'));
ok(ed && ed.situacao === 'tratativa' && ed.enviadaEm === '' && ed.historico.length >= 3, 'edição grava detalhe, situação e histórico');

// 7) Levar uma pendência para a competência seguinte.
await p.click('[data-lote="limpar"]');
await p.check('#ncTab tbody tr:first-child input[data-sel]'); await p.click('[data-lote="seguinte"]');
await p.waitForFunction(() => window.__RM.S.nc.itens.some(x => x.deCompetencia === '2026-09'));
ok(await S(() => { const c = window.__RM.S.nc.itens.find(x => x.deCompetencia === '2026-09'); const o = window.__RM.S.nc.itens.find(x => x.levadaPara === '2026-10'); return c.competencia === '2026-10' && !!o; }), 'pendência levada para 10/2026, ligada à original');

// 8) Exportar para o Qualiex: mesmas abas da planilha manual + Indicadores.
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#ncExp')]);
const arq = out + 'nc_exportada.xlsx'; await dl.saveAs(arq);
await p.waitForSelector('#dlg[open]'); await p.click('#dlgBotoes button[value=""]');
const lido = JSON.parse(execFileSync('python3', ['-I', '-c', `import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1]); print(json.dumps({ws.title:[ws.max_row-1,[c.value for c in ws[1]][:2]] for ws in wb.worksheets}))`, arq]).toString());
ok(JSON.stringify(Object.keys(lido)) === JSON.stringify(['PARTICULAR', 'CONVENIOS (FAT)', 'Correção de prestadores', 'Indicadores']), `abas exportadas: ${Object.keys(lido).join(', ')}`);
ok(lido.PARTICULAR[0] === 31 && lido['Correção de prestadores'][0] === 149 && lido['Correção de prestadores'][1][1] === 'PRESTADOR INCORRETO', 'colunas e quantidades iguais às da planilha manual');

// 9) Prazos do Fluxo mensal e atalho no grupo de NCs.
await p.click('#ncProx'); await p.waitForSelector('.nc-cand');
const prazos = await p.$$eval('.nc-cand .l b', e => e.map(x => x.textContent));
ok(prazos.some(t => t.startsWith('22/10')) && prazos.some(t => t.startsWith('30/10 · hoje')) && prazos.some(t => t.startsWith('29/10')), `prazos da competência 10/2026: ${prazos.join(' | ')}`);
await p.goto(html + '#fluxo'); await p.waitForSelector('#fxCriar'); await p.click('#fxCriar'); await p.waitForSelector('[data-tg="nc"]'); await p.click('[data-tg="nc"]');
ok(/Não conformidades desta competência: 5/.test(await p.textContent('[data-g="nc"]')), 'grupo de NCs do Fluxo mostra o total da competência');

// 10) Retenção: NC registrada há 70 dias perde nome e ID ao abrir; a de 55 dias gera aviso.
await S(() => { const it = window.__RM.S.nc.itens, t = Date.now(); it[0].criadaEm = new Date(t - 70 * 864e5).toISOString(); it[1].criadaEm = new Date(t - 55 * 864e5).toISOString(); localStorage.setItem('rm2.nc', JSON.stringify(window.__RM.S.nc)); });
await p.reload(); await p.waitForFunction(() => window.__RM);
const ret = await S(() => { const it = window.__RM.S.nc.itens; return [it[0].paciente, it[0].idAtendimento, !!it[0].anonimizada, it[0].natureza, !!it[1].paciente]; });
ok(ret[0] === '' && ret[1] === '' && ret[2] && ret[3] && ret[4], 'após 60 dias: nome e ID apagados; natureza mantida; a NC mais nova fica intacta');
await p.goto(html + '#nc'); await p.waitForSelector('.nc-kpis');
ok(/terão nome e ID do paciente apagados em até 7 dias/.test(await p.textContent('#pag-nc')), 'aviso de dados que vencem em até 7 dias');

// 11) Bases: faturistas; menu: selo de abertas.
await p.goto(html + '#bases'); await p.waitForSelector('#cardFat');
ok((await p.$$('#cardFat tbody tr')).length === 12, 'Bases → Faturistas lista 12 responsáveis (2 genéricos + 10 da planilha)');
ok(/aberta/.test(await p.getAttribute('.nav a[data-pag="nc"]', 'aria-label')), `menu: «${await p.getAttribute('.nav a[data-pag="nc"]', 'aria-label')}»`);

// 12) Celular.
const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
m.on('pageerror', e => erros.push(e.message));
await m.goto(html + '#nc'); await m.waitForSelector('.nc-kpis');
ok(await m.evaluate(() => document.documentElement.scrollWidth) <= 390, 'celular sem rolagem horizontal da página');
ok(await m.evaluate(() => [...document.querySelectorAll('.nav .curto')].some(e => e.offsetParent && e.textContent === 'NCs')), 'barra do celular: «NCs»');
await m.screenshot({ path: out + 'nc_celular.png', fullPage: false });
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
