// Teste SOL-F17 (candidatos a NC guardados), SOL-F14 (lista documental de Bases),
// SOL-F13 (classificação lida do Fechamento) e SOL-F16 (status sugerido no Fluxo).
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
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Fluxo')));
await p.goto(html + '#inicio');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const S = (fn, arg) => p.evaluate(fn, arg);
const pronto = () => p.waitForFunction(() => window.__RM && document.getElementById('stInit').textContent.includes('Pronto') && !!window.__RM.S.nc, null, { polling: 200, timeout: 30000 });
const abrirG = async g => { await p.waitForSelector(`[data-tg="${g}"]`); if (!await p.isVisible(`[data-g="${g}"] tr[data-t]`)) await p.click(`[data-tg="${g}"]`); await p.waitForTimeout(200); };
const okDlg = async () => { await p.waitForSelector('#dlg[open]'); await p.click('#dlgBotoes button[value=ok]'); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(250); };

// ---- F17: candidatos guardados ----
await p.setInputFiles('#inMV', [d('mv_usg_medico15_unidade1.pdf')]); await p.waitForFunction(() => window.__RM.S.relatorios.length === 1, null, { timeout: 60000 });
await p.setInputFiles('#inApolo', d('apolo_09-2026.xlsx')); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 60000 });
await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar'); await p.selectOption('#cfUn', '1'); await p.selectOption('#cfMed', '*'); await p.click('#cfRodar'); await p.waitForSelector('#cfTab table');
const nCand = await S(() => window.__RM.S.ncCand.reduce((s, f) => s + f.itens.length, 0));
await p.reload(); await pronto();
const depois = await S(() => ({ n: window.__RM.S.ncCand.reduce((s, f) => s + f.itens.length, 0), em: !!window.__RM.S.nc.candidatos[0]?.em }));
ok(nCand > 0 && depois.n === nCand && depois.em, `candidatos a NC continuam depois de recarregar a página (${depois.n})`);
// Depois de recarregar (sem os arquivos na sessão), a revisão continua pela aba Não conformidades.
await p.goto(html + '#nc'); await p.waitForSelector('[data-rev-tipo]'); await p.click('[data-rev-tipo]'); await p.waitForSelector('#rvDisp');
await p.locator('[data-cand]').first().check(); await p.click('#rvDisp'); await p.waitForTimeout(300);
const disp = await S(() => (window.__RM.S.nc.dispensados || []).length);
await p.reload(); await pronto();
ok(disp === 1 && await S(() => window.__RM.S.ncDispensados.size) === 1, 'candidato dispensado continua dispensado depois de recarregar');

// ---- F14: lista documental de Bases ----
await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub]'); await p.click('[data-bsub="prestadores"]');
await p.setInputFiles('#prCtrlArq', d('repasse_10-2026_controle.xlsx')); await okDlg();
const esperado = await S(() => { const c = window.__RM.S.cfg.prestadores; return { usg: c.filter(p => p.regras?.faixaUSG && !p.regras?.v3).length, img: c.filter(p => p.regras?.participaIMG && !p.regras?.v3).length, cur: c.filter(p => p.regras?.v3).length }; });
await p.goto(html + '#fluxo'); await p.waitForSelector('#fxCriar'); await p.click('#fxCriar'); await p.waitForSelector('.marco');
const doc = await S(() => { const g = window.__RM.S.fluxo.competencias['2026-10'].grupos; return { usg: Object.keys(g.usg.documental).length, img: Object.keys(g.img.documental).length, cur: Object.keys(g.curitiba.documental).length }; });
ok(doc.usg === esperado.usg && doc.img === esperado.img && doc.cur === esperado.cur, `Fluxo do mês com os prestadores de Bases: USG ${doc.usg}, IMG ${doc.img}, Curitiba ${doc.cur}`);
await abrirG('usg');
await p.click('[data-g="usg"] [data-docrm="15"]'); await okDlg();
await p.goto(html + '#inicio'); await p.goto(html + '#fluxo'); await p.waitForSelector('.marco');
ok(await S(() => !window.__RM.S.fluxo.competencias['2026-10'].grupos.usg.documental['15']), 'removido do mês não volta sozinho');

