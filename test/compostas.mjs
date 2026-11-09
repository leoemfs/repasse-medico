// Teste SOL-F5 v2: regras compostas e por convênio — vários títulos ou palavras, quantidade por código,
// alternativas, excludente de convênio, falta e sobra; cadastro pela tela; fusão por percentual.
// Dados fictícios montados no próprio teste; códigos TUSS reais do MV.
import { createRequire } from 'module';
import fs from 'fs';
import { execFileSync } from 'child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Compostas')));
await p.goto(html + '#equivalencias');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const okDlg = async (botao = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${botao}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(250); };
const MAMAS = '40901114', DOP = '40901386', ART = '40901220', ORG = '40901203', TCS = '41001109', TCP = '41001117';

// 1) Cadastro pela tela: USG mamas + Doppler ×2 (UNIMED ×1), dois títulos.
await p.waitForSelector('#cmpNova'); await p.click('#cmpNova'); await p.waitForSelector('#dlg[open]');
await p.fill('#dlgCorpo [name="nome"]', 'USG mamas + Doppler');
await p.fill('#dlgCorpo [name="titulos"]', 'ULTRASSONOGRAFIA DAS MAMAS COM DOPPLER\nUSG DE MAMAS COM DOPPLER');
await p.fill('#dlgCorpo [name="cod0"]', MAMAS); await p.press('#dlgCorpo [name="cod0"]', 'Escape'); await p.fill('#dlgCorpo [name="rot0"]', 'USG mamas');
await p.fill('#dlgCorpo [name="cod1"]', DOP); await p.press('#dlgCorpo [name="cod1"]', 'Escape'); await p.fill('#dlgCorpo [name="rot1"]', 'Doppler'); await p.fill('#dlgCorpo [name="qtd1"]', '2');
await p.fill('#dlgCorpo [name="excConv1"]', 'unimed'); await p.press('#dlgCorpo [name="excConv1"]', 'Escape'); await p.selectOption('#dlgCorpo [name="excTipo1"]', 'quantidade'); await p.fill('#dlgCorpo [name="excQtd1"]', '1');
await p.screenshot({ path: out + 'compostas_cadastro.png' });
await okDlg('ok');
const c1 = await p.evaluate(() => window.__RM.S.eq.compostas[0]);
ok(c1 && c1.status === 'validada' && c1.titulos.length === 2 && c1.itens[1].qtd === 2 && c1.itens[1].excecoes[0].convenio === 'UNIMED' && c1.itens[1].excecoes[0].qtd === 1, 'cadastro pela tela: 2 títulos, Doppler ×2, UNIMED ×1, validada com responsável');
// Demais regras pelo motor (mesmo formato que a tela grava).
await p.evaluate(({ DOP, ART, ORG, TCS, TCP }) => {
  const { S: E } = window.__RM, v = (nome, campos) => ({ id: 'cmp' + nome.length + Math.random().toString(36).slice(2, 6), nome, escopo: { unidade: '*', modalidade: '*' }, status: 'validada', responsavel: 'Teste', validadoEm: new Date().toISOString(), historico: [], palavras: null, ...campos });
  E.eq.compostas.push(
    v('TC abdome total', { titulos: ['TOMOGRAFIA COMPUTADORIZADA DE ABDOME TOTAL', 'TOMOGRAFIA DE ABDOME TOTAL'], itens: [{ rotulo: 'TC abdome superior', codigos: [TCS], qtd: 1, excecoes: [] }, { rotulo: 'TC pelve', codigos: [TCP], qtd: 1, excecoes: [] }] }),
    v('USG articular + Doppler', { titulos: [], palavras: { todas: ['DOPPLER'], umaDe: ['PUNHO', 'OMBRO', 'JOELHO'] }, itens: [{ rotulo: 'USG articular', codigos: [ART], qtd: 1, excecoes: [{ convenio: 'UNIMED', tipo: 'nao-exigido', qtd: 0 }] }, { rotulo: 'Doppler', codigos: [DOP], qtd: 1, excecoes: [] }] }),
    v('Transvaginal + Doppler', { titulos: ['ULTRASSONOGRAFIA TRANSVAGINAL COM DOPPLER'], itens: [{ rotulo: 'USG transvaginal', codigos: ['40901300'], qtd: 1, excecoes: [] }, { rotulo: 'Doppler', codigos: [DOP], qtd: 1, excecoes: [] }] }),
    // Formato antigo (v1): continua valendo.
    { id: 'cmpv1', titulo: 'DOPPLER DE TIREOIDE', codigos: [ORG, DOP], porConvenio: [{ convenio: 'UNIMED', codigos: [DOP] }], escopo: { unidade: '*', modalidade: '*' }, status: 'validada', responsavel: 'Teste', historico: [] });
}, { DOP, ART, ORG, TCS, TCP });

