// v3.0.0-alpha.12 — P3 da auditoria de 16/11/2026: modalidade por grupo do MV e HM da V3 configuráveis em Bases e regras
// (padrão = comportamento de sempre), textos de privacidade atualizados. Dados fictícios.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.clock.install({ time: new Date('2026-11-17T10:00:00') });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste P3')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const okDlg = async (botao = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${botao}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };
const mods = () => p.evaluate(() => { const t = window.__RM.t; return ['ULTRASSONOGRAFIA', 'DOPPLER COLORIDO', 'TOMOGRAFIA COMPUTADORIZADA', 'RADIOLOGIA', 'HEMODINAMICA'].map(g => `${g}:${(t.modalidadesDoGrupo(g) || ['-']).join('/')}`).join(' '); });
const hm = () => p.evaluate(() => { const t = window.__RM.t; return [t.hmV3Devido('ULTRASSONOGRAFIA', 'US ABDOME - HM', 'UNIMED LONDRINA'), t.hmV3Devido('HONORARIOS', 'DOPPLER - HM', 'UNIMED'), t.hmV3Devido('ULTRASSONOGRAFIA', 'US - HM', 'SULAMERICA'), t.hmV3Devido('TOMOGRAFIA', 'TC - HM', 'UNIMED')].join(' '); });
// Padrão = o de sempre.
ok(await mods() === 'ULTRASSONOGRAFIA:US DOPPLER COLORIDO:US TOMOGRAFIA COMPUTADORIZADA:CT RADIOLOGIA:CR/DX HEMODINAMICA:-', `modalidades padrão (${await mods()})`);
ok(await hm() === 'true true false false', `HM da V3 padrão: USG/Doppler Unimed devido; outro convênio ou procedimento não (${await hm()})`);
// Tela: Bases e regras → Modalidades e HM V3.
await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub="modalidades"]'); await p.click('[data-bsub="modalidades"]'); await p.waitForSelector('#cardModHM:not([hidden])');
await p.click('#mgAdd'); await p.waitForTimeout(150);
const n = await p.$$eval('#cardModHM [data-mg][data-c="padrao"]', e => e.length);
await p.fill(`#cardModHM [data-mg="${n - 1}"][data-c="padrao"]`, 'HEMODINAMICA|ANGIOGRAFIA'); await p.fill(`#cardModHM [data-mg="${n - 1}"][data-c="modalidades"]`, 'xa');
await p.fill('#hmConv', 'UNIMED|SULAMERICA');
await p.click('#mhSalvar'); await p.waitForTimeout(200);
const cfg = await p.evaluate(() => ({ m: window.__RM.S.cfg.modalidadesGrupo.at(-1), h: window.__RM.S.cfg.hmV3 }));
ok(cfg.m.padrao === 'HEMODINAMICA|ANGIOGRAFIA' && cfg.m.modalidades === 'XA' && cfg.h.convenios === 'UNIMED|SULAMERICA', `gravado na configuração (compartilhada pela pasta): ${JSON.stringify(cfg)}`);
ok((await mods()).endsWith('HEMODINAMICA:XA'), 'novo grupo vale sem nova versão (HEMODINAMICA → XA)');
ok(await hm() === 'true true true false', 'HM da V3 com SULAMERICA passa a ser devido');
// Efeito na conferência da V3 (unidade 5): HM SulAmérica de USG fica Devido.
const cls = await p.evaluate(() => { const { S, t } = window.__RM, d = new Date(Date.UTC(2026, 9, 3));
  const r = { seq: 1, pagina: 1, codigo: '40901173', procDesc: 'USG TIREOIDE - HM', grupoNome: 'HONORARIOS MEDICOS', conta: '1', atendimento: '2', paciente: 'ANA', convenio: 'SULAMERICA', data: d, vlRepasse: 7, vlTotal: 14, pct: .5, quant: 1, prestadorCod: '15', prestadorNome: 'DR X' };
  const base = { ...r, seq: 2, procDesc: 'USG TIREOIDE', grupoNome: 'ULTRASSONOGRAFIA' };   // exame base do HM (regra de 23/11/2026)
  const res = t.conferirCruzado({ regs: [base, r], cab: { prestadorCod: '15', prestadorNome: 'DR X' } }, { laudos: [] }, S.cfg, S.eq, { unidadeCod: '5', tol: 0 });
  return res.linhas.filter(x => x.r && x.tipo === 'hm').map(x => `${x.status}:${t.classeDaLinhaConf(x)}`).join(' '); });
ok(cls === 'conferido:devido', `conferência da V3: HM de USG SulAmérica = Devido pela regra configurada (${cls})`);
await p.screenshot({ path: out + 'p3_modalidades.png' });
// Recarregar: a regra continua valendo.
await p.reload(); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
ok((await mods()).endsWith('HEMODINAMICA:XA') && await hm() === 'true true true false', 'depois de recarregar, as regras configuradas continuam valendo');
// Restaurar padrão.
await p.goto(html + '#bases'); await p.click('[data-bsub="modalidades"]'); await p.waitForSelector('#cardModHM:not([hidden])');
await p.click('#mhPad'); await okDlg();
ok(await mods() === 'ULTRASSONOGRAFIA:US DOPPLER COLORIDO:US TOMOGRAFIA COMPUTADORIZADA:CT RADIOLOGIA:CR/DX HEMODINAMICA:-' && await hm() === 'true true false false', '«Restaurar padrão» volta ao comportamento de sempre');
// Texto de privacidade atualizado.
const nota = await p.evaluate(() => document.body.innerText);
ok(!/Nada é enviado à internet/i.test(nota) && /não vão para a internet/.test(nota), 'texto de privacidade atualizado (sem «Nada é enviado à internet»)');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
