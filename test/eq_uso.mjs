// Teste SOL-F41: uso das equivalências nas conferências — linhas confirmadas por relação e por regra composta,
// por competência; em uso × parada × nunca usada; rodada antiga sem o id da relação; só a última rodada de cada
// relatório conta; impacto antes de tirar a validação (justificativa obrigatória) e planilha do uso.
// Dados fictícios montados no próprio teste; códigos TUSS reais do MV.
import { createRequire } from 'module';
import fs from 'fs';
import { execFileSync } from 'child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
await p.clock.install({ time: new Date('2026-11-09T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Uso')));
await p.goto(html + '#inicio');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const okDlg = async (botao = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${botao}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(250); };
const MAMAS = '40901114', TV = '40901300', DOP = '40901386', TIR = '40901122', ESC = '40901203';

// 1) Base: mamas (em uso), transvaginal (só em 07/2026 → parada), tireoide (nunca usada), escroto (pendente) e
// uma regra composta validada (transvaginal com Doppler).
const ids = await p.evaluate(({ MAMAS, TV, DOP, TIR, ESC }) => {
  const { S: E, t } = window.__RM, v = (codigo, titulo, descMV) => t.novaRelacao({ codigo, titulo, descMV });
  const rel = [v(MAMAS, 'ULTRASSONOGRAFIA DAS MAMAS', 'USG MAMAS'), v(TV, 'ULTRASSONOGRAFIA TRANSVAGINAL', 'USG TRANSVAGINAL'), v(TIR, 'ULTRASSONOGRAFIA DA TIREOIDE', 'USG TIREOIDE'), v(ESC, 'ULTRASSONOGRAFIA DO ESCROTO', 'USG ORGAOS SUPERFICIAIS')];
  E.eq.itens.push(...rel);
  t.alterarStatusEq(E.eq, rel.slice(0, 3).map(e => e.id), 'validada', 'Teste Uso', 'teste', '2026-07');
  const c = t.novaComposta({ nome: 'Transvaginal + Doppler', titulos: ['ULTRASSONOGRAFIA TRANSVAGINAL COM DOPPLER'], itens: [{ rotulo: 'USG transvaginal', codigos: [TV], qtd: 1, excecoes: [] }, { rotulo: 'Doppler', codigos: [DOP], qtd: 1, excecoes: [] }] });
  E.eq.compostas.push(c); t.alterarStatusComposta(E.eq, c.id, 'validada', 'Teste Uso', 'teste', '2026-07');
  return { mamas: rel[0].id, tv: rel[1].id, tir: rel[2].id, esc: rel[3].id, cmp: c.id };
}, { MAMAS, TV, DOP, TIR, ESC });

