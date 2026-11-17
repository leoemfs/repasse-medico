// v3.0.0-alpha.14 — Estrutura padronizada das pastas (pedido de 17/11/2026), com pasta simulada e arquivos fictícios:
// 01 - Sistema (arquivos permanentes), um ano por pasta, 12 competências com a mesma estrutura; leitura da nova e da
// antiga; nada apagado, renomeado ou sobrescrito; pastas da equipe (Repasse 20%…) fora.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', pasta = out + 'estrutura_pastas/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.rmSync(pasta, { recursive: true, force: true }); fs.mkdirSync(pasta, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
let relogio = Date.parse('2026-11-17T10:00:00');
const seguro = p => { const r = path.resolve(pasta, p); if (!r.startsWith(path.resolve(pasta))) throw new Error('fora da pasta'); return r; };
async function pdfMV(arq, cod, nome, pac) {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const pg = await b.newPage(), L = [`Grupo de Repasse: ${cod} - ${nome}`, `Prestador: ${cod} - ${nome}`, 'Repasse: 24001 Dt. Repasse: 10/11/2026 Descrição: REPASSE USG 11/2026', 'Grupo de Procedimento: 30 - ULTRASSONOGRAFIA', 'Procedimento: 40901173 - US TIREOIDE - OP',
    `122899 2549590 2214126 ${pac} N CLINICO UNIMED 10/10/26 1 0 10,00 50,00 20,00`, 'Total do Procedimento: 10,00 20,00', 'Total do Grupo de Procedimento: 10,00 20,00', 'Total Geral do Repasse: 10,00 20,00'];
  await pg.setContent(`<body style="font:11px Arial">${L.map(l => `<div style="white-space:pre">${l}</div>`).join('')}</body>`); await pg.pdf({ path: arq }); await pg.close();
}
// Estrutura antiga parcial: as equivalências ainda na raiz (antes da mudança manual).
fs.mkdirSync(pasta + 'Equivalência TUSS (sincronização)', { recursive: true });
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
const p = await usuario('Teste Pastas');
await p.evaluate(() => window.__RM.t.definirPastaSync(window.__pastaRaiz())); await p.waitForTimeout(500);
const existe = c => fs.existsSync(pasta + c);
// 1) Arquivos permanentes em 01 - Sistema; o que ainda está no lugar antigo continua sendo usado (nada se divide).
ok(existe('01 - Sistema/Configurações compartilhadas/configuracao.json'), 'configuração compartilhada gravada em «01 - Sistema › Configurações compartilhadas»');
ok(existe('Equivalência TUSS (sincronização)/equivalencias.json') && !existe('01 - Sistema/Equivalências TUSS'), 'equivalências continuam na pasta antiga enquanto ela existir (não cria a nova vazia ao lado)');
const v = await p.evaluate(() => window.__RM.t.verificarEstrutura('2026-11'));
ok(v.sistemaAntigo.some(x => x.k === 'eq' && /01 - Sistema › Equivalências TUSS/.test(x.para)), 'a ferramenta aponta o que mover: «Equivalência TUSS (sincronização)» → «01 - Sistema › Equivalências TUSS»');
// 2) «Criar pastas de 2027»: 12 competências com a mesma estrutura.
await p.evaluate(() => { window.__fimCriar = false; window.__RM.t.criarEstruturaAno(2027).then(() => { window.__fimCriar = true; }); });
await p.waitForSelector('#dlg[open]'); await p.click('#dlgBotoes button[value="ok"]'); await p.waitForFunction(() => window.__fimCriar, null, { timeout: 60000 });
const ano = '03 - Repasse 2027/';
const meses = fs.readdirSync(pasta + ano).sort();
ok(meses.length === 12 && meses[0] === '2027-01 - Janeiro' && meses[2] === '2027-03 - Março' && meses[11] === '2027-12 - Dezembro', `«03 - Repasse 2027» com as 12 competências (${meses[0]} … ${meses[11]})`);
const mar = ano + '2027-03 - Março/';
ok(fs.readdirSync(pasta + mar).sort().join('|') === '01 - Correção de prestador|02 - Não conformidades|03 - NFS para pagamento|04 - Planilhas de conferência|05 - Relatórios de repasse MV|06 - Relatórios de prestadores conferidos|07 - Mutirão unidades|08 - Repasse final', 'cada competência com as pastas 01 a 08');
ok(fs.readdirSync(pasta + mar + '03 - NFS para pagamento').sort().join('|') === 'Pagamento 15|Pagamento 30', 'NFS para pagamento › Pagamento 15 | Pagamento 30');
const rel = fs.readdirSync(pasta + mar + '05 - Relatórios de repasse MV').sort(), usg = fs.readdirSync(pasta + mar + '05 - Relatórios de repasse MV/USG');
ok(rel.join('|') === 'Curitiba|IMG|USG' && usg.length >= 5 && usg.every(n => !/^Unidade \\d/.test(n)) && usg.includes('Alphasonic Londrina'), `05 › USG | IMG por unidade (${usg.slice(0, 4).join(', ')}…) e Curitiba; sem as pastas da equipe (20%, 25%)`);
ok(fs.readdirSync(pasta + mar + '05 - Relatórios de repasse MV/Curitiba').sort().join('|') === 'Prestadores SRA|Prestadores Unidade', 'Curitiba › Prestadores Unidade | Prestadores SRA');
ok(fs.readdirSync(pasta + mar + '06 - Relatórios de prestadores conferidos').length === 5, '06 › Repasse Ecodoppler, Sedação, IMG, Curitiba e USG');
ok(existe('01 - Sistema/Backups') && existe('01 - Sistema/Bases compartilhadas') && existe('01 - Sistema/Outros arquivos permanentes do sistema') && !existe('01 - Sistema/Equivalências TUSS'), '01 - Sistema completa, sem duplicar o que ainda está no lugar antigo');
// Criar de novo não duplica nada.
await p.evaluate(() => window.__RM.t.criarEstruturaAno(2027)); await p.waitForTimeout(800);
ok(!(await p.isVisible('#dlg[open]')) && fs.readdirSync(pasta + ano).length === 12, 'criar de novo: «as pastas já existem», nada duplicado');
// 3) Leitura da estrutura nova: USG por nome da unidade, Curitiba, correção «nome_unidade»; pasta da equipe ignorada.
const mes = '02 - Repasse 2026/2026-11 - Novembro/05 - Relatórios de repasse MV/';
await pdfMV(pasta + mes + 'USG/Alphasonic Londrina/15.pdf', '15', 'DR X', 'ANA PAULA ROCHA');
await pdfMV(pasta + mes + 'Curitiba/Prestadores SRA/31.pdf', '31', 'DR V3', 'BRUNA LIMA COSTA');
await pdfMV(pasta + mes + 'Repasse 20%/paulo.pdf', '40', 'DR PAULO', 'CARLA DIAS MOTA');
await pdfMV(pasta + '02 - Repasse 2026/2026-11 - Novembro/01 - Correção de prestador/generico_17.pdf', '2', 'PRESTADOR GENERICO', 'DORA NUNES PIRES');
await p.evaluate(() => { window.__fim = false; window.__RM.t.atualizarDaPasta({ silencioso: true }).then(() => { window.__fim = true; }); }); await p.waitForFunction(() => window.__fim, null, { timeout: 30000 });
const rels = await p.evaluate(() => window.__RM.S.relatorios.map(x => `${x.rel.cab.prestadorCod}:${x.grupoPasta || '-'}:${x.unidadePasta}:${x.finalidade || 'conferencia'}`).sort());
ok(rels.join(' ') === '15:usg:17:conferencia 2:-:17:correcao 31:curitiba:5:conferencia', `lê a estrutura nova: USG › Alphasonic Londrina = unidade 17, Curitiba = V3, correção pelo nome (${rels.join(' · ')})`);
ok(!rels.some(r => r.startsWith('40:')), '«Repasse 20%» (pasta da equipe) não é lida');
// Pacote .zip da competência com os mesmos nomes da estrutura padronizada.
await p.evaluate(() => window.__RM.irPara('inicio')); await p.waitForSelector('#compPacote');
const [dz] = await Promise.all([p.waitForEvent('download'), p.click('#compPacote')]); await dz.saveAs(out + 'estrutura_pacote.zip');
const nz = execFileSync('python3', ['-I', '-c', 'import zipfile,sys; print("\\n".join(sorted(zipfile.ZipFile(sys.argv[1]).namelist())))', out + 'estrutura_pacote.zip']).toString();
ok(dz.suggestedFilename() === '2026-11 - Novembro.zip' && /2026-11 - Novembro\/05 - Relatórios de repasse MV\/USG\/Alphasonic Londrina\/medico_15_/.test(nz) && /2026-11 - Novembro\/05 - Relatórios de repasse MV\/Curitiba\/medico_31_/.test(nz) && /2026-11 - Novembro\/01 - Correção de prestador\/relatorio_correcao_prestador_17\.pdf/.test(nz),
  `pacote .zip com os nomes padronizados (${dz.suggestedFilename()})`);
