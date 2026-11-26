// v3.0.0-alpha.38 — Ordem da tabela da Conferência (pedido de 24/11/2026, prévia aprovada): «Ordenar por» e títulos clicáveis;
// em «Paciente (A→Z)» as linhas do mesmo paciente ficam juntas, com faixa alternada e «N linhas»; a ordem vale para o Excel e
// fica lembrada no navegador. Dados fictícios: TC abdome superior e TC pelve do mesmo paciente, separadas no relatório.
import { createRequire } from 'module';
import fs from 'fs';
import { execFileSync } from 'child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/ordem_conferencia/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const py = (codigo, ...args) => JSON.parse(execFileSync('python3', ['-I', '-c', codigo, ...args], { encoding: 'utf8' }) || 'null');
const b = await chromium.launch(), erros = [];

py(`import openpyxl,datetime,json,sys
wb=openpyxl.Workbook(); ws=wb.active
ws.append(['ID','BRANCH_NAME','PATIENT_ID','PATIENT_NAME','TITLE','STUDY_DATETIME','PATIENT_INSURANCE','MODALITY','NAME_MEDICO'])
for i,(p,t,d) in enumerate(json.loads(sys.argv[2])): ws.append([900+i,'Ultramed Cambe',600+i,p,t,datetime.datetime(2026,10,d,9,30),'UNIMED','CT','DR T'])
wb.save(sys.argv[1]); print('null')`, out + 'apolo.xlsx', JSON.stringify([['ZACARIAS LIMA', 'TOMOGRAFIA DE ABDOME TOTAL', 8], ['ANA BEATRIZ COSTA', 'TOMOGRAFIA DE ABDOME TOTAL', 3], ['MARCOS VIEIRA', 'TOMOGRAFIA DE CRÂNIO', 5]]));
const linhaMV = (n, pac, dia, vl) => `${125800 + n} ${2579500 + n} ${2244100 + n} ${pac} N CLINICO UNIMED ${String(dia).padStart(2, '0')}/10/26 1 0 ${vl},00 50,00 ${vl * 2},00`;
const procs = [['41001109 - TC ABDOME SUPERIOR-OP', [[1, 'ZACARIAS LIMA', 8, 20], [2, 'ANA BEATRIZ COSTA', 3, 20]]], ['41001117 - TC PELVE OU BACIA-OP', [[3, 'ZACARIAS LIMA', 8, 25], [4, 'ANA BEATRIZ COSTA', 3, 25]]], ['41001010 - TC CRANIO-OP', [[5, 'MARCOS VIEIRA', 5, 30]]]];
const L = ['Grupo de Repasse: 70 - DR T', 'Prestador: 70 - DR T', 'Repasse: 4700 Dt. Repasse: 10/11/2026 Descrição: REPASSE IMG 11/2026', 'Grupo de Procedimento: 34 - TOMOGRAFIA COMPUT. DIAGNOSTICA'];
let tg = 0; for (const [pr, ls] of procs) { const t = ls.reduce((s, l) => s + l[3], 0); tg += t; L.push(`Procedimento: ${pr}`, ...ls.map(l => linhaMV(...l)), `Total do Procedimento: ${t},00 ${t * 2},00`); }
L.push(`Total do Grupo de Procedimento: ${tg},00 ${tg * 2},00`, `Total Geral do Repasse: ${tg},00 ${tg * 2},00`);
{ const pg = await b.newPage(); await pg.setContent(`<body style="font:11px Arial">${L.map(l => `<div style="white-space:pre">${l}</div>`).join('')}</body>`); await pg.pdf({ path: out + 'mv_70_img_unidade_4.pdf' }); await pg.close(); }

