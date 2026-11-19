// SOL-F45 (v3.0.0-alpha.17) — Excel único da unidade × grupo (pedido de 19/11/2026): com os relatórios de IMG da unidade
// filtrados na Conferência, «Conferir os N relatórios filtrados» e «Excel único» geram UMA planilha com todos os
// prestadores (aba Prestadores, linhas de todos na aba Conferência, o que falta decidir), gravada em
// «09 - Planilhas de repasse conferidos › IMG › unidade». A pasta 09 não é lida como planilha de laudos.
// Arquivos fictícios (TC na unidade 17), pasta da rede simulada.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/planilha_unidade/', pasta = out + 'rede/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(pasta, { recursive: true });
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const py = (codigo, ...args) => JSON.parse(execFileSync('python3', ['-I', '-c', codigo, ...args], { encoding: 'utf8' }) || 'null');
const b = await chromium.launch(), erros = [];
const seguro = p => { const r = path.resolve(pasta, p); if (!r.startsWith(path.resolve(pasta))) throw new Error('fora da pasta'); return r; };

// ---------- Arquivos fictícios: tomografia na unidade 17 (produção 10/2026, competência 11/2026) ----------
// DR A (21): 3 TC de crânio com laudo. DR B (22): 2 TC, uma sem laudo. DR C só laudou (sem relatório e sem cadastro).
const laudos = [
  ['ANA PAULA ROCHA', 3, 'DR A'], ['BRUNA LIMA COSTA', 4, 'DR A'], ['CARLA DIAS MOTA', 5, 'DR A'],
  ['DIEGO REIS LIMA', 6, 'DR B'], ['GUSTAVO MELO SA', 9, 'DR C'], ['HUGO PIRES NETO', 9, 'DR C']];
py(`import openpyxl,datetime,json,sys
wb=openpyxl.Workbook(); ws=wb.active
ws.append(['ID','BRANCH_NAME','PATIENT_ID','PATIENT_NAME','TITLE','STUDY_DATETIME','PATIENT_INSURANCE','MODALITY','NAME_MEDICO'])
for i,(p,d,m) in enumerate(json.loads(sys.argv[2])): ws.append([700+i,'AlphaSonic Palhano',300+i,p,'TC DE CRANIO',datetime.datetime(2026,10,d,9,30),'UNIMED','CT',m])
wb.save(sys.argv[1]); print('null')`, out + 'apolo_10-2026.xlsx', JSON.stringify(laudos));
const linhaMV = (n, pac, dia, vl) => `${123800 + n} ${2559500 + n} ${2224100 + n} ${pac} N CLINICO UNIMED ${String(dia).padStart(2, '0')}/10/26 1 0 ${vl},00 50,00 ${vl * 2},00`;
async function pdfMV(arq, cod, nome, linhas) {
  const tot = linhas.reduce((s, l) => s + l[3], 0), pg = await b.newPage();
  const L = [`Grupo de Repasse: ${cod} - ${nome}`, `Prestador: ${cod} - ${nome}`, `Repasse: 3${cod}0 Dt. Repasse: 10/11/2026 Descrição: REPASSE IMG 11/2026`, 'Grupo de Procedimento: 40 - TOMOGRAFIA', 'Procedimento: 41001010 - TC CRANIO',
    ...linhas.map(l => linhaMV(...l)), `Total do Procedimento: ${tot},00 ${tot * 2},00`, `Total do Grupo de Procedimento: ${tot},00 ${tot * 2},00`, `Total Geral do Repasse: ${tot},00 ${tot * 2},00`];
  await pg.setContent(`<body style="font:11px Arial">${L.map(l => `<div style="white-space:pre">${l}</div>`).join('')}</body>`); await pg.pdf({ path: out + arq }); await pg.close();
}
await pdfMV('mv_21_img_unidade_17.pdf', '21', 'DR A', [[1, 'ANA PAULA ROCHA', 3, 100], [2, 'BRUNA LIMA COSTA', 4, 100], [3, 'CARLA DIAS MOTA', 5, 100]]);
await pdfMV('mv_22_img_unidade_17.pdf', '22', 'DR B', [[4, 'DIEGO REIS LIMA', 6, 80], [5, 'ELIANE SOUZA BRAZ', 7, 80]]);

