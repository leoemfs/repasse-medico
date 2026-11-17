// v3.0.0-alpha.10 — P1 da auditoria de 16/11/2026. Dados fictícios (PDFs do MV impressos pelo próprio Chromium).
// 1. Reconferir em um clique: carrega o PDF novo e confere de novo com a mesma unidade, médico e aba.
// 2. Excel com «Processando…» e «Exportar só o filtrado».
// 3. Candidatos a NC: só o escopo do prestador quando a conferência roda com todos os médicos, e guardados compactos.
// 4. Rodadas: retenção (as substituídas ficam resumidas, a com aceite fica inteira), leitura por competência e backup
//    só da competência; base antiga (IndexedDB v2) ganha o índice sem perder rodadas.
import { createRequire } from 'module';
import fs from 'fs';
import { execFileSync } from 'child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/p1/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];

// PDFs do MV (produção 10/2026, prestador 15 - DR X): o 1º sem a Carla, o 2º com ela (o MV lançou depois).
const linhaMV = (n, pac, dia, vl) => `${122800 + n} ${2549500 + n} ${2214100 + n} ${pac} N CLINICO UNIMED ${String(dia).padStart(2, '0')}/10/26 1 0 ${vl},00 50,00 ${vl * 2},00`;
async function pdfMV(arq, linhas) {
  const tot = linhas.reduce((s, l) => s + l[3], 0), pg = await b.newPage();
  const L = ['Grupo de Repasse: 15 - DR X', 'Prestador: 15 - DR X', 'Repasse: 25022 Dt. Repasse: 10/11/2026 Descrição: REPASSE USG 11/2026', 'Grupo de Procedimento: 30 - ULTRASSONOGRAFIA', 'Procedimento: 40901173 - US TIREOIDE - OP',
    ...linhas.map(l => linhaMV(...l)), `Total do Procedimento: ${tot},00 ${tot * 2},00`, `Total do Grupo de Procedimento: ${tot},00 ${tot * 2},00`, `Total Geral do Repasse: ${tot},00 ${tot * 2},00`];
  await pg.setContent(`<body style="font:11px Arial">${L.map(l => `<div style="white-space:pre">${l}</div>`).join('')}</body>`); await pg.pdf({ path: out + arq }); await pg.close();
}
await pdfMV('mv1.pdf', [[1, 'ANA PAULA ROCHA', 3, 10], [2, 'BRUNA LIMA COSTA', 4, 20]]);
await pdfMV('mv2.pdf', [[1, 'ANA PAULA ROCHA', 3, 10], [2, 'BRUNA LIMA COSTA', 4, 20], [3, 'CARLA DIAS MOTA', 5, 30]]);

const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.clock.install({ time: new Date('2026-11-17T10:00:00') });
await p.addInitScript(() => {
  localStorage.setItem('rm2.operador', JSON.stringify('Teste P1'));
  // Simula a base da alpha.9: IndexedDB v2 com uma rodada antiga (sem «comp») de 09/2026, criada antes da página abrir.
  if (!sessionStorage.getItem('p1-v2')) {
    sessionStorage.setItem('p1-v2', '1');
    const rq = indexedDB.open('repasse-medico-v2', 2);
    rq.onupgradeneeded = () => { const db = rq.result; for (const n of ['rodadas', 'arquivos']) db.createObjectStore(n, { keyPath: 'id' }); };
    rq.onsuccess = () => { const tx = rq.result.transaction('rodadas', 'readwrite'); tx.objectStore('rodadas').put({ id: 'rod-antiga', tipo: 'conferencia', em: '2026-09-20T10:00:00.000Z', chaveCompetencia: '2026-09', prestadorCod: '15', prestadorNome: 'DR X', unidadeCod: '17', arquivos: [], contagens: {}, versoes: {}, linhas: [{ kd: 'M|1|2|3|2026-08-01', estado: 'conferido', vlRepasse: 5 }] }); tx.oncomplete = () => rq.result.close(); };
  }
});
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const okDlg = async (botao = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${botao}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };

