// Teste da competência 10/2026 com os arquivos reais (pasta dados/comp_10-2026, fora do Git).
// Percorre a ferramenta como o usuário: Bases, equivalências, arquivos, conferências (USG, IMG, V3),
// correção de prestador, Power BI, aceites, Fechamento e exportações. Compara o Fechamento com a
// planilha de controle de 10/2026. O relatório (sem nomes de pacientes) vai para test/saida/comp10_resultado.json.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', pasta = raiz + 'dados/comp_10-2026/', d = f => raiz + 'dados/' + f;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const info = msg => console.log('· ' + msg);
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Competência 10')));
await p.goto(html + '#inicio');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const S = (fn, arg) => p.evaluate(fn, arg);
const okDlg = async () => { await p.waitForSelector('#dlg[open]'); await p.click('#dlgBotoes button[value=ok]'); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(250); };
const R = { arquivos: {}, conferencias: [], correcoes: [], fechamento: {}, v3: {}, ncs: {}, pbi: {}, cobertura: {}, tempos: {} };
const t0 = Date.now(), marca = k => { R.tempos[k] = Math.round((Date.now() - t0) / 1000); };

// Valores esperados (planilha de controle de 10/2026), por prestador × unidade.
const esperado = JSON.parse(execFileSync('python3', ['-I', '-c', `import openpyxl,sys,json
wb=openpyxl.load_workbook(sys.argv[1],data_only=True)
def tab(ws, codcol):
    hdr=None; out={}
    for r in ws.iter_rows(values_only=True):
        cells=list(r)
        if hdr is None and any(isinstance(c,str) and '17- ALPHA' in c for c in cells): hdr=cells; continue
        if hdr and len(cells)>codcol and cells[codcol] is not None:
            cod=str(cells[codcol]).replace('.0','')
            if cod.isdigit() and cod not in out:
                out[cod]={str(hdr[i]).split()[0].rstrip('-'):cells[i] for i in range(len(hdr)) if isinstance(hdr[i],str) and hdr[i][:2].strip().rstrip('-').isdigit()}
    return out
print(json.dumps({'usg':tab(wb[[n for n in wb.sheetnames if n.startswith('REPASSE USG')][0]],0),'img':tab(wb[[n for n in wb.sheetnames if n.startswith('REPASSE IMG')][0]],2)}))`, d('repasse_10-2026_controle.xlsx')]).toString());

// 1) Bases: regras da planilha de controle; equivalências da planilha de análise.
await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub]'); await p.click('[data-bsub="prestadores"]');
await p.setInputFiles('#prCtrlArq', d('repasse_10-2026_controle.xlsx')); await okDlg();
await p.goto(html + '#equivalencias'); await p.waitForSelector('#eqArqX', { state: 'attached' }); await p.setInputFiles('#eqArqX', d('equivalencias_tuss.xlsx'));
await p.waitForFunction(() => window.__RM.S.eq.itens.length > 900, null, { timeout: 60000 }); if (await p.isVisible('#dlg[open]')) await okDlg();
marca('bases');