// 2) Conferência com dados fictícios.
const r = await p.evaluate(({ MAMAS, DOP, ART, ORG, TCS, TCP }) => {
  const { S: E, t } = window.__RM, dt = new Date(Date.UTC(2026, 8, 10)), dia = t.diaSerial(dt);
  const laudos = [], regs = []; let seq = 0;
  const caso = (pac, titulo, conv, cods) => { laudos.push({ i: laudos.length, paciente: pac, pn: pac, data: dt, dia, titulo, modalidade: /TOMO/.test(titulo) ? 'CT' : 'US', medico: 'MEDICO TESTE', mn: 'MEDICO TESTE', unidade: 'X', convenio: '' });
    for (const c of cods) { seq++; regs.push({ seq, chave: 'c' + seq, codigo: c, procDesc: 'P' + c, grupoNome: /^4100/.test(c) ? 'TOMOGRAFIA COMPUT. DIAGNOSTICA' : 'ULTRASSONOGRAFIA - OUTROS', convenio: conv, paciente: pac, data: dt, vlTotal: 100, vlRepasse: 40, quant: 1, conta: '9' + seq, atendimento: '8' + seq, caso: pac }); } };
  caso('PACIENTE TC TOTAL', 'TOMOGRAFIA COMPUTADORIZADA DE ABDOME TOTAL', 'PARTICULAR', [TCS, TCP]);
  caso('PACIENTE MAMAS PART', 'USG DE MAMAS COM DOPPLER', 'PARTICULAR', [MAMAS, DOP, DOP]);
  caso('PACIENTE MAMAS UNIMED', 'ULTRASSONOGRAFIA DAS MAMAS COM DOPPLER', 'UNIMED CURITIBA', [MAMAS, DOP]);
  caso('PACIENTE MAMAS FALTA', 'USG DE MAMAS COM DOPPLER', 'PARTICULAR', [MAMAS, DOP]);
  caso('PACIENTE PUNHO UNIMED', 'ULTRASSONOGRAFIA DO PUNHO DIREITO COM DOPPLER', 'UNIMED CURITIBA', [ART, DOP]);
  caso('PACIENTE PUNHO PART', 'DOPPLER COLORIDO DO PUNHO DIREITO', 'PARTICULAR', [ART, DOP]);
  caso('PACIENTE TIREOIDE UNIMED', 'DOPPLER DE TIREOIDE', 'UNIMED LONDRINA', [DOP]);
  const res = t.conferirCruzado({ regs, cab: {} }, { laudos }, E.cfg, E.eq, { tol: 0, unidadeCod: '*', medicos: null });
  const por = {}; for (const x of res.linhas.filter(x => x.r)) (por[x.r.caso] = por[x.r.caso] || []).push(`${x.r.codigo}:${x.status}${[...x.marcadores].filter(m => /composta|divergente/.test(m)).map(m => '+' + m).join('')}`);
  const mot = res.linhas.find(x => x.r?.caso === 'PACIENTE MAMAS FALTA')?.motivos.join(' | ') || '';
  return { por, mot };
}, { MAMAS, DOP, ART, ORG, TCS, TCP });
const P = r.por;
ok(P['PACIENTE TC TOTAL'].every(x => /conferido\+composta$/.test(x)), `TC abdome total: superior + pelve conferidos pelo mesmo laudo (${P['PACIENTE TC TOTAL'].join(', ')})`);
ok(P['PACIENTE MAMAS PART'].length === 3 && P['PACIENTE MAMAS PART'].every(x => /conferido\+composta$/.test(x)), `mamas (particular): USG + Doppler ×2 conferidos (${P['PACIENTE MAMAS PART'].join(', ')})`);
ok(P['PACIENTE MAMAS UNIMED'].every(x => /conferido\+composta$/.test(x)), 'mamas (UNIMED): Doppler ×1 basta, sem composição incompleta');
ok(P['PACIENTE MAMAS FALTA'].every(x => /ressalva\+composta\+composta-falta/.test(x)) && /Doppler \(esperado ×2, lançado ×1\)/.test(r.mot), 'mamas (particular) com um Doppler só: «Composição incompleta — esperado ×2, lançado ×1»');
ok(P['PACIENTE PUNHO UNIMED'].some(x => x === `${ART}:so-faturamento+eq-divergente`) && P['PACIENTE PUNHO UNIMED'].some(x => /^40901386:conferido\+composta$/.test(x)), `punho com Doppler (UNIMED): Doppler conferido; articular sobra (excludente) (${P['PACIENTE PUNHO UNIMED'].join(', ')})`);
ok(P['PACIENTE PUNHO PART'].every(x => /conferido\+composta$/.test(x)), 'punho com Doppler (particular): título reconhecido pelas palavras; articular + Doppler conferidos');
ok(P['PACIENTE TIREOIDE UNIMED'].every(x => /conferido\+composta$/.test(x)), 'regra no formato antigo continua valendo (tireoide UNIMED: só o Doppler)');
// 2b) Mesmo estudo: «USG transvaginal com Doppler» fecha transvaginal + Doppler; o 2º laudo «Doppler de transvaginal»
// do mesmo dia não é «Só no laudo» faltante (vira decisão de um clique; com a regra marcada, conta como conferido).
const tv = async () => p.evaluate(({ DOP }) => {
  const { S: E, t } = window.__RM, dt = new Date(Date.UTC(2026, 8, 12)), dia = t.diaSerial(dt), laudos = [], regs = [];
  const L = titulo => laudos.push({ i: laudos.length, paciente: 'PACIENTE TV', pn: 'PACIENTE TV', data: dt, dia, titulo, modalidade: 'US', medico: 'MEDICO TESTE', mn: 'MEDICO TESTE', unidade: 'X', convenio: '' });
  L('ULTRASSONOGRAFIA TRANSVAGINAL COM DOPPLER'); L('DOPPLER DE TRANSVAGINAL');
  ['40901300', DOP].forEach((c, k) => regs.push({ seq: k + 1, chave: 'tv' + k, codigo: c, procDesc: 'P' + c, grupoNome: 'ULTRASSONOGRAFIA - OUTROS', convenio: 'PARTICULAR', paciente: 'PACIENTE TV', data: dt, vlTotal: 100, vlRepasse: 40, quant: 1, conta: '7' + k, atendimento: '6' + k }));
  const res = t.conferirCruzado({ regs, cab: {} }, { laudos }, E.cfg, E.eq, { tol: 0, unidadeCod: '*', medicos: null });
  const l2 = res.linhas.find(x => x.l?.titulo === 'DOPPLER DE TRANSVAGINAL' && !x.r);
  return { mv: res.linhas.filter(x => x.r).map(x => x.status).join(), l2: l2 ? `${l2.status}:${[...l2.marcadores].join('+')}` : 'pareado', cz: t.causasDaConferencia(res, E.eq.compostas).grupos.map(g => g.tipo).join() };
}, { DOP });
let tv1 = await tv();
ok(tv1.mv === 'conferido,conferido' && tv1.l2 === 'so-laudo:mesmo-estudo-possivel' && /mesmo-estudo/.test(tv1.cz), `2º laudo do mesmo estudo vira decisão «Laudo do mesmo estudo?» (não «Só no laudo» comum) (${tv1.l2})`);
await p.evaluate(() => { const r = window.__RM.S.eq.compostas.find(c => c.nome === 'Transvaginal + Doppler'); r.titulosMesmoEstudo = ['DOPPLER DE TRANSVAGINAL']; });
tv1 = await tv();
ok(tv1.l2 === 'conferido:mesmo-estudo' && !/mesmo-estudo/.test(tv1.cz), `com o título incluído na regra como do mesmo estudo, o laudo conta como conferido (${tv1.l2})`);
await p.evaluate(() => { const r = window.__RM.S.eq.compostas.find(c => c.nome === 'Transvaginal + Doppler'); delete r.titulosMesmoEstudo;
  const { S: E, t } = window.__RM, e = t.novaRelacao({ codigo: '40901386', titulo: 'DOPPLER DE TRANSVAGINAL', descMV: 'DOPPLER', escopo: { unidade: '*', modalidade: '*' }, origem: 'teste' }); E.eq.itens.push(e); t.alterarStatusEq(E.eq, [e.id], 'validada', 'Teste', 'teste', '2026-10'); });
