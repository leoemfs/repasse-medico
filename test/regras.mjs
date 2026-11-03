// Teste: Bases → regras de repasse (unidades, faixas de USG, prestadores, classes, convênios) e
// importação das regras a partir da planilha de controle do repasse.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', d = f => raiz + 'dados/' + f;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Regras')));
await p.goto(html + '#bases');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const S = expr => p.evaluate(expr);
const okDlg = async () => { await p.waitForSelector('#dlg[open]'); await p.click('#dlgBotoes button[value=ok]'); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };
const sub = async k => { await p.click(`[data-bsub="${k}"]`); await p.waitForTimeout(150); };

// 1) Unidades: CNPJ e % de USG padrão; sub-abas.
const un = await S(() => window.__RM.S.cfg.unidades.map(u => `${u.cod}:${u.cnpj.slice(-7)}:${u.pctUSG?.medico ?? '-'}`).join(' '));
ok(un.includes('1:0001-33:0.44') && un.includes('10:0005-67:0.44') && un.includes('17:0007-29:0.42') && un.includes('5:0001-03:-'), `unidades com CNPJ e % de USG (${un})`);
ok((await p.$$('#pag-bases .card:not([hidden])')).length === 3, 'sub-aba «Unidades e faixas»: unidades, faixas de USG e parâmetros');
await p.fill('[data-u="0"][data-c="pctMed"]', '45'); await p.dispatchEvent('[data-u="0"][data-c="pctMed"]', 'change'); await p.click('#unSalvar'); await p.waitForTimeout(150);
ok(await S(() => window.__RM.S.cfg.unidades[0].pctUSG.medico) === 0.45, '% de USG da unidade editável');
await p.fill('[data-u="0"][data-c="pctMed"]', '44'); await p.dispatchEvent('[data-u="0"][data-c="pctMed"]', 'change'); await p.click('#unSalvar'); await p.waitForTimeout(150);

// 2) Importar regras da planilha de controle.
await sub('prestadores');
await p.setInputFiles('#prCtrlArq', d('repasse_10-2026_controle.xlsx')); await okDlg();
const pr = await S(() => { const g = c => window.__RM.S.cfg.prestadores.find(p => p.cod === String(c))?.regras || {}; return { n: window.__RM.S.cfg.prestadores.length, gus: [g(5).faixaUSG, g(5).board, g(5).participaIMG].join(), lucca: g(8873).faixaUSG, bruno: [g(13447).faixaUSG, g(13447).tipo].join(), mel: g(10264).faixaUSG, marini: g(7).classeFixa, gilson: g(11467).v3 }; });
ok(pr.n === 36, `36 prestadores importados (${pr.n})`);
ok(pr.gus === 'geral,2000,true' && pr.lucca === 'mais2' && pr.bruno === 'residente,residente' && pr.mel === 'p55' && pr.marini === 'A' && pr.gilson, `faixas, BOARD, IMG, classe fixa e V3 (${JSON.stringify(pr)})`);
ok(/Repasse médicos geral · BOARD R\$ 2\.000,00 · IMG/.test(await p.textContent('#pag-bases')), 'resumo das regras na tabela de prestadores');

// 3) Exceção da Melanie: mamografia fixa R$ 18.
const iMel = await S(() => window.__RM.S.cfg.prestadores.findIndex(p => p.cod === '10264'));
await p.click(`[data-regras="${iMel}"]`); await p.waitForSelector('#dlg[open]');
await p.fill('#dlgCorpo textarea[name=excecoes]', 'MAMO=18'); await okDlg();
ok(await S(() => JSON.stringify(window.__RM.S.cfg.prestadores.find(p => p.cod === '10264').regras.excecoesIMG)) === '[{"exame":"MAMO","valor":18}]', 'exceção de valor no IMG gravada (Melanie: mamografia R$ 18)');

// 4) Classes e valores.
await sub('classes');
ok(await p.inputValue('[data-corte="0"]') === '26524.38' && await p.inputValue('[data-val="convenio|MAMO|A"]') === '20.66' && await p.inputValue('[data-val="sus|RESSO|A"]') === '40', 'tabela de 2026: cortes e valores (convênio e SUS)');
ok((await p.$$('[data-eqv][data-c="nome"]')).length === 9, '9 procedimentos equivalentes (angio, artro, dacrio, infiltração, perfusão, fusão)');

// 5) Convênios: do Power BI (Convênio/Particular) e SUS à mão.
await p.goto(html + '#inicio'); await p.setInputFiles('#inPBI', d('powerbi_completo_raw.xlsx')); await p.waitForFunction(() => !!window.__RM.S.pbi, null, { timeout: 120000 });
await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub]'); await sub('convenios');
await p.click('#cvPbi'); await p.waitForTimeout(300);
const cv = await S(() => ({ n: window.__RM.S.cfg.convenios.length, sem: window.__RM.S.cfg.convenios.filter(c => !c.tipo).length, part: window.__RM.S.cfg.convenios.filter(c => c.tipo === 'PARTICULAR').length }));
ok(cv.n === 220 && cv.sem === 0 && cv.part > 0, `220 convênios do Power BI com tipo (${JSON.stringify(cv)})`);
await p.fill('#cvBusca', 'UNIMED'); await p.waitForTimeout(200);
const nome = await p.getAttribute('#cvTab select[data-cv]', 'data-cv');
await p.selectOption('#cvTab select[data-cv]', 'SUS'); await p.waitForTimeout(150);
await p.goto(html + '#inicio'); await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub]'); await sub('convenios'); await p.click('#cvPbi'); await p.waitForTimeout(300);
ok(await p.evaluate(n => window.__RM.S.cfg.convenios.find(c => c.nome === n).tipo, nome) === 'SUS', `tipo marcado à mão (${nome} → SUS) não é trocado ao reimportar`);

// 6) Persistência e registro na competência.
await p.reload(); await p.waitForFunction(() => window.__RM, null, { polling: 200, timeout: 30000 });
ok(await S(() => window.__RM.S.cfg.prestadores.length === 36 && window.__RM.S.cfg.convenios.length === 220), 'regras gravadas após recarregar');
ok(await S(() => window.__RM.S.compReg.itens['2026-10'].alteracoes.some(a => a.tipo === 'prestadores') && window.__RM.S.compReg.itens['2026-10'].alteracoes.some(a => a.tipo === 'regras')), 'alterações registradas na competência 10/2026');
await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub]'); await sub('prestadores'); await p.screenshot({ path: out + 'regras_prestadores.png' });
await sub('classes'); await p.screenshot({ path: out + 'regras_classes.png', fullPage: true });
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
