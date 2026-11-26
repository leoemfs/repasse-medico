// v3.0.0-alpha.60 — Conferências compartilhadas pela pasta (decisões, observações, rodadas e aceite), com duas pessoas.
// Dados fictícios.

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', pasta = out + 'conf_sync/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.rmSync(pasta, { recursive: true, force: true }); fs.mkdirSync(pasta, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
let relogio = Date.parse('2026-11-17T10:00:00');
const seguro = p => { const r = path.resolve(pasta, p); if (!r.startsWith(path.resolve(pasta))) throw new Error('fora da pasta'); return r; };
async function usuario(nome, { semEspacoNoLocalStorage = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-11-17T10:00:00') });
  p.on('pageerror', e => erros.push(`${nome}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error') erros.push(`${nome}: ${m.text()}`); });
  await p.exposeFunction('__fs', (op, rel, arg) => {
    const f = seguro(rel);
    if (op === 'lista') return fs.existsSync(f) ? fs.readdirSync(f, { withFileTypes: true }).map(d => ({ nome: d.name, dir: d.isDirectory() })) : null;
    if (op === 'existe') return fs.existsSync(f) ? (fs.statSync(f).isDirectory() ? 'dir' : 'arq') : '';
    if (op === 'mkdir') { fs.mkdirSync(f, { recursive: true }); return true; }
    if (op === 'ler') return fs.existsSync(f) ? { txt: fs.readFileSync(f, 'utf8'), lm: fs.statSync(f).mtimeMs, tam: fs.statSync(f).size } : null;
    if (op === 'lerb64') return fs.readFileSync(f).toString('base64');
    if (op === 'gravar') { fs.writeFileSync(f, arg.b64 ? Buffer.from(arg.b64, 'base64') : arg.txt); relogio += 1000; fs.utimesSync(f, relogio / 1000, relogio / 1000); return true; }
    if (op === 'apagar') { fs.rmSync(f, { force: true }); return true; }
  });
  await p.addInitScript(([n, semEspaco]) => {
    localStorage.setItem('rm2.operador', JSON.stringify(n));
    if (semEspaco) { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'rm2.equivalencias' && v.length > 2000) throw new DOMException('cheio', 'QuotaExceededError'); return orig.call(this, k, v); }; }
    // Pasta simulada: diretório e arquivo com a interface do File System Access do Edge.
    const arq = (rel, nome) => ({ kind: 'file', name: nome,
      getFile: async () => { const r = await window.__fs('ler', rel); if (!r) throw new DOMException('não existe', 'NotFoundError'); return { name: nome, lastModified: r.lm, size: r.tam, text: async () => r.txt, arrayBuffer: async () => { const b = atob(await window.__fs('lerb64', rel)), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; } }; },
      createWritable: async () => { let partes = []; return { write: async d => { partes.push(d); }, close: async () => { const bl = new Blob(partes); const u8 = new Uint8Array(await bl.arrayBuffer()); let s = ''; for (const x of u8) s += String.fromCharCode(x); await window.__fs('gravar', rel, { b64: btoa(s) }); } }; } });
    const dir = (rel, nome) => ({ kind: 'directory', name: nome, queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      async *values() { for (const e of (await window.__fs('lista', rel)) || []) yield e.dir ? dir(`${rel}/${e.nome}`, e.nome) : arq(`${rel}/${e.nome}`, e.nome); },
      getDirectoryHandle: async (n, o = {}) => { const r = `${rel}/${n}`, t = await window.__fs('existe', r); if (t === 'dir') return dir(r, n); if (!o.create) throw new DOMException('não existe', 'NotFoundError'); await window.__fs('mkdir', r); return dir(r, n); },
      getFileHandle: async (n, o = {}) => { const r = `${rel}/${n}`, t = await window.__fs('existe', r); if (!t && !o.create) throw new DOMException('não existe', 'NotFoundError'); return arq(r, n); },
      removeEntry: async n => window.__fs('apagar', `${rel}/${n}`) });
    window.__pastaRaiz = () => dir('.', 'Repasse Medico');
  }, [nome, semEspacoNoLocalStorage]);
  await p.goto(html + '#inicio');
  await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
  return p;
}
// Desde a alpha.19, conectar a pasta já lê os PDFs (e pode abrir o aviso do PDF de outra produção): não espera a leitura.
const arq = pasta + '02 - Repasse 2026/2026-11 - Novembro/02 - Não conformidades/nao_conformidades.json';
const lerArq = () => JSON.parse(fs.readFileSync(arq, 'utf8'));
const conectar = p => p.evaluate(() => window.__RM.t.definirPastaSync(window.__pastaRaiz()));
// Espera a sincronização em andamento (o gatilho automático de 800 ms) terminar e roda mais uma.
const sync = async p => { await p.clock.runFor(1500); await p.waitForFunction(() => !document.querySelector('#confSync') || !/Sincronizando/.test(document.querySelector('#confSync').textContent), null, { timeout: 10000 }).catch(() => {}); await p.evaluate(() => window.__RM.t.sincronizarConf({ interativo: true })); await p.clock.runFor(500); await p.evaluate(() => window.__RM.t.sincronizarConf({ interativo: true })); };
const estado = p => p.evaluate(() => { const { S } = window.__RM, c = S.compReg.itens['2026-11'] || {}; return { dec: (c.decisoes || []).map(d => `${d.justificativa}:${d.por}`), obs: (c.observacoes || []).map(o => `${o.texto}:${o.por}`), rod: S.rodadas.filter(r => r.id === 'rodT').map(r => r.aceite ? `aceite:${r.aceite.por}` : 'sem aceite') }; });
const ana = await usuario('Ana Teste'), leo = await usuario('Leo Teste');
await conectar(ana); await conectar(leo); await ana.waitForTimeout(300);
// 1) Ana decide uma linha, anota outra e aceita um relatório.
await ana.evaluate(() => { const { S, t } = window.__RM;
  t.registrarConsiderar(S.compReg, '2026-11', ['MV|teste|1'], 'laudo do mês seguinte', 'Ana Teste', {}); t.registrarObservacao(S.compReg, '2026-11', ['MV|teste|2'], 'conferir com a unidade', 'Ana Teste'); t.salvarCompReg();
  const r = { id: 'rodT', tipo: 'conferencia', em: '2026-11-17T10:00:00.000Z', chaveCompetencia: '2026-11', operador: 'Ana Teste', prestadorCod: '15', unidadeCod: '1', linhas: [], contagens: {} };
  t.aceitarRodada(r, 'Ana Teste', 'ok', 0); return t.guardarRodada(r); });
await sync(ana); await sync(leo);
const l1 = await estado(leo);
ok(l1.dec.join() === 'laudo do mês seguinte:Ana Teste', `a decisão da Ana chega ao Leo, com o nome dela (${l1.dec})`);
ok(l1.obs.join() === 'conferir com a unidade:Ana Teste', `a observação da Ana chega ao Leo (${l1.obs})`);
ok(l1.rod.join() === 'aceite:Ana Teste', `a rodada com o aceite da Ana chega ao Leo (${l1.rod})`);
ok(fs.existsSync(pasta + '02 - Repasse 2026/2026-11 - Novembro/conferencias_compartilhadas.json'), 'arquivo «conferencias_compartilhadas.json» na pasta do mês');
// 1b) Decisão sozinha não sincroniza (só o aceite ou «Atualizar agora»): a tela não trava a cada decisão.
const mt = () => fs.statSync(pasta + '02 - Repasse 2026/2026-11 - Novembro/conferencias_compartilhadas.json').mtimeMs;
await sync(ana); await sync(leo); await ana.clock.runFor(2000); await leo.clock.runFor(2000); await ana.waitForTimeout(500); const m0 = mt(); await sync(leo);
ok(mt() === m0, 'sincronizar sem mudança não regrava o arquivo (sem vaivém entre os dois)');
await ana.evaluate(() => { const { S, t } = window.__RM; t.registrarConsiderar(S.compReg, '2026-11', ['MV|teste|9'], 'só local por enquanto', 'Ana Teste', {}); t.salvarCompReg(); });
await ana.clock.runFor(5000); await ana.waitForTimeout(300);
ok(mt() === m0, 'uma decisão sozinha não grava na pasta (sem travar a tela)');
await ana.evaluate(() => { const { S, t } = window.__RM, c = S.compReg.itens['2026-11']; t.removerConsiderar(S.compReg, '2026-11', c.decisoes.find(d => d.justificativa === 'só local por enquanto').id); t.salvarCompReg(); });
// 2) Leo decide outra linha; Ana recebe. 3) Leo remove a decisão da Ana; some para os dois.
await leo.evaluate(() => { const { S, t } = window.__RM; t.registrarConsiderar(S.compReg, '2026-11', ['MV|teste|3'], 'convênio igual', 'Leo Teste', {}); t.salvarCompReg(); });
await sync(leo); await sync(ana);
const a2 = await estado(ana);
ok(a2.dec.sort().join('|') === 'convênio igual:Leo Teste|laudo do mês seguinte:Ana Teste', `cada um vê o que fez e o que o outro fez (${a2.dec.join(' | ')})`);
await leo.evaluate(() => { const { S, t } = window.__RM, c = S.compReg.itens['2026-11'], d = c.decisoes.find(x => x.por === 'Ana Teste'); t.removerConsiderar(S.compReg, '2026-11', d.id); t.salvarCompReg(); });
await sync(leo); await sync(ana);
ok((await estado(ana)).dec.join() === 'convênio igual:Leo Teste', '«Remover decisão» feito pelo Leo vale também para a Ana');
await leo.clock.fastForward(60000);
await leo.evaluate(() => { const { S, t } = window.__RM, r = S.rodadas.find(x => x.id === 'rodT'); t.desfazerAceiteRodada(r, 'Leo Teste', 'faltou NC'); return t.guardarRodada(r); });
await sync(leo); await sync(ana);
ok((await estado(ana)).rod.join() === 'sem aceite', 'desfazer o aceite (Leo) vale também para a Ana, com o histórico');
const aut = await leo.evaluate(() => window.__RM.t.syncConfEstado());
ok(aut.status === 'ok' && aut.autores.some(a => a.quem === 'Ana Teste' && a.rodadas === 1 && a.observacoes === 1 && a.aceites === 0) && aut.autores.some(a => a.quem === 'Leo Teste' && a.decisoes === 1), `a barra mostra quem fez o quê (${JSON.stringify(aut.autores)})`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
