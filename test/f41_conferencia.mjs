// v3.0.0-alpha.13 — SOL-F41 (o que faltava): filtros por título e médico do laudo, intervalo de datas e «sem observação»;
// lote «Dispensar laudos» e «Observação»; observação no Excel, no aceite e na NC; retenção da observação. Dados fictícios.
import { createRequire } from 'module';
import fs from 'fs';
import { execFileSync } from 'child_process';
const abrirF = async () => { if (!(await p.isVisible('#cfGaveta'))) await p.click('#cfFiltrosBt'); };
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/f41/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.clock.install({ time: new Date('2026-11-17T10:00:00') });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste F41')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const okDlg = async (botao = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${botao}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };
// 4 linhas do MV (DR X) e laudos: 3 com par, 1 «Só no laudo» do DR X (2ª página) e 2 «Só no laudo» do DR Y.
await p.evaluate(() => {
  const { S } = window.__RM, d = n => new Date(Date.UTC(2026, 9, n)), dia = n => Math.round(d(n) / 864e5);
  const L = (i, pac, titulo, n, med = 'DR X') => ({ i, linhaPlanilha: i + 2, idLaudo: String(600 + i), unidade: 'AlphaSonic Palhano', paciente: pac, pn: pac, idPac: String(i), titulo, tn: titulo, descricao: '', data: d(n), dia: dia(n), convenio: 'UNIMED', modalidade: 'US', medico: med, mn: med });
  S.apolo = { nome: 'apolo.xlsx', hash: 'h', laudos: [L(0, 'ANA PAULA ROCHA', 'USG TIREOIDE', 3), L(1, 'BRUNA LIMA COSTA', 'USG TIREOIDE', 4), L(2, 'CARLA DIAS MOTA', 'USG ABDOME', 5),
    L(3, 'ANA PAULA ROCHA', 'DOPPLER TIREOIDE PAGINA 2', 3), L(4, 'GIL SOUZA', 'USG MAMAS', 8, 'DR Y'), L(5, 'HUGO LIMA', 'USG MAMAS', 9, 'DR Y')] };
  S.eq.itens.push({ id: 'eqA', codigo: '40901173', titulo: 'USG TIREOIDE', status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'T' });
  const R = (seq, pac, n, codigo, desc, vl) => ({ seq, pagina: 1, codigo, procDesc: desc, grupoNome: 'ULTRASSONOGRAFIA', conta: String(9000 + seq), atendimento: String(7000 + seq), paciente: pac, convenio: 'UNIMED', data: d(n), vlRepasse: vl, vlTotal: vl * 2, pct: .5, quant: 1, prestadorCod: '15', prestadorNome: 'DR X', repasse: '25022' });
  const regs = [R(1, 'ANA PAULA ROCHA', 3, '40901173', 'US TIREOIDE', 10), R(2, 'BRUNA LIMA COSTA', 4, '40901173', 'US TIREOIDE', 20), R(3, 'CARLA DIAS MOTA', 5, '40901017', 'US ABDOME', 30), R(4, 'DORA NUNES PIRES', 6, '40901173', 'US TIREOIDE', 40)];
  S.relatorios = [{ id: 'rF41', nome: 'mv.pdf', tamanho: 1, hash: 'hF41', unidadePasta: '17', rel: { arquivo: 'mv.pdf', cab: { prestadorCod: '15', prestadorNome: 'DR X', repasse: '25022', descricao: 'REPASSE USG', competencia: '11/2026', repasses: [] }, regs, avisos: [], conferencias: [], ok: true } }];
  window.__RM.irPara('conferencia');
});
await p.waitForSelector('#cfRodar'); await p.selectOption('#cfUn', '17').catch(() => {}); await p.waitForTimeout(150);
await p.selectOption('#cfMed', '*'); await p.click('#cfRodar'); await p.waitForSelector('#cfAbas', { timeout: 15000 }); await p.waitForTimeout(200);
await p.evaluate(() => { window.__RM.S.conf.soFalta = false; }); await p.click('#cfVerTodas'); await p.waitForTimeout(150);
const vis = () => p.evaluate(() => [...document.querySelectorAll('#cfTab tbody tr.clicavel')].length);
const info = () => p.textContent('#cfSelInfo');
// 1) Filtros novos.
await abrirF(); await p.selectOption('#cfFTit', 'USG MAMAS'); await p.waitForTimeout(150);
ok(/2 linha\(s\) no filtro/.test(await info()), `título do laudo «USG MAMAS»: 2 linhas (${(await info()).match(/\d+ linha\(s\)/)?.[0]})`);
await abrirF(); await p.selectOption('#cfFTit', '*'); await abrirF(); await p.selectOption('#cfFMed', 'DR Y'); await p.waitForTimeout(150);
ok(/2 linha\(s\) no filtro/.test(await info()), 'médico do laudo «DR Y»: 2 linhas');
await abrirF(); await p.selectOption('#cfFMed', '*'); await abrirF(); await p.selectOption('#cfFData', '2026-10-04'); await abrirF(); await p.selectOption('#cfFDataAte', '2026-10-06'); await p.waitForTimeout(150);
ok(/3 linha\(s\) no filtro · R\$ 90,00/.test(await info()), `intervalo 04/10 a 06/10: 3 linhas, R$ 90 (${(await info()).match(/\d+ linha\(s\) no filtro · R\$ [\d.,]+/)?.[0]})`);
await p.click('#cfLimpar'); await p.waitForTimeout(150);
// 2) Lote: dispensar os laudos «Só no laudo» do filtro (DR X, 2ª página).
await p.evaluate(() => { window.__RM.S.conf.soFalta = false; }); await p.click('#cfVerTodas'); await p.waitForTimeout(150);
await abrirF(); await p.selectOption('#cfFMed', 'DR X'); await abrirF(); await p.selectOption('#cfFData', '2026-10-03'); await p.waitForTimeout(150);
ok(await p.isVisible('#cfLoteDisp') && /Dispensar os 1 laudo/.test(await p.textContent('#cfLoteDisp')), 'lote: «Dispensar os 1 laudo(s) «Só no laudo»…» para o filtrado');
await p.click('#cfLoteDisp'); await p.waitForSelector('#dlg[open]'); await okDlg();
ok(await p.evaluate(() => window.__RM.S.conf.res.linhas.find(x => !x.r && x.l?.titulo === 'DOPPLER TIREOIDE PAGINA 2')?.decisao?.tipo) === 'dispensado', 'laudo da 2ª página dispensado em lote');
await p.click('#cfLimpar'); await p.waitForTimeout(150);
// 3) Lote: observação nas linhas do DR Y.
await p.evaluate(() => { window.__RM.S.conf.soFalta = false; }); await p.click('#cfVerTodas'); await p.waitForTimeout(150);
await abrirF(); await p.selectOption('#cfFMed', 'DR Y'); await p.waitForTimeout(150);
await p.click('#cfLoteObs'); await p.waitForSelector('#dlg[open]'); await p.fill('#dlgCorpo [name="txt"]', 'Conferir no relatório do DR Y'); await okDlg();
await p.click('#cfLimpar'); await p.waitForTimeout(150);
await p.evaluate(() => { window.__RM.S.conf.soFalta = false; }); await p.click('#cfVerTodas'); await p.waitForTimeout(150);
await abrirF(); await p.selectOption('#cfFObs', 'com'); await p.waitForTimeout(150);
ok(/2 linha\(s\) no filtro/.test(await info()), 'observação em lote nas 2 linhas; filtro «Com observação» mostra as 2');
await abrirF(); await p.selectOption('#cfFObs', 'sem'); await p.waitForTimeout(150);
const nTot = await p.evaluate(() => window.__RM.S.conf.res.linhas.length);
ok(new RegExp(`${nTot - 2} linha\\(s\\) no filtro`).test(await info()), `filtro «Sem observação»: as outras ${nTot - 2}`);
await abrirF(); await p.selectOption('#cfFObs', ''); await p.waitForTimeout(150);
// 4) NC a partir de uma linha com observação: a observação vai para a NC.
await p.locator('#cfTab tr', { hasText: 'DORA NUNES PIRES' }).first().click(); await p.waitForTimeout(150);
const iD = await p.evaluate(() => window.__RM.S.conf.res.linhas.findIndex(x => x.r?.paciente === 'DORA NUNES PIRES'));
await p.fill(`[data-obs="${iD}"]`, 'Paciente não compareceu'); await p.click(`[data-obs-salvar="${iD}"]`); await p.waitForTimeout(300);
await p.locator('#cfTab tr', { hasText: 'DORA NUNES PIRES' }).first().click().catch(() => {}); await p.waitForTimeout(150);
if (!(await p.isVisible(`[data-nc-linha="${iD}"]`))) { await p.locator('#cfTab tr', { hasText: 'DORA NUNES PIRES' }).first().click(); await p.waitForTimeout(150); }
await p.click(`[data-nc-linha="${iD}"]`); await p.waitForSelector('#dlg[open]');
ok(/Paciente não compareceu/.test(await p.inputValue('#dlgCorpo textarea[name=obs]')), 'registro da NC já traz a observação da linha');
await p.selectOption('#dlgCorpo select[name=natureza]', 'lancado-incorreto'); await okDlg();
ok(await p.evaluate(() => window.__RM.S.nc.itens.some(n => /Paciente não compareceu/.test(n.obs))), 'a NC registrada tem a observação da linha nas Observações');
// 5) Excel: coluna «Observação (na linha)» no modelo Padrão.
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#cfExcel')]); await dl.saveAs(out + 'conf.xlsx');
const xl = JSON.parse(execFileSync('python3', ['-I', '-c', `import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1],read_only=True); ws=wb['Conferência']; rows=[list(r) for r in ws.iter_rows(values_only=True)]
h=rows[0]; i=h.index('Observação (na linha)') if 'Observação (na linha)' in h else -1
print(json.dumps({'col':i,'vals':[str(r[i]) for r in rows[1:] if i>=0 and r[i]]}))`, out + 'conf.xlsx'], { encoding: 'utf8' }));
ok(xl.col >= 0 && xl.vals.length === 3 && xl.vals.some(v => /DR Y \(Teste F41, 2026-11-17\)/.test(v)) && xl.vals.some(v => /não compareceu/.test(v)), `Excel com a coluna «Observação (na linha)»: ${xl.vals.length} linha(s) com texto, autor e data`);
// 6) Aceite: «N linha(s) com observação».
await p.click('#cfAba-aceite'); await p.waitForTimeout(150);
ok(/3 linha\(s\) com observação/.test(await p.textContent('#cfAceite')), 'quadro do aceite mostra «3 linha(s) com observação»');
await p.screenshot({ path: out + 'aceite.png' });
// 7) Retenção: observação com mais de 60 dias tem o texto apagado ao abrir.
await p.evaluate(() => { const { S } = window.__RM; const o = window.__RM.t.estadoCompetenciaObs(S.comp); o[0].em = '2026-08-01T10:00:00.000Z'; localStorage.setItem('rm2.compReg', JSON.stringify(S.compReg)); });
const ret = await p.evaluate(() => { const { S, t } = window.__RM, n = t.aplicarRetencaoObservacoes(S.compReg, 60), o = t.estadoCompetenciaObs(S.comp); return { n, texto: o[0].texto, por: o[0].por, outras: o.slice(1).every(x => !/retenção/.test(x.texto)) }; });
ok(ret.n === 1 && /retenção/.test(ret.texto) && ret.por === 'Teste F41' && ret.outras, `retenção: observação de mais de 60 dias tem o texto apagado (fica quem e quando): «${ret.texto}»`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