// 2) Rodadas fictícias em 07, 09, 10 e 11/2026 (prestador 15, unidade 1).
const rodar = (comp, casos, { semEqId = false, em } = {}) => p.evaluate(async ({ comp, casos, semEqId, em }) => {
  const { S: E, t } = window.__RM, [a, m] = comp.split('-').map(Number), dt = new Date(Date.UTC(a, m - 2, 10)), dia = t.diaSerial(dt);
  const laudos = [], regs = []; let seq = 0;
  for (const [pac, titulo, cods] of casos) {
    laudos.push({ i: laudos.length, paciente: pac, pn: pac, data: dt, dia, titulo, modalidade: 'US', medico: 'MEDICO TESTE', mn: 'MEDICO TESTE', unidade: 'X', convenio: '' });
    for (const c of cods) { seq++; regs.push({ seq, chave: `${comp}-${seq}`, codigo: c, procDesc: 'P' + c, grupoNome: 'ULTRASSONOGRAFIA - OUTROS', convenio: 'PARTICULAR', paciente: pac, data: dt, vlTotal: 100, vlRepasse: 40, quant: 1, conta: '9' + seq, atendimento: '8' + seq }); }
  }
  const relatorio = { regs, cab: { prestadorCod: '15', prestadorNome: 'MEDICO TESTE', repasse: '1', competencia: '', descricao: 'USG' } };
  const res = t.conferirCruzado(relatorio, { laudos }, E.cfg, E.eq, { tol: 0, unidadeCod: '*', medicos: null });
  const r = t.registroRodada(res, { operador: 'Teste Uso', arquivos: [], unidadeCod: '1', relatorio, chaveCompetencia: comp, parametros: {}, cfgRevisao: 0 });
  if (em) r.em = em;
  if (semEqId) r.linhas.forEach(l => delete l.eqId);   // rodada de versão anterior: sem o id da relação
  await t.guardarRodada(r);
  return r.linhas.map(l => `${l.codigo}:${l.estado}:${l.eq || ''}${l.eqId ? ':id' : ''}`);
}, { comp, casos, semEqId, em });
const L07 = await rodar('2026-07', [['PACIENTE TESTE A', 'ULTRASSONOGRAFIA TRANSVAGINAL', [TV]], ['PACIENTE TESTE B', 'ULTRASSONOGRAFIA TRANSVAGINAL', [TV]]], { semEqId: true });
ok(L07.every(x => x === `${TV}:conferido:validada`), `rodada antiga (sem id da relação): transvaginal conferida 2× (${L07.join(', ')})`);
await rodar('2026-09', [['PACIENTE TESTE C', 'ULTRASSONOGRAFIA DAS MAMAS', [MAMAS]]]);
// 10/2026: uma rodada antiga do mesmo relatório (não conta) e a última (conta).
await rodar('2026-10', [['PACIENTE TESTE D', 'ULTRASSONOGRAFIA DAS MAMAS', [MAMAS]], ['PACIENTE TESTE E', 'ULTRASSONOGRAFIA DAS MAMAS', [MAMAS]], ['PACIENTE TESTE F', 'ULTRASSONOGRAFIA DAS MAMAS', [MAMAS]]], { em: '2026-10-05T10:00:00.000Z' });
const L10 = await rodar('2026-10', [['PACIENTE TESTE D', 'ULTRASSONOGRAFIA DAS MAMAS', [MAMAS]], ['PACIENTE TESTE E', 'ULTRASSONOGRAFIA DAS MAMAS', [MAMAS]]], { em: '2026-10-20T10:00:00.000Z' });
ok(L10.every(x => x === `${MAMAS}:conferido:validada:id`), `rodada nova guarda o id da relação usada (${L10.join(', ')})`);
const L11 = await rodar('2026-11', [['PACIENTE TESTE G', 'ULTRASSONOGRAFIA DAS MAMAS', [MAMAS]], ['PACIENTE TESTE H', 'ULTRASSONOGRAFIA TRANSVAGINAL COM DOPPLER', [TV, DOP]], ['PACIENTE TESTE I', 'ULTRASSONOGRAFIA DO ESCROTO', [ESC]]]);
ok(L11.includes(`${ESC}:pendente:pendente:id`), `relação pendente não confirma (${L11.join(', ')})`);

// 3) Motor: uso por relação e por regra composta.
const U = await p.evaluate(ids => {
  const { S: E, t } = window.__RM, u = t.usoEquivalencias(E.rodadas, E.eq), f = (m, id) => { const x = u[m].get(id); return x ? { linhas: x.linhas, ultima: x.ultima, comps: Object.fromEntries([...x.porComp].map(([c, v]) => [c, v.linhas])), sit: u.situacao(x), prest: [...x.prestadores.keys()], vl: x.vlRepasse } : { sit: u.situacao(x) }; };
  return { comps: u.competencias, recentes: u.recentes, mamas: f('relacoes', ids.mamas), tv: f('relacoes', ids.tv), tir: f('relacoes', ids.tir), esc: f('relacoes', ids.esc), cmp: f('compostas', ids.cmp),
    imp: t.impactoTirarValidacao(u, [ids.mamas, ids.tir], '2026-11') };
}, ids);
ok(U.comps.join() === '2026-07,2026-09,2026-10,2026-11' && U.recentes.join() === '2026-09,2026-10,2026-11', `competências com rodadas: ${U.comps.join(', ')} (recentes: ${U.recentes.join(', ')})`);
ok(U.mamas.linhas === 4 && U.mamas.comps['2026-10'] === 2 && U.mamas.ultima === '2026-11' && U.mamas.sit === 'em-uso' && U.mamas.vl === 160, `mamas: 4 linhas (09: 1, 10: 2 — só a última rodada do relatório —, 11: 1), R$ 160, em uso (${JSON.stringify(U.mamas.comps)})`);
ok(U.tv.linhas === 2 && U.tv.ultima === '2026-07' && U.tv.sit === 'parada', `transvaginal: 2 linhas em 07/2026 achadas pelo par código × título, parada (${U.tv.sit})`);
ok(U.tir.sit === 'nunca-usada' && U.esc.sit === 'nunca-usada', 'tireoide (validada, sem linhas): nunca usada');
ok(U.cmp.linhas === 2 && U.cmp.sit === 'em-uso' && U.cmp.comps['2026-11'] === 2, `regra composta: 2 linhas em 11/2026, em uso (${JSON.stringify(U.cmp.comps)})`);
ok(U.imp.comUso === 1 && U.imp.linhasTotal === 4 && U.imp.linhasComp === 1 && U.imp.relatoriosComp === 1, `impacto de tirar mamas + tireoide: 1 com uso, 4 linhas no total, 1 em 11/2026 (${JSON.stringify(U.imp)})`);