const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }), p = await ctx.newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Ordem')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
await p.setInputFiles('#inMV', [out + 'mv_70_img_unidade_4.pdf']); await p.waitForFunction(() => window.__RM.S.relatorios.length === 1, null, { timeout: 30000 });
await p.setInputFiles('#inApolo', out + 'apolo.xlsx'); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 30000 });
await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar');
if ((await p.inputValue('#cfUn')) !== '4') await p.selectOption('#cfUn', '4');
await p.click('#cfRodar'); await p.waitForSelector('#cfOrdem', { timeout: 15000 }); await p.waitForTimeout(200);
await p.uncheck('#cfSoFalta'); await p.waitForSelector('#cfOrdem'); await p.waitForTimeout(200);
const pacientes = () => p.$$eval('#cfTab tbody tr:not(.detalhe) td:nth-child(3) .pac', ts => ts.map(t => t.textContent.trim()));
const antes = await pacientes();
ok(antes.join('|') === 'ZACARIAS LIMA|ANA BEATRIZ COSTA|ZACARIAS LIMA|ANA BEATRIZ COSTA|MARCOS VIEIRA', `padrão = ordem do relatório (${antes.join(' · ')})`);
await p.selectOption('#cfOrdem', 'pac'); await p.waitForTimeout(200);
const az = await pacientes();
ok(az.join('|') === 'ANA BEATRIZ COSTA|ANA BEATRIZ COSTA|MARCOS VIEIRA|ZACARIAS LIMA|ZACARIAS LIMA', `Paciente (A→Z): o mesmo paciente fica junto (${az.join(' · ')})`);
const faixas = await p.$$eval('#cfTab tbody tr:not(.detalhe)', trs => trs.map(tr => `${tr.classList.contains('grp-b') ? 'B' : '-'}${tr.classList.contains('grp-ini') ? 'i' : ''}`));
ok(faixas.join(' ') === 'Bi B -i Bi B', `faixa alternada por paciente (${faixas.join(' ')})`);
ok((await p.$$eval('#cfTab .grp-tag', ts => ts.map(t => t.textContent))).join('|') === '2 linhas|2 linhas', 'marca «2 linhas» na primeira linha de quem tem mais de uma');
await p.click('#cfTab [data-ordk="pac"]'); await p.waitForTimeout(200);
ok((await pacientes())[0] === 'ZACARIAS LIMA' && /▼/.test(await p.textContent('#cfTab [data-ordk="pac"]')), 'clicar de novo no título «Paciente» inverte (Z→A, ▼)');
await p.click('#cfTab [data-ordk="vl"]'); await p.waitForTimeout(200);
const vls = await p.$$eval('#cfTab tbody tr:not(.detalhe) td:last-child', ts => ts.map(t => t.textContent.trim()));
ok(vls.join('|') === '30,00|25,00|25,00|20,00|20,00' && (await p.inputValue('#cfOrdem')) === 'vl' && !(await p.$('#cfTab tr.grp-b')), `título «Vl Repasse»: maior primeiro, seletor acompanha, sem faixa (${vls.join(' · ')})`);
// Excel na ordem escolhida (Paciente A→Z).
await p.selectOption('#cfOrdem', 'pac'); await p.waitForTimeout(200);
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#cfExcel')]); await dl.saveAs(out + 'conf.xlsx');
const X = py(`import openpyxl,json,sys
ws=openpyxl.load_workbook(sys.argv[1],read_only=True)['Conferência']; r=list(ws.iter_rows(values_only=True)); i=list(r[0]).index('Paciente')
print(json.dumps([x[i] for x in r[1:]]))`, out + 'conf.xlsx');
ok(X.join('|') === az.join('|'), `Excel: aba «Conferência» na ordem da tela (${X.join(' · ')})`);
// Lembrada no navegador.
await p.goto(html + '#inicio'); await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar'); await p.click('#cfRodar'); await p.waitForSelector('#cfOrdem', { timeout: 15000 });
ok((await p.inputValue('#cfOrdem')) === 'pac', 'a ordem escolhida fica lembrada ao rodar de novo');
// 26/11/2026: botões da barra das linhas marcadas visíveis sem passar o mouse (antes: texto da cor da barra), nos dois temas.
for (const tema of ['light', 'dark']) {
  await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), tema);
  if (!(await p.$('#cfSelInfo.cf-selbar'))) { await p.click('#cfTab tbody tr:not(.detalhe) input.cf-sel'); await p.waitForTimeout(200); }
  const cores = await p.$$eval('#cfSelInfo.cf-selbar button', (bs) => { const bar = getComputedStyle(document.getElementById('cfSelInfo')).backgroundColor;
    return bs.filter(b => b.offsetParent).map(b => { const c = getComputedStyle(b); const fundo = c.backgroundColor === 'rgba(0, 0, 0, 0)' ? bar : c.backgroundColor; return { t: b.textContent.trim().slice(0, 24), ok: c.color !== fundo }; }); });
  ok(cores.length > 0 && cores.every(c => c.ok), `tema ${tema}: botões da barra das linhas marcadas com texto visível (${cores.map(c => c.t).join(' · ')})`);
}
ok(!erros.length, `sem erros na tela${erros.length ? ': ' + erros.join(' | ') : ''}`);
await b.close();
