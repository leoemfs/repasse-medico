// Teste da competência no topo: vale para todas as abas, encapsula rodadas/NCs/fluxo,
// registra alterações nas bases, avisa produção de outro mês e fecha/reabre a competência.
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
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Competência')));
await p.goto(html + '#inicio');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const S = expr => p.evaluate(expr);
const ir = async pag => { await p.goto(html + '#' + pag); await p.waitForFunction(t => document.getElementById('titulo').textContent === t, { inicio: 'Início', conferencia: 'Conferência cruzada', rodadas: 'Rodadas', fluxo: 'Fluxo mensal', nc: 'Não conformidades', bases: 'Bases' }[pag]); await p.waitForTimeout(150); };
const okDlg = async () => { await p.waitForSelector('#dlg[open]'); await p.click('#dlgBotoes button[value=ok]'); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(150); };
const seletor = () => p.textContent('#compGlobal');

ok(/Competência 10\/2026\s*aberta/.test(await seletor()) && /produção 09\/2026/.test(await seletor()), `seletor no topo começa no mês atual: «${(await seletor()).replace(/\s+/g, ' ').trim()}»`);
await ir('bases');
ok(/vale para todas/.test(await seletor()), 'em Bases o seletor avisa que a aba vale para todas as competências');

// 1) Arquivos de produção 09/2026 na competência 10/2026: sem aviso.
await ir('inicio');
await p.setInputFiles('#inMV', [d('mv_usg_medico15_unidade1.pdf')]); await p.waitForFunction(() => window.__RM.S.relatorios.length === 1, null, { timeout: 60000 });
await p.setInputFiles('#inApolo', d('apolo_09-2026.xlsx')); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 60000 });
await p.waitForSelector('.painel-comp');
const arqs = await p.$$eval('.painel-comp .grid3 > div:first-child .v', e => e.map(x => x.textContent));
ok(arqs[0] === 'ok' && arqs[1] === 'ok' && !(await p.$('#pag-inicio .aviso-fixo')), `arquivos de produção 09/2026 conferem com a competência 10/2026 (${arqs.join(', ')})`);

// 2) Conferência gravada na competência do topo.
await ir('conferencia'); await p.selectOption('#cfUn', '1'); await p.click('#cfRodar'); await p.waitForSelector('#cfTab table');
ok(await S(() => window.__RM.S.rodadas.map(r => r.chaveCompetencia).join()) === '2026-10', 'rodada gravada na competência 10/2026');

// 3) Trocar para 09/2026: tudo muda junto.
await p.click('#compAnt'); await p.waitForFunction(() => /09\/2026/.test(document.getElementById('compGlobal').textContent));
ok(/última conferência desta sessão é da competência 10\/2026/.test(await p.textContent('#pag-conferencia')) && !(await p.$('#cfTab table')), 'conferência de 10/2026 não aparece em 09/2026');
ok(/espera produção 08\/2026/.test(await p.textContent('#pag-conferencia')), 'aviso: arquivos de produção 09/2026 numa competência que espera 08/2026');
await ir('rodadas');
ok(/Nenhuma rodada na competência 09\/2026/.test(await p.textContent('#rdTab')), 'Rodadas mostra só as da competência');
await p.check('#rdTodas'); await p.waitForTimeout(200);
ok((await p.$$('#rdTab tbody tr.clicavel')).length === 1, '«mostrar todas as competências» traz a rodada de 10/2026');
await ir('fluxo');
ok(/Checklist da competência 09\/2026/.test(await p.textContent('#pag-fluxo')) && !(await p.$('#fxAnt')), 'Fluxo mensal segue o seletor do topo (sem ‹ › próprio)');
await p.reload(); await p.waitForFunction(() => window.__RM);
ok(/Competência 09\/2026/.test(await seletor()), 'competência escolhida lembrada após recarregar');
await p.click('#compProx'); await p.waitForFunction(() => /10\/2026/.test(document.getElementById('compGlobal').textContent));

