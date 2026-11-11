// v3.0.0-alpha.4 — «Exame»: laudos do mesmo paciente, dia, modalidade e médico cumprem juntos a regra composta
// (USG com Doppler em uma página ou em duas) e «Dispensar laudo» para «Só no laudo» que não precisa de lançamento.
// Dados fictícios; códigos reais do MV (40901203 órgãos e estruturas, 40901386 Doppler de órgão isolado).
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Exame')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const r = await p.evaluate(() => {
  const { S, t } = window.__RM, d = new Date(Date.UTC(2026, 9, 10)), dia = Math.round(d / 864e5);
  const L = (i, titulo, medico = 'DR X') => ({ i, linhaPlanilha: i + 2, idLaudo: String(100 + i), unidade: 'AlphaSonic Palhano', paciente: 'JOAO DA SILVA', pn: 'JOAO DA SILVA', idPac: '1', titulo, tn: titulo, data: d, dia, convenio: 'CISMEPAR', modalidade: 'US', medico, mn: medico });
  const R = (seq, codigo) => ({ seq, codigo, procDesc: codigo === '40901203' ? 'US ORGAOS E ESTRUTURAS' : 'DOPPLER ORGAO ISOLADO', grupoNome: 'ULTRASSONOGRAFIA', conta: String(seq), atendimento: '1', paciente: 'JOAO DA SILVA', convenio: 'CISMEPAR', data: d, vlRepasse: 10, vlTotal: 20, prestadorCod: '1' });
  const rel = cods => ({ regs: cods.map((c, i) => R(i + 1, c)), cab: { prestadorCod: '1' } });
  const regra = (extra = {}) => ({ id: 'c1', nome: 'Escroto com Doppler', titulos: ['ULTRASSONOGRAFIA DE BOLSA ESCROTAL COM DOPPLER'], palavras: null, itens: [{ rotulo: 'órgãos', codigos: ['40901203'], qtd: 1, excecoes: [] }, { rotulo: 'Doppler', codigos: ['40901386'], qtd: 1, excecoes: [] }], escopo: { unidade: '*', modalidade: '*' }, status: 'validada', responsavel: 'T', historico: [], ...extra });
  const relDop = { id: 'e1', codigo: '40901386', titulo: 'DOPPLER DE ORGAOS E ESTRUTURAS', status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [] };
  const eq = (compostas, itens = []) => ({ schema: 'repasse-medico/equivalencias', versaoSchema: 1, revisao: 1, itens, compostas, catalogoTitulos: [], catalogoTUSS: [] });
  const ver = (laudos, base, cods = ['40901203', '40901386']) => t.conferirCruzado(rel(cods), { laudos }, S.cfg, base, { unidadeCod: '17', tol: 0 }).linhas.map(x => `${x.r?.codigo || x.l.titulo}:${x.status}${x.l && x.r ? '@' + x.l.i : ''}${x.marcadores.has('composta-falta') ? ':falta' : ''}${x.marcadores.has('ambiguo') ? ':ambiguo' : ''}`).join(' | ');
  const COM = 'ULTRASSONOGRAFIA DE BOLSA ESCROTAL COM DOPPLER', DOP = 'DOPPLER DE ORGAOS E ESTRUTURAS';
  return {
    umaPagina: ver([L(0, COM)], eq([regra()])),
    duasPaginas: ver([L(0, COM), L(1, DOP)], eq([regra()], [relDop])),
    duasPaginasDopplerAntes: ver([L(0, DOP), L(1, COM)], eq([regra()], [relDop])),
    naListaDaRegra: ver([L(0, COM), L(1, 'DOPPLER DE BOLSA ESCROTAL')], eq([regra({ titulosMesmoEstudo: ['DOPPLER DE BOLSA ESCROTAL'] })])),
    faltaDoppler: ver([L(0, COM), L(1, DOP)], eq([regra()], [relDop]), ['40901203']),
    dopplerDuasVezes: ver([L(0, COM), L(1, DOP)], eq([regra()], [relDop]), ['40901203', '40901386', '40901386']),
    outroMedico: ver([L(0, COM), L(1, DOP, 'DR Y')], eq([regra()], [relDop]))
  };
});
ok(r.umaPagina === '40901203:conferido@0 | 40901386:conferido@0', `uma página («com Doppler»): órgãos + Doppler conferidos pela regra (${r.umaPagina})`);
ok(r.duasPaginas === '40901203:conferido@0 | 40901386:conferido@0 | DOPPLER DE ORGAOS E ESTRUTURAS:conferido', `duas páginas, Doppler com equivalência própria: o exame cumpre a regra, sem «ambíguo», e a 2ª página fica «mesmo estudo» (${r.duasPaginas})`);
ok(r.duasPaginasDopplerAntes === '40901203:conferido@1 | 40901386:conferido@1 | DOPPLER DE ORGAOS E ESTRUTURAS:conferido', `ordem das páginas na planilha não importa: sem «composição incompleta» falsa (${r.duasPaginasDopplerAntes})`);
ok(r.naListaDaRegra === '40901203:conferido@0 | 40901386:conferido@0 | DOPPLER DE BOLSA ESCROTAL:conferido', `2ª página na lista «outros laudos do mesmo exame» da regra (${r.naListaDaRegra})`);
ok(/^40901203:ressalva@0:falta \| DOPPLER DE ORGAOS E ESTRUTURAS:so-laudo$/.test(r.faltaDoppler), `Doppler não lançado no MV continua «composição incompleta» (${r.faltaDoppler})`);
ok(r.dopplerDuasVezes === '40901203:conferido@0 | 40901386:conferido@0 | 40901386:conferido@1 | DOPPLER DE ORGAOS E ESTRUTURAS:conferido'.replace(' | DOPPLER DE ORGAOS E ESTRUTURAS:conferido', '') || /40901386:\w+@1/.test(r.dopplerDuasVezes), `Doppler lançado 2 vezes: a 2ª linha fica com a 2ª página (${r.dopplerDuasVezes})`);
ok(r.outroMedico === '40901203:conferido@0 | 40901386:pendente@0:ambiguo | DOPPLER DE ORGAOS E ESTRUTURAS:so-laudo', `página de OUTRO médico não entra no exame: o Doppler fica pendente para você decidir quem laudou, e a página dele não some como «mesmo estudo» (${r.outroMedico})`);

