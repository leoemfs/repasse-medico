// v3.0.0-alpha.29 — SOL-F18: não conformidades compartilhadas pela pasta da rede, com duas pessoas (Ana e Leo) e
// pasta simulada. Um arquivo por competência na «02 - Não conformidades»; mescla de três vias; conflito com escolha;
// exclusão e registro em dobro; competências separadas. Dados fictícios.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', pasta = out + 'nc_sync/';
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
const sync = (p, interativo = false) => p.evaluate(i => { window.__fimNC = false; window.__RM.t.sincronizarNC({ interativo: i }).then(() => { window.__fimNC = true; }); }, interativo);
const fim = p => p.waitForFunction(() => window.__fimNC, null, { timeout: 20000 });
const ncs = p => p.evaluate(() => window.__RM.S.nc.itens.filter(x => x.competencia === '2026-11').map(x => `${x.paciente}:${x.situacao}`).sort().join(' '));
const registrar = (p, paciente, comp = '2026-11') => p.evaluate(([paciente, comp]) => { const { S, t } = window.__RM; t.registrarNCs(S.nc, [{ categoria: 'convenio', natureza: 'nao-lancado', competencia: comp, paciente, data: '2026-10-05', titulo: 'USG TIREOIDE', unidade: 'AlphaSonic Palhano' }], window.__RM.S.operador); }, [paciente, comp]);
const ana = await usuario('Ana Teste'), leo = await usuario('Leo Teste');
await conectar(ana); await conectar(leo); await ana.waitForTimeout(300);
// 1) Ana registra duas NCs (uma de outra competência) e sincroniza.
await registrar(ana, 'ANA PAULA ROCHA'); await registrar(ana, 'OUTUBRO', '2026-10'); await sync(ana); await fim(ana);
ok(fs.existsSync(arq) && lerArq().itens.length === 1 && lerArq().atualizadoPor === 'Ana Teste', 'NC da Ana gravada em «2026-11 - Novembro › 02 - Não conformidades › nao_conformidades.json», com quem gravou');
ok(!lerArq().itens.some(x => x.competencia !== '2026-11'), 'o arquivo da competência leva só as NCs dela (a de 10/2026 fica fora)');
// 2) Leo recebe; muda a situação; Ana recebe.
await sync(leo); await fim(leo);
ok(await ncs(leo) === 'ANA PAULA ROCHA:aberta', `Leo recebe a NC da Ana (${await ncs(leo)})`);
await leo.evaluate(() => { const { S } = window.__RM, x = S.nc.itens.find(y => y.paciente === 'ANA PAULA ROCHA'); x.situacao = 'enviada'; x.historico.push({ em: new Date().toISOString(), por: 'Leo Teste', acao: 'Aberta → Enviada' }); });
await sync(leo); await fim(leo); await sync(ana); await fim(ana);
ok(await ncs(ana) === 'ANA PAULA ROCHA:enviada', `a mudança do Leo chega à Ana (${await ncs(ana)})`);
// 3) Os dois mudam a mesma NC de jeito diferente: a Ana escolhe (e o histórico das duas fica).
await leo.evaluate(() => { const x = window.__RM.S.nc.itens.find(y => y.paciente === 'ANA PAULA ROCHA'); x.situacao = 'tratativa'; x.historico.push({ em: '2026-11-17T11:00:00.000Z', por: 'Leo Teste', acao: 'Enviada → Em tratativa' }); });
await sync(leo); await fim(leo);
await ana.evaluate(() => { const x = window.__RM.S.nc.itens.find(y => y.paciente === 'ANA PAULA ROCHA'); x.situacao = 'regularizada'; x.historico.push({ em: '2026-11-17T11:05:00.000Z', por: 'Ana Teste', acao: 'Enviada → Regularizada' }); });
await sync(ana); await fim(ana);
ok(await ana.evaluate(() => window.__RM.t.syncNCEstado().status) === 'conflito', 'mudança dos dois na mesma NC: conflito (sem decidir sozinho, fora da tela de NCs)');
await sync(ana, true); await ana.waitForSelector('#dlg[open]');
ok(/alteradas pelos dois/.test(await ana.textContent('#dlgTitulo')) && /Em tratativa/.test(await ana.textContent('#dlgCorpo')), 'o diálogo mostra a versão de cada um');
await ana.check('#dlgCorpo input[name="c0"][value="remoto"]'); await ana.click('#dlgBotoes button[value="ok"]'); await fim(ana);
const hist = await ana.evaluate(() => window.__RM.S.nc.itens.find(y => y.paciente === 'ANA PAULA ROCHA').historico.map(h => h.por).join(','));
ok(await ncs(ana) === 'ANA PAULA ROCHA:tratativa' && /Ana Teste/.test(hist) && /Leo Teste/.test(hist), `escolhida a do Leo; o histórico das duas fica (${hist})`);
await sync(leo); await fim(leo);
ok(await ncs(leo) === 'ANA PAULA ROCHA:tratativa' && lerArq().itens.length === 1, 'os dois ficam com a mesma versão');
// 4) Os dois registram a mesma NC antes de sincronizar: fica uma só.
await registrar(ana, 'BRUNA LIMA COSTA'); await registrar(leo, 'BRUNA LIMA COSTA');
await sync(ana); await fim(ana); await sync(leo); await fim(leo); await sync(ana); await fim(ana);
ok(await ncs(ana) === 'ANA PAULA ROCHA:tratativa BRUNA LIMA COSTA:aberta' && await ncs(leo) === await ncs(ana), `mesma NC registrada pelos dois: fica uma (${await ncs(leo)})`);
// 5) Leo exclui uma NC: sai também para a Ana.
await leo.evaluate(() => { const { S } = window.__RM; S.nc.itens = S.nc.itens.filter(x => x.paciente !== 'BRUNA LIMA COSTA'); });
await sync(leo); await fim(leo); await sync(ana); await fim(ana);
ok(await ncs(ana) === 'ANA PAULA ROCHA:tratativa', 'NC excluída pelo Leo sai também da Ana');
// 6) Gravar pela tela agenda a sincronização sozinha; a aba de NCs mostra a barra.
await registrar(ana, 'CARLA DIAS MOTA'); await ana.evaluate(() => window.__RM.t.salvarNC('NC registrada.'));
await ana.waitForFunction(() => window.__RM.t.syncNCEstado().ocupado === false && window.__RM.S.nc.itens.some(x => x.paciente === 'CARLA DIAS MOTA'), null, { timeout: 5000 });
await ana.waitForTimeout(1500);
ok(lerArq().itens.some(x => x.paciente === 'CARLA DIAS MOTA'), 'salvar NC pela tela agenda a sincronização (chega ao arquivo sozinha)');
await ana.evaluate(() => window.__RM.irPara('nc')); await ana.waitForSelector('#ncSync');
ok(/NCs sincronizadas/.test(await ana.textContent('#ncSync')), `aba de NCs com a barra de sincronização (${(await ana.textContent('#ncSync')).slice(0, 40)})`);
await ana.screenshot({ path: out + 'nc_sync.png' });
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
