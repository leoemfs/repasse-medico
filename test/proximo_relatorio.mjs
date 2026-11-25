// v3.0.0-alpha.56 — «Ir para o próximo relatório» segue a lista do roteiro (ordem do seletor). Dados fictícios.
import { createRequire } from 'module';
import fs from 'fs';
import { execFileSync } from 'child_process';
const abrirF = async () => { if (!(await p.isVisible('#cfGaveta'))) await p.click('#cfFiltrosBt'); };
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/proximo/';
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
  S.apolo = { nome: 'apolo.xlsx', hash: 'h', laudos: [{ i: 0, linhaPlanilha: 2, idLaudo: '1', unidade: 'AlphaSonic Palhano', paciente: 'ANA', pn: 'ANA', idPac: '1', titulo: 'USG TIREOIDE', tn: 'USG TIREOIDE', descricao: '', data: d(3), dia: dia(3), convenio: 'UNIMED', modalidade: 'US', medico: 'DR', mn: 'DR' }] };
  const R = (cod, nome) => ({ seq: 1, pagina: 1, codigo: '40901173', procDesc: 'US TIREOIDE', grupoNome: 'ULTRASSONOGRAFIA', conta: '1', atendimento: '1', paciente: 'ANA', convenio: 'UNIMED', data: d(3), vlRepasse: 10, vlTotal: 20, pct: .5, quant: 1, prestadorCod: cod, prestadorNome: nome, repasse: '1' });
  const rel = (id, cod, nome) => ({ id, nome: id + '.pdf', tamanho: 1, hash: 'h' + id, unidadePasta: '17', grupoPasta: 'usg', rel: { arquivo: id + '.pdf', cab: { prestadorCod: cod, prestadorNome: nome, repasse: '1', descricao: 'REPASSE USG', competencia: '11/2026', repasses: [] }, regs: [R(cod, nome)], avisos: [], conferencias: [], ok: true } });
  // Carregados fora da ordem alfabética: ANA, CARLOS, BRUNO (a regra antiga iria de ANA para CARLOS).
  S.relatorios = [rel('rA', '10', 'ANA ALFA'), rel('rC', '30', 'CARLOS ZETA'), rel('rB', '20', 'BRUNO BETA')];
  window.__RM.irPara('conferencia');
});
await p.waitForSelector('#cfRodar');
const ordem = await p.$$eval('#cfRel option', os => os.map(o => o.textContent.split(' · ')[0]));
await p.selectOption('#cfRel', 'rA'); await p.waitForTimeout(150); await p.selectOption('#cfUn', '17').catch(() => {});
await p.click('#cfRodar'); await p.waitForSelector('#cfAbas', { timeout: 15000 }); await p.waitForTimeout(200);
await p.evaluate(() => window.__RM.S.conf && (window.__RM.S.conf.aba = 'aceite')); await p.evaluate(() => { const b = document.querySelector('[data-cfaba="aceite"]') || [...document.querySelectorAll('[data-cfaba]')].find(x => /Aceite/.test(x.textContent)); b && b.click(); }); await p.waitForTimeout(300);
ok(ordem.join(',') === '10 - ANA ALFA,20 - BRUNO BETA,30 - CARLOS ZETA', `a lista segue a ordem do seletor, não a de carregamento (${ordem.join(', ')})`);
await p.fill('#cfAceiteObs', 'ok').catch(() => {}); await p.click('#cfAceitarProx'); await p.waitForTimeout(400);
if (await p.isVisible('#dlg[open]').catch(() => false)) { await p.click('#dlgBotoes button[value="ok"]').catch(() => {}); await p.waitForTimeout(400); }
await p.waitForSelector('#cfRel'); const foi = await p.inputValue('#cfRel');
ok(foi === 'rB', `«Registrar aceite e ir para o próximo» depois de ANA abre BRUNO (ordem da lista), não CARLOS (ordem de carregamento): ${foi}`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
