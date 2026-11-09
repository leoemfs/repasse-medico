// SOL-F35 — Prestadores por unidade com os arquivos reais da competência 10/2026 (dados/comp_10-2026, fora do Git):
// quem laudou na planilha de laudos × relatório, conferência e aceite; Curitiba só com médicos V3 e a regra de cada um.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', pasta = raiz + 'dados/comp_10-2026/', d = f => raiz + 'dados/' + f;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const info = msg => console.log('· ' + msg);
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Unidades')));
await p.goto(html + '#inicio');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const S = (fn, arg) => p.evaluate(fn, arg);
const okDlg = async (v = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${v}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(250); };
const abrirUn = async (un, gr, soFalta = true) => { await p.goto(html + '#conferencia'); await p.waitForSelector('[data-cusub="unidades"]'); await p.click('[data-cusub="unidades"]'); await p.waitForSelector('.cu-un'); await p.click(`[data-cuun="${un}"]`); await p.waitForTimeout(150); if (gr) { await p.click(`[data-cugr="${gr}"]`); await p.waitForTimeout(150); } if ((await p.isChecked('#cuSoFalta')) !== soFalta) { await p.click('#cuSoFalta'); await p.waitForTimeout(150); } await p.waitForSelector('.cu-res'); };
const ctl = () => S(() => { const { S: E, t } = window.__RM; const sess = []; return t.controlePrestadoresUnidade({ laudos: E.apolo.laudos, cfg: E.cfg, rodadas: E.rodadas, chave: E.comp, sessao: sess, marcas: (JSON.parse(localStorage.getItem('rm2.controleUnidades') || '{}'))[E.comp] || {}, naoSRA: E.cfg.medicosNaoSRA || [] }); });

// Bases (planilha de controle) e laudos do Apolo.
await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub]'); await p.click('[data-bsub="prestadores"]');
await p.setInputFiles('#prCtrlArq', d('repasse_10-2026_controle.xlsx')); await okDlg();
await p.goto(html + '#inicio'); await p.setInputFiles('#inApolo', pasta + 'APOLO_10-2026_ref_09-2026.xlsx'); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 300000 });
while (await p.isVisible('#dlg[open]')) await okDlg();

// 1) Sem PDF: todos os laudos de cada unidade/grupo entram na conta; ninguém sem relatório fica de fora.
const c0 = await ctl();
const conta = await S(() => { const { S: E } = window.__RM, mapa = new Map(); for (const u of E.cfg.unidades) for (const n of u.apolo || []) mapa.set(n.toUpperCase(), String(u.cod));
  const r = {}; for (const l of E.apolo.laudos) { const cod = mapa.get(String(l.unidade).toUpperCase()); if (!cod) continue; const g = cod === '5' ? 'curitiba' : l.modalidade === 'US' ? 'usg' : 'img'; r[`${cod}|${g}`] = (r[`${cod}|${g}`] || 0) + 1; } return r; });
let todosBatem = true;
for (const u of c0.unidades) for (const G of u.grupos) {
  const soma = G.itens.reduce((s, x) => s + x.laudos + x.foraRegra.reduce((t, f) => t + f.q, 0), 0) + (G.grupo === 'curitiba' ? u.outros.reduce((s, o) => s + o.laudos, 0) : 0);
  if (soma !== (conta[`${u.cod}|${G.grupo}`] || 0)) { todosBatem = false; info(`unidade ${u.cod} ${G.grupo}: ${soma} × ${conta[`${u.cod}|${G.grupo}`]}`); }
}
ok(todosBatem, 'cada laudo do Apolo entra em exatamente um prestador (ou «não pagos pela SRA») da sua unidade e grupo');
const u17 = c0.unidades.find(u => u.cod === '17'), usg17 = u17.grupos.find(G => G.grupo === 'usg');
info(`unidade 17 · USG: ${usg17.resumo.laudaram} laudaram · ${usg17.resumo.gerar} a gerar · ${usg17.resumo.semCadastro} sem cadastro`);
ok(usg17.itens.every(x => ['gerar', 'sem-cadastro', 'conflito', 'fora'].includes(x.situacao)), 'sem PDF nem rodada: quem laudou está «Gerar no MV» (ou sem cadastro)');
ok(c0.unidades.every(u => u.grupos.every(G => G.itens.every(x => x.cod || ['sem-cadastro', 'conflito'].includes(x.situacao)))), 'médico do Apolo sem cadastro nunca recebe prestador sugerido');
// Curitiba: só médicos V3, com a regra de cada um.
const u5 = c0.unidades.find(u => u.cod === '5');
const v3ok = await S(cods => cods.every(c => window.__RM.S.cfg.prestadores.find(p => String(p.cod) === c)?.regras?.v3), u5.grupos[0].itens.filter(x => x.cod).map(x => x.cod));
ok(u5.grupos.length === 1 && u5.grupos[0].grupo === 'curitiba' && v3ok, `Curitiba: um grupo só, só com médicos V3 (${u5.grupos[0].itens.filter(x => x.cod).length} V3 · ${u5.outros.length} outros «não pagos pela SRA» · ${u5.grupos[0].resumo.semCadastro} sem cadastro)`);
const regra = await S(() => { const t = window.__RM.t, r = { modo: 'fixo', grupos: [{ grupo: '*USG*' }, { grupo: 'RESSONANCIA MAGNETICA' }] }; return [t.laudoNaRegraV3(r, 'US'), t.laudoNaRegraV3(r, 'MR'), t.laudoNaRegraV3(r, 'CT'), t.laudoNaRegraV3({ modo: 'percentual' }, 'CT')]; });
ok(regra.join() === 'true,true,false,true', 'regra V3 por valor fixo conta só os grupos cadastrados (USG e RM sim, TC não); percentual conta todos');