tv1 = await tv();
ok(tv1.l2 === 'conferido:mesmo-estudo', `com equivalência validada «DOPPLER DE TRANSVAGINAL» × Doppler, também reconhece o mesmo estudo (${tv1.l2})`);
await p.evaluate(() => { const E = window.__RM.S.eq; E.itens = E.itens.filter(e => e.titulo !== 'DOPPLER DE TRANSVAGINAL'); });

// 3) Fusão de imagem: percentual da unidade onde foi feita (padrão) ou % fixo do valor faturado.
const fus = await p.evaluate(() => { const { S: E, t } = window.__RM, e = E.cfg.classes.equivalentes.find(x => x.nome === 'Fusão de imagem'), l = { grupo: 'TOMOGRAFIA COMPUT. DIAGNOSTICA', desc: 'FUSAO DE IMAGEM', vlTotal: 500, quant: 1, convenio: 'X' };
  const un1 = t.valorEsperadoIMG(E.cfg, null, 'A', l, '1'), un17 = t.valorEsperadoIMG(E.cfg, null, 'A', l, '17'), un5 = t.valorEsperadoIMG(E.cfg, null, 'A', l, '5');
  e.pctUnidade = false; e.pct = 30; const fixo = t.valorEsperadoIMG(E.cfg, null, 'A', l, '1'); e.pctUnidade = true; e.pct = 0;
  return { padrao: !!e.pctUnidade && !e.valor, un1, un17, un5, fixo }; });