// 4) Alteração nas bases registrada na competência.
await ir('bases'); await p.click('#fatAdd'); await p.waitForSelector('#dlg[open]'); await p.fill('#dlgCorpo input[name=nome]', 'TESTE.FATURISTA'); await okDlg();
await ir('inicio');
ok(/Faturistas[\s\S]*TESTE\.FATURISTA/.test(await p.textContent('.painel-comp .grid3 > div:last-child')), 'painel: faturista cadastrado aparece em «Bases alteradas nesta competência»');
ok(await S(() => window.__RM.S.compReg.itens['2026-10'].alteracoes.some(a => a.tipo === 'faturistas' && a.por === 'Teste Competência')), 'alteração guarda tipo e quem fez');

// 5) Iniciar o fluxo e fechar a competência (os arquivos ficam só na sessão: recarregar o MV e o Apolo).
await p.setInputFiles('#inMV', [d('mv_usg_medico15_unidade1.pdf')]); await p.waitForFunction(() => window.__RM.S.relatorios.length === 1, null, { timeout: 60000 });
await p.setInputFiles('#inApolo', d('apolo_09-2026.xlsx')); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 60000 });
await ir('fluxo'); await p.click('#fxCriar'); await p.waitForSelector('.marco');
await ir('inicio'); await p.click('#compFechar'); await okDlg();
ok(/fechada/.test(await seletor()) && await S(() => window.__RM.S.compReg.itens['2026-10'].status) === 'fechada', 'competência 10/2026 fechada');
await ir('conferencia');
ok(await p.isVisible('#compAviso') && /somente leitura/.test(await p.textContent('#compAviso')), 'faixa «fechada: somente leitura» nas abas da competência');
await p.selectOption('#cfUn', '1'); await p.click('#cfRodar'); await p.waitForTimeout(400);
ok(await S(() => window.__RM.S.rodadas.length) === 1 && /fechada/.test(await p.textContent('#aviso')), 'conferência bloqueada na competência fechada');
await ir('nc');
ok(await p.isDisabled('#ncNova') && await p.isDisabled('#ncImp') && await p.isEnabled('#ncExp'), 'NCs: registrar e importar bloqueados; exportar continua');
await ir('fluxo'); await p.click('[data-tg="usg"]'); await p.waitForSelector('[data-g="usg"] select[data-c="status"]');
ok(await p.isDisabled('[data-g="usg"] select[data-c="status"]') && await p.isEnabled('[data-tg="usg"]'), 'Fluxo: dá para abrir os grupos, mas não alterar');
await ir('bases');
ok(await p.isEnabled('#fatAdd') && !(await p.isVisible('#compAviso')), 'Bases continuam editáveis (valem para todas)');
await ir('inicio'); await p.screenshot({ path: out + 'competencia_inicio.png', fullPage: true });

// 6) Pacote da competência.
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#compPacote')]);
const arq = out + 'pacote_competencia.zip'; await dl.saveAs(arq);
const nomes = execFileSync('python3', ['-I', '-c', 'import zipfile,sys; print(" ".join(sorted(zipfile.ZipFile(sys.argv[1]).namelist())))', arq]).toString().trim();
ok(/Fluxo_mensal_10-2026\.xlsx/.test(nomes) && /rodadas_10-2026\.json/.test(nomes) && /resumo_competencia\.json/.test(nomes), `pacote: ${nomes}`);

// 7) Reabrir exige justificativa.
await p.click('#compReabrir'); await okDlg();
ok(await S(() => window.__RM.S.compReg.itens['2026-10'].status) === 'fechada', 'reabrir sem justificativa não reabre');
await p.click('#compReabrir'); await p.waitForSelector('#dlg[open]'); await p.fill('#dlgCorpo input[name=just]', 'NF chegou depois'); await okDlg();
const h = await S(() => window.__RM.S.compReg.itens['2026-10']);
ok(h.status === 'aberta' && h.historico.map(x => x.acao).join() === 'fechada,reaberta' && h.historico[1].obs === 'NF chegou depois', 'reaberta com justificativa no histórico');

// 8) Celular.
const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
m.on('pageerror', e => erros.push(e.message));
await m.goto(html + '#inicio'); await m.waitForSelector('#compGlobal button');
ok(await m.evaluate(() => document.documentElement.scrollWidth) <= 390, 'celular: seletor no topo sem rolagem horizontal');
await m.screenshot({ path: out + 'competencia_celular.png' });
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
