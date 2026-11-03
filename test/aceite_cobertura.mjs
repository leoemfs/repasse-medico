// Teste SOL-F11 (aceite na própria Conferência) e SOL-F15 (cobertura de equivalências e validação em lote).
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', d = f => raiz + 'dados/' + f;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Aceite')));
await p.goto(html + '#inicio');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const S = (fn, arg) => p.evaluate(fn, arg);
const okDlg = async () => { await p.waitForSelector('#dlg[open]'); await p.click('#dlgBotoes button[value=ok]'); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(250); };

// Arquivos: dois PDFs (o do genérico também vai para a conferência, para testar «próximo relatório»), Apolo e equivalências.
await p.setInputFiles('#inMV', [d('mv_usg_medico15_unidade1.pdf'), d('mv_correcao_unidade2.pdf')]); await p.waitForFunction(() => window.__RM.S.relatorios.length === 2, null, { timeout: 60000 });
await S(() => window.__RM.S.relatorios.forEach(x => { x.finalidade = 'conferencia'; }));
await p.setInputFiles('#inApolo', d('apolo_09-2026.xlsx')); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 60000 });
await p.goto(html + '#equivalencias'); await p.waitForSelector('#eqArqX', { state: 'attached' }); await p.setInputFiles('#eqArqX', d('equivalencias_tuss.xlsx')); await p.waitForFunction(() => window.__RM.S.eq.itens.length > 900, null, { timeout: 60000 });
if (await p.isVisible('#dlg[open]')) await okDlg();

// ---- F11: aceite na Conferência ----
await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar');
const relA = await p.inputValue('#cfRel');
await p.selectOption('#cfUn', '1'); await p.click('#cfRodar'); await p.waitForSelector('#cfAceite');
const box = await p.textContent('#cfAceite');
ok(/sem aceite/.test(box) && /pendente\(s\)/.test(box) && !!(await p.$('#cfAceitarProx')), `quadro de aceite no resultado (${box.replace(/\s+/g, ' ').slice(0, 110)}…)`);
await p.screenshot({ path: out + 'aceite_conferencia.png' });
await p.click('#cfAceitar'); await p.waitForTimeout(200);
ok(await S(() => !window.__RM.S.rodadas.at(-1).aceite) && /observação/.test(await p.textContent('#aviso')), 'com pendências, a observação é obrigatória');
await p.fill('#cfAceiteObs', 'pendências por equivalência ainda não validada'); await p.click('#cfAceitar'); await p.waitForSelector('.aceite-box.feito');
const ac = await S(() => window.__RM.S.rodadas.find(r => r.id === window.__RM.S.conf.ctx.rodadaId).aceite);
ok(ac && ac.por === 'Teste Aceite' && /equivalência/.test(ac.obs) && ac.pendencias > 0, `aceite registrado na rodada (${ac?.pendencias} pendência(s))`);
ok(/aceito/.test(await p.textContent('#cfAceite')) && !!(await p.$('#cfDesfazer')), 'depois do aceite: quem, quando e «Desfazer aceite»');
await p.goto(html + '#rodadas'); await p.waitForSelector('#rdTab table');
ok(/Teste Aceite/.test(await p.textContent('#rdTab')), 'o aceite aparece em Rodadas');
// Desfazer e aceitar de novo, indo para o próximo relatório.
await p.goto(html + '#conferencia'); await p.waitForSelector('#cfAceite');
await p.click('#cfDesfazer'); await okDlg();
const dz = await S(() => { const r = window.__RM.S.rodadas.find(r => r.id === window.__RM.S.conf.ctx.rodadaId); return [!!r.aceite, (r.aceitesDesfeitos || []).length]; });
ok(dz[0] === false && dz[1] === 1 && /sem aceite/.test(await p.textContent('#cfAceite')), 'desfazer aceite: volta a «sem aceite» e guarda no histórico');
await p.fill('#cfAceiteObs', 'ok para enviar'); await p.click('#cfAceitarProx'); await p.waitForTimeout(400);
const prox = await S(() => [document.getElementById('cfRel').value, document.getElementById('cfUn').value, !!window.__RM.S.conf]);
ok(prox[0] !== relA && prox[1] === '1' && prox[2] === false, 'aceitar e ir para o próximo: próximo relatório selecionado, mesma unidade, sem resultado antigo na tela');