ok(fus.padrao && fus.un1.esperado === 220 && fus.un17.esperado === 210 && /44% da unidade 1/.test(fus.un1.explicacao), `fusão de imagem: % da unidade — unidade 1 (44%) R$ ${fus.un1.esperado}, unidade 17 (42%) R$ ${fus.un17.esperado} (${fus.un1.explicacao})`);
ok(/unidade 5 sem percentual/.test(fus.un5.motivo || ''), `unidade sem percentual cadastrado vira aviso (${fus.un5.motivo})`);
ok(fus.fixo.esperado === 150 && /30% do valor faturado/.test(fus.fixo.explicacao), `% fixo continua possível: 30% de R$ 500,00 = ${fus.fixo.esperado}`);
await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub]'); await p.click('[data-bsub="classes"]');
ok(await p.isVisible('[data-eqv][data-c="pct"]') && await p.$eval('tr:has([value="Fusão de imagem"]) [data-c="pctUnidade"]', i => i.checked), 'Bases → Classes: colunas «Ou % do valor faturado» e «Ou % da unidade» (fusão marcada)');

// 4) Lista: as regras aparecem com composição e exceções.
await p.goto(html + '#equivalencias'); await p.waitForSelector('#cardCompostas');
const lista = await p.textContent('#cardCompostas');
ok(/USG mamas \+ Doppler/.test(lista) && /×2/.test(lista) && /não exigido/.test(lista) && /contém DOPPLER e um de PUNHO · OMBRO · JOELHO/.test(lista), 'lista mostra títulos, palavras, quantidade e excludente por convênio');
await p.locator('#cardCompostas').screenshot({ path: out + 'compostas_lista.png' });
// 5) Conflito (título validado para dois códigos) → «um ou outro» vira regra composta e o conflito deixa de travar.
await p.evaluate(() => { const { S: E, t } = window.__RM;
  const mk = (codigo, descMV, titulo) => { const e = t.novaRelacao({ codigo, titulo, descMV, escopo: { unidade: '*', modalidade: '*' }, origem: 'teste' }); E.eq.itens.push(e); t.alterarStatusEq(E.eq, [e.id], 'validada', 'Teste', 'teste', '2026-10'); };
  mk('40901204', 'USG BOLSA ESCROTAL - OP', 'ULTRASSONOGRAFIA DO ESCROTO'); mk('40901203', 'USG ORGAOS SUPERF. (TIREOIDE OU ESCROTO OU PENIS OU CRANIO)', 'ULTRASSONOGRAFIA DO ESCROTO');
  mk('40901204', 'USG BOLSA ESCROTAL - OP', 'USG DOPPLER DE BOLSA ESCROTAL'); mk('40901386', 'DOPPLER COLORIDO DE ORGAO OU ESTRUTURA ISOLADA - OP', 'USG DOPPLER DE BOLSA ESCROTAL'); });