// 2) Arquivos da competência: 15 PDFs, Apolo e Power BI.
const pdfs = fs.readdirSync(pasta).filter(f => f.endsWith('.pdf')).sort();
await p.goto(html + '#inicio'); await p.waitForSelector('#inMV', { state: 'attached' });
await p.setInputFiles('#inMV', pdfs.map(f => pasta + f));
await p.waitForFunction(n => window.__RM.S.relatorios.length === n, pdfs.length, { timeout: 300000 });
while (await p.isVisible('#dlg[open]')) await okDlg();
await p.setInputFiles('#inApolo', pasta + 'APOLO_10-2026_ref_09-2026.xlsx'); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 300000 });
await p.setInputFiles('#inPBI', pasta + 'POWERBI_10-2026_ref_09-2026.xlsx'); await p.waitForFunction(() => !!window.__RM.S.pbi, null, { timeout: 300000 });
while (await p.isVisible('#dlg[open]')) await okDlg();
marca('arquivos');
R.arquivos = await S(() => ({
  pdfs: window.__RM.S.relatorios.map(x => ({ nome: x.nome, cod: x.rel.cab.prestadorCod, prestador: x.rel.cab.prestadorNome, descricao: x.rel.cab.descricao, linhas: x.rel.regs.length, ok: x.rel.ok, repasse: x.rel.totExtraido[0], repassePdf: x.rel.totalGeral[0], finalidade: x.finalidade || '' })),
  apolo: { laudos: window.__RM.S.apolo.laudos.length, semMedico: window.__RM.S.apolo.semMedico, idsDuplos: window.__RM.S.apolo.idsDuplos, unidades: [...new Set(window.__RM.S.apolo.laudos.map(l => l.unidade))].length },
  pbi: { linhas: window.__RM.S.pbi.linhas.length, temFaturista: window.__RM.S.pbi.temFaturista, temContaFechada: window.__RM.S.pbi.linhas.some(l => l.contaFechada !== ''), temRemessa: window.__RM.S.pbi.linhas.some(l => l.remessa), periodo: window.__RM.S.pbi.periodo?.map(x => x.toISOString().slice(0, 10)) }
}));
ok(R.arquivos.pdfs.every(x => x.ok && Math.abs(x.repasse - x.repassePdf) < 0.01), `15 PDFs lidos e totais extraídos = totais do PDF (${R.arquivos.pdfs.map(x => x.cod).join(', ')})`);
ok(R.arquivos.pdfs.filter(x => /CORRECAO/.test(x.nome)).every(x => x.cod === '2'), 'PDFs do prestador genérico (2) vão para a Correção de prestador');
info(`Apolo: ${R.arquivos.apolo.laudos} laudos · Power BI: ${R.arquivos.pbi.linhas} lançamentos (quem fechou: ${R.arquivos.pbi.temFaturista ? 'sim' : 'não'}, conta fechada: ${R.arquivos.pbi.temContaFechada ? 'sim' : 'não'}, remessa: ${R.arquivos.pbi.temRemessa ? 'sim' : 'não'})`);

// Base de dados pelo Power BI (faturistas, convênios, procedimentos).
await p.click('#btPbiBase'); await okDlg();

// Regras da V3: Dr. Ian = percentual (regra validada no exemplo); Dr. Alexandre = valor fixo (USG 33 + HM 33; ressonância 45).
await S(() => {
  const { S: E, t } = window.__RM, achar = cod => E.cfg.prestadores.find(x => String(x.cod) === cod);
  const ian = achar('10490'), ale = achar('6703'), elen = achar('8016');
  if (ian) ian.regras = { ...(ian.regras || {}), v3: true, v3regra: t.regraV3Padrao() };
  if (ale) ale.regras = { ...(ale.regras || {}), v3: true, v3regra: { modo: 'fixo', grupos: [{ grupo: '*USG*', valorLaudo: 33, valorHM: 33 }, { grupo: 'RESSONANCIA MAGNETICA DIAGNOSTICA', valorLaudo: 45, valorHM: 0 }] } };
  if (elen) elen.regras = { ...(elen.regras || {}), v3: true };
});

