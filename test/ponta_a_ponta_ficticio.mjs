// v3.0.0-alpha.11 (P2 da auditoria de 16/11/2026) — Ponta a ponta SEM a pasta dados/: os fluxos que só tinham teste com
// arquivos reais (leitura do PDF e do Apolo, conferência, decisões, NCs, aceite, correção de prestador, fechamento e Excel)
// rodam aqui com arquivos fictícios gerados no próprio teste. Roda no GitHub a cada envio (.github/workflows/testes.yml).
import { createRequire } from 'module';
import fs from 'fs';
import { execFileSync } from 'child_process';
const abrirF = async () => { if (!(await p.isVisible('#cfGaveta'))) await p.click('#cfFiltrosBt'); };
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/ficticio/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const py = (codigo, ...args) => JSON.parse(execFileSync('python3', ['-I', '-c', codigo, ...args], { encoding: 'utf8' }) || 'null');
const b = await chromium.launch(), erros = [];

// ---------- Arquivos fictícios (produção 10/2026, competência 11/2026) ----------
// Planilha de laudos do Apolo (formato atual: BRANCH_NAME, PATIENT_NAME, TITLE…).
const laudos = [
  ['ANA PAULA ROCHA', 'USG TIREOIDE', 3, 'UNIMED'], ['BRUNA LIMA COSTA', 'USG TIREOIDE', 4, 'UNIMED'], ['CARLA DIAS MOTA', 'USG TIREOIDE', 5, 'HOSPITAL X'],
  ['ELIS SOUZA REIS', 'USG ESTRANHO', 7, 'UNIMED'], ['FABIO NUNES LEAL', 'USG TIREOIDE', 8, 'UNIMED'], ['HELENA PRADO VAZ', 'USG TIREOIDE', 10, 'UNIMED']];
py(`import openpyxl,datetime,json,sys
wb=openpyxl.Workbook(); ws=wb.active
ws.append(['ID','BRANCH_NAME','PATIENT_ID','PATIENT_NAME','TITLE','STUDY_DATETIME','PATIENT_INSURANCE','MODALITY','NAME_MEDICO'])
for i,(p,t,d,c) in enumerate(json.loads(sys.argv[2])): ws.append([900+i,'AlphaSonic Palhano',100+i,p,t,datetime.datetime(2026,10,d,9,30),c,'US','DR X'])
wb.save(sys.argv[1]); print('null')`, out + 'apolo_10-2026.xlsx', JSON.stringify(laudos));
// PDFs do MV no formato do relatório, impressos pelo Chromium.
const linhaMV = (n, pac, dia, vl, conv = 'UNIMED') => `${122800 + n} ${2549500 + n} ${2214100 + n} ${pac} N CLINICO ${conv} ${String(dia).padStart(2, '0')}/10/26 1 0 ${vl},00 50,00 ${vl * 2},00`;
async function pdfMV(arq, cod, nome, linhas) {
  const tot = linhas.reduce((s, l) => s + l[3], 0), pg = await b.newPage();
  const L = [`Grupo de Repasse: ${cod} - ${nome}`, `Prestador: ${cod} - ${nome}`, `Repasse: 2${cod}0 Dt. Repasse: 10/11/2026 Descrição: REPASSE USG 11/2026`, 'Grupo de Procedimento: 30 - ULTRASSONOGRAFIA', 'Procedimento: 40901173 - US TIREOIDE - OP',
    ...linhas.map(l => linhaMV(...l)), `Total do Procedimento: ${tot},00 ${tot * 2},00`, `Total do Grupo de Procedimento: ${tot},00 ${tot * 2},00`, `Total Geral do Repasse: ${tot},00 ${tot * 2},00`];
  await pg.setContent(`<body style="font:11px Arial">${L.map(l => `<div style="white-space:pre">${l}</div>`).join('')}</body>`); await pg.pdf({ path: out + arq }); await pg.close();
}
// Conferência do DR X (15): 2 conferidos, 1 ressalva de convênio, 1 sem laudo, 1 sem equivalência; FABIO fica «Só no laudo».
await pdfMV('mv_15.pdf', '15', 'DR X', [[1, 'ANA PAULA ROCHA', 3, 10], [2, 'BRUNA LIMA COSTA', 4, 20], [3, 'CARLA DIAS MOTA', 5, 30], [4, 'DORA NUNES PIRES', 6, 40], [5, 'ELIS SOUZA REIS', 7, 50]]);
// Correção de prestador: lançado para o DR Z (99), mas o laudo é do DR X.
await pdfMV('mv_99.pdf', '99', 'DR Z', [[6, 'HELENA PRADO VAZ', 10, 60]]);