// ---------- Ferramenta com a pasta da rede simulada ----------
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }), p = await ctx.newPage();
await p.clock.install({ time: new Date('2026-11-19T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.exposeFunction('__fs', (op, rel, arg) => {
  const f = seguro(rel);
  if (op === 'lista') return fs.existsSync(f) ? fs.readdirSync(f, { withFileTypes: true }).map(d => ({ nome: d.name, dir: d.isDirectory() })) : null;
  if (op === 'existe') return fs.existsSync(f) ? (fs.statSync(f).isDirectory() ? 'dir' : 'arq') : '';
  if (op === 'mkdir') { fs.mkdirSync(f, { recursive: true }); return true; }
  if (op === 'ler') return fs.existsSync(f) ? { txt: fs.readFileSync(f, 'utf8'), lm: fs.statSync(f).mtimeMs, tam: fs.statSync(f).size } : null;
  if (op === 'lerb64') return fs.readFileSync(f).toString('base64');
  if (op === 'gravar') { fs.writeFileSync(f, arg.b64 ? Buffer.from(arg.b64, 'base64') : arg.txt); return true; }
  if (op === 'apagar') { fs.rmSync(f, { force: true }); return true; }
});
await p.addInitScript(() => {
  localStorage.setItem('rm2.operador', JSON.stringify('Teste Unidade'));
  const arq = (rel, nome) => ({ kind: 'file', name: nome,
    getFile: async () => { const r = await window.__fs('ler', rel); if (!r) throw new DOMException('não existe', 'NotFoundError'); return { name: nome, lastModified: r.lm, size: r.tam, text: async () => r.txt, arrayBuffer: async () => { const b = atob(await window.__fs('lerb64', rel)), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; } }; },
    createWritable: async () => { const partes = []; return { write: async d => { partes.push(d); }, close: async () => { const u8 = new Uint8Array(await new Blob(partes).arrayBuffer()); let s = ''; for (const x of u8) s += String.fromCharCode(x); await window.__fs('gravar', rel, { b64: btoa(s) }); } }; } });
  const dir = (rel, nome) => ({ kind: 'directory', name: nome, queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    async *values() { for (const e of (await window.__fs('lista', rel)) || []) yield e.dir ? dir(`${rel}/${e.nome}`, e.nome) : arq(`${rel}/${e.nome}`, e.nome); },
    getDirectoryHandle: async (n, o = {}) => { const r = `${rel}/${n}`, t = await window.__fs('existe', r); if (t === 'dir') return dir(r, n); if (!o.create) throw new DOMException('não existe', 'NotFoundError'); await window.__fs('mkdir', r); return dir(r, n); },
    getFileHandle: async (n, o = {}) => { const r = `${rel}/${n}`, t = await window.__fs('existe', r); if (!t && !o.create) throw new DOMException('não existe', 'NotFoundError'); return arq(r, n); },
    removeEntry: async n => window.__fs('apagar', `${rel}/${n}`) });
  window.__pastaRaiz = () => dir('.', 'Repasse Medico');
});
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
await p.evaluate(() => window.__RM.t.definirPastaSync(window.__pastaRaiz())); await p.waitForTimeout(500);
const okDlg = async (botao = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${botao}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };
const abas = arq => py(`import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1],read_only=True); r={}
for n in wb.sheetnames: r[n]=[[c for c in row] for row in wb[n].iter_rows(values_only=True)]
print(json.dumps(r,default=str))`, arq);

await p.setInputFiles('#inMV', [out + 'mv_21_img_unidade_17.pdf', out + 'mv_22_img_unidade_17.pdf']);
await p.waitForFunction(() => window.__RM.S.relatorios.length === 2, null, { timeout: 30000 });
await p.setInputFiles('#inApolo', out + 'apolo_10-2026.xlsx'); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 30000 });
await p.evaluate(() => { const { S, t } = window.__RM; S.eq.itens.push({ id: 'eqTC', codigo: '41001010', titulo: 'TC DE CRANIO', status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'Teste' }); t.salvarEq('Equivalência validada.'); });

