// Teste da aba Fluxo mensal: criar competência, marcos, status, prazos, documental, rodada vinculada, notas, modelo e persistência.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
await p.clock.install({ time: new Date('2026-10-29T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Fluxo')));
await p.goto(html + '#fluxo'); await p.waitForFunction(() => window.__RM && document.querySelector('#fxCriar'));
ok(await p.textContent('#titulo') === 'Fluxo mensal', 'título «Fluxo mensal»');
await p.click('#fxCriar'); await p.waitForSelector('.marco');
const marcos = await p.$$eval('.marco b', els => els.map(e => e.textContent));
ok(marcos.includes('07/10') && marcos.includes('09/10') && marcos.some(t => t.startsWith('29/10 · HOJE')) && marcos.includes('30/10'), `marcos calculados: ${marcos.join(' ')}`);
const nGrupos = await p.$$eval('section.grupo-fx', e => e.length);
ok(nGrupos === 7 && !!(await p.$('#fxEntrega h2')), `7 grupos de etapas + painel de entrega e NFs (${nGrupos})`);
const venc = await p.evaluate(() => document.querySelector('.kpi').textContent);
ok(/Prazos vencidos/.test(venc), 'indicadores operacionais exibidos');
// Abrir USG, mudar status, conferir que a etapa seguinte não muda sozinha
await p.click('[data-tg="usg"]');
await p.selectOption('[data-g="usg"] tr[data-t="gerar"] select[data-c="status"]', 'ok');
await p.waitForSelector('[data-g="usg"] tr[data-t="gerar"] select.sel-ok');
const st = await p.evaluate(() => { const c = window.__RM.S.fluxo.competencias['2026-10'].grupos.usg.tarefas; return [c.gerar.status, c.gerar.conclusao, c.conf.status]; });
ok(st[0] === 'ok' && st[1] === '2026-10-29' && st[2] === 'ni', `concluir «Gerar» não conclui «Conferência» (${st})`);
// Prazo manual exige justificativa
await p.click('[data-g="usg"] tr[data-t="conf"] [data-prazo]'); await p.waitForSelector('#dlg[open]');
await p.fill('#dlgCorpo input[name=data]', '2026-10-08'); await p.click('#dlgBotoes button[value=ok]');
await p.waitForFunction(() => window.__RM.S.fluxo.competencias['2026-10'].grupos.usg.tarefas.conf.prazoManual, null, { timeout: 3000 }).catch(() => {});
ok(await p.evaluate(() => window.__RM.S.fluxo.competencias['2026-10'].grupos.usg.tarefas.conf.prazoManual) === '2026-10-08', 'prazo definido em etapa sem prazo no modelo');
// Documental
await p.click('[data-g="usg"] [data-docadd="usg"]'); await p.fill('#dlgCorpo input[name=cod]', '15'); await p.fill('#dlgCorpo input[name=nome]', 'MARCELO MIYAZAKI YOSHIDA'); await p.click('#dlgBotoes button[value=ok]');
await p.waitForSelector('[data-g="usg"] tr[data-doc="15"]');
await p.fill('[data-g="usg"] tr[data-doc="15"] input[data-d="relatorio"]', '2026-10-09'); await p.dispatchEvent('[data-g="usg"] tr[data-doc="15"] input[data-d="relatorio"]', 'change');
await p.fill('[data-g="usg"] tr[data-doc="15"] input[data-d="nfRecebida"]', '2026-10-13'); await p.dispatchEvent('[data-g="usg"] tr[data-doc="15"] input[data-d="nfRecebida"]', 'change');
const doc = await p.evaluate(() => { const c = window.__RM.S.fluxo.competencias['2026-10']; const d = c.grupos.usg.documental['15']; return [d.relatorio, d.nfRecebida, d.nfFinanceiro]; });
ok(doc[0] === '2026-10-09' && doc[1] === '2026-10-13' && doc[2] === '', 'NF recebida não vira «encaminhada ao Financeiro» sozinha');
ok(/a encaminhar/.test(await p.textContent('#fxEntrega')), 'consolidado mostra «a encaminhar»');
// Rodada vinculada (só sugestão)
await p.evaluate(() => window.__RM.S.rodadas.push({ id: 'rodvelha', tipo: 'conferencia', em: '2026-10-05T12:00:00.000Z', prestadorCod: '15', prestadorNome: 'MARCELO', unidadeCod: '1', contagens: { pendente: 67 } }));
await p.evaluate(() => window.__RM.S.rodadas.push({ id: 'rodteste', tipo: 'conferencia', em: '2026-10-08T12:00:00.000Z', prestadorCod: '15', prestadorNome: 'MARCELO', unidadeCod: '1', contagens: { conferido: 60, pendente: 7 } }));
await p.click('[data-tg="usg"]'); await p.click('[data-tg="usg"]');
await p.waitForSelector('[data-g="usg"] tr[data-t="conf"] [data-rod]');
await p.click('[data-g="usg"] tr[data-t="conf"] [data-rod]'); await p.waitForSelector('#dlg[open] input[value=rodteste]');
await p.check('#dlgCorpo input[value=rodteste]'); await p.click('#dlgBotoes button[value=ok]');
await p.waitForFunction(() => window.__RM.S.fluxo.competencias['2026-10'].grupos.usg.tarefas.conf.rodada, null, { timeout: 3000 }).catch(() => {});
const rod = await p.evaluate(() => { const t = window.__RM.S.fluxo.competencias['2026-10'].grupos.usg.tarefas.conf; return [t.rodada, t.status]; });
ok(rod[0] === 'rodteste' && rod[1] === 'ni', `rodada escolhida (entre 2) vinculada sem concluir a etapa (${rod})`);
// Ajuste de marco com justificativa recalcula dependentes
await p.click('[data-marco="pagIMG"]'); await p.fill('#dlgCorpo input[name=data]', '2026-10-29'); await p.fill('#dlgCorpo input[name=just]', 'pagamento antecipado'); await p.click('#dlgBotoes button[value=ok]');
const envio = await p.$eval('[data-marco="envioIMG"] b', e => e.textContent);
ok(envio.startsWith('23/10'), `envio IMG recalculado após ajuste do pagamento (${envio})`);
// Anotação e observação de seção
await p.fill('#fxNotaTxt', 'Jhonas avisou atraso da planilha de novembro.'); await p.click('#fxNotaAdd');
ok(await p.evaluate(() => window.__RM.S.fluxo.competencias['2026-10'].anotacoes.length) === 1, 'anotação registrada');
await p.fill('[data-obs="usg"]', 'Aguardando 2 NFs.'); await p.dispatchEvent('[data-obs="usg"]', 'change');
// Filtro de vencidas abre grupos com etapas vencidas
await p.click('[data-f="vencidas"]');
const gv = await p.$$eval('section.grupo-fx', e => e.map(x => x.dataset.g));
ok(gv.length > 0 && gv.includes('prep'), `filtro «Vencidas» (${gv.join(', ')})`);
await p.click('[data-f="todos"]');
await p.screenshot({ path: out + 'fluxo_acompanhamento.png', fullPage: true });
// Exportação
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#fxExp')]); await dl.saveAs(out + 'fluxo.xlsx');
ok(fs.statSync(out + 'fluxo.xlsx').size > 3000, 'exportação .xlsx gerada');
// Modelo: muda regra, salva, aplica
await p.click('[data-sub="modelo"]'); await p.waitForSelector('#mdMarcos');
await p.screenshot({ path: out + 'fluxo_modelo.png', fullPage: false });
await p.fill('#mdMarcos tr[data-m="pagUSG"] input[data-r="dia"]', '16'); await p.click('#mdSalvar');
const prev = await p.$eval('#mdMarcos tr[data-m="pagUSG"] td:last-child', e => e.textContent);
ok(prev === '16/10/2026', `modelo: pagamento USG dia 16 → ${prev}`);
const compPag = await p.evaluate(() => window.__RM.S.fluxo.competencias['2026-10'].modelo.marcos.find(m => m.id === 'pagUSG').regra.dia);
ok(compPag === 15, 'competência já iniciada mantém o modelo antigo (histórico preservado)');
// Persistência e nav
await p.reload(); await p.waitForFunction(() => window.__RM && window.__RM.S.fluxo && window.__RM.S.fluxo.competencias['2026-10'], null, { polling: 200, timeout: 30000 });
const persist = await p.evaluate(() => { const c = window.__RM.S.fluxo.competencias['2026-10']; return [c.grupos.usg.tarefas.gerar.status, c.anotacoes.length, c.grupos.usg.obs, window.__RM.S.fluxo.modelo.marcos.find(m => m.id === 'pagUSG').regra.dia]; });
ok(JSON.stringify(persist) === JSON.stringify(['ok', 1, 'Aguardando 2 NFs.', 16]), `persistência após recarregar (${persist})`);
const dica = await p.$eval('a[data-pag="fluxo"]', a => a.getAttribute('aria-label'));
ok(/^Fluxo mensal/.test(dica), `menu: «${dica}»`);
// Celular
const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
await m.clock.install({ time: new Date('2026-10-29T10:00:00') });
m.on('pageerror', e => erros.push(e.message));
await m.goto(html + '#fluxo'); await m.waitForSelector('#fxCriar'); await m.click('#fxCriar'); await m.waitForSelector('.marco'); await m.click('[data-tg="usg"]');
await m.screenshot({ path: out + 'fluxo_celular.png', fullPage: false });
ok(await m.evaluate(() => document.documentElement.scrollWidth) <= 390, 'celular sem rolagem horizontal da página');
ok(await m.$eval('.barra-cel a[data-pag="fluxo"] span', e => e.textContent) === 'Fluxo', 'barra do celular: «Fluxo»');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