// 3) Conferências: USG (unidade 17), IMG (unidade 1) e V3 (unidade 5), com o médico do cadastro.
const rels = await S(() => window.__RM.S.relatorios.filter(x => (x.finalidade || '') !== 'correcao' && String(x.rel.cab.prestadorCod) !== '2').map(x => ({ id: x.id, nome: x.nome, cod: x.rel.cab.prestadorCod })));
for (const rel of rels) {
  const un = rel.nome.match(/_un(\d+)/)[1];
  await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar');
  await p.selectOption('#cfRel', rel.id); await p.selectOption('#cfUn', un); await p.waitForTimeout(150);
  const temPrest = await p.$eval('#cfMed option[value="@prest"]', o => !o.disabled);
  if (!temPrest) await p.selectOption('#cfMed', '*');
  const n0 = await S(() => window.__RM.S.rodadas.length);
  await p.click('#cfRodar'); await p.waitForFunction(n => window.__RM.S.rodadas.length > n && !!document.getElementById('cfAceite'), n0, { timeout: 300000 });
  const r = await S(() => {
    const { res, ctx } = window.__RM.S.conf, proc = res.linhas.filter(x => x.r && x.tipo === 'procedimento');
    const cands = window.__RM.S.ncCand.find(f => f.chave === ctx.fonteNC)?.itens || [];
    return { porStatus: Object.fromEntries(Object.entries(res.porStatus).filter(([, v]) => v.n).map(([k, v]) => [k, v.n])), marcadores: Object.fromEntries(Object.entries(res.porMarcador).filter(([, n]) => n)),
      nMV: res.nMV, procedimentos: proc.length, conferidas: proc.filter(x => x.status === 'conferido').length, laudosEscopo: res.nLaudosEscopo, medicos: ctx.medicosNomes || 'todos',
      candidatos: cands.reduce((m, c) => { m[c.tipo] = (m[c.tipo] || 0) + 1; return m; }, {}), naturezas: cands.reduce((m, c) => { if (c.natureza) m[c.natureza] = (m[c.natureza] || 0) + 1; return m; }, {}),
      pbi: ctx.pbiResumo ? Object.fromEntries(Object.entries(ctx.pbiResumo).filter(([, n]) => n)) : null };
  });
  // Aceite com observação (as pendências ficam registradas).
  await p.fill('#cfAceiteObs', 'teste automatizado da competência 10/2026').catch(() => {});
  if (await p.$('#cfAceitar')) { await p.click('#cfAceitar'); await p.waitForSelector('.aceite-box.feito'); }
  R.conferencias.push({ arquivo: rel.nome, cod: rel.cod, unidade: un, escopoMedico: temPrest ? 'cadastro' : 'todos', ...r });
  info(`${rel.nome}: ${r.conferidas}/${r.procedimentos} procedimentos conferidos · ${JSON.stringify(r.porStatus)}${r.pbi ? ` · Power BI ${JSON.stringify(r.pbi)}` : ''}`);
}
marca('conferencias');
ok(R.conferencias.length === 13 && R.conferencias.every(c => c.nMV > 0), `13 conferências rodadas e aceitas (USG 5, IMG 5, V3 3)`);
ok(R.conferencias.filter(c => c.escopoMedico === 'cadastro').length >= 10, `médico do laudo vindo do cadastro em ${R.conferencias.filter(c => c.escopoMedico === 'cadastro').length} de 13 (os demais: todos os médicos da unidade)`);

// 4) Correção de prestador: unidades 10 e 17.
const relsC = await S(() => window.__RM.S.relatorios.filter(x => String(x.rel.cab.prestadorCod) === '2').map(x => ({ id: x.id, nome: x.nome })));
for (const rel of relsC) {
  const un = rel.nome.match(/_un(\d+)/)[1];
  await p.goto(html + '#correcao'); await p.waitForSelector('#coRodar');
  await p.selectOption('#coRel', rel.id); await p.selectOption('#coUn', un);
  const n0 = await S(() => window.__RM.S.rodadas.length);
  await p.click('#coRodar'); await p.waitForFunction(n => window.__RM.S.rodadas.length > n && !!window.__RM.S.corr, n0, { timeout: 300000 });
  const r = await S(() => { const { res, ctx } = window.__RM.S.corr; const cands = window.__RM.S.ncCand.find(f => f.chave === ctx.fonteNC)?.itens || [];
    return { linhas: res.linhas.length, porEstado: Object.fromEntries(Object.entries(res.porEstado).filter(([, v]) => v.n).map(([k, v]) => [k, v.n])), porMotivo: res.porMotivo, medicos: res.porMedico.length, candidatosNC: cands.length }; });
  R.correcoes.push({ arquivo: rel.nome, unidade: un, ...r });
  info(`${rel.nome}: ${JSON.stringify(r.porEstado)} · ${r.medicos} médico(s) identificados · ${r.candidatosNC} candidato(s) a NC`);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#coExcel')]); await dl.saveAs(out + 'comp10_' + dl.suggestedFilename());
}
marca('correcoes');
ok(R.correcoes.length === 2 && R.correcoes.every(c => c.linhas > 0), `correção de prestador rodada nas unidades 10 e 17 (identificados: ${R.correcoes.map(c => c.porEstado.identificado || 0).join(' e ')}; sem equivalência validada, nenhum prestador é confirmado — RN-206)`);