const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.clock.install({ time: new Date('2026-11-17T10:00:00') });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Ficticio')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const okDlg = async (botao = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${botao}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };
const baixar = async (sel, nome) => { const [dl] = await Promise.all([p.waitForEvent('download'), p.click(sel)]); await dl.saveAs(out + nome); return out + nome; };
const abas = (arq) => py(`import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1],read_only=True); r={}
for n in wb.sheetnames: r[n]=[[c for c in row] for row in wb[n].iter_rows(values_only=True)]
print(json.dumps(r,default=str))`, arq);

// ---------- 1. Início: PDFs e planilha pela tela ----------
await p.setInputFiles('#inMV', [out + 'mv_15.pdf', out + 'mv_99.pdf']);
await p.waitForFunction(() => window.__RM.S.relatorios.length === 2, null, { timeout: 30000 });
await p.setInputFiles('#inApolo', out + 'apolo_10-2026.xlsx'); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 30000 });
const ini = await p.evaluate(() => { const { S } = window.__RM; return { rels: S.relatorios.map(x => `${x.rel.cab.prestadorCod}:${x.rel.regs.length}:${x.rel.ok}`).sort(), laudos: S.apolo.laudos.length, prest: S.cfg.prestadores.some(x => x.cod === '15' && x.nomeMV === 'DR X') }; });
ok(ini.rels.join(' ') === '15:5:true 99:1:true' && ini.laudos === 6, `PDFs lidos com os totais conferidos (${ini.rels.join(' · ')}) e ${ini.laudos} laudos do Apolo`);
ok(ini.prest, 'prestador 15 - DR X cadastrado pelo cabeçalho do MV');
// O PDF do DR Z vai para a Correção de prestador (coluna «Finalidade» da lista do Início).
const id99 = await p.evaluate(() => window.__RM.S.relatorios.find(x => x.rel.cab.prestadorCod === '99').id);
await p.selectOption(`[data-fin="${id99}"]`, 'correcao');
// Equivalência validada (como faria a tela de Equivalências).
await p.evaluate(() => { const { S, t } = window.__RM; S.eq.itens.push({ id: 'eqF', codigo: '40901173', titulo: 'USG TIREOIDE', status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'Teste' }); t.salvarEq('Equivalência validada.'); });

