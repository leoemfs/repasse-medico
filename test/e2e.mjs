// Teste de ponta a ponta: abre o HTML final por file://, como o usuário fará.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname;
const html = fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
const d = f => raiz + 'dados/' + f, out = raiz + 'test/saida/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
await page.clock.install({ time: new Date('2026-10-30T10:00:00') });   // competência 10/2026 = produção 09/2026 dos arquivos de teste
const erros = [];
page.on('pageerror', e => erros.push(e.message));
page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await page.addInitScript(() => { if (!localStorage.getItem('rm2.operador')) localStorage.setItem('rm2.operador', JSON.stringify('Teste E2E')); });
await page.goto('file://' + raiz + 'dist/' + html);
await page.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const passo = async (nome, fn) => { const t = Date.now(); await fn(); console.log(`✔ ${nome} (${Date.now() - t} ms)`); };
await passo('carregar PDFs', async () => { await page.setInputFiles('#inMV', [d('mv_usg_medico15_unidade1.pdf'), d('mv_correcao_unidade2.pdf')]); await page.waitForFunction(() => window.__RM.S.relatorios.length === 2, null, { timeout: 60000 }); });
await passo('carregar Apolo', async () => { await page.setInputFiles('#inApolo', d('apolo_09-2026.xlsx')); await page.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 60000 }); });
await passo('importar equivalências', async () => { await page.setInputFiles('#inEq', d('equivalencias_tuss.xlsx')); await page.waitForFunction(() => window.__RM.S.eq.itens.length > 900, null, { timeout: 60000 }); });
await passo('carregar Power BI', async () => { await page.setInputFiles('#inPBI', d('powerbi_09-2026.xlsx')); await page.waitForFunction(() => !!window.__RM.S.pbi, null, { timeout: 60000 }); });
await page.screenshot({ path: out + 'tela_inicio.png', fullPage: true });
await passo('conferência cruzada', async () => {
  await page.goto(page.url().split('#')[0] + '#conferencia');
  await page.selectOption('#cfRel', { index: 0 }); await page.selectOption('#cfUn', '1');
  await page.click('#cfRodar'); await page.waitForSelector('#cfTab table');
});
console.log('  conferência:', await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(window.__RM.S.conf.res.porStatus).map(([k, v]) => [k, v.n])))));
await page.screenshot({ path: out + 'tela_conferencia.png', fullPage: false });
await passo('validar 3 pares pela tela e reprocessar', async () => {
  const boxes = await page.$$('#eqrTab input[type=checkbox]');
  for (const b of boxes.slice(0, 3)) await b.check();
  await page.click('#eqrValidar'); await page.fill('#dlgCorpo input[name=motivo]', 'teste E2E'); await page.click('#dlgBotoes button[value=ok]');
  await page.waitForFunction(() => window.__RM.S.eq.itens.some(e => e.status === 'validada'));
  await page.waitForTimeout(300);
});
console.log('  após validar:', await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(window.__RM.S.conf.res.porStatus).map(([k, v]) => [k, v.n]))) + ' comparação=' + JSON.stringify(Object.fromEntries(Object.entries(window.__RM.S.conf.comparacao?.grupos || {}).map(([k, v]) => [k, v.length])))));
await passo('exportar Excel da conferência', async () => { const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#cfExcel')]); await dl.saveAs(out + 'e2e_conferencia.xlsx'); });
await passo('correção de prestador', async () => {
  await page.goto(page.url().split('#')[0] + '#correcao');
  await page.selectOption('#coRel', { index: 0 }); await page.selectOption('#coUn', '2');
  await page.click('#coRodar'); await page.waitForSelector('#coTab table');
});
console.log('  correção:', await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(window.__RM.S.corr.res.porEstado).map(([k, v]) => [k, v.n])))));
await page.screenshot({ path: out + 'tela_correcao.png', fullPage: false });
await passo('exportar planilha da correção', async () => { const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#coExcel')]); await dl.saveAs(out + 'e2e_correcao.xlsx'); });
for (const pg of ['equivalencias', 'bases', 'rodadas', 'configuracoes']) await passo('abrir ' + pg, async () => { await page.goto(page.url().split('#')[0] + '#' + pg); await page.waitForTimeout(400); await page.screenshot({ path: out + `tela_${pg}.png`, fullPage: false }); });
await passo('persistência após recarregar', async () => {
  await page.reload(); await page.waitForFunction(() => window.__RM && window.__RM.S.eq);
  const r = await page.evaluate(() => ({ val: window.__RM.S.eq.itens.filter(e => e.status === 'validada').length, rod: window.__RM.S.rodadas.length, prest: window.__RM.S.cfg.prestadores.length }));
  console.log('  ', JSON.stringify(r));
});
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(page.url().split('#')[0] + '#inicio'); await page.waitForTimeout(300);
await page.screenshot({ path: out + 'tela_celular.png', fullPage: false });
const largura = await page.evaluate(() => document.documentElement.scrollWidth);
console.log('  largura no celular:', largura, largura <= 390 ? 'ok (sem rolagem horizontal)' : 'ROLAGEM HORIZONTAL');
console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'Sem erros no console.');
await browser.close();
