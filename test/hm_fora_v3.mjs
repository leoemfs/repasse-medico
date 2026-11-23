// SOL-F48 (v3.0.0-alpha.22) — HM fora da V3 (pedido de 23/11/2026): «na unidade da V3 pagamos HM de USG; nas demais unidades
// o HM deve ser notificado para exclusão e não compõe valor para o repasse, todos os grupos de HM em todas as unidades
// (exceto V3)». Arquivos fictícios: unidade 17 (comum) com HM em vários grupos e unidade 5 (V3), que não muda.
import { createRequire } from 'module';
import fs from 'fs';
import { execFileSync } from 'child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/hm_fora_v3/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const py = (codigo, ...args) => JSON.parse(execFileSync('python3', ['-I', '-c', codigo, ...args], { encoding: 'utf8' }) || 'null');
const b = await chromium.launch(), erros = [];

// Laudos: tireoide de ANA e BRUNA na unidade 17 (DR X) e de VERA na V3 (DR V).
py(`import openpyxl,datetime,json,sys
wb=openpyxl.Workbook(); ws=wb.active
ws.append(['ID','BRANCH_NAME','PATIENT_ID','PATIENT_NAME','TITLE','STUDY_DATETIME','PATIENT_INSURANCE','MODALITY','NAME_MEDICO'])
for i,(u,p,d,m) in enumerate(json.loads(sys.argv[2])): ws.append([800+i,u,500+i,p,'USG TIREOIDE',datetime.datetime(2026,10,d,9,30),'UNIMED','US',m])
wb.save(sys.argv[1]); print('null')`, out + 'apolo.xlsx', JSON.stringify([['AlphaSonic Palhano', 'ANA PAULA ROCHA', 3, 'DR X'], ['AlphaSonic Palhano', 'BRUNA LIMA COSTA', 4, 'DR X'], ['AlphaSonic Curitiba', 'VERA LUCIA DIAS', 5, 'DR V']]));
// PDF do MV com vários grupos: [grupo, [procedimento, [[n, paciente, dia, vl, convênio]]], …].
const linhaMV = (n, pac, dia, vl, conv) => `${124800 + n} ${2569500 + n} ${2234100 + n} ${pac} N CLINICO ${conv} ${String(dia).padStart(2, '0')}/10/26 1 0 ${vl},00 50,00 ${vl * 2},00`;
async function pdfMV(arq, cod, nome, tipo, blocos) {
  const L = [`Grupo de Repasse: ${cod} - ${nome}`, `Prestador: ${cod} - ${nome}`, `Repasse: 4${cod}0 Dt. Repasse: 10/11/2026 Descrição: REPASSE ${tipo} 11/2026`];
  let geral = 0;
  for (const [grupo, ...procs] of blocos) {
    let tg = 0; L.push(`Grupo de Procedimento: ${grupo}`);
    for (const [proc, linhas] of procs) { const t = linhas.reduce((s, l) => s + l[3], 0); tg += t; L.push(`Procedimento: ${proc}`, ...linhas.map(l => linhaMV(...l)), `Total do Procedimento: ${t},00 ${t * 2},00`); }
    geral += tg; L.push(`Total do Grupo de Procedimento: ${tg},00 ${tg * 2},00`);
  }
  L.push(`Total Geral do Repasse: ${geral},00 ${geral * 2},00`);
  const pg = await b.newPage(); await pg.setContent(`<body style="font:11px Arial">${L.map(l => `<div style="white-space:pre">${l}</div>`).join('')}</body>`); await pg.pdf({ path: out + arq }); await pg.close();
}
// Unidade 17: 2 USG com laudo (R$ 10 cada) e 4 HM de grupos diferentes — inclusive HM de USG Unimed (pago só na V3).
await pdfMV('mv_15_usg_unidade_17.pdf', '15', 'DR X', 'USG', [
  ['30 - ULTRASSONOGRAFIA', ['40901173 - US TIREOIDE - OP', [[1, 'ANA PAULA ROCHA', 3, 10, 'UNIMED'], [2, 'BRUNA LIMA COSTA', 4, 10, 'UNIMED']]],
    ['40901174 - US TIREOIDE - HM', [[6, 'BRUNA LIMA COSTA', 4, 5, 'UNIMED']]]],   // HM lançado no grupo do exame («- HM» na descrição)
  ['78 - HONORARIOS MEDICOS PF', ['10101039 - HM ULTRASSONOGRAFIA TIREOIDE', [[3, 'ANA PAULA ROCHA', 3, 7, 'UNIMED']]]],
  ['81 - HONORARIO MEDICO MAMOGRAFIA', ['10101047 - HM MAMOGRAFIA DIGITAL', [[4, 'CARLA DIAS MOTA', 5, 15, 'BRADESCO']]]],
  ['77 - HONORARIO MEDICO RAIO X', ['10101055 - HM RAIO X TORAX', [[5, 'DORA NUNES PIRES', 6, 4, 'UNIMED']]]]]);