// ---------- 2. Conferência ----------
await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar');
if (await p.isVisible('#cfRel')) await p.selectOption('#cfRel', await p.evaluate(() => window.__RM.S.relatorios.find(x => x.rel.cab.prestadorCod === '15').id));
await p.selectOption('#cfUn', '17'); await p.waitForTimeout(150);
ok(await p.inputValue('#cfMed') === '@prest', 'médico do laudo: o do cadastro do prestador (padrão)');
await p.click('#cfRodar'); await p.waitForSelector('#cfAbas', { timeout: 15000 }); await p.waitForTimeout(200);
const classes = () => p.evaluate(() => window.__RM.S.conf.res.linhas.filter(x => x.r).map(x => `${x.r.paciente.split(' ')[0]}:${window.__RM.t.classeDaLinhaConf(x)}`).join(' '));
const totais = () => p.evaluate(() => window.__RM.t.totaisPorClasse(window.__RM.S.conf.res.linhas, window.__RM.t.classeDaLinhaConf));
ok(await classes() === 'ANA:devido BRUNA:devido CARLA:pend DORA:pend ELIS:pend', `classes da conferência: ${await classes()}`);
ok(await p.evaluate(() => window.__RM.S.conf.res.linhas.some(x => !x.r && x.status === 'so-laudo' && x.l.paciente === 'FABIO NUNES LEAL')), 'laudo sem lançamento aparece «Só no laudo»');
ok(/Conferir e decidir/.test(await p.textContent('#cfRoteiro .rot-passo.atual')) && /decisão\(ões\) faltam/.test(await p.textContent('#cfRoteiro')), `SOL-F51: roteiro no passo 2 (${(await p.textContent('#cfRoteiro .rot-passo.atual')).trim()})`);
await p.click('#btnMenu'); await p.waitForTimeout(150);
ok(await p.isVisible('#cfRoteiro .roteiro'), 'roteiro continua visível com o menu recolhido (alpha.27: a classe do cartão não colide com o nome dos itens do menu)');
await p.click('#btnMenu'); await p.waitForTimeout(150);
await p.click('#cfTab tbody tr.clicavel'); await p.waitForTimeout(150);
ok(/MV/.test(await p.textContent('#cfTab .cf-cmp')) && await p.isVisible('#cfTab .cf-cmp'), 'linha aberta mostra MV × laudo lado a lado');
ok(/15 - DR X\s*DR X\s*mesmo prestador/.test(await p.textContent('#cfTab .cf-cmp')), 'linha Médico: o prestador do relatório do MV ao lado do médico do laudo (alpha.39)');
ok(await p.isVisible('#cfTab .qd .qd-tit') && /1 diferença: Convênio/.test(await p.textContent('#cfTab .qd .qd-rod')) && (await p.$$('#cfTab .qd tr.dif')).length === 1, `quadro 1 a 1 (alpha.40): título, linha da diferença destacada e resumo (${(await p.textContent('#cfTab .qd .qd-rod')).trim()})`);
await p.screenshot({ path: out + 'conferencia.png', fullPage: true });
await p.click('#cfTab tbody tr.clicavel'); await p.waitForTimeout(150);
// Aceitar a ressalva de convênio (filtro por data + lote).
await p.evaluate(() => { window.__RM.S.conf.soFalta = false; }); await p.click('#cfVerTodas'); await p.waitForTimeout(150);
await abrirF(); await p.selectOption('#cfFData', '2026-10-05'); await p.waitForTimeout(150);
await p.click('#cfLoteAceitar'); await p.waitForSelector('#dlg[open]'); await p.fill('#dlgCorpo [name="just"]', 'Mesmo convênio escrito de outro jeito');
// v3.0.0-alpha.28: Enter no campo confirma (antes acionava «Cancelar»).
await p.press('#dlgCorpo [name="just"]', 'Enter'); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200);
await p.click('#cfLimpar'); await p.waitForTimeout(150);
// NC na linha sem laudo, pelo detalhe da linha.
await p.evaluate(() => { window.__RM.S.conf.soFalta = false; }); await p.click('#cfVerTodas'); await p.waitForTimeout(150);
await p.locator('#cfTab tr', { hasText: 'DORA NUNES PIRES' }).first().click(); await p.waitForTimeout(150);
await p.locator('[data-nc-linha]').first().click(); await p.waitForSelector('#dlg[open]');
await p.selectOption('#dlgCorpo select[name=natureza]', 'lancado-incorreto'); await okDlg();
ok(await classes() === 'ANA:devido BRUNA:devido CARLA:aceito DORA:nc ELIS:pend', `depois das decisões: ${await classes()}`);
let T = await totais();
ok(T.pagar === 60 && T.nc.valor === 40 && T.pend.valor === 50 && T.total === 150, `valor para pagamento R$ ${T.pagar} (Devido 30 + Aceito 30); NC R$ ${T.nc.valor}; pendente R$ ${T.pend.valor}; total R$ ${T.total}`);
// Candidato «Só no laudo» registrado como NC na aba Não conformidades.
await p.click('#cfAba-nc'); await p.waitForTimeout(100);
await p.click('[data-revisar-nc]'); await p.waitForSelector('#rvTab table');
await p.locator('#rvTab tr', { hasText: 'FABIO NUNES LEAL' }).locator('input[data-cand]').check();
await p.click('#rvReg'); await p.waitForSelector('#dlg[open]');
// v3.0.0-alpha.42 (decisão de 25/11/2026): sem o Power BI, o «Só no laudo» sugere «prestador incorreto» (em geral lançado para outro médico).
ok(await p.inputValue('#dlgCorpo select[name=natureza]') === 'prestador-incorreto', 'natureza sugerida para o «Só no laudo» sem Power BI: prestador incorreto');
await p.fill('#dlgCorpo input[name=responsavel]', 'FATURISTA DA UNIDADE'); await okDlg();
const ncs = await p.evaluate(() => window.__RM.S.nc.itens.map(x => `${x.paciente}:${x.natureza}:${x.competencia}`).sort());
ok(ncs.length === 2 && ncs.includes('FABIO NUNES LEAL:prestador-incorreto:2026-11') && ncs.includes('DORA NUNES PIRES:lancado-incorreto:2026-11'), `2 NCs registradas na competência 11/2026 (${ncs.join(' · ')})`);
const ncX = await baixar('#ncExp', 'ncs.xlsx'); await p.waitForTimeout(300); if (await p.isVisible('#dlg[open]')) await okDlg('');   // «Marcar como Enviada?» → não
const ncAbas = abas(ncX);
ok(Object.values(ncAbas).flat().flat().some(c => String(c).includes('FABIO NUNES LEAL')) && Object.values(ncAbas).flat().flat().some(c => String(c).includes('DORA NUNES PIRES')), `Excel das NCs com as duas linhas (abas: ${Object.keys(ncAbas).join(', ')})`);

