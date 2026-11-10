// Teste: planilhas de laudos (Apolo) e do Power BI guardadas por competência (pedido de 04/11/2026).
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
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Planilhas')));
const S = (fn, arg) => p.evaluate(fn, arg);
const pronto = () => p.waitForFunction(() => window.__RM && document.getElementById('stInit').textContent.includes('Pronto'), null, { polling: 200, timeout: 60000 });
const okDlg = async () => { await p.waitForSelector('#dlg[open]'); await p.click('#dlgBotoes button[value=ok]'); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(250); };
await p.goto(html + '#inicio'); await pronto();

// 1) Carregar e recarregar a página: as duas planilhas continuam.
await p.setInputFiles('#inApolo', d('apolo_09-2026.xlsx')); await p.waitForFunction(() => !!window.__RM.S.apolo?.guardada, null, { timeout: 120000 });
await p.setInputFiles('#inPBI', d('powerbi_09-2026.xlsx')); await p.waitForFunction(() => !!window.__RM.S.pbi?.guardada, null, { timeout: 120000 });
const antes = await S(() => [window.__RM.S.apolo.laudos.length, window.__RM.S.pbi.linhas.length]);
ok(/Guardada nesta competência/.test(await p.textContent('#stApolo')) && /Guardada nesta competência/.test(await p.textContent('#stPBI')), 'Início mostra as duas planilhas «Guardada nesta competência»');
await p.screenshot({ path: out + 'planilhas_guardadas.png' });
await p.reload(); await pronto(); await p.waitForFunction(() => !!window.__RM.S.apolo && !!window.__RM.S.pbi, null, { timeout: 60000 });
const depois = await S(() => [window.__RM.S.apolo.laudos.length, window.__RM.S.pbi.linhas.length, window.__RM.S.apolo.laudos[0].data instanceof Date]);
ok(depois[0] === antes[0] && depois[1] === antes[1] && depois[2], `depois de recarregar: laudos ${depois[0]} e Power BI ${depois[1]} continuam carregados (datas preservadas)`);
// Sem CPF guardado.
const semCPF = await S(async () => { const r = await new Promise(res => { const q = indexedDB.open('repasse-medico-v2'); q.onsuccess = () => { const g = q.result.transaction('arquivos').objectStore('arquivos').getAll(); g.onsuccess = () => res(g.result); }; });
  return { n: r.length, cpf: JSON.stringify(r.map(x => Object.keys(x.dados.linhas?.[0] || x.dados.laudos?.[0] || {}))).toLowerCase().includes('cpf'), bytes: r.some(x => x.dados.bytes) }; });
ok(semCPF.n === 2 && !semCPF.cpf && !semCPF.bytes, 'o navegador guarda o que a ferramenta leu, sem CPF e sem o arquivo original');
// 2) Conferência funciona com as planilhas restauradas.
await p.setInputFiles('#inMV', [d('mv_usg_medico15_unidade1.pdf')]); await p.waitForFunction(() => window.__RM.S.relatorios.length === 1, null, { timeout: 60000 });
await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar'); await p.selectOption('#cfUn', '1'); await p.click('#cfRodar'); await p.waitForSelector('#cfTab table');
ok(await S(() => window.__RM.S.conf.res.nLaudosEscopo > 0 && !!window.__RM.S.conf.ctx.pbiResumo), 'conferência roda com o Apolo e o Power BI restaurados');
// 3) Trocar o Power BI no meio do mês: a nova substitui a guardada.
await p.goto(html + '#inicio'); await p.waitForSelector('#inPBI', { state: 'attached' });
const em1 = await S(() => window.__RM.S.pbi.guardada.em);
await p.clock.fastForward('02:00:00');
await p.setInputFiles('#inPBI', d('powerbi_09-2026.xlsx')); await p.waitForFunction(e => window.__RM.S.pbi?.guardada && window.__RM.S.pbi.guardada.em !== e, em1, { timeout: 120000 });
ok(true, 'carregar outro Power BI substitui o guardado (atualização no meio do mês)');
// 4) Remover da competência: some ao recarregar; o Apolo continua.
await p.click('[data-desguardar="pbi"]'); await okDlg();
await p.reload(); await pronto(); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 60000 });
ok(await S(() => !window.__RM.S.pbi && !!window.__RM.S.apolo), '«Remover da competência»: o Power BI não volta; o Apolo continua');
// 5) Guardar automaticamente desmarcado: o Power BI fica só na sessão.
// v3.0: a opção fica em Configurações → Conferência.
const opcaoGuardar = async (tipo) => { await S(() => window.__RM.irPara('configuracoes')); await p.locator('[data-cfsub="conferencia"]:visible').click(); await p.uncheck(`[data-guardarauto="${tipo}"]`); await p.waitForTimeout(200); await S(() => window.__RM.irPara('inicio')); };
await opcaoGuardar('apolo');
await p.setInputFiles('#inPBI', d('powerbi_09-2026.xlsx'));
ok(await p.waitForFunction(() => !!window.__RM.S.pbi?.guardada, null, { timeout: 120000 }).then(() => true, () => false), 'a opção é por planilha: desmarcar a do Apolo não muda a do Power BI');
await opcaoGuardar('pbi'); await p.click('[data-desguardar="pbi"]'); await okDlg();
await p.setInputFiles('#inPBI', d('powerbi_09-2026.xlsx')); await p.waitForTimeout(3000);
ok(await S(() => !window.__RM.S.pbi.guardada) && /Só nesta sessão/.test(await p.textContent('#stPBI')), 'com «guardar automaticamente» desmarcado, o Power BI fica só na sessão');
// 6) Outra competência: as planilhas de 10/2026 voltam quando você volta para 10/2026.
await S(() => window.__RM.S.cfg.parametros.guardarPlanilhas = { apolo: true, pbi: true });
await p.click('#compProx').catch(() => {}); await p.waitForTimeout(500); while (await p.isVisible('#dlg[open]')) await okDlg();
const comp = await S(() => window.__RM.S.comp);
await p.click('#compAnt').catch(() => {}); await p.waitForTimeout(1500); while (await p.isVisible('#dlg[open]')) await okDlg();
ok(comp === '2026-11' && await S(() => window.__RM.S.comp === '2026-10' && !!window.__RM.S.apolo?.guardada), 'ao voltar para 10/2026, a planilha de laudos guardada volta');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