// ---- F16 + F13: rodada aceita de USG e de IMG; sugestões e classificação ----
await S(async () => {
  const { S: E, t } = window.__RM, em = new Date().toISOString();
  const rod = (id, un, desc, vl) => ({ id, tipo: 'conferencia', em, operador: 'Teste', unidadeCod: un, prestadorCod: '7', prestadorNome: 'MARCELO GARCIA MARINI', repasse: desc, descricao: desc, chaveCompetencia: E.comp, competencia: '', contagens: {},
    linhas: [{ chave: 'k' + id, estado: 'conferido', codigo: '1', vlRepasse: vl, vlTotal: vl * 2.2, quant: 10, grupo: desc.includes('USG') ? 'ULTRASSONOGRAFIA - OUTROS' : 'RADIOLOGIA', desc: 'X', convenio: 'X', tipoItem: 'procedimento', kd: 'M|' + id, kl: '', decisao: '' }], aceite: { por: 'Teste', em } });
  await t.dbGravar(rod('r1', '1', 'REPASSE USG', 30000)); await t.dbGravar(rod('r2', '1', 'REPASSE IMG', 3000));
});
await p.goto(html + '#inicio'); await p.goto(html + '#fluxo'); await p.waitForSelector('.marco');
await abrirG('usg');
const sugUSG = await p.textContent('[data-g="usg"] tr[data-t="conf"]');
ok(/Sugestão: .*Em andamento.*1 de \d+ prestador\(es\) com aceite|Sugestão: .*Concluída/.test(sugUSG), `etapa «Conferência» com status sugerido (${sugUSG.match(/Sugestão:[^C]*/)?.[0]?.trim()})`);
await p.click('[data-g="usg"] tr[data-t="gerar"] [data-sug]'); await p.waitForTimeout(300);
const st = await S(() => { const t = window.__RM.S.fluxo.competencias['2026-10'].grupos.usg.tarefas.gerar; return [t.status, t.historico.at(-1).campo]; });
ok(['ok', 'and'].includes(st[0]) && st[1] === 'sugestão confirmada', 'confirmar a sugestão muda o status e fica no histórico');
await p.screenshot({ path: out + 'fluxo_sugestao.png' });
await abrirG('classif');
const cl = await p.textContent('[data-g="classif"]');
ok(/calculada no Fechamento/.test(cl) && /7 · MARCELO GARCIA MARINI|7 · Marcelo Garcia Marini/i.test(cl), 'classificação lida do Fechamento (produção e classe calculadas)');
await p.click('[data-g="classif"] [data-clconf="*"]'); await p.waitForTimeout(300);
const conf = await S(() => Object.values(window.__RM.S.fluxo.competencias['2026-10'].grupos.classif.classificacao).filter(e => e.conferidoEm).length);
ok(conf > 0, `«Conferir todos» registra a conferência humana (${conf})`);
const sugCl = await p.textContent('[data-g="classif"] tr[data-t="conferir"]');
ok(/Sugestão: .*Concluída/.test(sugCl), 'etapa «Conferir valores» sugere «Concluída» com tudo conferido');
// Ajuste manual exige justificativa e aparece como aviso.
await p.selectOption('[data-g="classif"] tr[data-clp="7"] [data-clman]', 'D'); await p.waitForSelector('#dlg[open]');
await p.fill('#dlgCorpo [name="just"]', 'acordo da diretoria'); await okDlg();
ok(/difere do calculado/.test(await p.textContent('[data-g="classif"] tr[data-clp="7"]')), 'ajuste manual diferente do calculado aparece como aviso');
await p.locator('[data-g="classif"]').screenshot({ path: out + 'fluxo_classificacao.png' });
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
