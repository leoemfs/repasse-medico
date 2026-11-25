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
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