// ---------- 4a. Base antiga: índice criado, rodada preservada, fora da janela da competência 11/2026 ----------
const v2 = await p.evaluate(async () => { const t = window.__RM.t, todas = await t.dbTodas(), jan = await t.dbRodadasJanela('2026-11'), so = await t.dbRodadasJanela('2026-09', true); return { todas: todas.map(r => `${r.id}:${r.comp}`), jan: jan.map(r => r.id), so: so.map(r => r.id) }; });
ok(v2.todas.includes('rod-antiga:2026-09'), `base v2 atualizada para v3: a rodada antiga continua e ganhou a competência no índice (${v2.todas.join(', ')})`);
ok(v2.jan.includes('rod-antiga') && v2.so.includes('rod-antiga'), 'janela de 11/2026 (4 antes, 1 depois) e a leitura só de 09/2026 encontram a rodada pelo índice');

await p.setInputFiles('#inMV', out + 'mv1.pdf');
await p.waitForFunction(() => window.__RM.S.relatorios.length === 1, null, { timeout: 20000 });
// Relatório 1 (montado na sessão como o Início faz), laudos do Apolo e equivalência validada.
await p.evaluate(() => {
  const { S } = window.__RM, d = n => new Date(Date.UTC(2026, 9, n)), dia = n => Math.round(d(n) / 864e5);
  const L = (i, pac, titulo, n, med = 'DR X') => ({ i, linhaPlanilha: i + 2, idLaudo: String(700 + i), unidade: 'AlphaSonic Palhano', paciente: pac, pn: pac, idPac: String(i), titulo, tn: titulo, descricao: '', data: d(n), dia: dia(n), convenio: 'UNIMED', modalidade: 'US', medico: med, mn: med });
  S.apolo = { nome: 'apolo.xlsx', hash: 'h', laudos: [L(0, 'ANA PAULA ROCHA', 'USG TIREOIDE', 3), L(1, 'BRUNA LIMA COSTA', 'USG TIREOIDE', 4), L(2, 'CARLA DIAS MOTA', 'USG TIREOIDE', 5),
    ...Array.from({ length: 6 }, (_, k) => L(10 + k, `OUTRO PACIENTE ${k}`, 'USG TIREOIDE', 6 + k, 'DR Y'))] };
  S.eq.itens.push({ id: 'eqP1', codigo: '40901173', titulo: 'USG TIREOIDE', status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'T' });
  if (!S.cfg.prestadores.some(x => String(x.cod) === '15')) S.cfg.prestadores.push({ cod: '15', nomeMV: 'DR X', aliases: [], naoRealizaRepasse: false, regras: {} });
});
await p.evaluate(() => { const x = window.__RM.S.relatorios[0]; x.unidadePasta = '17'; window.__RM.irPara('conferencia'); });
await p.waitForSelector('#cfRodar'); await p.selectOption('#cfUn', '17').catch(() => {}); await p.waitForTimeout(150);

