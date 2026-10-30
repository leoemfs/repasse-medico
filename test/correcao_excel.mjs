// Teste: Excel da correção de prestador organizado para corrigir no MV.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', d = f => raiz + 'dados/' + f;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true })).newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Correção')));
await p.goto(html + '#inicio');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
await p.setInputFiles('#inMV', [d('mv_correcao_unidade2.pdf')]); await p.waitForFunction(() => window.__RM.S.relatorios.length === 1, null, { timeout: 60000 });
await p.setInputFiles('#inApolo', d('apolo_09-2026.xlsx')); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 60000 });
await p.setInputFiles('#inEq', d('equivalencias_tuss.xlsx')); await p.waitForFunction(() => window.__RM.S.eq.itens.length > 900, null, { timeout: 60000 });
// Simula a validação das relações de confiança Alta (como no teste do motor).
await p.evaluate(() => { for (const e of window.__RM.S.eq.itens) if (e.confianca === 'Alta' && !e.ambiguo) { e.status = 'validada'; e.responsavel = 'Teste'; e.validadoEm = new Date().toISOString(); } });
await p.goto(html + '#correcao'); await p.waitForSelector('#coRodar'); await p.selectOption('#coUn', '2'); await p.click('#coRodar'); await p.waitForSelector('#coTab table');
const ident = await p.evaluate(() => window.__RM.S.corr.res.porEstado.identificado.n);
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#coExcel')]); const xl = out + 'correcao_excel.xlsx'; await dl.saveAs(xl);
const x = JSON.parse(execFileSync('python3', ['-I', '-c', `import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1]); c=wb['Corrigir no MV']; cab=[v.value for v in c[1]]; L=list(c.iter_rows(min_row=2,values_only=True))
t=list(wb['Todas as linhas'].iter_rows(min_row=2,values_only=True))
ni=[r for r in t if r[0]=='Prestador não identificado']
print(json.dumps({'abas':wb.sheetnames,'cab':cab,'n':len(L),'ordenado':[r[9] for r in L]==sorted([r[9] for r in L]),'medicos':len(set(r[9] for r in L)),'todas':len(t),'niSemMedico':all(not r[9] for r in ni),'obsFim':bool(L and L[0][15])}))`, xl]).toString());
ok(JSON.stringify(x.abas) === JSON.stringify(['Corrigir no MV', 'Todas as linhas', 'Não identificados', 'Conflitos e insuficientes', 'Resumo', 'Informações', 'Equivalências a analisar', 'Técnico']), `abas: ${x.abas.join(', ')}`);
ok(x.cab.join('|') === 'Status|Atendimento MV|Conta MV|Cód. TUSS MV|Descrição do procedimento MV|Paciente MV|Data MV|Convênio MV|Vl Repasse|Médico do laudo (Apolo)|Cód. prestador|Paciente Apolo|Data Apolo|Título do laudo (TITLE)|Descrição do estudo (STUDY)|Observações|Alertas', 'aba principal objetiva: status, MV, médico e laudo do Apolo; motivo e alertas no fim');
ok(x.n > 0 && x.n <= ident && x.ordenado, `«Corrigir no MV»: ${x.n} linha(s) de ${x.medicos} médico(s), agrupadas por médico`);
ok(x.todas === await p.evaluate(() => window.__RM.S.corr.res.linhas.length) && x.niSemMedico, '«Todas as linhas» reconcilia com o MV; não identificado sem médico (RN-206)');
ok(x.obsFim, 'observação (motivo e detalhe) preenchida no fim da linha');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
