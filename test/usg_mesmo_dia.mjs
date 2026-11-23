// v3.0.0-alpha.23 (SOL-F47) — Vários USG do mesmo paciente no mesmo dia: quando a equivalência não decide, o título do laudo
// desempata pela descrição do MV (afinidade), e um par que continua sendo palpite não entra na validação em lote.
// Dados fictícios; códigos TUSS de USG (40901122 abdome total, 40901300 transvaginal, 40901173 tireoide).
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });

const r = await p.evaluate(() => {
  const { S, t } = window.__RM, d = new Date(Date.UTC(2026, 9, 10)), dia = Math.round(d / 864e5);
  const ABD = '40901122', TV = '40901300', TIR = '40901173';
  const DESC = { [ABD]: 'US - ABDOME TOTAL (ABDOME SUPERIOR, RINS, BEXIGA, AORTA, VEIA CAVA INFERIOR E ADRENAIS)', [TV]: 'US - TRANSVAGINAL (UTERO, OVARIO, ANEXOS E VAGINA)', [TIR]: 'US - TIREOIDE' };
  const L = (i, titulo, medico = 'DR X') => ({ i, linhaPlanilha: i + 2, idLaudo: String(100 + i), unidade: 'AlphaSonic Palhano', paciente: 'ANA LIMA', pn: 'ANA LIMA', idPac: '1', titulo, tn: titulo, data: d, dia, convenio: 'CISMEPAR', modalidade: 'US', medico, mn: medico });
  const R = (seq, codigo) => ({ seq, codigo, procDesc: DESC[codigo], grupoNome: 'ULTRASSONOGRAFIA', conta: String(seq), atendimento: '1', paciente: 'ANA LIMA', convenio: 'CISMEPAR', data: d, vlRepasse: 10, vlTotal: 20, prestadorCod: '1' });
  const rel = (codigo, titulo, status = 'validada') => ({ id: `e${codigo}${titulo}`, codigo, titulo, status, escopo: { unidade: '*', modalidade: '*' }, historico: [] });
  const eq = (itens = []) => ({ schema: 'repasse-medico/equivalencias', versaoSchema: 1, revisao: 1, itens, compostas: [], catalogoTitulos: [], catalogoTUSS: [] });
  const conf = (cods, tits, base = eq()) => t.conferirCruzado({ regs: cods.map((c, i) => R(i + 1, c)), cab: {} }, { laudos: tits.map((x, i) => typeof x === 'string' ? L(i, x) : L(i, ...x)) }, S.cfg, base, { unidadeCod: '17', tol: 0 });
  const txt = res => res.linhas.map(x => `${x.r?.codigo || x.l.titulo}:${x.status}${x.r && x.l ? '→' + x.l.titulo : ''}${['ambiguo', 'escolhido-titulo'].filter(m => x.marcadores.has(m)).map(m => ':' + m).join('')}`).join(' | ');
  const TAB = 'USG DE ABDOME TOTAL', TTV = 'ULTRASSONOGRAFIA TRANSVAGINAL', TTI = 'ULTRASSONOGRAFIA DE TIREOIDE';
  const tres = conf([ABD, TV, TIR], [TTI, TTV, TAB]);
  const causasTres = t.causasDaConferencia(tres).grupos.map(g => `${g.tipo}:${g.codigo}×${g.titulo}`).sort();
  const genericos = conf([ABD, TIR], ['EXAME DE IMAGEM', 'LAUDO COMPLEMENTAR']);
  const cg = t.causasDaConferencia(genericos);
  return {
    afSuperior: [t.afinidadeTitulo('US - ABDOME SUPERIOR (FIGADO, VIAS BILIARES, VESICULA, PANCREAS, BACO)', 'USG DE ABDOME SUPERIOR'), t.afinidadeTitulo(DESC[ABD], 'USG DE ABDOME SUPERIOR')],
    afRins: [t.afinidadeTitulo('US - APARELHO URINARIO (RINS E BEXIGA)', 'USG DE RINS E VIAS URINARIAS'), t.afinidadeTitulo(DESC[ABD], 'USG DE RINS E VIAS URINARIAS')],
    afMamas: t.afinidadeTitulo('US - MAMARIA BILATERAL', 'ULTRASSONOGRAFIA DE MAMAS'),
    tres: txt(tres), causasTres,
    faltaLaudo: txt(conf([ABD, TV, TIR], [TTI, TAB])),
    ordemInversa: txt(conf([TIR, TV, ABD], [TAB, TTV, TTI])),
    contra: txt(conf([ABD], [TTI, 'USG ABDOMINAL'], eq([rel(TIR, TTI)]))),
    validadas: txt(conf([ABD, TV, TIR], [TTI, TTV, TAB], eq([rel(ABD, TAB), rel(TV, TTV), rel(TIR, TTI)]))),
    pendentes: txt(conf([ABD, TIR], [TTI, TAB], eq([rel(ABD, TAB, 'pendente'), rel(TIR, TTI, 'pendente')]))),
    genericos: txt(genericos), genericosCausas: [cg.grupos.map(g => g.tipo).join(','), cg.umaUma.map(g => g.tipo).join(',')],
    bilateral: txt(conf([ABD, ABD], [TAB])),
    rins: txt(t.conferirCruzado({ regs: [R(1, ABD), { ...R(2, '40901165'), procDesc: 'US - APARELHO URINARIO (RINS E BEXIGA)' }], cab: {} }, { laudos: [L(0, 'USG DE RINS E VIAS URINARIAS'), L(1, TAB)] }, S.cfg, eq(), { unidadeCod: '17', tol: 0 })),
    outroMedico: txt(conf([ABD, TIR], [[TTI, 'DR Y'], TAB]))
  };
});

