// Teste SOL-F5: equivalências compostas e por convênio (um laudo sustenta N linhas do MV).
// Dados fictícios montados no próprio teste.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Compostas')));
await p.goto(html + '#equivalencias');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const okDlg = async () => { await p.waitForSelector('#dlg[open]'); await p.click('#dlgBotoes button[value=ok]'); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(250); };
const ART = '40901220', DOP = '40901386', TIT = 'USG DE OMBRO COM DOPPLER';

// 1) Cadastro pela tela: articular + doppler; UNIMED = só doppler; já validada.
await p.waitForSelector('#cmpNova'); await p.click('#cmpNova'); await p.waitForSelector('#dlg[open]');
await p.fill('#dlgCorpo [name="titulo"]', TIT); await p.press('#dlgCorpo [name="titulo"]', 'Escape');
await p.fill('#dlgCorpo [name="codigos"]', `${ART}, ${DOP}`); await p.fill('#dlgCorpo [name="cv0"]', 'unimed'); await p.fill('#dlgCorpo [name="cvc0"]', DOP);
await p.check('#dlgCorpo [name="validar"]'); await okDlg();
const c = await p.evaluate(() => window.__RM.S.eq.compostas[0]);
ok(c && c.status === 'validada' && c.codigos.join() === `${ART},${DOP}` && c.porConvenio[0].convenio === 'UNIMED' && c.responsavel === 'Teste Compostas', 'regra composta cadastrada e validada com responsável');
await p.locator('#cardCompostas').screenshot({ path: out + 'compostas_card.png' });

// 2) Conferência com dados fictícios.
const r = await p.evaluate(({ ART, DOP, TIT }) => {
  const { S: E, t } = window.__RM, dt = new Date(Date.UTC(2026, 8, 10)), dia = t.diaSerial(dt);
  const laudo = (i, pac) => ({ i, paciente: pac, pn: pac, data: dt, dia, titulo: TIT, modalidade: 'US', medico: 'MEDICO TESTE', mn: 'MEDICO TESTE', unidade: 'X', convenio: '' });
  const reg = (seq, pac, cod, conv) => ({ seq, chave: 'c' + seq, codigo: cod, procDesc: cod === ART ? 'US ARTICULAR' : 'DOPPLER COLORIDO', grupoNome: 'ULTRASSONOGRAFIA - OUTROS', convenio: conv, paciente: pac, data: dt, vlTotal: 100, vlRepasse: 40, quant: 1 });
  const apolo = { laudos: [laudo(0, 'PACIENTE UM TESTE'), laudo(1, 'PACIENTE DOIS TESTE'), laudo(2, 'PACIENTE TRES TESTE')] };
  const rel = { regs: [reg(1, 'PACIENTE UM TESTE', ART, 'PARTICULAR'), reg(2, 'PACIENTE UM TESTE', DOP, 'PARTICULAR'),
    reg(3, 'PACIENTE DOIS TESTE', ART, 'UNIMED CURITIBA'), reg(4, 'PACIENTE DOIS TESTE', DOP, 'UNIMED CURITIBA'),
    reg(5, 'PACIENTE TRES TESTE', ART, 'PARTICULAR')], cab: {} };
  const res = t.conferirCruzado(rel, apolo, E.cfg, E.eq, { tol: 0, unidadeCod: '*', medicos: null });
  return res.linhas.filter(x => x.r).map(x => ({ seq: x.r.seq, st: x.status, m: [...x.marcadores].sort().join('+'), mot: x.motivos.join(' | ') }));
}, { ART, DOP, TIT });
const L = Object.fromEntries(r.map(x => [x.seq, x]));
ok(L[1].st === 'conferido' && L[2].st === 'conferido' && L[1].m === 'composta' && L[2].m === 'composta', `particular: um laudo sustenta articular + doppler, as duas conferidas (${L[1].st}, ${L[2].st})`);
ok(L[4].st === 'conferido' && /UNIMED/.test(L[4].mot), 'UNIMED: o doppler é conferido pela variação do convênio');
ok(L[3].st !== 'conferido' && /eq-divergente/.test(L[3].m) && /não faz parte/.test(L[3].mot), `UNIMED: o articular sobra e é apontado (${L[3].st}: ${L[3].m})`);
ok(L[5].st === 'ressalva' && /composta-falta/.test(L[5].m) && new RegExp(`falta ${DOP}`).test(L[5].mot), 'só o articular lançado: «Composição incompleta», falta o doppler');
// Desativada não vale.
await p.click('[data-cmpdes]'); await p.waitForSelector('#dlg[open]'); await p.fill('#dlgCorpo [name="motivo"]', 'teste'); await okDlg();
const st2 = await p.evaluate(({ ART, TIT }) => window.__RM.t.avaliarProcedimento(window.__RM.t.indiceEquivalencias(window.__RM.S.eq), ART, TIT, { convenio: 'PARTICULAR' }).estado, { ART, TIT });
ok(st2 === 'sem-cadastro', `regra desativada deixa de valer (${st2})`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