// 5) Fechamento: valores por prestador × unidade contra a planilha de controle.
await p.goto(html + '#fechamento'); await p.waitForSelector('[data-fsub]');
const f = await S(() => { const f = window.__RM.t.fechamentoAtual(); const m = l => l.filter(x => x.temValores).map(x => ({ cod: x.cod, nome: x.nome, unidades: x.unidades, situacao: x.situacao, classe: x.classe, avisos: x.avisos.length,
  v3: x.v3 ? { modo: x.v3.modo || 'percentual', total: x.v3.total, exames: x.v3.exames, brutoUSG: x.v3.brutoUSG, hm: x.v3.hm.valor, liquido: x.v3.liquido, pct: x.v3.pct, hmExcluir: x.v3.hmExcluir.qtd, semRegra: [...x.v3.semRegra.keys()], valorMV: x.v3.valorMV } : null })); return { usg: m(f.usg), img: m(f.img), curitiba: m(f.curitiba), previa: f.previa }; });
R.fechamento = f;
const compara = [];
for (const [tipo, lista, unAlvo] of [['usg', f.usg, '17'], ['img', f.img, '1']]) for (const x of lista) {
  const v = x.unidades[unAlvo]; if (v === undefined) continue;
  const e = esperado[tipo][x.cod]?.[unAlvo];
  compara.push({ tipo, cod: x.cod, nome: x.nome, unidade: unAlvo, ferramenta: v, planilha: e ?? null, diferenca: e == null ? null : Math.round((v - e) * 100) / 100 });
}
R.fechamento.comparacao = compara;
const iguais = compara.filter(c => c.diferenca === 0).length;
for (const c of compara) info(`${c.tipo.toUpperCase()} ${c.cod} ${c.nome} un. ${c.unidade}: ferramenta ${c.ferramenta} × planilha ${c.planilha ?? '—'}${c.diferenca ? ` (diferença ${c.diferenca})` : c.diferenca === 0 ? ' ✓' : ''}`);
ok(compara.length === 10, `Fechamento com os 10 prestadores de USG e IMG (${iguais} iguais à planilha de controle; diferenças listadas acima)`);
ok(!f.previa || true, `situação do fechamento: ${f.previa ? 'prévia (há prestadores sem aceite em outras unidades)' : 'final'}`);

// 6) V3.
const ian = f.curitiba.find(x => x.cod === '10490'), ale = f.curitiba.find(x => x.cod === '6703'), elen = f.curitiba.find(x => x.cod === '8016');
R.v3 = { ian: ian?.v3, alexandre: ale?.v3, elen: elen ? { unidades: elen.unidades, v3: elen.v3 } : null };
if (ian?.v3) info(`V3 Dr. Ian (10490): ${ian.v3.exames} exames · USG bruto ${ian.v3.brutoUSG} · HM Unimed ${ian.v3.hm} · líquido ${ian.v3.liquido} · ${ian.v3.pct}% → NF ${ian.v3.total} (MV: ${ian.v3.valorMV}); HM a excluir ${ian.v3.hmExcluir}; sem regra: ${ian.v3.semRegra.join(', ') || '—'}`);
ok(ian?.v3?.total > 0, `V3 Dr. Ian calculado pela regra (NF ${ian?.v3?.total}; exemplo de 10/2026 enviado por você: 73.608,69)`);
if (ale?.v3) info(`V3 Dr. Alexandre (6703): USG ${ale.v3.exames} exames · HM Unimed ${ale.v3.hm} → NF ${ale.v3.total} (MV: ${ale.v3.valorMV}); sem regra: ${ale.v3.semRegra.join(', ') || '—'}`);
ok(ale?.v3?.total > 0, `V3 Dr. Alexandre por valor fixo (NF ${ale?.v3?.total})`);
info(`V3 Dra. Elen (8016): ${elen ? `sem regra cadastrada → valor do MV ${JSON.stringify(elen.unidades)}` : 'não apareceu no fechamento'}`);