// ---------- 3. Candidatos: todos os médicos da unidade, mas guardados só os do prestador ----------
await p.selectOption('#cfMed', '*'); await p.click('#cfRodar'); await p.waitForSelector('#cfAbas', { timeout: 15000 }); await p.waitForTimeout(200);
const cand = await p.evaluate(() => {
  const { S } = window.__RM, f = S.nc.candidatos.find(x => x.chave === S.conf.ctx.fonteNC);
  const tabelaSL = S.conf.res.linhas.filter(x => !x.r && x.status === 'so-laudo').map(x => x.l.medico);
  return { n: f.itens.length, fora: f.fora || 0, meds: f.itens.map(c => c.campos.medico), semOrigem: f.itens.every(c => !c.origem && c.competencia === undefined), comum: !!f.comum?.origem?.rodadaId, sl: tabelaSL };
});
ok(cand.sl.filter(m => m === 'DR Y').length === 6 && cand.sl.includes('DR X'), `a tabela continua com todos os «Só no laudo» da unidade (${cand.sl.length}, 6 do DR Y)`);
ok(cand.fora === 6 && !cand.meds.includes('DR Y') && cand.meds.includes('DR X'), `candidatos guardados: só os do prestador (${cand.n}); ${cand.fora} de outro médico ficaram fora do escopo`);
ok(cand.semOrigem && cand.comum, 'candidatos compactos: origem e competência guardadas uma vez na análise');
await p.click('#cfAba-nc'); await p.waitForTimeout(100);
ok(/6 laudo\(s\) «Só no laudo» de outros médicos/.test(await p.textContent('[data-cfsec="nc"]')), 'o cartão dos candidatos diz quantos ficaram fora do escopo');
// O candidato guardado (compacto) volta inteiro para o registro da NC.
const reg = await p.evaluate(() => {
  const { S, t } = window.__RM, f = S.nc.candidatos.find(x => x.chave === S.conf.ctx.fonteNC), c = t.expandirCandidatoNC(f.itens.find(x => x.campos.paciente === 'CARLA DIAS MOTA'), f);
  const d = t.dadosDoCandidato(c, { natureza: 'nao-lancado', competencia: S.comp });
  return { rod: d.origem.rodadaId === S.conf.ctx.rodadaId, comp: c.competencia === S.comp || !!c.competencia, chaves: d.origem.chavesLinha.length };
});
ok(reg.rod && reg.comp && reg.chaves === 1, 'candidato compacto expandido tem origem (rodada), competência e chave do laudo para registrar a NC');
// Tamanho: 2.000 candidatos com o motivo longo e campos vazios.
const tam = await p.evaluate(() => {
  const { t } = window.__RM, base = { tipo: 'so-laudo', natureza: 'nao-lancado', categoria: 'convenio', campos: { paciente: 'NOME DE PACIENTE FICTICIO', data: '2026-10-03', titulo: 'USG TIREOIDE', unidade: 'AlphaSonic Palhano', convenio: 'UNIMED', modalidade: 'US', medico: 'DR X', codigo: '', conta: '', valor: 0, responsavel: '', idAtendimento: '' },
    motivo: 'Sem lançamento correspondente neste relatório do MV. '.repeat(12), competencia: '2026-11', origem: { tipo: 'conferencia', rodadaId: 'rod_abc123', relatorio: '15 - DR X · 25022' }, chave: 'x', chavesLinha: ['L|1'] };
  const itens = Array.from({ length: 2000 }, (_, i) => ({ ...base, chave: 'k' + i, chavesLinha: ['L|' + i] }));
  return { antes: JSON.stringify(itens).length, depois: JSON.stringify(t.compactarCandidatosNC(itens)).length };
});
ok(tam.depois < tam.antes * 0.6, `2.000 candidatos: ${(tam.antes / 1024).toFixed(0)} KB → ${(tam.depois / 1024).toFixed(0)} KB guardados`);
await p.click('#cfAba-previa');

