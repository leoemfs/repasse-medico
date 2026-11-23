// v3.0.0-alpha.8 — PDF de outra produção lido da pasta: o aviso mostra onde o arquivo está e «Ignorar este arquivo» é
// lembrado (antes, «Cancelar» valia só até recarregar e o aviso voltava a cada abertura). PDF fictício gerado no teste.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', pasta = out + 'pasta_ignorados/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.rmSync(pasta, { recursive: true, force: true });
const dirPDF = pasta + 'Competências/Comp_11-2026/Relatórios para conferência/USG/Unidade 1 - ULTRAMED APUCARANA (HPA)/';
fs.mkdirSync(dirPDF, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
let relogio = Date.parse('2026-11-17T10:00:00');
const seguro = p => { const r = path.resolve(pasta, p); if (!r.startsWith(path.resolve(pasta))) throw new Error('fora da pasta'); return r; };
// PDF do MV (produção 02/2026), no formato do relatório, impresso pelo próprio Chromium.
{ const pg = await b.newPage(); const L = ['Grupo de Repasse: 7873 - MEDICO TESTE', 'Prestador: 7873 - MEDICO TESTE', 'Repasse: 24001 Dt. Repasse: 10/03/2026 Descrição: REPASSE USG 03/2026', 'Grupo de Procedimento: 30 - ULTRASSONOGRAFIA', 'Procedimento: 40901173 - US TIREOIDE - OP',
  '122899 2549590 2214126 PACIENTE FICTICIO UM N CLINICO UNIMED 10/02/26 1 0 10,00 50,00 20,00', 'Total do Procedimento: 10,00 20,00', 'Total do Grupo de Procedimento: 10,00 20,00', 'Total Geral do Repasse: 10,00 20,00'];
  await pg.setContent(`<body style="font:11px Arial">${L.map(l => `<div style="white-space:pre">${l}</div>`).join('')}</body>`); await pg.pdf({ path: dirPDF + '7873.pdf' }); await pg.close(); }
async function usuario(nome, { semEspacoNoLocalStorage = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-11-10T10:00:00') });
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
const conectar = p => p.evaluate(() => { window.__fim = false; window.__RM.t.definirPastaSync(window.__pastaRaiz()).then(() => { window.__fim = true; }); });
const atualizar = p => p.evaluate(() => { window.__fim = false; window.__RM.t.atualizarDaPasta().then(() => { window.__fim = true; }); });
const ana = await usuario('Ana Teste');
await ana.evaluate(() => { window.__avisos = []; new MutationObserver(() => window.__avisos.push(document.getElementById('aviso').textContent)).observe(document.getElementById('aviso'), { childList: true, characterData: true, subtree: true }); });
await conectar(ana);
await ana.waitForSelector('#dlg[open]', { timeout: 20000 }).catch(async () => console.log('DEBUG', await ana.evaluate(() => [document.getElementById('aviso').textContent, window.__avisos, window.__fim]), erros));
const txt = await ana.textContent('#dlgCorpo');
ok(/produção\s*02\/2026/.test(txt) && /Comp_11-2026 › Relatórios para conferência › USG › Unidade 1/.test(txt), `o aviso mostra a produção e onde o arquivo está (${txt.replace(/\s+/g, ' ').match(/Onde está:[^.]*/)?.[0]})`);
await ana.click('#dlgBotoes button[value="ignorar"]'); await ana.waitForFunction(() => window.__fim, null, { timeout: 20000 });
ok(await ana.evaluate(() => !window.__RM.S.relatorios.length), 'ignorado: o PDF não entra na sessão');
// Recarregar: lê a pasta de novo e não pergunta.
await ana.reload(); await ana.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
await conectar(ana); await ana.waitForFunction(() => window.__fim, null, { timeout: 20000 });
ok(!(await ana.isVisible('#dlg[open]')) && /1 ignorado/.test(await ana.textContent('#aviso')), `depois de recarregar, não pergunta de novo (${(await ana.textContent('#aviso')).slice(0, 90)})`);
// O arquivo muda (nova versão do PDF): volta a perguntar.
fs.utimesSync(dirPDF + '7873.pdf', new Date(), new Date('2026-11-17T12:00:00'));
await atualizar(ana); await ana.waitForSelector('#dlg[open]', { timeout: 20000 });
ok(true, 'arquivo mudou na pasta: volta a perguntar');
await ana.click('#dlgBotoes button[value=""]'); await ana.waitForFunction(() => window.__fim, null, { timeout: 20000 });
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