// ---------- 1. Filtro unidade 17 · IMG: botões de lote e de Excel único ----------
await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar');
await p.selectOption('#cfFUn', '17'); await p.waitForTimeout(150);
await p.selectOption('#cfFGr', 'img'); await p.waitForTimeout(150);
ok(await p.isVisible('[data-cflote]') && await p.isVisible('[data-cfunica]'), `filtro unidade 17 · IMG mostra «${await p.textContent('[data-cflote]')}» e «${await p.textContent('[data-cfunica]')}»`);
await p.click('[data-cflote]'); await okDlg(); await p.waitForTimeout(500);
const rods = await p.evaluate(() => window.__RM.S.rodadas.filter(r => r.tipo === 'conferencia').map(r => `${r.prestadorCod}:${r.unidadeCod}`).sort());
ok(rods.join(' ') === '21:17 22:17', `lote: uma rodada por relatório (${rods.join(' · ')})`);
// Aceite do relatório do DR A (pela tela da conferência dele).
await p.evaluate(() => { const { S } = window.__RM; S.cfProximo = { relId: S.relatorios.find(x => x.rel.cab.prestadorCod === '21').id, unidadeCod: '17' }; });
await p.goto(html + '#inicio'); await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar');
await p.click('#cfRodar'); await p.waitForSelector('#cfAbas', { timeout: 15000 });
await p.click('#cfAba-aceite'); await p.waitForTimeout(100); await p.click('#cfAceitar'); await p.waitForTimeout(300); if (await p.isVisible('#dlg[open]')) await okDlg();

