// SOL-F43 (v3.0.0-alpha.6) — Prévia de conferência como conferência oficial: classes (Devido, Aceito, Pendente, NC,
// Excluído), totais, abas, filtros, decisões em lote, observação, «Resolvido no MV», reconferência com alertas e
// Fechamento só com Devido + Aceito (rodadas antigas com o total do MV). Dados fictícios.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.clock.install({ time: new Date('2026-11-16T10:00:00') });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Oficial')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const okDlg = async (botao = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${botao}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };
// Relatório: 2 conferidos, 1 ressalva (convênio), 1 só no faturamento (vai virar NC), 1 sem equivalência (resolvido no MV),
// 1 taxa, 1 HM sem regra. Laudos: os pares e um laudo do paciente da ressalva com convênio escrito diferente.
const montar = (sem = []) => p.evaluate(sem => {
  const { S } = window.__RM, d = n => new Date(Date.UTC(2026, 9, n)), dia = n => Math.round(d(n) / 864e5);
  const L = (i, pac, titulo, n, conv = 'UNIMED') => ({ i, linhaPlanilha: i + 2, idLaudo: String(500 + i), unidade: 'AlphaSonic Palhano', paciente: pac, pn: pac, idPac: String(i), titulo, tn: titulo, descricao: '', data: d(n), dia: dia(n), convenio: conv, modalidade: 'US', medico: 'DR X', mn: 'DR X' });
  S.apolo = { nome: 'apolo.xlsx', hash: 'h', laudos: [L(0, 'ANA PAULA ROCHA', 'USG TIREOIDE', 3), L(1, 'BRUNA LIMA COSTA', 'USG TIREOIDE', 4), L(2, 'CARLA DIAS MOTA', 'USG TIREOIDE', 5, 'HOSPITAL X'), L(3, 'ELIS SOUZA REIS', 'USG ESTRANHO', 7)] };
  S.eq.itens.push({ id: 'eqT', codigo: '40901173', titulo: 'USG TIREOIDE', status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'T' });
  const R = (seq, pac, n, codigo, desc, vl, grupo = 'ULTRASSONOGRAFIA', conv = 'UNIMED') => ({ seq, pagina: 1, codigo, procDesc: desc, grupoNome: grupo, conta: String(9000 + seq), atendimento: String(7000 + seq), paciente: pac, convenio: conv, data: d(n), vlRepasse: vl, vlTotal: vl * 2, pct: .5, quant: 1, prestadorCod: '15', prestadorNome: 'DR X', repasse: '25022' });
  const regs = [R(1, 'ANA PAULA ROCHA', 3, '40901173', 'US TIREOIDE', 10), R(2, 'BRUNA LIMA COSTA', 4, '40901173', 'US TIREOIDE', 20), R(3, 'CARLA DIAS MOTA', 5, '40901173', 'US TIREOIDE', 30, 'ULTRASSONOGRAFIA', 'UNIMED'),
    R(4, 'DORA NUNES PIRES', 6, '40901173', 'US TIREOIDE', 40), R(5, 'ELIS SOUZA REIS', 7, '40901173', 'US TIREOIDE', 50), R(6, 'ANA PAULA ROCHA', 3, '60000001', 'TAXA DE SALA', 5, 'TAXAS DIVERSAS'), R(7, 'ANA PAULA ROCHA', 3, '40901173', 'US TIREOIDE - HM', 7, 'HONORARIOS MEDICOS')]
    .filter(r => !sem.includes(r.seq));
  const id = 'r' + Math.random().toString(36).slice(2, 6);
  S.relatorios = [{ id, nome: 'mv.pdf', tamanho: 1, hash: 'hash-' + sem.join('-'), unidadePasta: '17', rel: { arquivo: 'mv.pdf', cab: { prestadorCod: '15', prestadorNome: 'DR X', repasse: '25022', descricao: 'REPASSE USG', competencia: '11/2026', repasses: [] }, regs, avisos: [], conferencias: [], ok: true } }];
  window.__RM.irPara('conferencia');
}, sem);
const rodar = async () => { await p.waitForSelector('#cfRodar'); if (await p.isVisible('#cfUn')) await p.selectOption('#cfUn', '17').catch(() => {}); await p.click('#cfRodar'); await p.waitForSelector('#cfAbas', { timeout: 15000 }); await p.waitForTimeout(200); };
const classes = () => p.evaluate(() => window.__RM.S.conf.res.linhas.filter(x => x.r).map(x => `${x.r.seq}:${window.__RM.t.classeDaLinhaConf(x)}`).join(' '));
const totais = () => p.evaluate(() => { const t = window.__RM.t.totaisPorClasse(window.__RM.S.conf.res.linhas, window.__RM.t.classeDaLinhaConf); return { pagar: t.pagar, total: t.total, pend: t.pend.valor, nc: t.nc.valor, excl: t.excluido.valor, aceito: t.aceito.valor, devido: t.devido.valor }; });
await montar(); await rodar();
const c1 = await classes();
ok(c1 === '1:devido 2:devido 3:pend 4:pend 5:pend 6:excluido 7:excluido', `classes: conferido = Devido, ressalva/sem laudo/sem equivalência = Pendente, taxa e HM sem regra = Excluído (${c1})`);
let t = await totais();
ok(t.pagar === 30 && t.total === 162 && t.excl === 12, `Valor para pagamento = Devido (R$ ${t.pagar}); Excluído R$ ${t.excl}; soma das classes = total do MV (R$ ${t.total})`);
ok(await p.isVisible('[data-cfsec="previa"]') && !(await p.isVisible('[data-cfsec="aceite"]')) && /para pagamento/i.test(await p.textContent('.tot-cl.pagar')), 'abre na aba «Prévia de conferência», com o valor para pagamento em destaque');
// Abas.
for (const k of ['decidir', 'nc', 'aceite', 'detalhes', 'previa']) { await p.click(`[data-cfaba="${k}"]`); await p.waitForTimeout(100); ok(await p.isVisible(`[data-cfsec="${k}"]`), `aba «${k}» abre sem recarregar`); }
// Filtro por procedimento + data, com contagem e soma.
await p.selectOption('#cfFProc', '40901173'); await p.waitForTimeout(150); await p.selectOption('#cfFData', '2026-10-05'); await p.waitForTimeout(150);
const info = await p.textContent('#cfSelInfo');
ok(/1 linha\(s\) no filtro · R\$ 30,00/.test(info), `filtro por procedimento e data mostra contagem e soma (${info.replace(/\s+/g, ' ').slice(0, 60)})`);
// Aceitar em lote a pendente do filtro (ressalva de convênio).
await p.click('#cfLoteAceitar'); await p.waitForSelector('#dlg[open]'); await p.fill('#dlgCorpo [name="just"]', 'Mesmo convênio escrito de outro jeito'); await okDlg();
t = await totais();
ok(t.aceito === 30 && t.pagar === 60, `aceitar em lote move R$ 30 de Pendente para Aceito: para pagamento R$ ${t.pagar}`);
await p.click('#cfLimpar'); await p.waitForTimeout(150);
// NC na linha só no faturamento (seq 4): fora do fechamento.
await p.evaluate(() => { const { S } = window.__RM, x = S.conf.res.linhas.find(y => y.r?.seq === 4); S.nc.itens.push({ id: 'ncT', competencia: S.comp, categoria: 'convenio', natureza: 'nao-lancado', situacao: 'aberta', paciente: 'DORA NUNES PIRES', codigo: '40901173', criadaEm: new Date().toISOString(), criadaPor: 'Teste Oficial', historico: [], origem: { tipo: 'conferencia', rodadaId: S.conf.ctx.rodadaId, chavesLinha: [`M|${x.r.conta}|${x.r.atendimento}|${x.r.codigo}|2026-10-06`] } }); window.__RM.irPara('conferencia'); });
await p.click('#cfVerTodas').catch(() => {}); await p.waitForTimeout(200);
t = await totais();
ok(t.nc === 40 && t.pagar === 60, `NC registrada: R$ ${t.nc} fora do fechamento (para pagamento continua R$ ${t.pagar})`);
// Resolvido no MV (seq 5) + observação.
await p.evaluate(() => { window.__RM.S.conf.soFalta = false; });
await p.locator('#cfTab tr', { hasText: 'ELIS SOUZA REIS' }).first().click(); await p.waitForTimeout(150);
const i5 = await p.evaluate(() => window.__RM.S.conf.res.linhas.findIndex(x => x.r?.seq === 5));
await p.click(`[data-resolvido="${i5}"]`); await p.waitForSelector('#dlg[open]'); await p.fill('#dlgCorpo [name="just"]', 'Lançamento retirado da conta'); await okDlg();
ok((await classes()).includes('5:pend') && (await p.evaluate(i => window.__RM.S.conf.res.linhas[i].decisao?.tipo, i5)) === 'resolvido', '«Resolvido no MV» registra a decisão e a linha continua Pendente (fora do fechamento)');
await p.locator('#cfTab tr', { hasText: 'ANA PAULA ROCHA' }).first().click(); await p.waitForTimeout(150);
const i1 = await p.evaluate(() => window.__RM.S.conf.res.linhas.findIndex(x => x.r?.seq === 1));
await p.fill(`[data-obs="${i1}"]`, 'Conferido com a recepção'); await p.click(`[data-obs-salvar="${i1}"]`); await p.waitForTimeout(300);
await p.click('#cfAba-aceite'); const ace = await p.textContent('#cfAceite');
ok(/Para pagamento: R\$ 60,00/.test(ace) && /pendente R\$ 50,00/.test(ace) && /NC R\$ 40,00/.test(ace), `aceite do relatório mostra o valor por classe (${ace.replace(/\s+/g, ' ').slice(0, 150)})`);
await p.screenshot({ path: out + 'conferencia_oficial_aceite.png' });
// Fechamento: só Devido + Aceito.
const f1 = await p.evaluate(() => { const f = window.__RM.t.fechamentoAtual(), x = f.prestadores.find(y => y.cod === '15'); return { u: x?.unidades?.['17'], cl: x?.classes, av: x?.avisos }; });
ok(f1.u === 60 && f1.cl?.pend === 50 && f1.cl?.nc === 40, `Fechamento usa o valor para pagamento (R$ ${f1.u}), não o total do MV (R$ 162); pendente e NC ficam fora`);
// Reconferência: novo PDF sem a linha 5 (resolvido confirmado) e ainda com a linha 4 (NC continua no MV) e o HM.
await p.click('#cfAba-previa'); await montar([5]); await rodar();
await p.click('#cfAba-nc'); await p.waitForTimeout(150);
const nc = await p.textContent('[data-cfsec="nc"]');
ok(/continuam no relatório reimportado/.test(nc) && /Não corrigida: continua no MV/.test(nc), 'reimportado com o procedimento da NC ainda lançado: alerta «continua no MV»');
ok(/Confirmado pela reconferência/.test(nc), '«Resolvido no MV» confirmado: a linha saiu do novo PDF');
ok(/continua no MV depois da reconferência/.test(nc), 'HM sem regra que continua no MV depois da reconferência: notificado para excluir');
ok(/\d+/.test(await p.textContent('#cfAba-nc .n.alerta')), 'aba «NCs e correções no MV» com o número de alertas em vermelho');
await p.screenshot({ path: out + 'conferencia_oficial_nc.png' });
await p.click('#cfAba-previa'); await p.evaluate(() => { window.__RM.S.conf.soFalta = false; }); await p.click('#cfVerTodas'); await p.waitForTimeout(150);
ok(/✎/.test(await p.textContent('#cfTab')), 'observação continua na nova rodada (marca ✎ na linha)');
await p.screenshot({ path: out + 'conferencia_oficial_previa.png' });
// Rodada antiga (sem a regra nova): Fechamento com o total do MV e aviso para conferir de novo.
const f2 = await p.evaluate(async () => { const { S, t } = window.__RM; for (const r of S.rodadas) { delete r.regraValor; } return (t.fechamentoAtual().prestadores.find(y => y.cod === '15') || {}); });
ok(f2.unidades?.['17'] === 112 && f2.avisos.some(a => /regra antiga/.test(a)), `rodada anterior à regra nova: valor pelo total do MV (R$ ${f2.unidades?.['17']}) com aviso «confira de novo»`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