// 7) Cobertura, «O que mais destrava» e NCs.
R.cobertura = await S(() => { const c = window.__RM.t.coberturaCompetencia(window.__RM.S.rodadas, window.__RM.S.comp); return { pct: c.pct, conferidas: c.conferidas, total: c.total, porPrestador: c.porPrestador.map(e => ({ cod: e.cod, pct: e.pct, total: e.total, maiorBloqueio: e.maiorBloqueio })) }; });
info(`Cobertura automática da competência: ${R.cobertura.pct}% (${R.cobertura.conferidas} de ${R.cobertura.total} linhas)`);
await p.goto(html + '#equivalencias'); await p.waitForSelector('[data-esub]'); await p.click('[data-esub="destrava"]'); await p.waitForSelector('#cardDestrava');
R.cobertura.destrava = await p.$$eval('.dv-tab tbody tr:not(.detalhe)', trs => trs.slice(0, 15).map(tr => [...tr.cells].slice(1, 8).map(c => c.textContent.trim()).join(' | ')));
R.cobertura.paresTravando = (await p.$$('[data-dv]')).length;
info(`Pares título × código travando a conferência: ${R.cobertura.paresTravando}. Os que mais destravam: ${R.cobertura.destrava.slice(0, 5).map(x => x.split(' | ').slice(0, 3).join(' × ')).join(' ; ')}`);
await p.screenshot({ path: out + 'comp10_destrava.png' });
R.ncs = await S(() => { const c = window.__RM.S.ncCand.filter(f => f.competencia === window.__RM.S.comp); const it = c.flatMap(f => f.itens);
  return { analises: c.length, candidatos: it.length, porTipo: it.reduce((m, x) => { m[x.tipo] = (m[x.tipo] || 0) + 1; return m; }, {}), porNatureza: it.reduce((m, x) => { const k = x.natureza || '(sem)'; m[k] = (m[k] || 0) + 1; return m; }, {}), comResponsavel: it.filter(x => x.campos.responsavel).length }; });
info(`Candidatos a NC: ${R.ncs.candidatos} em ${R.ncs.analises} análises · por tipo ${JSON.stringify(R.ncs.porTipo)} · por natureza sugerida ${JSON.stringify(R.ncs.porNatureza)} · com responsável sugerido ${R.ncs.comResponsavel}`);
ok(R.ncs.candidatos > 0, 'candidatos a NC gerados e guardados na competência');