ok(r.afSuperior[0] > r.afSuperior[1], `afinidade: «USG de abdome superior» fica mais perto de «US - ABDOME SUPERIOR» do que de «US - ABDOME TOTAL (ABDOME SUPERIOR…)» (${r.afSuperior})`);
ok(r.afRins[0] > r.afRins[1], `afinidade: «USG de rins e vias urinárias» fica com o aparelho urinário, não com o abdome total que cita os rins (${r.afRins})`);
ok(r.afMamas >= 0.5, `afinidade: «mamária» e «mamas» são a mesma estrutura (${r.afMamas})`);
ok(r.tres === `40901122:pendente→USG DE ABDOME TOTAL:escolhido-titulo | 40901300:pendente→ULTRASSONOGRAFIA TRANSVAGINAL:escolhido-titulo | 40901173:pendente→ULTRASSONOGRAFIA DE TIREOIDE:escolhido-titulo`,
  `3 USG no mesmo dia sem equivalência: cada linha fica com o laudo do seu exame, sem «ambíguo» (${r.tres})`);
ok(r.causasTres.join(' ; ') === 'eq-sem-cadastro:40901122×USG DE ABDOME TOTAL ; eq-sem-cadastro:40901173×ULTRASSONOGRAFIA DE TIREOIDE ; eq-sem-cadastro:40901300×ULTRASSONOGRAFIA TRANSVAGINAL',
  `«O que falta decidir» propõe validar os pares certos (${r.causasTres.join(' ; ')})`);
ok(/^40901122:pendente→USG DE ABDOME TOTAL:escolhido-titulo \| 40901300:so-faturamento \| 40901173:pendente→ULTRASSONOGRAFIA DE TIREOIDE:escolhido-titulo$/.test(r.faltaLaudo),
  `falta o laudo da transvaginal: é ela que fica «Só no faturamento» (candidato a NC certo), não a tireoide (${r.faltaLaudo})`);
ok(r.ordemInversa === `40901173:pendente→ULTRASSONOGRAFIA DE TIREOIDE:escolhido-titulo | 40901300:pendente→ULTRASSONOGRAFIA TRANSVAGINAL:escolhido-titulo | 40901122:pendente→USG DE ABDOME TOTAL:escolhido-titulo`,
  `a ordem das linhas no MV e dos laudos na planilha não muda o pareamento (${r.ordemInversa})`);
ok(r.contra === '40901122:pendente→USG ABDOMINAL:escolhido-titulo | ULTRASSONOGRAFIA DE TIREOIDE:so-laudo',
  `laudo com título validado para outro código (tireoide) não fica com a linha do abdome (${r.contra})`);
ok(r.validadas === `40901122:conferido→USG DE ABDOME TOTAL | 40901300:conferido→ULTRASSONOGRAFIA TRANSVAGINAL | 40901173:conferido→ULTRASSONOGRAFIA DE TIREOIDE`,
  `com as equivalências validadas, continua «Conferido» sem marcador novo (${r.validadas})`);