// Confirmação sem campos: o foco começa no botão principal e o Enter confirma; Esc cancela.
const conf1 = p.evaluate(() => window.__RM.t.confirmar('Teste', 'Confirma?', 'Confirmar')); await p.waitForSelector('#dlg[open]');
ok(await p.evaluate(() => document.activeElement?.value) === 'ok', 'confirmação abre com o foco no botão principal (não no «Cancelar»)');
await p.keyboard.press('Enter'); ok(await conf1 === true, 'Enter confirma');
const conf2 = p.evaluate(() => window.__RM.t.confirmar('Teste', 'Confirma?', 'Confirmar')); await p.waitForSelector('#dlg[open]');
await p.keyboard.press('Escape'); ok(await conf2 === false, 'Esc cancela');
// ---------- 3. Aceite do relatório e Excel da conferência ----------
await p.goto(html + '#conferencia'); await p.waitForSelector('#cfAbas');
await p.click('#cfAba-aceite'); await p.waitForTimeout(100);
await p.fill('#cfAceiteObs', 'ELIS: título sem equivalência, fica pendente'); await p.click('#cfAceitar'); await p.waitForTimeout(300); if (await p.isVisible('#dlg[open]')) await okDlg();
ok(await p.evaluate(() => { const { S } = window.__RM; return !!S.rodadas.find(r => r.id === S.conf.ctx.rodadaId)?.aceite; }), 'aceite do relatório registrado com observação');
await p.waitForTimeout(200);
ok(/Versão final e envio/.test(await p.textContent('#cfRoteiro .rot-passo.atual')) && (await p.$$('#cfRoteiro .rot-passo.feito')).length === 5, `SOL-F51: depois do aceite, roteiro no passo 6 (${(await p.textContent('#cfRoteiro .rot-passo.atual')).trim()})`);
await p.screenshot({ path: out + 'roteiro.png', fullPage: true });
const cfX = await baixar('#cfExcel', 'conferencia.xlsx'), cfAbas = abas(cfX);
const resumo = (cfAbas['Resumo'] || []).find(r => String(r[0]).startsWith('VALOR PARA PAGAMENTO'));
ok(resumo && +resumo[2] === 60, `Excel da conferência: Resumo com o valor para pagamento R$ ${resumo?.[2]}`);