// «Dispensar laudo» pela tela: «Só no laudo» sai das pendências, com justificativa, e «Remover decisão» desfaz.
await p.evaluate(() => {
  const { S } = window.__RM, d = new Date(Date.UTC(2026, 9, 10)), dia = Math.round(d / 864e5);
  S.apolo = { nome: 'apolo.xlsx', hash: 'h', laudos: [{ i: 0, linhaPlanilha: 2, idLaudo: '900', unidade: 'AlphaSonic Palhano', paciente: 'MARIA TESTE', pn: 'MARIA TESTE', idPac: '7', titulo: 'ULTRASSONOGRAFIA DE TIREOIDE', tn: 'ULTRASSONOGRAFIA DE TIREOIDE', descricao: '', data: d, dia, convenio: 'UNIMED', modalidade: 'US', medico: 'DR X', mn: 'DR X' }] };
  const reg = { seq: 1, pagina: 1, codigo: '40901173', procDesc: 'US TIREOIDE', grupoNome: 'ULTRASSONOGRAFIA', conta: '1', atendimento: '1', paciente: 'OUTRO PACIENTE', convenio: 'UNIMED', data: d, vlRepasse: 10, vlTotal: 20, pct: .5, quant: 1, prestadorCod: '1', prestadorNome: 'DR X', repasse: 'USG' };
  S.relatorios.push({ id: 'r1', nome: 'mv.pdf', tamanho: 1, hash: 'h1', unidadePasta: '17', rel: { arquivo: 'mv.pdf', cab: { prestadorCod: '1', prestadorNome: 'DR X', repasse: 'USG', descricao: 'REPASSE USG', competencia: '11/2026' }, regs: [reg], avisos: [], conferencias: [], ok: true } });
  window.__RM.irPara('conferencia');
});
await p.waitForSelector('#cfRodar'); if (await p.isVisible('#cfUn')) await p.selectOption('#cfUn', '17').catch(() => {});
await p.click('#cfRodar'); await p.waitForSelector('#cfExcel', { timeout: 15000 });
const linhaSL = await p.evaluate(() => window.__RM.S.conf.res.linhas.findIndex(x => x.status === 'so-laudo'));
await p.evaluate(() => { window.__RM.S.conf.soFalta = false; });
await p.click('#cfVerTodas'); await p.waitForTimeout(200);
await p.locator('#cfTab tr', { hasText: 'MARIA TESTE' }).first().click(); await p.waitForTimeout(200);
await p.click(`[data-dispensar="${linhaSL}"]`); await p.waitForSelector('#dlg[open]');
await p.selectOption('#dlgCorpo [name="mot"]', { index: 2 }); await p.click('#dlgBotoes button[value="ok"]'); await p.waitForTimeout(400);
const dec = await p.evaluate(i => { const x = window.__RM.S.conf.res.linhas[i]; return x.decisao ? `${x.decisao.tipo}|${x.decisao.justificativa}` : ''; }, linhaSL);
ok(/^dispensado\|Exame sem cobrança/.test(dec), `«Dispensar laudo…» grava a decisão com o motivo escolhido (${dec})`);
await p.evaluate(() => { window.__RM.S.conf.soFalta = true; }); await p.check('#cfSoFalta').catch(() => {}); await p.waitForTimeout(200);
const tab = await p.textContent('#cfTab'), falta = await p.textContent('.cf-frase');
ok(!/MARIA TESTE/.test(tab) && /dispensado/i.test(await p.textContent('.marcadores')), `o laudo dispensado sai de «só o que falta decidir» e aparece no marcador «Laudo dispensado»`);
await p.click('#cfRodar'); await p.waitForSelector('#cfExcel', { timeout: 15000 });
const dec2 = await p.evaluate(() => window.__RM.S.conf.res.linhas.find(x => x.status === 'so-laudo')?.decisao?.tipo);
ok(dec2 === 'dispensado', `a dispensa vale na nova rodada da competência (${dec2})`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