ok(r.pendentes === '40901122:pendente→USG DE ABDOME TOTAL | 40901173:pendente→ULTRASSONOGRAFIA DE TIREOIDE', `equivalências pendentes já cadastradas continuam decidindo o par (${r.pendentes})`);
ok(/:ambiguo.*:ambiguo/.test(r.genericos) && !/escolhido-titulo/.test(r.genericos), `títulos que não dizem o exame continuam «Mais de um laudo plausível» (${r.genericos})`);
ok(r.genericosCausas[0] === '' && r.genericosCausas[1] === 'ambiguo,ambiguo', `par que é palpite vai para a decisão linha a linha, não para «cadastrar e validar» em lote (${r.genericosCausas})`);
ok(r.rins === '40901122:pendente→USG DE ABDOME TOTAL:escolhido-titulo | 40901165:pendente→USG DE RINS E VIAS URINARIAS:escolhido-titulo', `abdome total × aparelho urinário (o abdome também cita os rins): cada um com o seu laudo (${r.rins})`);
ok(/^40901122:pendente→USG DE ABDOME TOTAL:escolhido-titulo \| 40901122:so-faturamento$/.test(r.bilateral) || /^40901122:pendente→USG DE ABDOME TOTAL \| 40901122:so-faturamento$/.test(r.bilateral),
  `duas linhas do mesmo código e um laudo: a 2ª continua «Só no faturamento» (${r.bilateral})`);
ok(/40901122:pendente→USG DE ABDOME TOTAL/.test(r.outroMedico) && /40901173:pendente→ULTRASSONOGRAFIA DE TIREOIDE/.test(r.outroMedico), `laudo de outro médico no mesmo dia: o título ainda leva cada linha ao seu exame (${r.outroMedico})`);

// Tela: a lista de candidatos mostra a afinidade do título.
await p.evaluate(() => {
  const { S } = window.__RM, d = new Date(Date.UTC(2026, 9, 10)), dia = Math.round(d / 864e5);
  const L = (i, titulo) => ({ i, linhaPlanilha: i + 2, idLaudo: String(900 + i), unidade: 'AlphaSonic Palhano', paciente: 'ANA LIMA', pn: 'ANA LIMA', idPac: '7', titulo, tn: titulo, descricao: '', data: d, dia, convenio: 'CISMEPAR', modalidade: 'US', medico: 'DR X', mn: 'DR X' });
  S.apolo = { nome: 'apolo.xlsx', hash: 'h', laudos: [L(0, 'ULTRASSONOGRAFIA DE TIREOIDE'), L(1, 'USG DE ABDOME TOTAL')] };
  const reg = (seq, codigo, procDesc) => ({ seq, pagina: 1, codigo, procDesc, grupoNome: 'ULTRASSONOGRAFIA', conta: String(seq), atendimento: '1', paciente: 'ANA LIMA', convenio: 'CISMEPAR', data: d, vlRepasse: 10, vlTotal: 20, pct: .5, quant: 1, prestadorCod: '1', prestadorNome: 'DR X', repasse: 'USG' });
  S.relatorios.push({ id: 'r1', nome: 'mv.pdf', tamanho: 1, hash: 'h1', unidadePasta: '17', rel: { arquivo: 'mv.pdf', cab: { prestadorCod: '1', prestadorNome: 'DR X', repasse: 'USG', descricao: 'REPASSE USG', competencia: '11/2026' }, regs: [reg(1, '40901122', 'US - ABDOME TOTAL (ABDOME SUPERIOR, RINS, BEXIGA)'), reg(2, '40901173', 'US - TIREOIDE')], avisos: [], conferencias: [], ok: true } });
  window.__RM.irPara('conferencia');
});
await p.waitForSelector('#cfRodar'); if (await p.isVisible('#cfUn')) await p.selectOption('#cfUn', '17').catch(() => {});
await p.click('#cfRodar'); await p.waitForSelector('#cfExcel', { timeout: 15000 });
await p.evaluate(() => { window.__RM.S.conf.soFalta = false; });
await p.click('#cfVerTodas'); await p.waitForTimeout(200);
await p.locator('#cfTab tr', { hasText: 'ABDOME TOTAL' }).first().click(); await p.waitForTimeout(200);
const det = await p.textContent('#cfTab');
ok(/título 100%/.test(det) && /título 0%/.test(det), 'detalhe da linha mostra a afinidade de cada laudo candidato («título 100%» × «título 0%»)');
ok(/Laudo escolhido pelo título/.test(det), 'detalhe da linha explica por que o laudo foi escolhido');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