// ---------- 4. Correção de prestador ----------
await p.goto(html + '#correcao'); await p.waitForSelector('#coRodar');

await p.selectOption('#coUn', '17'); await p.click('#coRodar'); await p.waitForSelector('#coTab table', { timeout: 15000 });
const corr = await p.evaluate(() => { const r = window.__RM.S.corr.res; return r.linhas.map(o => `${o.estado}:${o.medico}`).join(' '); });
ok(corr === 'identificado:DR X', `correção de prestador: a linha do DR Z é identificada como do DR X (${corr})`);
const coX = await baixar('#coExcel', 'correcao.xlsx'), coAbas = abas(coX);
ok(Object.keys(coAbas).some(n => /Corrigir no MV/i.test(n)), `Excel da correção com a aba «Corrigir no MV» (${Object.keys(coAbas).join(', ')})`);

// ---------- 5. Fechamento ----------
await p.goto(html + '#fechamento'); await p.waitForSelector('#fhCorpo', { timeout: 15000 }); await p.waitForTimeout(300);
const f = await p.evaluate(() => { const x = window.__RM.t.fechamentoAtual().prestadores.find(y => y.cod === '15'); return { v: x?.unidades?.['17'], cl: x?.classes }; });
ok(f.v === 60 && f.cl?.pend === 50 && f.cl?.nc === 40, `Fechamento do DR X na unidade 17: R$ ${f.v} (pendente R$ ${f.cl?.pend} e NC R$ ${f.cl?.nc} fora)`);
ok(/60,00/.test(await p.textContent('#fhCorpo')), 'a tela do Fechamento mostra o valor para pagamento');
const fhX = await baixar('#fhExp', 'fechamento.xlsx').catch(() => '');
ok(fhX && Object.keys(abas(fhX)).length > 0, 'planilha de controle do fechamento exportada e reaberta');
// v3.0.0-alpha.20: Etapas do mês dentro do Fechamento e envio; envio marcado na linha do prestador.
await p.goto(html + '#fluxo'); await p.waitForSelector('#fxCriar'); await p.click('#fxCriar'); await p.waitForSelector('.marco');
ok(/Etapas do mês/.test(await p.textContent('#subnav')) && await p.evaluate(() => document.querySelector('.nav a.ativo')?.dataset.pag) === 'fechamento', 'Etapas do mês ficam no Fechamento e envio (menu e subabas)');
await p.screenshot({ path: out + 'etapas.png', fullPage: true });
await p.click('#subnav [data-fsub="usg"]'); await p.waitForSelector('#fhCorpo [data-envio]', { timeout: 15000 });
const env = await p.getAttribute('#fhCorpo [data-envio$="|relatorio"]', 'data-envio');
await p.click(`[data-envio="${env}"]`); await p.waitForTimeout(300);
ok(await p.evaluate(e => { const [m, cod] = e.split('|'), c = window.__RM.S.fluxo.competencias[window.__RM.S.comp]; return !!c.grupos[m].documental[cod]?.relatorio; }, env), `e-mail marcado na linha do prestador grava no controle documental (${env})`);
await p.click('[data-fsit="enviado"]'); await p.waitForTimeout(200);
ok((await p.$$('#fhCorpo [data-envio$="|relatorio"].on')).length >= 1 && (await p.$$('#fhCorpo [data-envio$="|relatorio"]:not(.on)')).length === 0, 'situação vira filtro: «E-mail enviado» mostra só quem já recebeu');
await p.screenshot({ path: out + 'fechamento.png', fullPage: true });
await p.goto(html + '#inicio'); await p.waitForSelector('.ini-dia'); await p.waitForTimeout(300);
ok(await p.isVisible('#iniArquivos') && /Pede você/.test(await p.textContent('#pag-inicio')) && await p.isVisible('.ini-dia .mi'), 'Início como painel do dia: marcos, arquivos do mês e «Pede você»');
await p.screenshot({ path: out + 'inicio.png', fullPage: true });
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