await p.goto(html + '#inicio'); await p.goto(html + '#equivalencias'); await p.waitForSelector('[data-confou]');
const cf = await p.textContent('ul.conflitos');
ok(/ULTRASSONOGRAFIA DO ESCROTO[\s\S]*um ou outro/.test(cf) && /USG DOPPLER DE BOLSA ESCROTAL[\s\S]*juntos/.test(cf), 'conflito indica possível regra composta: escroto = um ou outro; título com Doppler = juntos');
await p.locator('ul.conflitos li:has-text("ULTRASSONOGRAFIA DO ESCROTO") [data-confou]').click(); await p.waitForSelector('#dlg[open]');
await p.fill('#dlgCorpo [name="just"]', 'escroto lançado como bolsa escrotal ou órgãos superficiais'); await okDlg('ok');
const esc2 = await p.evaluate(() => { const { S: E, t } = window.__RM, idx = t.indiceEquivalencias(E.eq); return ['40901204', '40901203'].map(c => t.avaliarProcedimento(idx, c, 'ULTRASSONOGRAFIA DO ESCROTO').estado); });
ok(esc2.join() === 'validada,validada' && !/«ULTRASSONOGRAFIA DO ESCROTO»/.test(await p.textContent('ul.conflitos').catch(() => '')) && /resolvidos por regra composta/.test(await p.textContent('#pag-equivalencias')), '«Um ou outro»: regra validada, os dois códigos confirmam o laudo e o título sai dos conflitos');
await p.locator('ul.conflitos li:has-text("USG DOPPLER DE BOLSA ESCROTAL") [data-confjt]').click(); await p.waitForSelector('#dlg[open]');
ok(await p.inputValue('#dlgCorpo [name="cod0"]') === '40901204' && await p.inputValue('#dlgCorpo [name="cod1"]') === '40901386' && /USG DOPPLER DE BOLSA ESCROTAL/.test(await p.inputValue('#dlgCorpo [name="titulos"]')), '«Juntos» abre o cadastro da regra composta já com o título e os dois códigos');
await p.screenshot({ path: out + 'compostas_conflito_juntos.png' });
await okDlg('');
// 6) Lista de pendentes agrupada por título: um ou outro, só o marcado, juntos e o botão na barra.
await p.evaluate(() => { const { S: E, t } = window.__RM;
  const mk = (codigo, descMV, titulo) => E.eq.itens.push(t.novaRelacao({ codigo, titulo, descMV, escopo: { unidade: '*', modalidade: '*' }, origem: 'teste' }));
  mk('40808041', 'MAMOGRAFIA DIGITAL BILATERAL - OP', 'MAMOGRAFIA DIGITAL'); mk('28850308', 'MAMOGRAFIA DIGITAL UNILATERAL - OP', 'MAMOGRAFIA DIGITAL');
  mk('40901286', 'USG PARTES MOLES', 'ULTRASSONOGRAFIA DO BRAÇO ESQUERDO'); mk('40901220', 'USG ARTICULAR (POR ARTICULACAO) - OP', 'ULTRASSONOGRAFIA DO BRAÇO ESQUERDO'); mk('40901211', 'USG EST. SUPERFICIAIS', 'ULTRASSONOGRAFIA DO BRAÇO ESQUERDO');
  mk('40901114', 'USG MAMAS - OP', 'DOPPLER MAMAS'); mk('40901386', 'DOPPLER COLORIDO DE ORGAO OU ESTRUTURA ISOLADA - OP', 'DOPPLER MAMAS'); });
