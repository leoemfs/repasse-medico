// Teste SOL-F22: arquivos da sessão — PDF do genérico vai para a Correção, limpar arquivos,
// aviso ao carregar arquivo de outra produção e oferta de limpeza ao trocar de competência.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, d = f => raiz + 'dados/' + f;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Arquivos')));
await p.goto(html + '#inicio');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const S = expr => p.evaluate(expr);
const botao = async v => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${v}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };
const opcoesDe = async (pag, sel) => { await p.goto(html + '#' + pag); await p.waitForSelector(sel); return p.$$eval(sel + ' option', o => o.map(x => x.textContent)); };

// 1) Finalidade automática: o PDF do genérico (código 2) vai para a Correção.
await p.setInputFiles('#inMV', [d('mv_usg_medico15_unidade1.pdf'), d('mv_correcao_unidade2.pdf')]); await p.waitForFunction(() => window.__RM.S.relatorios.length === 2, null, { timeout: 60000 });
await p.setInputFiles('#inApolo', d('apolo_09-2026.xlsx')); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 60000 });
ok(await S(() => window.__RM.S.relatorios.map(x => `${x.rel.cab.prestadorCod}:${x.finalidade}`).join()) === '15:conferencia,2:correcao', 'finalidade automática: 15 → conferência, 2 (genérico) → correção');
const cf = await opcoesDe('conferencia', '#cfRel'), co = await opcoesDe('correcao', '#coRel');
ok(cf.length === 1 && /^15 -/.test(cf[0]) && co.length === 1 && /^2 - GILBERTO/.test(co[0]), `cada análise lista só os seus PDFs (conferência: ${cf.length}, correção: ${co.length})`);
// Troca manual da finalidade.
await p.goto(html + '#inicio'); await p.waitForSelector('[data-fin]');
await p.selectOption('[data-fin] >> nth=0', 'correcao');
ok((await opcoesDe('correcao', '#coRel')).length === 2 && /Nenhum relatório para a conferência/.test(await (async () => { await p.goto(html + '#conferencia'); await p.waitForTimeout(200); return p.textContent('#pag-conferencia'); })()), 'finalidade trocada à mão: os dois na correção, conferência avisa que não há relatório');
await p.goto(html + '#inicio'); await p.waitForSelector('[data-fin]'); await p.selectOption('[data-fin] >> nth=0', 'conferencia');

// 2) Limpar só os PDFs.
await p.click('#btLimpar'); await p.waitForSelector('#dlg[open]'); await p.check('#dlgCorpo input[value="pdfs"]'); await botao('ok');
ok(await S(() => window.__RM.S.relatorios.length === 0 && !!window.__RM.S.apolo), 'limpar só os PDFs mantém o Apolo');

// 3) Carregar arquivo de outra produção: pergunta antes de incluir.
await S(() => { localStorage.setItem('rm2.competencia', JSON.stringify('2026-11')); });
await p.reload(); await p.waitForFunction(() => window.__RM && /11\/2026/.test(document.getElementById('compGlobal').textContent));
await p.setInputFiles('#inMV', [d('mv_usg_medico15_unidade1.pdf')]); await p.waitForSelector('#dlg[open]');
ok(/produção <b>09\/2026<\/b>|produção 09\/2026/.test(await p.innerHTML('#dlgCorpo')) && /espera produção 10\/2026/.test(await p.textContent('#dlgCorpo')), 'PDF de produção 09/2026 na competência 11/2026: a ferramenta pergunta');
await botao('');
ok(await S(() => window.__RM.S.relatorios.length) === 0, 'recusado: o PDF não entra');
await p.setInputFiles('#inMV', [d('mv_usg_medico15_unidade1.pdf')]); await botao('ok');
await p.waitForFunction(() => window.__RM.S.relatorios.length === 1, null, { timeout: 60000 });
ok(true, 'aceito: o PDF entra mesmo de outra produção');

// 4) Troca de competência com arquivos de outra produção: oferece limpar.
await p.click('#compAnt'); await p.waitForTimeout(400);
ok(!(await p.$('#dlg[open]')), 'em 10/2026 o PDF de produção 09/2026 é o esperado: não pergunta');
await p.click('#compProx'); await p.waitForSelector('#dlg[open]');
ok(/Limpar todos os arquivos da sessão/.test(await p.textContent('#dlgCorpo')), 'em 11/2026 com arquivos de produção 09/2026: oferece limpar');
await botao('ok');
ok(await S(() => window.__RM.S.relatorios.length === 0 && !window.__RM.S.apolo), 'arquivos limpos para a nova competência');

// 5) Parâmetro do prestador genérico em Configurações.
await p.goto(html + '#configuracoes'); await p.waitForSelector('#pGen');
ok(await p.inputValue('#pGen') === '2', 'prestador genérico configurável (padrão 2)');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