// 4) Gravação: NCs em «02 - Não conformidades»; nunca sobrescreve.
const n1 = await p.evaluate(async () => { const t = window.__RM.t; return [await t.entregarArquivo(new Blob(['a']), 'teste.xlsx', 'nc', '2026-11'), await t.entregarArquivo(new Blob(['bb']), 'teste.xlsx', 'nc', '2026-11')]; });
const ncDir = pasta + '02 - Repasse 2026/2026-11 - Novembro/02 - Não conformidades/';
ok(n1.join() === 'pasta,pasta' && fs.readdirSync(ncDir).sort().join('|') === 'teste (2).xlsx|teste.xlsx' && fs.readFileSync(ncDir + 'teste.xlsx', 'utf8') === 'a', 'NCs gravadas em «02 - Não conformidades»; mesmo nome não sobrescreve (« (2)»)');
ok(existe('Equivalência TUSS (sincronização)'), 'nada da estrutura antiga foi apagado');
// Tela: árvore da estrutura em Configurações → Pastas.
await p.evaluate(() => window.__RM.irPara('configuracoes')); await p.locator('[data-cfsub="pastas"]:visible').click(); await p.waitForSelector('#cardEstrutura');
ok(/02 - Repasse 2026/.test(await p.textContent('#cardEstrutura')) && /Guia: mudar da estrutura antiga/.test(await p.textContent('#cardEstrutura')), 'Configurações → Pastas: árvore padronizada e guia de mudança');
await p.screenshot({ path: out + 'estrutura_pastas.png', fullPage: true });
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