await p.goto(html + '#inicio'); await p.goto(html + '#equivalencias'); await p.waitForSelector('#eqVis');
await p.selectOption('#eqSt', 'pendente'); await p.selectOption('#eqVis', 'titulo'); await p.waitForSelector('table.eq-grupos');
const gr = await p.$$eval('table.eq-grupos tbody tr', trs => trs.map(tr => tr.cells[0].textContent.trim()));
ok(!(await p.isVisible('#eqVal')) && gr.includes('MAMOGRAFIA DIGITAL') && gr.includes('ULTRASSONOGRAFIA DO BRAÇO ESQUERDO') && gr.includes('DOPPLER MAMAS'), `«Agrupar por título»: títulos com 2+ códigos pendentes (${gr.join(' · ')})`);
await p.screenshot({ path: out + 'compostas_lista_titulo.png', fullPage: true });
await p.locator('table.eq-grupos tr:has-text("MAMOGRAFIA DIGITAL") [data-gac="ou"]').click(); await p.waitForSelector('#dlg[open]');
await p.fill('#dlgCorpo [name="just"]', 'digital bilateral ou unilateral'); await okDlg('ok');
const mam = await p.evaluate(() => window.__RM.S.eq.itens.filter(e => e.titulo === 'MAMOGRAFIA DIGITAL').map(e => e.status).join());
ok(mam === 'coberta,coberta', `«Um ou outro»: regra validada e as duas relações saem de Pendentes («Cobertas por regra composta») (${mam})`);
await p.selectOption('#eqVis', 'titulo').catch(() => {}); await p.waitForSelector('table.eq-grupos');
const braco = p.locator('table.eq-grupos tr:has-text("BRAÇO ESQUERDO")');
for (const c of ['40901286', '40901211']) await braco.locator(`[data-gcod="${c}"]`).uncheck();
await braco.locator('[data-gac="so"]').click(); await okDlg('ok');
const br = await p.evaluate(() => Object.fromEntries(window.__RM.S.eq.itens.filter(e => /BRAÇO/.test(e.titulo)).map(e => [e.codigo, e.status])));
ok(br['40901220'] === 'validada' && br['40901286'] === 'desativada' && br['40901211'] === 'desativada', '«Só o marcado»: valida o código marcado e desativa os outros do título');
await p.locator('table.eq-grupos tr:has-text("DOPPLER MAMAS") [data-gac="juntos"]').click(); await p.waitForSelector('#dlg[open]');
ok(await p.inputValue('#dlgCorpo [name="cod0"]') === '40901114' && await p.inputValue('#dlgCorpo [name="cod1"]') === '40901386', '«Juntos» abre o cadastro da regra com os dois códigos do título');
await okDlg('');
// Regra desativada: as relações cobertas voltam a pendente.
await p.evaluate(() => { const { S: E, t } = window.__RM, r = E.eq.compostas.find(c => /MAMOGRAFIA DIGITAL/.test(c.nome)); t.alterarStatusComposta(E.eq, r.id, 'desativada', 'Teste', 'teste'); });
await p.goto(html + '#inicio'); await p.goto(html + '#equivalencias'); await p.waitForSelector('#eqVis');
ok(await p.evaluate(() => window.__RM.S.eq.itens.filter(e => e.titulo === 'MAMOGRAFIA DIGITAL').every(e => e.status === 'pendente')), 'regra desativada: as relações cobertas voltam a pendente');
// Botão na barra: regra composta com as selecionadas.
await p.selectOption('#eqVis', 'lista'); await p.waitForSelector('#eqTab input[data-id]'); await p.fill('#eqBusca', 'DOPPLER MAMAS'); await p.waitForTimeout(300);
await p.check('#eqTodos'); await p.click('#eqCmp'); await p.waitForSelector('#dlg[open]');
ok(/DOPPLER MAMAS/.test(await p.inputValue('#dlgCorpo [name="titulos"]')) && ['40901114', '40901386'].includes(await p.inputValue('#dlgCorpo [name="cod0"]')), '«Criar regra composta com as selecionadas» abre o cadastro com títulos e códigos marcados');
await okDlg('');
// 7) Planilha de equivalências linha a linha e leitura em português das regras.
await p.goto(html + '#inicio'); await p.goto(html + '#equivalencias'); await p.waitForSelector('#eqXlsx');
const leit = await p.$$eval('#cardCompostas .cp-leitura', e => e.map(x => x.textContent));
ok(leit.some(t => /^Espera na conta: 1× 40901114.*e 2× 40901386.*No convênio UNIMED.*esperado 1×/.test(t)), `cada regra mostra como funciona, em português (${(leit.find(t => /MAMAS/.test(t)) || '').slice(0, 140)}…)`);
const ctxDl = p.context(); const [dlx] = await Promise.all([p.waitForEvent('download'), p.click('#eqXlsx')]); const xe = out + 'equivalencias.xlsx'; await dlx.saveAs(xe);
const xq = JSON.parse(execFileSync('python3', ['-I', '-c', `import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1]); r=wb['Regras compostas']; it=wb['Itens das regras']; rel=wb['Relações']
print(json.dumps({'abas':wb.sheetnames,'leit':[x[2] for x in r.iter_rows(min_row=2,values_only=True)],'itens':it.max_row-1,'rel':rel.max_row-1}))`, xe]).toString());
const nIt = await p.evaluate(() => window.__RM.S.eq.compostas.map(c => window.__RM.t.regraComposta(c)).reduce((s, c) => s + c.itens.reduce((t, i) => t + Math.max(1, (i.excecoes || []).length), 0), 0));
ok(xq.abas.join('|') === 'Leia-me|Relações|Regras compostas|Itens das regras|Títulos das regras' && xq.itens === nIt && xq.rel === await p.evaluate(() => window.__RM.S.eq.itens.length) && xq.leit.every(t => /espera na conta/.test(t)), `«Exportar planilha (.xlsx)»: Leia-me, ${xq.rel} relações, ${xq.leit.length} regras com a leitura, ${xq.itens} itens linha a linha e os títulos de cada regra`);
// Desativada não vale.
await p.click('[data-cmpdes]'); await okDlg('').catch(() => {});
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
