// Teste: desfazer conflito de equivalência e memória das decisões por linha na competência.
import { createRequire } from 'module';
import fs from 'fs';
import { execFileSync } from 'child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', d = f => raiz + 'dados/' + f;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true })).newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
// Base com um conflito: o mesmo título validado para dois códigos.
await p.addInitScript(() => {
  if (localStorage.getItem('rm2.equivalencias')) return;
  const rel = (id, codigo, descMV) => ({ id, codigo, descMV, titulo: 'ULTRASSONOGRAFIA DE OMBRO COM DOPPLER', campo: 'TITLE', tipo: 'titulo', status: 'validada', direcao: 'mv->apolo',
    escopo: { unidade: '*', modalidade: '*' }, confianca: 'Alta', ambiguo: false, justificativa: '', atencao: '', origem: 'teste', responsavel: 'Teste', validadoEm: '2026-08-10T10:00:00Z', historico: [] });
  localStorage.setItem('rm2.equivalencias', JSON.stringify({ schema: 'repasse-medico/equivalencias', versaoSchema: 1, revisao: 1, atualizadoEm: new Date().toISOString(),
    itens: [rel('eqA', '40901130', 'US ARTICULAR'), rel('eqB', '40902021', 'DOPPLER COLORIDO')], catalogoTitulos: [], catalogoTUSS: [] }));
  localStorage.setItem('rm2.operador', JSON.stringify('Teste Decisões'));
});
await p.goto(html + '#equivalencias');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const S = expr => p.evaluate(expr);
const manterArquivos = async () => { await p.waitForTimeout(300); if (await p.$('#dlg[open]')) { await p.click('#dlgBotoes button[value=""]'); await p.waitForFunction(() => !document.getElementById('dlg').open); } };
const okDlg = async () => { await p.waitForSelector('#dlg[open]'); await p.click('#dlgBotoes button[value=ok]'); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(150); };

// 1) Desfazer conflito.
ok((await p.$$('[data-conf]')).length === 1, 'conflito listado com o botão «Desfazer conflito…»');
await p.click('[data-conf]'); await p.waitForSelector('#dlg[open]');
await p.check('#dlgCorpo input[value="40901130"]'); await okDlg();
ok(await S(() => window.__RM.S.eq.itens.every(e => e.status === 'validada')), 'sem justificativa, nada muda');
await p.click('[data-conf]'); await p.waitForSelector('#dlg[open]');
await p.check('#dlgCorpo input[value="40901130"]'); await p.fill('#dlgCorpo input[name=just]', 'só o articular por enquanto'); await okDlg();
const eq = await S(() => window.__RM.S.eq.itens.map(e => [e.codigo, e.status, e.historico.at(-1)?.competencia || ''].join(':')).join(' '));
ok(eq === '40901130:validada: 40902021:pendente:2026-10', `mantido o escolhido; o outro volta a pendente com a competência no histórico (${eq})`);
ok(!(await p.$('[data-conf]')), 'conflito resolvido some do painel');

