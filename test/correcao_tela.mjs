// v3.0.0-alpha.13 — Correção de prestador no padrão da Conferência, prestadores fora da correção e genéricos (25/11/2026).
import { createRequire } from 'module';
import fs from 'fs';
import { execFileSync } from 'child_process';
const abrirF = async () => { if (!(await p.isVisible('#cfGaveta'))) await p.click('#cfFiltrosBt'); };
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/correcao_tela/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.clock.install({ time: new Date('2026-11-17T10:00:00') });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste F41')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const okDlg = async (botao = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${botao}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };
// 4 linhas do MV (DR X) e laudos: 3 com par, 1 «Só no laudo» do DR X (2ª página) e 2 «Só no laudo» do DR Y.
await p.evaluate(() => {
  const { S } = window.__RM, d = n => new Date(Date.UTC(2026, 9, n)), dia = n => Math.round(d(n) / 864e5);
  const L = (i, pac, titulo, n, med) => ({ i, linhaPlanilha: i + 2, idLaudo: String(600 + i), unidade: 'AlphaSonic Palhano', paciente: pac, pn: pac, idPac: String(i), titulo, tn: titulo, descricao: '', data: d(n), dia: dia(n), convenio: 'UNIMED', modalidade: 'US', medico: med, mn: med });
  S.apolo = { nome: 'apolo.xlsx', hash: 'h', laudos: [L(0, 'ANA PAULA ROCHA', 'USG TIREOIDE', 3, 'MARCELO GARCIA MARINI'), L(1, 'BRUNA LIMA COSTA', 'USG TIREOIDE', 4, 'CAIO VINICIUS DE CASTRO')] };
  S.eq.itens.push({ id: 'eqA', codigo: '40901173', titulo: 'USG TIREOIDE', status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'T' });
  for (const [cod, nome] of [['7', 'MARCELO GARCIA MARINI'], ['44', 'CAIO VINICIUS DE CASTRO']]) if (!S.cfg.prestadores.some(x => x.cod === cod)) S.cfg.prestadores.push({ cod, nomeMV: nome, aliases: [], naoRealizaRepasse: false, regras: {} });
  const R = (seq, pac, n) => ({ seq, pagina: 1, codigo: '40901173', procDesc: 'US TIREOIDE', grupoNome: 'ULTRASSONOGRAFIA', conta: String(9000 + seq), atendimento: String(7000 + seq), paciente: pac, convenio: 'UNIMED', data: d(n), vlRepasse: 50, vlTotal: 100, pct: .5, quant: 1, prestadorCod: '2', prestadorNome: 'GENERICO', repasse: '25022' });
  const rel = (id, cod, regs) => ({ id, nome: id + '.pdf', tamanho: 1, hash: 'h' + id, unidadePasta: '17', rel: { arquivo: id + '.pdf', cab: { prestadorCod: cod, prestadorNome: 'GENERICO ' + cod, repasse: '25022', descricao: 'REPASSE', competencia: '11/2026', repasses: [] }, regs, avisos: [], conferencias: [], ok: true } });
  S.relatorios = [rel('rG', '2', [R(1, 'ANA PAULA ROCHA', 3), R(2, 'BRUNA LIMA COSTA', 4)]), rel('rTC', '5719', [R(3, 'ANA PAULA ROCHA', 3)])];
  window.__RM.irPara('correcao');
});
await p.waitForSelector('#coRodar'); await p.selectOption('#coUn', '17').catch(() => {}); await p.click('#coRodar'); await p.waitForSelector('#coTab tbody tr'); await p.waitForTimeout(200);
ok(/1 linha\(s\) de prestadores que não podem ficar/.test(await p.textContent('#coRes')), 'faixa do topo: 1 linha de prestador fora da correção (Marcelo, 7)');
ok(await p.locator('#coTab tr.fora-corr').count() === 1, 'a linha do prestador da lista tem o destaque vermelho');
ok(await p.locator('#coTab .cp-nome').count() === 2, 'ícone de copiar o nome em cada linha');
await p.locator('#coTab tr.fora-corr').click(); await p.waitForTimeout(200);
ok(/Lançado no genérico, mas o laudo é de/.test(await p.textContent('#coTab tr.detalhe')) && await p.locator('#coTab tr.detalhe .cpv').count() >= 1, 'linha aberta no padrão da Conferência, com diagnóstico e atendimento copiável');
await p.click('#coSoLista'); await p.waitForTimeout(150);
ok(await p.locator('#coTab tbody tr.clicavel').count() === 1, '«Mostrar só essas» filtra as linhas da lista');
ok(await p.locator('#coReler').count() === 1, 'botão de reler / carregar o PDF novo');
// Configurações: listas de prestadores genéricos e fora da correção; o 5719 vira genérico.
await p.evaluate(() => window.__RM.irPara('configuracoes')); await p.waitForTimeout(300);
await p.evaluate(() => { const b = [...document.querySelectorAll('[data-cfg-sub],[data-sub],.subabas button,nav button')].find(x => /Confer/i.test(x.textContent)); b && b.click(); }); await p.waitForTimeout(300);
ok(await p.locator('#pl-fora .pl-item').count() === 16, 'lista «Prestadores fora da correção» com os 16 do padrão');
await p.fill('[data-plbusca="gen"]', '5719'); await p.click('[data-pladd="gen"]'); await p.waitForTimeout(300);
const fin = await p.evaluate(() => window.__RM.S.cfg.parametros.prestadoresGenericos);
ok(JSON.stringify(fin) === '["2","5719"]', `prestador 5719 incluído nos genéricos (${JSON.stringify(fin)})`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