// ---------- 2. Excel único: baixado e gravado em 09 › IMG › unidade ----------
await p.selectOption('#cfFUn', '17'); await p.waitForTimeout(150); await p.selectOption('#cfFGr', 'img'); await p.waitForTimeout(150);
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-cfunica]')]); await dl.saveAs(out + 'baixado.xlsx');
await p.waitForTimeout(800);
const achar = (d, re) => { const r = []; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const c = path.join(d, e.name); if (e.isDirectory()) r.push(...achar(c, re)); else if (re.test(c)) r.push(c); } return r; };
const gravados = achar(pasta, /conferidos_img_unidade_17_comp_11-2026\.xlsx$/);
const rel = gravados.map(g => path.relative(pasta, g));
ok(dl.suggestedFilename() === 'conferidos_img_unidade_17_comp_11-2026.xlsx', `nome do arquivo: ${dl.suggestedFilename()}`);
ok(rel.length === 1 && /^02 - Repasse 2026\/2026-11 - Novembro\/09 - Planilhas de repasse conferidos\/IMG\/[^/]+\/conferidos_img_unidade_17_comp_11-2026\.xlsx$/.test(rel[0]), `gravado na pasta da competência: ${rel[0]}`);
const X = abas(gravados[0] || out + 'baixado.xlsx');
ok(['Prestadores', 'Conferência', 'O que falta decidir', 'Por procedimento', 'Informações'].every(n => X[n]), `abas: ${Object.keys(X).join(', ')}`);
const P = X['Prestadores'], cab = P[0], col = n => cab.indexOf(n);
const linha = cod => P.find(r => String(r[0]) === cod);
const A = linha('21'), B = linha('22'), tot = P.find(r => r[0] === 'TOTAL');
ok(A && A[col('Situação')] === 'Aceito' && +A[col('Para pagamento (Devido + Aceito)')] === 300 && +A[col('Linhas no MV')] === 3 && +A[col('Laudos no Apolo')] === 3, `DR A: ${A?.[col('Situação')]}, 3 linhas, 3 laudos, R$ ${A?.[col('Para pagamento (Devido + Aceito)')]} para pagamento`);
ok(B && /^Conferindo/.test(B[col('Situação')]) && +B[col('Para pagamento (Devido + Aceito)')] === 80 && +B[col('Pendente')] === 80 && +B[col('Total do MV (Vl Repasse)')] === 160, `DR B: ${B?.[col('Situação')]}, R$ ${B?.[col('Para pagamento (Devido + Aceito)')]} para pagamento e R$ ${B?.[col('Pendente')]} pendente de R$ ${B?.[col('Total do MV (Vl Repasse)')]}`);
ok(P.some(r => r[1] === 'DR C' && r[2] === 'Sem cadastro' && +r[4] === 2), 'DR C (laudou e não tem relatório) aparece com a situação de «Prestadores por unidade» e 2 laudos');
ok(tot && +tot[col('Para pagamento (Devido + Aceito)')] === 380 && +tot[col('Total do MV (Vl Repasse)')] === 460 && +tot[col('Linhas no MV')] === 5, `TOTAL da unidade: R$ ${tot?.[col('Para pagamento (Devido + Aceito)')]} para pagamento de R$ ${tot?.[col('Total do MV (Vl Repasse)')]} no MV`);
const C = X['Conferência'];
ok(C[0][0] === 'Cód. prestador' && C[0][1] === 'Prestador' && C.length - 1 === 5 && new Set(C.slice(1).map(r => String(r[0]))).size === 2, `aba Conferência: ${C.length - 1} linhas dos 2 prestadores, com o prestador nas 2 primeiras colunas`);
ok(X['O que falta decidir'].slice(1).some(r => String(r[0]) === '22' && r.includes('ELIANE SOUZA BRAZ')), 'o que falta decidir: a TC do DR B sem laudo, com o prestador');
ok(X['Informações'].some(r => r[0] === 'Grupo' && r[1] === 'IMG') && X['Informações'].some(r => r[0] === 'Unidade' && String(r[1]).startsWith('17')), 'Informações: unidade 17 · IMG');
ok(await p.evaluate(() => window.__RM.S.rodadas.filter(r => r.tipo === 'conferencia').length) === 3, 'gerar o Excel único não grava rodada nova');

// ---------- 3. Na aba «Prestadores por unidade», o mesmo botão ----------
await p.click('[data-cusub="unidades"]'); await p.waitForTimeout(200);
await p.click('[data-cuun="17"]'); await p.waitForTimeout(150);
if (await p.isVisible('[data-cugr="img"]')) { await p.click('[data-cugr="img"]'); await p.waitForTimeout(150); }
ok(await p.isVisible('[data-cuunica]') && /2 relatório/.test(await p.textContent('[data-cuunica]')), `Prestadores por unidade › unidade 17 · IMG: «${await p.textContent('[data-cuunica]')}»`);

// ---------- 4. A pasta 09 não é lida como planilha de laudos ----------
const apoloAntes = await p.evaluate(() => window.__RM.S.apolo.nome);
const r = await p.evaluate(() => window.__RM.t.atualizarDaPasta({ silencioso: true }));
ok(await p.evaluate(() => window.__RM.S.apolo.nome) === apoloAntes && (r?.avisos || []).some(a => /04 - Planilhas de conferência/.test(a)), `«Atualizar da pasta» sem a 04 não lê o Excel da 09 como laudos (${(r?.avisos || []).join('; ')})`);

ok(!erros.length, `sem erros na tela${erros.length ? ': ' + erros.join(' | ') : ''}`);
await b.close();
