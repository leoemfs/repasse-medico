// v3.0.0-alpha.11 — Pedidos de 17/11/2026, com pasta simulada e PDFs fictícios:
// 1. «Sincronizar pasta» em cada aba lê só a pasta dela (Conferência → Relatórios para conferência; Correção → Correção de prestador).
// 2. Correção de prestador sem subpastas por unidade: a unidade vem do nome do arquivo («nome_unidade»).
// 3. Fechamento: os avisos de prestadores por unidade ficam num alternante no fim da tela, com bolinha quando fechado.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', pasta = out + 'pasta_por_aba/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.rmSync(pasta, { recursive: true, force: true });
const comp = pasta + 'Competências/Comp_11-2026/', dirConf = comp + 'Relatórios para conferência/USG/Unidade 17 - ALPHASONIC LONDRINA/', dirCorr = comp + 'Correção de prestador/';
fs.mkdirSync(dirConf, { recursive: true }); fs.mkdirSync(dirCorr, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
let relogio = Date.parse('2026-11-17T10:00:00');
const seguro = p => { const r = path.resolve(pasta, p); if (!r.startsWith(path.resolve(pasta))) throw new Error('fora da pasta'); return r; };
async function pdfMV(arq, cod, nome, pac) {
  const pg = await b.newPage(), L = [`Grupo de Repasse: ${cod} - ${nome}`, `Prestador: ${cod} - ${nome}`, 'Repasse: 24001 Dt. Repasse: 10/11/2026 Descrição: REPASSE USG 11/2026', 'Grupo de Procedimento: 30 - ULTRASSONOGRAFIA', 'Procedimento: 40901173 - US TIREOIDE - OP',
    `122899 2549590 2214126 ${pac} N CLINICO UNIMED 10/10/26 1 0 10,00 50,00 20,00`, 'Total do Procedimento: 10,00 20,00', 'Total do Grupo de Procedimento: 10,00 20,00', 'Total Geral do Repasse: 10,00 20,00'];
  await pg.setContent(`<body style="font:11px Arial">${L.map(l => `<div style="white-space:pre">${l}</div>`).join('')}</body>`); await pg.pdf({ path: arq }); await pg.close();
}
await pdfMV(dirConf + '15.pdf', '15', 'DR X', 'ANA PAULA ROCHA');
await pdfMV(dirCorr + 'prestador generico_17.pdf', '2', 'PRESTADOR GENERICO', 'BRUNA LIMA COSTA');
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
const conectar = p => p.evaluate(() => window.__RM.t.definirPastaSync(window.__pastaRaiz()));
const p = await usuario('Teste Pasta');
await conectar(p);
// Estrutura: Correção de prestador sem subpastas por unidade.
const est = await p.evaluate(() => window.__RM.t.estruturaCompetencia('2026-11').map(c => c.map(x => typeof x === 'string' ? x : x.nome).join(' › ')).filter(t => /Correção de prestador/.test(t)));
ok(est.length === 1 && /Correção de prestador$/.test(est[0]), `estrutura da competência: só a pasta «Correção de prestador», sem subpastas (${est.join(' · ')})`);
const un = await p.evaluate(() => ['prestador generico_17.pdf', 'generico_Unidade 4.pdf', 'generico_un10.pdf', 'sem unidade.pdf'].map(n => window.__RM.t.unidadeDoArquivoCorrecao(n, '')));
ok(un[0] === '17' && un[1] === '4' && un[2] === '10' && un[3] === '', `unidade pelo nome do arquivo «nome_unidade»: ${un.join(', ')}`);
const porNome = await p.evaluate(() => { const u = window.__RM.S.cfg.unidades.find(x => x.cod === '4'); const nome = (u?.apolo?.[0] || u?.nome || '').split(' ').pop(); return [nome, window.__RM.t.unidadeDoArquivoCorrecao('generico_' + nome + '.pdf', '')]; });
ok(porNome[1] === '4', `unidade pelo nome dela no arquivo (generico_${porNome[0]}.pdf → ${porNome[1]})`);
// Correção: «Sincronizar pasta» lê só a Correção de prestador.
await p.goto(html + '#correcao'); await p.waitForTimeout(300);
ok(await p.isVisible('[data-syncpasta="correcao"]'), 'aba Correção de prestador tem «Sincronizar pasta» (pasta conectada, nenhum PDF ainda)');
await p.click('[data-syncpasta="correcao"]');
await p.waitForFunction(() => window.__RM.S.relatorios.length > 0, null, { timeout: 20000 }); await p.waitForTimeout(400);
const r1 = await p.evaluate(() => window.__RM.S.relatorios.map(x => `${x.rel.cab.prestadorCod}:${x.finalidade}:${x.unidadePasta}`));
ok(r1.length === 1 && r1[0] === '2:correcao:17', `lê só a pasta da Correção (${r1.join(' · ')}), com a unidade 17 tirada do nome do arquivo`);
ok(/Correção de prestador/.test(await p.textContent('#aviso')), `aviso diz que leu só a Correção de prestador (${(await p.textContent('#aviso')).slice(0, 80)})`);
// Conferência: lê só «Relatórios para conferência».
await p.goto(html + '#conferencia'); await p.waitForTimeout(300);
await p.click('[data-syncpasta="conferencia"]');
await p.waitForFunction(() => window.__RM.S.relatorios.length === 2, null, { timeout: 20000 }); await p.waitForTimeout(300);
const r2 = await p.evaluate(() => window.__RM.S.relatorios.map(x => `${x.rel.cab.prestadorCod}:${x.finalidade || 'conferencia'}:${x.unidadePasta}`).sort());
ok(r2.join(' ') === '15:conferencia:17 2:correcao:17', `Conferência lê «Relatórios para conferência» (${r2.join(' · ')})`);
// Fechamento: avisos no alternante, fechado, com bolinha.
await p.evaluate(() => { const { S } = window.__RM, d = new Date(Date.UTC(2026, 9, 10));
  S.apolo = { nome: 'apolo.xlsx', hash: 'h', laudos: ['DR Y', 'DR W'].map((m, i) => ({ i, linhaPlanilha: i + 2, idLaudo: String(i), unidade: 'AlphaSonic Palhano', paciente: 'P ' + i, pn: 'P ' + i, idPac: String(i), titulo: 'USG TIREOIDE', tn: 'USG TIREOIDE', descricao: '', data: d, dia: Math.round(d / 864e5), convenio: 'UNIMED', modalidade: 'US', medico: m, mn: m })) };
  for (const [c, n] of [['31', 'DR Y'], ['32', 'DR W']]) S.cfg.prestadores.push({ cod: c, nomeMV: n, aliases: [], naoRealizaRepasse: false, regras: {} }); });
await p.goto(html + '#fechamento'); await p.waitForSelector('#fhCorpo', { timeout: 15000 }); await p.waitForTimeout(300);
const fh = await p.evaluate(() => { const d = document.getElementById('fhAvisos'), pg = document.getElementById('pag-fechamento'); return d ? { aberto: d.open, bolinha: d.querySelector('.bolinha')?.textContent, depoisDoCorpo: !!(document.getElementById('fhCorpo').compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING), ultimo: pg.lastElementChild === d } : null; });
ok(fh && !fh.aberto && +fh.bolinha > 0, `avisos num alternante fechado, com bolinha (${fh?.bolinha} aviso[s])`);
ok(fh?.depoisDoCorpo && fh?.ultimo, 'alternante no fim da tela, depois do conteúdo do fechamento');
await p.click('#fhAvisos summary'); await p.waitForTimeout(150);
ok(await p.evaluate(() => document.getElementById('fhAvisos').open && /laudaram/.test(document.getElementById('fhAvisos').textContent)), 'aberto, mostra os avisos');
await p.screenshot({ path: out + 'fechamento_avisos.png', fullPage: true });
await p.evaluate(() => window.__RM.irPara('nc')); await p.evaluate(() => window.__RM.irPara('fechamento')); await p.waitForTimeout(300);
ok(await p.evaluate(() => document.getElementById('fhAvisos')?.open), 'a escolha (aberto) fica lembrada ao voltar');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