// 2) Memória das decisões na conferência.
await p.goto(html + '#inicio');
await p.setInputFiles('#inMV', [d('mv_usg_medico15_unidade1.pdf')]); await p.waitForFunction(() => window.__RM.S.relatorios.length === 1, null, { timeout: 60000 });
await p.setInputFiles('#inApolo', d('apolo_09-2026.xlsx')); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 60000 });
const rodar = async () => { const n = await S(() => window.__RM.S.rodadas.length); await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar'); await p.waitForTimeout(200); await p.selectOption('#cfUn', '1'); await p.selectOption('#cfMed', '*'); await p.click('#cfRodar'); await p.waitForFunction(k => window.__RM.S.rodadas.length === k, n + 1); await p.waitForSelector('#cfTab table'); };
// Médico do laudo vem do cadastro (nome do cabeçalho do MV ou alias validado), já selecionado com o nome.
await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar'); await p.selectOption('#cfUn', '1'); await p.waitForTimeout(200);
const medSel = await S(() => { const s = document.getElementById('cfMed'); return [s.value, s.selectedOptions[0].textContent]; });
ok(medSel[0] === '@prest' && /Marcelo Miyazaki Yoshida.*\(do cadastro\)/i.test(medSel[1]), `médico do laudo escolhido pelo cadastro, com o nome (${medSel[1]})`);
await rodar();
const nCand0 = await S(() => window.__RM.S.ncCand.at(-1).itens.length);
// Considerar no repasse a primeira linha pendente do MV.
await p.click('[data-st="pendente"]'); await p.click('#cfTab tbody tr.clicavel'); await p.click('[data-considerar]');
await p.waitForSelector('#dlg[open]'); await p.fill('#dlgCorpo input[name=just]', 'doppler autorizado à parte'); await okDlg();
ok(await S(() => window.__RM.S.conf.res.porDecisao.considerar) === 1 && !!(await p.$('.marc.dec-considerar')), 'linha «Considerado no repasse» com filtro próprio');
// Apontar como NC um laudo «Só no laudo».
await p.click('[data-st="pendente"]'); await p.click('[data-st="so-laudo"]'); await p.waitForTimeout(200);
await p.click('#cfTab tbody tr.clicavel'); await p.click('[data-nc-linha]'); await okDlg();
ok(await S(() => window.__RM.S.conf.res.porDecisao.nc) === 1, 'laudo apontado como NC aparece como «Tratado: NC»');
// Nova rodada: as decisões continuam.
await rodar();
const dec = await S(() => ({ ...window.__RM.S.conf.res.porDecisao, cand: window.__RM.S.ncCand.at(-1).itens.length, rod: window.__RM.S.rodadas.at(-1).linhas.filter(l => l.decisao).map(l => l.decisao).join() }));
ok(dec.nc === 1 && dec.considerar === 1, `nova rodada reconhece as decisões (NC ${dec.nc}, considerada ${dec.considerar})`);
ok(dec.cand === nCand0 - 1, `a linha tratada não volta como candidata (${nCand0} → ${dec.cand})`);
ok(dec.rod === 'considerar', 'a rodada guarda a decisão por linha');
await p.screenshot({ path: out + 'decisoes_conferencia.png' });
// Excel da conferência (SOL-F23): MV × Apolo lado a lado, decisão e abas técnicas à parte.
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#cfExcel')]); const xl = out + 'conferencia_f23.xlsx'; await dl.saveAs(xl);
const rodId = await S(() => window.__RM.S.conf.ctx.rodadaId);
ok(dl.suggestedFilename() === `conferencia_medico_15_unidade_1_comp_10-2026_rodada_${rodId}.xlsx`, `nome do arquivo com médico, unidade, competência e rodada (${dl.suggestedFilename()})`);
const xs = JSON.parse(execFileSync('python3', ['-I', '-c', `import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1]); c=wb['Conferência']; cab=[x.value for x in c[1]]
linhas=list(c.iter_rows(min_row=2,values_only=True)); f=wb['O que falta decidir']; pend=sum(1 for r in f.iter_rows(min_row=2,values_only=True) if isinstance(r[0],int))
print(json.dumps({'abas':wb.sheetnames,'cab':cab,'n':len(linhas),'cons':sum(1 for r in linhas if (r[1] or '').startswith('Considerado no repasse: doppler')),'nc':sum(1 for r in linhas if (r[1] or '').startswith('Tratado: NC')),'conf':sum(1 for r in linhas if r[0]=='Conferido'),'pend':pend,'unid':linhas[0][10],'np':sum(1 for r in linhas if r[0]=='Item não procedimental')}))`, xl]).toString());
ok(JSON.stringify(xs.abas) === JSON.stringify(['O que falta decidir', 'Conferência', 'Resumo', 'Informações', 'Técnico', 'Por procedimento', 'Títulos sem validação', 'Candidatos', 'MV original']), `abas: ${xs.abas.join(', ')}`);
ok(xs.cab.join('|') === 'Situação|Decisão na competência|Paciente|Data|Cód. TUSS MV|Procedimento no MV|Laudo (TITLE)|O que falta / por quê|Vl Repasse|Convênio MV|Unidade MV|Grupo de procedimento MV|Médico MV|Paciente MV|Paciente Apolo|Data Apolo|Descrição do estudo (STUDY)|Convênio Apolo|Unidade Apolo|Modalidade Apolo|Médico Apolo|Ressalvas|Observações e análise', 'colunas na ordem de quem confere: situação, paciente, data, MV, laudo, o que falta (SOL-F40)');
ok(xs.cons === 1 && xs.nc === 1 && /ULTRAMED APUCARANA/.test(xs.unid), `decisões na planilha (considerada ${xs.cons}, NC ${xs.nc}) e unidade MV da sessão`);
ok(xs.pend === xs.n - xs.conf - 2 - xs.np, `«O que falta decidir» = registros sem conferência e sem decisão (${xs.pend} de ${xs.n})`);
// Aceite desconta as decisões.
await p.goto(html + '#rodadas'); await p.waitForSelector('[data-ac]');
await p.click('[data-ac]'); await p.waitForSelector('#dlg[open]');
const txt = await p.textContent('#dlgCorpo');
const pendTotal = await S(() => window.__RM.S.rodadas.at(-1).linhas.filter(l => !['conferido', 'identificado'].includes(l.estado)).length);
ok(txt.includes(`${pendTotal - 1} linha(s) ainda não conferidas`), `aceite conta ${pendTotal - 1} pendências (de ${pendTotal}, descontada a considerada)`);
await p.click('#dlgBotoes button[value=""]');
// NC «não procede» deixa de valer como decisão.
await S(() => { window.__RM.S.nc.itens[0].situacao = 'nao-procede'; });
await rodar();
ok(await S(() => window.__RM.S.conf.res.porDecisao.nc) === 0, 'NC «Não procede» deixa de tratar a linha');
// Outra competência: decisões não se misturam.
await p.click('#compAnt'); await manterArquivos(); await rodar();
ok(await S(() => window.__RM.S.conf.res.porDecisao.considerar) === 0, 'em 09/2026 a decisão de 10/2026 não vale');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
