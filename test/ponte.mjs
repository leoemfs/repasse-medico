// v3.0.0-alpha.46 — Ponte Apolo → Power BI → MV pelo atendimento (25/11/2026). Dados fictícios, sem dados/.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname;
execFileSync('node', [raiz + 'tools/build.mjs', '--harness'], { stdio: 'ignore' });
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), p = await b.newPage(), erros = [];
p.on('pageerror', e => erros.push(e.message));
await p.goto('file://' + raiz + 'dist/harness.html'); await p.waitForFunction(() => window.PRONTO);
const r = await p.evaluate(() => {
  const n = s => s.toUpperCase();
  const abrev = [H.nomeAbreviadoCompat('MARIA AP SANTOS OLIVEIRA', 'MARIA APARECIDA DOS SANTOS OLIVEIRA'),
    H.nomeAbreviadoCompat('MARIA S', 'MARIA APARECIDA SANTOS'), H.nomeAbreviadoCompat('JOAO B FERREIRA', 'JOAO BATISTA FERREIRA'),
    H.nomeAbreviadoCompat('ANA PAULA SILVA', 'MARIA PAULA SILVA')];
  const cfg = H.cfgPadrao(); cfg.unidades = [{ cod: '4', nome: 'Ultramed Cambe', apolo: ['Ultramed Cambe'] }];
  const dia = Math.round(Date.UTC(2026, 9, 13) / 864e5), data = new Date(Date.UTC(2026, 9, 13));
  const PB = (at, pac, cod, grupo, conv, prest) => ({ atendimento: at, conta: '9' + at, paciente: pac, pn: pac, data, unidadeCod: '4', empresa: '4 - ULTRAMED CAMBE', grupo, codigo: cod, desc: '', convenio: conv, prestador: prest });
  const pbi = { linhas: [PB('2209601', 'MARIA APARECIDA DOS SANTOS OLIVEIRA', '40901122', 'ULTRASSONOGRAFIA', 'UNIMED', '1503'),
    PB('2201980', 'ANA PAULA DA SILVA', '40901173', 'ULTRASSONOGRAFIA', 'UNIMED', '1503'), PB('2202311', 'ANA PAULA SILVA SOUZA', '40901122', 'ULTRASSONOGRAFIA', 'PARTICULAR', '1503')] };
  const L = (i, pac, titulo, conv) => ({ i, pn: pac, paciente: pac, dia, data, unidade: 'Ultramed Cambe', modalidade: 'US', titulo, tn: titulo, convenio: conv, medico: 'DR X', mn: 'DR X' });
  const opc = { cfg, idxEq: null, unidadeCod: '4' };
  const p1 = H.ponteDoLaudo(pbi, L(0, 'MARIA AP SANTOS OLIVEIRA', 'USG ABDOME TOTAL', 'UNIMED'), opc);
  const p2 = H.ponteDoLaudo(pbi, L(1, 'ANA P SILVA', 'USG TIREOIDE', 'UNIMED'), opc);
  const p3 = H.ponteDoLaudo(pbi, L(2, 'CARLOS LIMA', 'USG TIREOIDE', 'UNIMED'), opc);
  return { abrev, p1: [p1.nivel, p1.melhor?.at.atendimento, p1.melhor?.pontos], p2: [p2.nivel, p2.melhor?.at.atendimento, p2.alternativas.length], p3: p3.nivel };
});
ok(JSON.stringify(r.abrev) === '[true,false,true,false]', `nome abreviado compatível só com 2 partes fortes e a 1ª igual: ${JSON.stringify(r.abrev)}`);
ok(r.p1[0] === 'firme' && r.p1[1] === '2209601', `laudo abreviado acha o atendimento no Power BI (vínculo firme): ${JSON.stringify(r.p1)}`);
ok(r.p2[0] === 'duvida' && r.p2[1] === '2201980' && r.p2[2] === 1, `dois atendimentos possíveis: dúvida, o de mais critérios primeiro: ${JSON.stringify(r.p2)}`);
ok(r.p3 === 'nenhum', 'paciente sem atendimento compatível: nenhum');
// Conferência do Henrique (25/11/2026): «TC abdome total» na conta; laudos do Henrique (abdome superior) e do Lucca
// (abdome total, validado para o código) no mesmo dia. A linha fica com o laudo do Henrique, não com o do Lucca.
const r2 = await p.evaluate(() => {
  const cfg = H.cfgPadrao(), eq = H.eqVaziaP();
  eq.itens.push({ id: 'e1', codigo: '41001095', titulo: 'TC ABDOME TOTAL', status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'T' });
  const data = new Date(Date.UTC(2026, 9, 10)), dia = Math.round(data / 864e5);
  const L = (i, titulo, med) => ({ i, linhaPlanilha: i + 2, idLaudo: 'L' + i, unidade: 'X', paciente: 'JOAO DA SILVA', pn: 'JOAO DA SILVA', idPac: '9', titulo, tn: titulo, descricao: '', data, dia, convenio: 'UNIMED', modalidade: 'CT', medico: med, mn: med });
  const apolo = { laudos: [L(0, 'TC ABDOME TOTAL', 'LUCCA MARICATO'), L(1, 'TC ABDOME SUPERIOR', 'HENRIQUE PINI')] };
  const r = { seq: 1, pagina: 1, codigo: '41001095', procDesc: 'TC ABDOME TOTAL', grupoNome: 'TOMOGRAFIA', conta: '1', atendimento: '100', paciente: 'JOAO DA SILVA', convenio: 'UNIMED', data, vlRepasse: 50, vlTotal: 100, pct: .5, quant: 1, prestadorCod: '10175', prestadorNome: 'HENRIQUE PINI', repasse: '1' };
  const rel = { cab: { prestadorCod: '10175', prestadorNome: 'HENRIQUE PINI', repasse: '1', descricao: 'REPASSE', competencia: '11/2026' }, regs: [r] };
  const com = H.conferirCruzado(rel, apolo, cfg, eq, { unidadeCod: '*', tol: 7, medicos: ['HENRIQUE PINI'] });
  const sem = H.conferirCruzado(rel, apolo, cfg, eq, { unidadeCod: '*', tol: 7, medicos: null });
  const par = res => res.linhas.find(x => x.r)?.l?.medico || '-';
  return [par(com), par(sem)];
});
ok(r2[0] === 'HENRIQUE PINI', `conferindo o Henrique, a linha fica com o laudo dele, não com o do Lucca (${r2[0]})`);
ok(r2[1] === 'LUCCA MARICATO', `sem médico escolhido, nada muda: fica o laudo validado (${r2[1]})`);
// Laudos que somam um código: superior + inferior do Henrique = 41001095 (TC abdome total).
const r3 = await p.evaluate(() => {
  const cfg = H.cfgPadrao(), eq = H.eqVaziaP();
  eq.somas = [H.novaSoma({ titulos: ['TC ABDOME SUPERIOR', 'TC ABDOME INFERIOR'], codigo: '41001095', desc: 'TC ABDOME TOTAL' }, 'Leo')];
  const data = new Date(Date.UTC(2026, 9, 10)), dia = Math.round(data / 864e5);
  const L = (i, titulo, med) => ({ i, linhaPlanilha: i + 2, idLaudo: 'L' + i, unidade: 'X', paciente: 'JOAO DA SILVA', pn: 'JOAO DA SILVA', idPac: '9', titulo, tn: titulo, descricao: '', data, dia, convenio: 'UNIMED', modalidade: 'CT', medico: med, mn: med });
  const r = { seq: 1, pagina: 1, codigo: '41001095', procDesc: 'TC ABDOME TOTAL', grupoNome: 'TOMOGRAFIA', conta: '1', atendimento: '100', paciente: 'JOAO DA SILVA', convenio: 'UNIMED', data, vlRepasse: 50, vlTotal: 100, pct: .5, quant: 1, prestadorCod: '10175', prestadorNome: 'HENRIQUE PINI', repasse: '1' };
  const rel = { cab: { prestadorCod: '10175', prestadorNome: 'HENRIQUE PINI', repasse: '1', descricao: 'REPASSE', competencia: '11/2026' }, regs: [r] };
  const completa = H.conferirCruzado(rel, { laudos: [L(0, 'TC ABDOME TOTAL', 'LUCCA MARICATO'), L(1, 'TC ABDOME SUPERIOR', 'HENRIQUE PINI'), L(2, 'TC ABDOME INFERIOR', 'HENRIQUE PINI')] }, cfg, eq, { unidadeCod: '*', tol: 7, medicos: ['HENRIQUE PINI'] });
  const parcial = H.conferirCruzado(rel, { laudos: [L(1, 'TC ABDOME SUPERIOR', 'HENRIQUE PINI')] }, cfg, eq, { unidadeCod: '*', tol: 7, medicos: ['HENRIQUE PINI'] });
  const lin = res => res.linhas.find(x => x.r), soLaudo = res => res.linhas.filter(x => x.status === 'so-laudo').map(x => x.l.titulo);
  const m = H.mesclarEq({ itens: [], compostas: [], somas: [] }, eq, null).eq.somas.length;
  return { st: lin(completa).status, soma: lin(completa).marcadores.has('soma'), so: soLaudo(completa), falta: lin(parcial).marcadores.has('soma-falta'), m };
});
ok(r3.st === 'conferido' && r3.soma, `superior + inferior do Henrique fecham «TC abdome total»: conferido (${r3.st})`);
ok(!r3.so.length, `os dois laudos do Henrique entram na soma e não sobram como «Só no laudo» (${JSON.stringify(r3.so)})`);
ok(r3.falta, 'só o superior: aviso «Soma de laudos incompleta»');
ok(r3.m === 1, 'a regra viaja na sincronização das equivalências');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