// 4) Tela: subaba «Uso nas conferências».
await p.goto(html + '#rodadas'); await p.goto(html + '#equivalencias'); await p.waitForSelector('[data-esub="uso"]');
await p.click('[data-esub="uso"]'); await p.waitForSelector('#cardUsoEq');
const cab = (await p.textContent('#cardUsoEq .grid4')).replace(/\s+/g, ' ');
ok(/1 em uso/.test(cab) && /1 paradas/.test(cab) && /1 nunca usadas/.test(cab) && /1 linhas confirmadas em 11\/2026/.test(cab), `resumo: ${cab.trim()}`);
const linhas = await p.$$eval('#usoTab tbody tr', trs => trs.map(tr => tr.textContent.replace(/\s+/g, ' ')));
ok(linhas.length === 3 && /40901114.*Em uso.*4/.test(linhas[0]) && /Parada/.test(linhas[1]) && /Nunca usada/.test(linhas[2]), `relações validadas, da mais usada para a menos (${linhas.map(l => l.slice(0, 60)).join(' | ')})`);
await p.click('#usoTab tbody tr:first-child td:nth-child(3)'); await p.waitForSelector('#usoTab tr.detalhe');
const det = (await p.textContent('#usoTab tr.detalhe')).replace(/\s+/g, ' ');
ok(/10\/2026\s*2\s*0\s*0\s*1\s*80,00/.test(det) && /15 - MEDICO TESTE/.test(det), `detalhe por competência e prestadores (${det.slice(0, 120)}…)`);
await p.selectOption('#usoSit', 'nunca-usada'); await p.waitForTimeout(150);
ok((await p.$$('#usoTab tbody tr')).length === 1 && /40901122/.test(await p.textContent('#usoTab')), 'filtro «Nunca usadas»');
await p.selectOption('#usoSit', '*'); await p.selectOption('#usoTipo', 'compostas'); await p.waitForTimeout(150);
ok(/Transvaginal \+ Doppler.*Em uso.*2/.test((await p.textContent('#usoTab tbody')).replace(/\s+/g, ' ')), 'regras compostas: «Transvaginal + Doppler» em uso, 2 linhas');
await p.selectOption('#usoJan', '1'); await p.waitForTimeout(150);
ok(/Em uso/.test(await p.textContent('#usoTab tbody')), 'janela de 1 competência: a regra usada em 11/2026 continua em uso');
await p.selectOption('#usoTipo', 'relacoes'); await p.waitForTimeout(150);
const sitJ1 = await p.$$eval('#usoTab tbody tr', trs => trs.map(tr => tr.textContent.replace(/\s+/g, ' ')));
ok(/40901114.*Em uso/.test(sitJ1[0]), 'janela de 1 competência: mamas (usada em 11/2026) em uso');
await p.selectOption('#usoJan', '3'); await p.waitForTimeout(150);
await p.screenshot({ path: out + 'eq_uso.png', fullPage: true });