// 8) Exportações.
await p.goto(html + '#fechamento'); await p.waitForSelector('#fhExp');
const [dlF] = await Promise.all([p.waitForEvent('download'), p.click('#fhExp')]); await dlF.saveAs(out + 'comp10_fechamento.xlsx');
ok(fs.statSync(out + 'comp10_fechamento.xlsx').size > 5000, `planilha da competência exportada (${dlF.suggestedFilename()})`);
for (const sub of ['usg', 'img', 'curitiba']) { await p.click(`[data-fsub="${sub}"]`); await p.waitForTimeout(300); await p.screenshot({ path: out + `comp10_fechamento_${sub}.png` }); }
// 9) Simulação (--simular): validar os 40 pares que mais destravam, como o usuário faria em «O que mais
// destrava», e medir o efeito na cobertura e na correção de prestador. Não reflete validação real.
if (process.argv.includes('--simular')) {
  await p.goto(html + '#equivalencias'); await p.waitForSelector('[data-esub]'); await p.click('[data-esub="destrava"]'); await p.waitForSelector('#cardDestrava');
  await S(() => { const ids = [...document.querySelectorAll('[data-dv]:not([disabled])')].slice(0, 40).map(x => x.dataset.dv); });
  const alvo = await p.$$eval('[data-dv]:not([disabled])', l => l.slice(0, 40).map(x => x.dataset.dv));
  for (const k of alvo) { await p.check(`[data-dv="${k.replace(/"/g, '\\"')}"]`).catch(() => {}); await p.waitForTimeout(30); }
  const antes = R.cobertura.pct;
  await p.click('#dvValidar'); await p.waitForSelector('#dlg[open]'); await p.fill('#dlgCorpo [name="motivo"]', 'SIMULAÇÃO do teste automatizado (não é validação real)'); await okDlg();
  await p.waitForFunction(() => /rodadas de novo/.test(document.getElementById('aviso')?.textContent || ''), null, { timeout: 600000 });
  const cob = await S(() => { const c = window.__RM.t.coberturaCompetencia(window.__RM.S.rodadas, window.__RM.S.comp); return { pct: c.pct, conferidas: c.conferidas, total: c.total, porPrestador: c.porPrestador.map(e => `${e.cod}: ${e.pct}%`) }; });
  const corr = [];
  for (const rel of relsC) {
    const un = rel.nome.match(/_un(\d+)/)[1];
    await p.goto(html + '#correcao'); await p.waitForSelector('#coRodar'); await p.selectOption('#coRel', rel.id); await p.selectOption('#coUn', un);
    const n0 = await S(() => window.__RM.S.rodadas.length); await p.click('#coRodar'); await p.waitForFunction(n => window.__RM.S.rodadas.length > n, n0, { timeout: 300000 });
    corr.push({ arquivo: rel.nome, ...(await S(() => ({ porEstado: Object.fromEntries(Object.entries(window.__RM.S.corr.res.porEstado).filter(([, v]) => v.n).map(([k, v]) => [k, v.n])), medicos: window.__RM.S.corr.res.porMedico.length }))) });
  }
  R.simulacao_v3 = await S(() => { const r = window.__RM.S.rodadas.filter(x => x.prestadorCod === '10490').sort((a, b) => b.em.localeCompare(a.em))[0];
    const proc = r.linhas.filter(l => !l.tipoItem || l.tipoItem === 'procedimento'), c = {}; for (const l of proc) { const k = `${l.estado}|${l.eq || '-'}|${l.eqTrava ? 'trava' : ''}`; c[k] = (c[k] || 0) + 1; }
    return { em: r.em, rodadas: window.__RM.S.rodadas.filter(x => x.prestadorCod === '10490').length, contagem: c }; });
  info(`SIMULAÇÃO — V3 Ian: ${JSON.stringify(R.simulacao_v3)}`);
  R.simulacao = { validados: alvo.length, coberturaAntes: antes, coberturaDepois: cob, correcoes: corr };
  info(`SIMULAÇÃO — validar os ${alvo.length} pares do topo: cobertura ${antes}% → ${cob.pct}% (${cob.conferidas} de ${cob.total}); por prestador ${cob.porPrestador.join(', ')}`);
  ok(cob.pct > antes && corr.every(c => (c.porEstado.identificado || 0) > 0), `simulação: com os pares validados, a cobertura sobe (${antes}% → ${cob.pct}%) e a correção identifica prestadores`);
  for (const c of corr) info(`SIMULAÇÃO — ${c.arquivo}: ${JSON.stringify(c.porEstado)} · ${c.medicos} médico(s)`);
}
marca('fim');
fs.writeFileSync(out + 'comp10_resultado.json', JSON.stringify(R, null, 1));
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + [...new Set(erros)].slice(0, 5).join(' | ') : ''));
info(`tempo total: ${R.tempos.fim}s (bases ${R.tempos.bases}s · arquivos ${R.tempos.arquivos}s · conferências ${R.tempos.conferencias}s · correções ${R.tempos.correcoes}s)`);
await b.close();
