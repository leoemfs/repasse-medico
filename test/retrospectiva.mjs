// v3.0.0-alpha.18 — SOL-F20: Retrospectiva mensal (PDCA), subaba do Fluxo mensal. Lead time por prestador (geração no MV →
// conferência → aceite → e-mail → NF → Financeiro, em dias úteis), rodadas até o aceite, espera por terceiros (Fluxo e
// Fechamento), cobertura, NCs por natureza e faturista com reincidência, antecedência ao Financeiro, comparação entre
// meses, «o que melhorar no próximo mês» e backlog herdado; Excel da retrospectiva. Dados fictícios.
import { createRequire } from 'module';
import fs from 'fs';
import { execFileSync } from 'child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];
const p = await (await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.clock.install({ time: new Date('2026-11-17T10:00:00') });
await p.addInitScript(() => { localStorage.setItem('rm2.operador', JSON.stringify('Teste Retro')); localStorage.setItem('rm2.competencia', JSON.stringify('2026-11')); });
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const okDlg = async (botao = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${botao}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };
const abrirRetro = async () => { await p.evaluate(() => window.__RM.irPara('fluxo')); await p.waitForSelector('[data-sub="retro"]'); await p.waitForTimeout(300); await p.click('[data-sub="retro"]'); await p.waitForSelector('.rt-kpis'); await p.waitForTimeout(300); };

// Dias úteis: 06/11 → 13/11/2026 = 5; Finados (02/11) não conta.
ok(await p.evaluate(() => { const { diasUteisEntre } = window.__RM.t, d = s => new Date(s + 'T00:00:00Z'); return diasUteisEntre(d('2026-11-06'), d('2026-11-13')) === 5 && diasUteisEntre(d('2026-10-30'), d('2026-11-03')) === 1 && diasUteisEntre(d('2026-11-13'), d('2026-11-06')) === -5; }), 'dias úteis entre datas (feriado de Finados fora; negativo quando a data final vem antes)');

// Fluxo de 11/2026 iniciado; rodadas, aceites, controle documental, etapa em «Aguardando terceiros» e NCs.
await p.goto(html + '#fluxo'); await p.waitForSelector('#fxCriar'); await p.click('#fxCriar'); await p.waitForSelector('.marco');
await p.evaluate(async () => {
  const { S, t } = window.__RM, comp = S.fluxo.competencias['2026-11'];
  comp.grupos.usg.tarefas.gerar.status = 'ok'; comp.grupos.usg.tarefas.gerar.conclusao = '2026-11-06';
  comp.grupos.prep.tarefas.apoloRec.historico = [{ em: '2026-11-03T12:00:00.000Z', por: 'T', de: 'ni', para: 'ter' }, { em: '2026-11-06T12:00:00.000Z', por: 'T', de: 'ter', para: 'ok' }];
  comp.grupos.prep.tarefas.apoloRec.status = 'ok'; comp.grupos.prep.tarefas.apoloRec.responsavel = 'Jhonas';
  comp.grupos.usg.documental = { 15: { cod: '15', nome: 'DR X', unidade: '17', relatorio: '2026-11-11', nfRecebida: '2026-11-12', nfFinanceiro: '2026-11-13', pendencia: '' }, 16: { cod: '16', nome: 'DRA Y', unidade: '17', relatorio: '', nfRecebida: '', nfFinanceiro: '', pendencia: '' } };
  t.salvarFluxo();
  const L = n => Array.from({ length: n }, (_, i) => ({ chave: 'k' + i, estado: i ? 'conferido' : 'pendente', medico: 'DR', codigo: '40901173', vlRepasse: 10, vlTotal: 20, quant: 1, grupo: 'ULTRASSONOGRAFIA', desc: 'US', convenio: 'UNIMED', tipoItem: 'procedimento', kd: 'kd' + i, kl: '', decisao: '' }));
  const R = (id, cod, nome, em, ch, aceite = null) => ({ id, tipo: 'conferencia', em, operador: 'T', arquivos: [{ papel: 'MV', hash: id }], unidadeCod: '17', prestadorCod: cod, prestadorNome: nome, repasse: '1', competencia: '', chaveCompetencia: ch, descricao: 'REPASSE USG', parametros: {}, versoes: {}, contagens: {}, linhas: L(4), aceite: aceite ? { por: 'T', em: aceite, obs: '', pendencias: 0 } : null });
  for (const r of [R('r1', '15', 'DR X', '2026-11-09T13:00:00.000Z', '2026-11'), R('r2', '15', 'DR X', '2026-11-10T13:00:00.000Z', '2026-11', '2026-11-10T14:00:00.000Z'),
    R('r3', '16', 'DRA Y', '2026-11-11T13:00:00.000Z', '2026-11', '2026-11-11T14:00:00.000Z'),
    R('o1', '15', 'DR X', '2026-10-08T13:00:00.000Z', '2026-10'), R('o2', '15', 'DR X', '2026-10-09T13:00:00.000Z', '2026-10'), R('o3', '15', 'DR X', '2026-10-13T13:00:00.000Z', '2026-10', '2026-10-13T14:00:00.000Z')]) await t.dbGravar(r);
  const nc = (competencia, natureza, responsavel) => ({ competencia, categoria: 'convenio', natureza, responsavel, unidade: 'X', paciente: 'P ' + Math.random(), data: '2026-10-01', valor: 50 });
  t.registrarNCs(S.nc, [nc('2026-11', 'nao-lancado', 'FAT A'), nc('2026-11', 'nao-lancado', 'FAT A'), nc('2026-11', 'duplicidade', 'FAT B'), nc('2026-10', 'nao-lancado', 'FAT A')], 'T');
  S.rodadas = await t.dbRodadasJanela('2026-11');
});
const ret = await p.evaluate(() => { const r = window.__RM.t.retrospectivaDe('2026-11'); return { prest: r.prestadores.map(x => ({ cod: x.cod, et: x.etapas, ate: x.rodadasAteAceite })), rod: r.rodadas, ter: r.terceiros, nc: r.nc, ant: r.antecedencia, resumo: r.resumo }; });
const x15 = ret.prest.find(x => x.cod === '15'), x16 = ret.prest.find(x => x.cod === '16');
ok(x15 && x15.et.geracaoConf === 1 && x15.et.confAceite === 1 && x15.et.aceiteEnvio === 1 && x15.et.envioNF === 1 && x15.et.nfFinanceiro === 1 && x15.et.total === 5,
  `lead time do DR X por etapa e total (geração 06/11 → Financeiro 13/11 = ${x15?.et.total} d.u.)`);
ok(x16 && x16.et.geracaoAceite === 3 && x16.et.total === null, `DRA Y: aceite 3 d.u. após a geração, ainda sem envio (total em aberto)`);
ok(x15.ate === 2 && x16.ate === 1 && ret.rod.media === 1.5 && ret.rod.pctPrimeira === 50, `rodadas até o aceite: 2 e 1 (média ${ret.rod.media}, ${ret.rod.pctPrimeira}% na 1ª)`);
ok(ret.ter.itens.some(i => i.origem === 'fluxo' && i.dias === 3 && i.quem === 'Jhonas'), 'espera por terceiros: etapa do Fluxo 3 d.u. em «Aguardando terceiros», com o responsável');
ok(ret.nc.total === 3 && ret.nc.porNatureza[0].nome.startsWith('Procedimento não lançado') && ret.nc.porNatureza[0].n === 2, 'NCs por natureza (a de outubro não conta em novembro)');
ok(ret.nc.reincidencias.length === 1 && ret.nc.reincidencias[0].faturista === 'FAT A' && ret.nc.reincidencias[0].meses === 2, 'reincidência: FAT A com «não lançado» em outubro e novembro');
const usg = ret.ant.find(a => a.id === 'usg');
ok(usg.dias === 0 && usg.situacao === 'abaixo' && usg.parcial, `antecedência USG: entrega 13/11 × pagamento 13/11 (dia 15 é domingo) = ${usg.dias} d.u., abaixo da meta de 5; parcial (1 de 2 NFs)`);
ok(ret.resumo.cobertura === 75, `cobertura de equivalências no resumo (${ret.resumo.cobertura}%)`);

// Tela: KPIs, comparação entre meses e lead time por prestador.
await abrirRetro();
const txt = await p.textContent('#fxCorpo');
ok(/Retrospectiva da competência 11\/2026/.test(txt) && /Lead time até o aceite/.test(txt) && /Antecedência ao Financeiro/.test(txt), 'subaba «Retrospectiva» com os indicadores');
const comp = await p.$$eval('.rt-comp thead th', e => e.map(x => x.textContent));
ok(comp.slice(1).join('|') === '08/2026|09/2026|10/2026|11/2026', `comparação com os 3 meses anteriores (${comp.slice(1).join(' · ')})`);
const linhaRod = await p.$$eval('.rt-comp tbody tr', trs => trs.find(t => t.textContent.startsWith('Rodadas até o aceite')).textContent);
ok(/3/.test(linhaRod) && /1,5/.test(linhaRod) && await p.$eval('.rt-comp tbody tr:nth-child(3) .rt-tend', e => e.classList.contains('melhor')).catch(() => false), 'rodadas: 3 em outubro → 1,5 em novembro, com seta de melhora');
ok(await p.$$eval('#rtPrest tbody tr', t => t.length) === 2 && /15 - DR X/.test(await p.textContent('#rtPrest')), 'tabela de lead time por prestador');
ok(/Gargalo do mês/.test(txt), 'mostra o gargalo (etapa com maior tempo médio)');

// Fechamento: marca «Aguardando terceiros» retirada fica no histórico e entra na retrospectiva.
await p.evaluate(() => window.__RM.irPara('fechamento')); await p.waitForSelector('[data-fsub="quadro"]'); await p.click('[data-fsub="quadro"]'); await p.waitForSelector('.quadro');
await p.click('.qd-card[data-sit$="|16"]'); await p.waitForSelector('#menuSit'); await p.click('#menuSit [data-ac="aguardando"]');
await p.waitForSelector('#dlg[open]'); await p.selectOption('#dlgCorpo select[name=quem]', 'medico'); await p.fill('#dlgCorpo input[name=motivo]', 'médico vai mandar a NF'); await okDlg();
await p.click('.qd-card[data-sit$="|16"]'); await p.waitForSelector('#menuSit'); await p.click('#menuSit [data-ac="tirarAguardando"]'); await p.waitForTimeout(300);
const hist = await p.evaluate(() => window.__RM.S.compReg.itens['2026-11'].fechamento.aguardandoHist);
ok(hist?.length === 1 && hist[0].cod === '16' && hist[0].motivo === 'médico vai mandar a NF' && hist[0].ate, 'tirar «Aguardando terceiros» guarda a marca no histórico (de quem, motivo, desde e até)');
ok(await p.evaluate(() => window.__RM.t.retrospectivaDe('2026-11').terceiros.itens.some(i => i.origem === 'fechamento' && i.cod === '16' && !i.aberto)), 'a marca retirada entra na espera por terceiros da retrospectiva');

// Melhorias para o próximo mês → backlog da competência seguinte.
await abrirRetro();
await p.fill('#rtTexto', 'Pedir a planilha do Apolo no 1º dia útil'); await p.selectOption('#rtInd', 'leadAceite'); await p.click('#rtAdd'); await p.waitForTimeout(200);
await p.fill('#rtTexto', 'Cobrar a NF no mesmo dia do e-mail'); await p.click('#rtAdd'); await p.waitForTimeout(200);
const mel = await p.evaluate(() => window.__RM.S.fluxo.competencias['2026-11'].melhorias);
ok(mel.length === 2 && mel[0].indicador === 'leadAceite' && mel[0].por === 'Teste Retro', 'melhorias gravadas no Fluxo da competência (com indicador e autor)');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#rtExp')]); await dl.saveAs(out + 'retrospectiva.xlsx');
await p.screenshot({ path: out + 'retrospectiva.png', fullPage: true });
const xl = JSON.parse(execFileSync('python3', ['-I', '-c', `import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1],read_only=True); r={n:[list(x) for x in wb[n].iter_rows(values_only=True)] for n in wb.sheetnames}
print(json.dumps(r,default=str))`, out + 'retrospectiva.xlsx'], { encoding: 'utf8' }));
ok(Object.keys(xl).join('|') === 'Resumo|Lead time|Terceiros|NCs|Antecedência|Melhorias', `Excel da retrospectiva com as abas ${Object.keys(xl).join(', ')}`);
ok(xl['Lead time'].some(r => r[1] === '15' && r[15] === 5) && xl.Melhorias.filter(r => r[0] === 'Para o próximo mês').length === 2, 'Excel: lead time total do DR X e as melhorias do mês');
ok(xl.Resumo.some(r => String(r[0]).startsWith('Rodadas até o aceite') && r[3] === 3 && r[4] === 1.5), 'Excel: resumo com a comparação entre meses');

// Sincronização: melhorias dos dois lados se juntam na mescla do Fluxo.
ok(await p.evaluate(() => {
  const { S, t } = window.__RM, base = JSON.parse(JSON.stringify(S.fluxo.competencias['2026-11'])), l = JSON.parse(JSON.stringify(base)), r = JSON.parse(JSON.stringify(base));
  l.melhorias.push({ id: 'mA', em: '2026-11-17T11:00:00Z', por: 'A', texto: 'a' }); r.melhorias.push({ id: 'mB', em: '2026-11-17T11:01:00Z', por: 'B', texto: 'b' });
  r.backlog = { x1: { status: 'feita', por: 'B', em: '2026-11-17T11:02:00Z' } };
  const m = t.mesclarFluxo(l, r, base); return !m.conflitos.length && m.comp.melhorias.length === 4 && m.comp.backlog.x1.status === 'feita';
}), 'mescla do Fluxo pela pasta: melhorias e backlog dos dois usuários se juntam sem conflito');

// Dezembro: as duas melhorias viram backlog; uma é feita, a outra segue para janeiro.
await p.evaluate(() => window.__RM.t.mudarCompetencia('2026-12')); await p.waitForTimeout(300);
await p.evaluate(() => window.__RM.irPara('fluxo')); await p.waitForSelector('[data-sub="acomp"]'); await p.click('[data-sub="acomp"]'); await p.waitForSelector('#fxCriar'); await p.click('#fxCriar'); await p.waitForSelector('.marco');
await abrirRetro();
ok(await p.$$eval('[data-bl]', e => e.length) === 2 && /Pedir a planilha do Apolo/.test(await p.textContent('.rt-pdca')), 'backlog de 12/2026 com as 2 melhorias combinadas em 11/2026');
await p.selectOption('[data-bl] select', 'feita'); await p.waitForSelector('#dlg[open]'); await p.fill('#dlgCorpo input[name=obs]', 'virou etapa do checklist'); await okDlg();
const bl = await p.evaluate(() => window.__RM.S.fluxo.competencias['2026-12'].backlog);
ok(Object.values(bl).length === 1 && Object.values(bl)[0].status === 'feita' && Object.values(bl)[0].obs === 'virou etapa do checklist', 'marcar «Feita» grava a situação (com observação) no Fluxo de 12/2026');
const jan = await p.evaluate(() => window.__RM.t.backlogDaCompetencia(window.__RM.S.fluxo.competencias, '2027-01').map(b => b.texto));
ok(jan.length === 1 && jan[0].startsWith('Cobrar a NF'), 'em 01/2027 segue só a melhoria que não foi feita nem descartada');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