// 2) Tela: subaba, unidade 17, USG.
await abrirUn('17', 'usg');
ok(/Prestadores por unidade/.test(await p.textContent('#pag-conferencia')) && await p.isVisible('[data-cuun="17"].on'), 'Conferência → «Prestadores por unidade» abre sem PDF, só com a planilha de laudos');
await p.screenshot({ path: out + 'prestadores_unidade_17.png', fullPage: true });

// 3) PDF do prestador 15 (USG, unidade 17) + conferência → «Conferido»; aceite → «Aceito».
await p.goto(html + '#inicio'); await p.setInputFiles('#inMV', pasta + 'MV_USG_15_un17.pdf'); await p.waitForFunction(() => window.__RM.S.relatorios.length === 1, null, { timeout: 120000 });
while (await p.isVisible('#dlg[open]')) await okDlg();
await p.goto(html + '#conferencia'); await p.click('[data-cusub="conferir"]');
await p.waitForSelector('#cfRodar'); await p.selectOption('#cfUn', '17'); await p.waitForTimeout(100);
if (!(await p.$eval('#cfMed option[value="@prest"]', o => !o.disabled))) await p.selectOption('#cfMed', '*');
await p.click('#cfRodar'); await p.waitForFunction(() => window.__RM.S.rodadas.length > 0, null, { timeout: 300000 });
let it15 = (await ctl()).unidades.find(u => u.cod === '17').grupos.find(G => G.grupo === 'usg').itens.find(x => x.cod === '15');
ok(it15?.situacao === 'conferido' && it15.linhasMV > 0, `prestador 15 na unidade 17: «Conferido» depois da rodada (${it15?.laudos} laudos × ${it15?.linhasMV} linhas no MV)`);
await S(async () => { const { S: E, t } = window.__RM, r = E.rodadas.at(-1); r.aceite = { por: 'Teste Unidades', em: new Date().toISOString(), obs: '', pendencias: 0 }; await t.dbGravar(r); });
it15 = (await ctl()).unidades.find(u => u.cod === '17').grupos.find(G => G.grupo === 'usg').itens.find(x => x.cod === '15');
ok(it15?.situacao === 'aceito', 'com aceite na rodada: «Aceito», sem digitar nada');

// 4) Marcas: gerado no MV, fora do repasse, não pago pela SRA; exportação; Início; Fechamento.
await abrirUn('17', 'usg');
const nGer0 = await p.locator('[data-cuger]').count();
if (nGer0) { await p.locator('[data-cuger]').first().click(); await p.waitForTimeout(300); ok(/gerado no MV · Teste Unidades/.test(await p.textContent('.cu-tab')), '«✓ gerado no MV» fica registrado com quem marcou (continua na lista até ter rodada)'); }
if (await p.locator('[data-cudisp]').count()) {
  await p.locator('[data-cudisp]').first().click(); await p.waitForSelector('#dlg[open]'); await p.fill('#dlgCorpo [name="motivo"]', 'pago por outra empresa neste mês'); await okDlg();
  const disp = (await ctl()).unidades.find(u => u.cod === '17').grupos.find(G => G.grupo === 'usg').itens.find(x => x.dispensado);
  ok(disp?.situacao === 'fora' && disp.dispensado.motivo === 'pago por outra empresa neste mês' && disp.dispensado.por === 'Teste Unidades', `«Fora do repasse neste mês» exige motivo, registra quem marcou e sai do que falta (${disp?.cod} ${disp?.nome})`);
}
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#cuExp')]);
await dl.saveAs(out + 'prestadores_por_unidade.xlsx');
ok(/prestadores_por_unidade_comp_10-2026\.xlsx/.test(dl.suggestedFilename()) && fs.statSync(out + 'prestadores_por_unidade.xlsx').size > 2000, `exporta «Lista para gerar no MV» (${dl.suggestedFilename()})`);
// Curitiba: «Não é pago pela SRA».
await abrirUn('5', '', false);
await p.screenshot({ path: out + 'prestadores_unidade_curitiba.png', fullPage: true });
if (await p.locator('[data-cunsra]').count()) {
  const nome = await p.locator('[data-cunsra]').first().getAttribute('data-cunsra');
  await p.locator('[data-cunsra]').first().click(); await okDlg();
  const c5 = (await ctl()).unidades.find(u => u.cod === '5');
  ok(c5.outros.some(o => o.nome === nome && o.marca?.por === 'Teste Unidades'), `Curitiba: «${nome}» marcado como não pago pela SRA vai para «Outros médicos», com quem marcou`);
} else info('Curitiba sem médico sem cadastro: «Não é pago pela SRA» não testado');
await p.goto(html + '#inicio'); await p.waitForSelector('#btCtlUn');
ok(/Unidade 17 · USG/.test(await p.textContent('#pag-inicio')), 'Início mostra o que falta por unidade');
await p.goto(html + '#fechamento'); await p.waitForSelector('[data-fsub]'); await p.click('[data-fsub="usg"]'); await p.waitForTimeout(300);
ok(/laudaram na unidade \d+ \(USG\) e não têm relatório/.test(await p.textContent('#pag-fechamento')), 'Fechamento avisa quem laudou e não tem relatório (sem bloquear)');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + [...new Set(erros)].slice(0, 3).join(' | ') : ''));
await b.close();
