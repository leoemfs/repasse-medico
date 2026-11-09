// SOL-F36 — Fluxo sincronizado pela pasta da rede, com dois usuários (dois navegadores com dados separados)
// e uma pasta simulada em disco (test/saida/pasta_rede). Dados fictícios.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', pasta = out + 'pasta_rede/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.rmSync(pasta, { recursive: true, force: true }); fs.mkdirSync(pasta, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
let relogio = Date.parse('2026-10-30T10:00:00');
async function usuario(nome) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
  p.on('pageerror', e => erros.push(`${nome}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error') erros.push(`${nome}: ${m.text()}`); });
  await p.exposeFunction('__fsLer', n => fs.existsSync(pasta + n) ? { txt: fs.readFileSync(pasta + n, 'utf8'), lm: fs.statSync(pasta + n).mtimeMs } : null);
  await p.exposeFunction('__fsGravar', (n, t) => { fs.writeFileSync(pasta + n, t); relogio += 1000; fs.utimesSync(pasta + n, relogio / 1000, relogio / 1000); });
  await p.addInitScript(n => localStorage.setItem('rm2.operador', JSON.stringify(n)), nome);
  await p.goto(html + '#fluxo');
  await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
  if (await p.isVisible('#fxCriar')) { await p.click('#fxCriar'); await p.waitForSelector('.marco'); }
  return p;
}
// Pasta simulada com a mesma interface do Edge (getFileHandle/getFile/createWritable).
const conectar = p => p.evaluate(() => window.__RM.t.definirPastaSync({ name: 'Repasse Médico', getFileHandle: async (n, o = {}) => {
  if (!o.create && !(await window.__fsLer(n))) throw new DOMException('não existe', 'NotFoundError');
  return { getFile: async () => { const r = await window.__fsLer(n); if (!r) throw new DOMException('não existe', 'NotFoundError'); return { lastModified: r.lm, text: async () => r.txt }; },
    createWritable: async () => { let buf = ''; return { write: async t => { buf += t; }, close: async () => window.__fsGravar(n, buf) }; } };
} }));
const sinc = p => p.evaluate(() => window.__RM.t.sincronizarFluxo());
const st = (p, g, t) => p.evaluate(([g, t]) => window.__RM.S.fluxo.competencias['2026-10'].grupos[g].tarefas[t], [g, t]);
const mudar = (p, g, t, s) => p.evaluate(([g, t, s]) => { const { S, t: T } = window.__RM; T.mudarStatusTarefa(S.fluxo.competencias['2026-10'], g, t, s, S.operador); T.salvarFluxo(); }, [g, t, s]);

const ana = await usuario('Ana Teste'), leo = await usuario('Leo Teste');
// 1) Ana conecta primeiro: o arquivo da competência aparece na pasta.
await mudar(ana, 'usg', 'gerar', 'and');
await conectar(ana);
ok(fs.existsSync(pasta + 'fluxo_comp_10-2026.json') && JSON.parse(fs.readFileSync(pasta + 'fluxo_comp_10-2026.json', 'utf8')).atualizadoPor === 'Ana Teste', 'ao conectar, o Fluxo da competência vai para a pasta (fluxo_comp_10-2026.json), com quem gravou');
ok(/Sincronizado/.test(await ana.textContent('#fxSync')), 'barra «Sincronizado» no topo do Fluxo');
// 2) Leo conecta depois, com mudanças próprias: junta sem conflito.
await mudar(leo, 'img', 'gerar', 'and');
await conectar(leo);
ok((await st(leo, 'usg', 'gerar')).status === 'and' && (await st(leo, 'img', 'gerar')).status === 'and' && (await leo.evaluate(() => window.__RM.t.syncEstado().status)) === 'ok', 'primeira sincronização do segundo usuário junta as duas versões sem conflito');
await sinc(ana);
ok((await st(ana, 'img', 'gerar')).status === 'and', 'Ana recebe a mudança do Leo');
// 3) Divisão do trabalho: Ana assume a unidade 1 · USG pela tela; Leo vê.
await ana.goto(html + '#inicio'); await ana.goto(html + '#fluxo'); await ana.waitForSelector('#fxDivisao');
await ana.locator('[data-dvk="1|usg"] [data-dv="assumir"]').click(); await ana.waitForTimeout(1500);
await sinc(leo); await leo.goto(html + '#inicio'); await leo.goto(html + '#fluxo'); await leo.waitForSelector('#fxDivisao');
const cel = await leo.textContent('[data-dvk="1|usg"]');
ok(/Ana Teste/.test(cel) && /assumiu/.test(cel) && await leo.isVisible('[data-dvk="1|usg"].outro'), `Leo vê a unidade 1 · USG com a Ana (${cel.replace(/\s+/g, ' ').trim().slice(0, 60)})`);
await leo.locator('[data-dvk="17|usg"] [data-dv="assumir"]').click(); await leo.waitForTimeout(1500); await sinc(ana);
ok((await ana.evaluate(() => window.__RM.S.fluxo.competencias['2026-10'].divisao['17:usg'].por)) === 'Leo Teste', 'cada um assume uma unidade diferente, e os dois veem');
await leo.locator('details.dv-feed summary').click();
ok(/Ana Teste.*assumiu a unidade 1 · USG/s.test(await leo.textContent('.dv-feed')), '«Últimas mudanças» mostra quem assumiu o quê');
await leo.screenshot({ path: out + 'fluxo_sync_divisao.png', fullPage: false });
// 4) Mudanças em etapas diferentes: sem conflito.
await mudar(ana, 'usg', 'conf', 'and'); await sinc(ana);
await mudar(leo, 'img', 'cruzada', 'and'); await sinc(leo); await sinc(ana);
ok((await st(ana, 'img', 'cruzada')).status === 'and' && (await st(leo, 'usg', 'conf')).status === 'and', 'etapas diferentes mudadas pelos dois se juntam sozinhas');
// 5) A mesma etapa pelos dois: pede escolha; a escolhida fica com o histórico das duas.
await mudar(ana, 'usg', 'conf', 'ok'); await sinc(ana);
await mudar(leo, 'usg', 'conf', 'cor');
const pr = leo.evaluate(() => window.__RM.t.sincronizarFluxo({ interativo: true }));
await leo.waitForSelector('#dlg[open]');
const txt = await leo.textContent('#dlgCorpo');
ok(/mudaram os mesmos itens/.test(txt) && /Conferência/.test(txt), 'mesma etapa mudada pelos dois: diálogo pede para escolher');
await leo.screenshot({ path: out + 'fluxo_sync_conflito.png' });
await leo.check('#dlgCorpo input[value="remoto"]'); await leo.click('#dlgBotoes button[value="ok"]'); await pr;
const conf = await st(leo, 'usg', 'conf');
ok(conf.status === 'ok' && conf.historico.some(h => h.para === 'cor' && h.por === 'Leo Teste') && conf.historico.some(h => h.para === 'ok' && h.por === 'Ana Teste'), 'escolhida a da Ana: status dela, com o histórico dos dois');
await sinc(ana);
ok((await st(ana, 'usg', 'conf')).historico.some(h => h.para === 'cor'), 'a escolha volta para a pasta e chega à Ana');
// 6) Pasta fora do ar: barra amarela, nada se perde.
await leo.evaluate(() => { window.__fsLerOriginal = window.__fsLer; window.__fsLer = async () => { throw new Error('rede indisponível'); }; });
await mudar(leo, 'usg', 'valid', 'and'); await sinc(leo);
ok((await leo.evaluate(() => window.__RM.t.syncEstado().status)) === 'erro' && (await st(leo, 'usg', 'valid')).status === 'and', 'sem acesso à pasta: estado de erro, mudança guardada no navegador');
await leo.evaluate(() => { window.__fsLer = window.__fsLerOriginal; }); await sinc(leo); await sinc(ana);
ok((await st(ana, 'usg', 'valid')).status === 'and', 'quando a pasta volta, a mudança pendente chega ao outro');
const arq = fs.readFileSync(pasta + 'fluxo_comp_10-2026.json', 'utf8');
ok(!/PACIENTE|CPF/i.test(arq), 'o arquivo da pasta só tem o Fluxo (nada de paciente)');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + [...new Set(erros)].slice(0, 3).join(' | ') : ''));
await b.close();