// 5) Planilha do uso.
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#usoXlsx')]); const xf = out + 'uso_equivalencias.xlsx'; await dl.saveAs(xf);
const xq = JSON.parse(execFileSync('python3', ['-I', '-c', `import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1]); r=wb['Relações']; c=wb['Regras compostas']
print(json.dumps({'abas':wb.sheetnames,'cab':[x.value for x in r[1]],'rel':[list(x) for x in r.iter_rows(min_row=2,values_only=True)],'cmp':[list(x) for x in c.iter_rows(min_row=2,values_only=True)]}, default=str))`, xf]).toString());
const m = xq.rel.find(x => x[2] === MAMAS), iOut = xq.cab.indexOf('10/2026');
ok(xq.abas.join('|') === 'Leia-me|Relações|Regras compostas' && m && m[0] === 'Em uso' && m[5] === 4 && m[9] === '11/2026' && m[iOut] === 2 && xq.cmp.length === 1 && xq.cmp[0][4] === 2,
  `«Exportar uso (.xlsx)»: ${xq.rel.length} relações e ${xq.cmp.length} regra, uma coluna por competência (mamas: ${m && m[5]} linhas, 10/2026 = ${m && m[iOut]})`);

// 6) Tirar a validação com o impacto à vista e justificativa obrigatória.
await p.check(`#usoTab [data-uso="${ids.mamas}"]`); await p.waitForTimeout(150);
await p.click('#usoPend'); await p.waitForSelector('#dlg[open]');
const dtxt = (await p.textContent('#dlgCorpo')).replace(/\s+/g, ' ');
ok(/confirmaram 4 linha\(s\).*1 em 1 relatório\(s\) de 11\/2026/.test(dtxt), `o diálogo mostra o impacto (${dtxt.slice(0, 160)}…)`);
await p.click('#dlgBotoes button[value="ok"]'); await p.waitForTimeout(250);
ok(await p.evaluate(id => window.__RM.S.eq.itens.find(e => e.id === id).status === 'validada', ids.mamas) && /justificativa/.test(await p.textContent('#aviso')), 'sem justificativa, nada muda');
await p.click('#usoPend'); await p.waitForSelector('#dlg[open]'); await p.fill('#dlgCorpo [name="motivo"]', 'título passou a ser usado também para mamas com Doppler'); await okDlg();
const h = await p.evaluate(id => window.__RM.S.eq.itens.find(e => e.id === id), ids.mamas);
ok(h.status === 'pendente' && /uso: 4 linha/.test(h.historico.at(-1).motivo) && h.historico.at(-1).por === 'Teste Uso', `voltou a pendente, com o uso no histórico («${h.historico.at(-1).motivo}»)`);
const lin2 = await p.$$eval('#usoTab tbody tr', trs => trs.map(tr => tr.textContent.replace(/\s+/g, ' ')));
ok(lin2.some(l => /40901114.*Pendente hoje.*4/.test(l)), 'continua na lista (com o uso guardado) como «Pendente hoje», sem caixa de seleção');

// 7) Base de equivalências: coluna «Uso nas conferências» e impacto ao desativar pela lista.
await p.click('[data-esub="base"]'); await p.waitForSelector('#eqSt'); await p.selectOption('#eqSt', 'validada'); await p.waitForTimeout(150);
const bl = await p.$$eval('#eqTab tbody tr', trs => trs.map(tr => tr.textContent.replace(/\s+/g, ' ')));
ok(bl.some(l => /40901300.*2 linha\(s\) · últ\. 07\/2026/.test(l)) && bl.some(l => /40901122.*nunca usada/.test(l)), `coluna «Uso nas conferências» na lista (${bl.map(l => l.slice(-40)).join(' | ')})`);
await p.check(`#eqTab input[data-id="${ids.tv}"]`); await p.click('#eqDes'); await p.waitForSelector('#dlg[open]');
ok(/confirmaram 2 linha\(s\)/.test(await p.textContent('#dlgCorpo')) && /obrigatória/.test(await p.textContent('#dlgCorpo')), 'desativar pela lista também mostra o impacto e pede justificativa');
await okDlg('');

ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