// V3 (unidade 5): USG com laudo + HM de USG Unimed (devido) + HM de mamografia (excluído, regra da V3).
await pdfMV('mv_16_v3_unidade_5.pdf', '16', 'DR V', 'USG', [
  ['30 - ULTRASSONOGRAFIA', ['40901173 - US TIREOIDE - OP', [[7, 'VERA LUCIA DIAS', 5, 30, 'UNIMED']]]],
  ['78 - HONORARIOS MEDICOS PF', ['10101039 - HM ULTRASSONOGRAFIA TIREOIDE', [[8, 'VERA LUCIA DIAS', 5, 30, 'UNIMED']]]],
  ['81 - HONORARIO MEDICO MAMOGRAFIA', ['10101047 - HM MAMOGRAFIA DIGITAL', [[9, 'VERA LUCIA DIAS', 5, 15, 'UNIMED']]]]]);

const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.clock.install({ time: new Date('2026-11-23T10:00:00') });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste HM')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const abas = arq => py(`import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1],read_only=True); r={}
for n in wb.sheetnames: r[n]=[[c for c in row] for row in wb[n].iter_rows(values_only=True)]
print(json.dumps(r,default=str))`, arq);
await p.setInputFiles('#inMV', [out + 'mv_15_usg_unidade_17.pdf', out + 'mv_16_v3_unidade_5.pdf']);
await p.waitForFunction(() => window.__RM.S.relatorios.length === 2, null, { timeout: 30000 });
await p.setInputFiles('#inApolo', out + 'apolo.xlsx'); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 30000 });
ok(await p.evaluate(() => window.__RM.S.relatorios.every(x => x.rel.ok)), 'PDFs lidos com os totais conferidos');
await p.evaluate(() => { const { S, t } = window.__RM; S.eq.itens.push({ id: 'eqT', codigo: '40901173', titulo: 'USG TIREOIDE', status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'Teste' }); t.salvarEq('Equivalência validada.'); });

// ---------- 1. Unidade 17 (fora da V3): todo HM é «HM a excluir do MV» e fica fora do valor ----------
const rodar = async (cod, un) => {
  await p.goto(html + '#inicio'); await p.evaluate(([c, u]) => { const { S } = window.__RM; S.cfProximo = { relId: S.relatorios.find(x => x.rel.cab.prestadorCod === c).id, unidadeCod: u }; }, [cod, un]);
  await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar');
  if ((await p.inputValue('#cfUn')) !== un) await p.selectOption('#cfUn', un);
  await p.click('#cfRodar'); await p.waitForSelector('#cfAbas', { timeout: 15000 }); await p.waitForTimeout(200);
  return p.evaluate(() => { const { S, t } = window.__RM, res = S.conf.res; return { cab: S.conf.ctx.relatorio.cab.prestadorCod, un: S.conf.ctx.unidadeCod,
    hm: res.linhas.filter(x => x.r && x.tipo === 'hm').map(x => ({ g: x.r.grupoNome, cl: t.classeDaLinhaConf(x), m: [...x.marcadores], mot: x.motivos[0] })), T: t.totaisPorClasse(res.linhas, t.classeDaLinhaConf) }; });
};
const A = await rodar('15', '17');
ok(A.cab === '15' && A.un === '17', 'conferência do DR X na unidade 17');
ok(A.hm.length === 4 && A.hm.every(h => h.cl === 'excluido' && h.m.includes('hm-excluir')), `os 4 HM (grupos ${[...new Set(A.hm.map(h => h.g))].join(', ')}; um com «- HM» na descrição) são Excluído com o marcador «HM a excluir do MV»`);
ok(A.hm.find(h => /PF$/.test(h.g))?.cl === 'excluido', 'HM de USG Unimed fora da V3 também não é pago');
ok(A.hm.every(h => /^HM a excluir do MV: fora da V3 nenhum HM é pago/.test(h.mot)), `motivo: «${A.hm[0]?.mot}»`);
ok(A.T.pagar === 20 && A.T.excluido.valor === 31 && A.T.total === 51, `para pagamento R$ ${A.T.pagar} (só as 2 USG); excluído R$ ${A.T.excluido.valor}; total R$ ${A.T.total}`);
// Tela: aba «NCs e correções no MV» lista os 4 HM para excluir.
await p.click('#cfAba-nc'); await p.waitForTimeout(150);
const txtNC = await p.textContent('#pag-conferencia');
ok(/HM a excluir do MV/.test(txtNC) && /Fora da V3 nenhum HM é pago/.test(txtNC), 'aba «NCs e correções no MV»: lista «HM a excluir do MV» com a regra');
// O HM não pode ser aceito para pagamento: o aceite não muda a classe.
const aceito = await p.evaluate(() => window.__RM.t.classeDaLinhaRodada({ tipoItem: 'hm', estado: 'hm-pendente', decisao: 'considerar' }));
ok(aceito === 'excluido', 'HM fora da V3 continua Excluído mesmo com «Aceito para pagamento»');
// Excel do prestador: aba «HM a excluir do MV».
const [dl1] = await Promise.all([p.waitForEvent('download'), p.click('#cfExcel')]); await dl1.saveAs(out + 'conf_15.xlsx');
const X1 = abas(out + 'conf_15.xlsx'), H1 = X1['HM a excluir do MV'] || [];
ok(H1.length === 5 && H1.slice(1).reduce((s, r) => s + +r[9], 0) === 31, `Excel do prestador: aba «HM a excluir do MV» com ${H1.length - 1} HM (R$ ${H1.slice(1).reduce((s, r) => s + +r[9], 0)})`);
// Aceite e Fechamento: aviso de HM a excluir e valor só das USG.
await p.click('#cfAba-aceite'); await p.waitForTimeout(100); await p.click('#cfAceitar'); await p.waitForTimeout(300); if (await p.isVisible('#dlg[open]')) { await p.click('#dlgBotoes button[value="ok"]'); await p.waitForTimeout(200); }
const f = await p.evaluate(() => { const x = window.__RM.t.fechamentoAtual().prestadores.find(y => y.cod === '15'); return { v: x?.unidades?.['17'], av: x?.avisos || [], hm: x?.hmExcluir }; });
ok(f.v === 20, `Fechamento do DR X na unidade 17: R$ ${f.v} (sem HM)`);
ok(f.av.some(a => /unidade 17: 4 HM a excluir do MV \(R\$ 31,00\)/.test(a)) && f.hm?.qtd === 4, `aviso no Fechamento: «${f.av.find(a => /HM a excluir/.test(a))}»`);

// ---------- 2. Excel único da unidade: aba «HM a excluir do MV» com o prestador ----------
await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar');
await p.selectOption('#cfFUn', '17'); await p.waitForTimeout(150); await p.selectOption('#cfFGr', 'usg'); await p.waitForTimeout(150);
const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('[data-cfunica]')]); await dl2.saveAs(out + 'unica.xlsx');
const H2 = abas(out + 'unica.xlsx')['HM a excluir do MV'] || [];
ok(H2.length === 5 && H2.slice(1).every(r => String(r[0]) === '15'), `Excel único da unidade 17: aba «HM a excluir do MV» com ${H2.length - 1} HM do prestador 15`);

// ---------- 2b. Configuração antiga: a regra «- HM» que nunca casava é migrada ----------
const mig = await p.evaluate(() => { const c = { classificacao: [{ id: 'hm-sufixo', campo: 'descricao', padrao: '(^|\\s)-\\s*HM\\s*$', tipo: 'hm', ativa: true }, { id: 'hm-grupo', campo: 'grupo', padrao: 'HONORARIO', tipo: 'hm', ativa: true }], parametros: {}, unidades: [], faturistas: [], prestadores: [] };
  window.__RM.t.migrarConfig(c); return c.classificacao.map(r => r.padrao); });
ok(mig[0] === '^HM |(^| )HM$' && mig[1] === 'HONORARIO|HONOR MED|(^| )HM( |$)', `configuração antiga migrada: ${mig.join(' · ')}`);

// ---------- 3. V3 (unidade 5): HM de USG Unimed continua pago; o de mamografia, excluído ----------
const V = await rodar('16', '5');
const hmUSG = V.hm.find(h => /PF$/.test(h.g)), hmMG = V.hm.find(h => /MAMOGRAFIA/.test(h.g));
ok(V.un === '5' && hmUSG?.cl === 'devido' && !hmUSG.m.includes('hm-excluir'), `V3: HM de USG Unimed é Devido (${hmUSG?.cl})`);
ok(hmMG?.cl === 'excluido' && hmMG.m.includes('hm-v3-excluir') && !hmMG.m.includes('hm-excluir'), 'V3: HM de mamografia fica Excluído pela regra da V3 («HM V3 a excluir»)');
ok(V.T.pagar === 60, `V3: para pagamento R$ ${V.T.pagar} (USG + HM de USG Unimed)`);

ok(!erros.length, `sem erros na tela${erros.length ? ': ' + erros.join(' | ') : ''}`);
await b.close();