// ---------- 2. Excel: «Processando…» e só o filtrado ----------
await p.evaluate(() => { window.__lerBotao = []; const mo = new MutationObserver(() => { const bt = document.getElementById('cfExcel'); if (bt) window.__lerBotao.push(bt.textContent); }); mo.observe(document.body, { subtree: true, childList: true, characterData: true }); });
let [dl] = await Promise.all([p.waitForEvent('download'), p.click('#cfExcel')]);
ok(await p.evaluate(() => window.__lerBotao.includes('Processando…')), 'Exportar Excel mostra «Processando…» enquanto monta e gera o arquivo');
await dl.saveAs(out + 'tudo.xlsx');
await p.evaluate(() => { window.__RM.S.conf.soFalta = false; window.__RM.S.conf.busca = 'BRUNA'; }); await p.click('#cfVerTodas'); await p.fill('#cfBusca', 'BRUNA'); await p.waitForTimeout(300);
ok(await p.isVisible('#cfExcelFiltro'), `com filtro, aparece «${(await p.textContent('#cfExcelFiltro').catch(() => '')).trim()}»`);
[dl] = await Promise.all([p.waitForEvent('download'), p.click('#cfExcelFiltro')]);
ok(/_filtrado\.xlsx$/.test(dl.suggestedFilename()), `arquivo do filtrado: ${dl.suggestedFilename()}`);
await dl.saveAs(out + 'filtrado.xlsx');
const xl = JSON.parse(execFileSync('python3', ['-I', '-c', `import openpyxl,json,sys
r={}
for k in sys.argv[1:]:
  wb=openpyxl.load_workbook(k,read_only=True); ws=wb[wb.sheetnames[0]]
  inf=[c for row in wb['Informações'].iter_rows(values_only=True) for c in row if c]
  r[k.split('/')[-1]]={'linhas':sum(1 for row in ws.iter_rows(min_row=2,values_only=True) if any(row)),'filtro':any('SÓ O FILTRADO' in str(c) for c in inf)}
print(json.dumps(r))`, out + 'tudo.xlsx', out + 'filtrado.xlsx'], { encoding: 'utf8' }));
ok(xl['filtrado.xlsx'].linhas === 1 && xl['tudo.xlsx'].linhas > 1, `Excel do filtrado com só a linha visível (${xl['filtrado.xlsx'].linhas} × ${xl['tudo.xlsx'].linhas} no completo)`);
ok(xl['filtrado.xlsx'].filtro && !xl['tudo.xlsx'].filtro, 'a aba Informações do filtrado diz que é só o filtrado (e a do completo não)');
await p.fill('#cfBusca', ''); await p.evaluate(() => { window.__RM.S.conf.busca = ''; });

// ---------- 1. Reconferir em um clique (sem pasta: escolhe o PDF novo) ----------
await p.selectOption('#cfMed', '@prest').catch(() => {}); await p.click('#cfRodar'); await p.waitForSelector('#cfAbas'); await p.waitForTimeout(200);
await p.click('#cfAba-nc'); await p.waitForTimeout(100);
const antes = await p.evaluate(() => ({ rod: window.__RM.S.conf.ctx.rodadaId, rels: window.__RM.S.relatorios.length, hash: window.__RM.S.conf.ctx.arquivos[0].hash }));
ok(/Carregar o PDF novo e conferir de novo/.test(await p.textContent('#cfReconferir')), 'sem pasta conectada: botão «Carregar o PDF novo e conferir de novo» no resultado');
await p.setInputFiles('#cfReArq', out + 'mv2.pdf');
await p.waitForFunction(r => window.__RM.S.conf?.ctx.rodadaId !== r, antes.rod, { timeout: 20000 }); await p.waitForTimeout(300);
const depois = await p.evaluate(() => { const { S } = window.__RM; return { rels: S.relatorios.length, hash: S.conf.ctx.arquivos[0].hash, un: S.conf.ctx.unidadeCod, med: S.conf.ctx.medicoSel, aba: S.conf.aba, n: S.conf.res.linhas.filter(x => x.r).length, vis: !document.querySelector('[data-cfsec="nc"]').hidden }; });
ok(depois.n === 3 && depois.hash !== antes.hash && depois.rels === antes.rels, `um clique: PDF novo lido (3 linhas), no lugar do anterior (${depois.rels} relatório na sessão), e conferido de novo`);
ok(depois.un === '17' && depois.med === '@prest' && depois.aba === 'nc' && depois.vis, `mantém unidade (${depois.un}), médico (${depois.med}) e a aba aberta (${depois.aba})`);
await p.screenshot({ path: out + 'reconferir.png' });