// ---- F15: cobertura e «O que mais destrava» ----
await p.goto(html + '#inicio'); await p.waitForSelector('#cobInicio');
const cob0 = await S(() => document.getElementById('cobInicio').textContent);
ok(/Cobertura automática/.test(cob0) && /linhas conferidas sem decisão manual/.test(cob0), `Início: cobertura da competência (${cob0.replace(/\s+/g, ' ').trim().slice(0, 90)})`);
await p.click('#cobInicio [data-destrava]'); await p.waitForSelector('#cardDestrava');
const nPares = (await p.$$('[data-dv]')).length;
ok(nPares > 0 && /O que mais destrava/.test(await p.textContent('#cardDestrava')), `atalho do Início abre «O que mais destrava» (${nPares} pares)`);
const linhas = await p.$$eval('.dv-tab tbody tr:not(.detalhe)', trs => trs.map(tr => +tr.cells[3].textContent));
ok(linhas.every((v, i) => !i || linhas[i - 1] >= v), `ordenado do que mais destrava (${linhas.slice(0, 5).join(', ')}…)`);
await p.click('[data-dvver]'); await p.waitForTimeout(150);
ok(/conta .* atendimento/.test(await p.textContent('tr.detalhe:not([hidden])')), '«ver pares» mostra exemplos (prestador, unidade, data, conta/atendimento)');
// Seleciona os dois primeiros validáveis e confere a simulação.
const habil = await p.$$('[data-dv]:not([disabled])');
await habil[0].check(); await p.waitForTimeout(150); await (await p.$$('[data-dv]:not([disabled])'))[1].check(); await p.waitForTimeout(150);
const lote = await p.textContent('.lote-dv');
ok(/2 selecionado\(s\)/.test(lote) && /destrava \+\d+ linha/.test(lote) && /→/.test(lote), `simulação do ganho (${lote.replace(/\s+/g, ' ').trim()})`);
await p.screenshot({ path: out + 'cobertura_destrava.png' });
const antes = await S(() => window.__RM.S.rodadas.length);
const covAntes = await S(() => window.__RM.t.coberturaCompetencia(window.__RM.S.rodadas, window.__RM.S.comp).conferidas);
await p.click('#dvValidar'); await p.waitForSelector('#dlg[open]'); await okDlg(); await p.waitForTimeout(800);
const depois = await S(() => ({ n: window.__RM.S.rodadas.length, cov: window.__RM.t.coberturaCompetencia(window.__RM.S.rodadas, window.__RM.S.comp), val: window.__RM.S.eq.itens.filter(e => e.status === 'validada' && e.responsavel === 'Teste Aceite').length }));
ok(depois.val === 2, 'as 2 equivalências ficam validadas com o responsável');
ok(depois.n > antes && depois.cov.conferidas > covAntes, `rodou de novo as conferências afetadas: ${depois.n - antes} rodada(s), conferidas ${covAntes} → ${depois.cov.conferidas}`);
// Fechamento → Indicadores: cobertura por prestador.
await p.goto(html + '#fechamento'); await p.waitForSelector('[data-fsub]'); await p.click('[data-fsub="indicadores"]'); await p.waitForSelector('#cobFech');
ok(/Cobertura automática por prestador/.test(await p.textContent('#cobFech')) && /15 - /.test(await p.textContent('#cobFech')), 'Fechamento → Indicadores: cobertura por prestador e maior bloqueio');
await p.locator('#cobFech').screenshot({ path: out + 'cobertura_fechamento.png' });
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