// ---------- 4b. Retenção: rodadas substituídas ficam resumidas; a com aceite e a mais recente ficam inteiras ----------
const rodar = async () => { await p.click('#cfAba-previa'); await p.click('#cfRodar'); await p.waitForSelector('#cfAbas'); await p.waitForTimeout(200); };
await rodar();
await p.click('#cfAba-aceite'); await p.waitForTimeout(100);
await p.fill('#cfAceiteObs', 'Conferido'); await p.click('#cfAceitar'); await p.waitForTimeout(300); if (await p.isVisible('#dlg[open]')) await okDlg();
const aceita = await p.evaluate(() => { const { S } = window.__RM; return S.rodadas.find(r => r.id === S.conf.ctx.rodadaId)?.aceite ? S.conf.ctx.rodadaId : ''; });
await rodar(); await rodar(); await rodar();
const ret = await p.evaluate(async () => {
  const { S, t } = window.__RM, todas = (await t.dbTodas()).filter(r => r.prestadorCod === '15' && r.comp === '2026-11').sort((a, b) => a.em.localeCompare(b.em));
  return { lista: todas.map(r => `${r.id === S.conf.ctx.rodadaId ? 'ATUAL' : r.aceite ? 'ACEITE' : 'x'}:${r.resumida ? 'resumida' : 'inteira'}:${r.linhas.length}:${(r.arquivos.find(a => a.papel === 'MV') || {}).hash.slice(0, 6)}`),
    f: t.fechamentoAtual().prestadores.find(y => y.cod === '15')?.unidades?.['17'] };
});
const inteiras = ret.lista.filter(x => x.includes('inteira')), resumidas = ret.lista.filter(x => x.includes('resumida'));
ok(aceita && ret.lista.some(x => x.startsWith('ACEITE:inteira')), `a rodada com aceite continua inteira (${ret.lista.join(' · ')})`);
ok(ret.lista.at(-1).startsWith('ATUAL:inteira') && resumidas.length >= 2 && resumidas.every(x => x.split(':')[2] === '0'), `${resumidas.length} rodadas substituídas ficaram resumidas (sem linhas); ${inteiras.length} inteiras`);
const h1 = ret.lista[0].split(':')[3], doPdf1 = ret.lista.filter(x => x.endsWith(':' + h1));
ok(doPdf1.at(-1).includes(':inteira:') && doPdf1.slice(0, -1).every(x => x.includes(':resumida:')), `do PDF anterior, só a mais recente fica inteira (a reconferência compara com ela): ${doPdf1.join(' · ')}`);
ok(ret.f === 60, `Fechamento usa a rodada com aceite: R$ ${ret.f}`);
// Rodadas: a resumida não oferece aceite.
await p.evaluate(() => window.__RM.irPara('rodadas')); await p.waitForTimeout(400);
ok(/resumida/.test(await p.textContent('#rdTab')), 'tela Rodadas mostra «resumida» no lugar de «Registrar aceite»');

// ---------- 4c. Backup só da competência e troca de competência relê a janela ----------
const bk = await p.evaluate(async () => { const { t } = window.__RM, so = await t.dbRodadasJanela('2026-11', true); return { n: so.length, outras: so.filter(r => r.comp !== '2026-11').length }; });
ok(bk.n > 0 && bk.outras === 0, `backup leva só as rodadas da competência aberta (${bk.n})`);
await p.evaluate(() => window.__RM.t.mudarCompetencia('2026-04')); await p.waitForTimeout(600);
const jan = await p.evaluate(() => window.__RM.S.rodadas.map(r => r.comp));
ok(!jan.includes('2026-11') && !jan.includes('2026-09'), `na competência 04/2026 a sessão não carrega as rodadas de 09 e 11/2026 (${jan.length} carregadas)`);
await p.evaluate(() => window.__RM.t.mudarCompetencia('2026-11')); await p.waitForTimeout(600);
ok(await p.evaluate(() => window.__RM.S.rodadas.some(r => r.comp === '2026-11') && window.__RM.S.rodadas.some(r => r.comp === '2026-09')), 'de volta a 11/2026: rodadas da competência e das vizinhas (09/2026) carregadas');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
