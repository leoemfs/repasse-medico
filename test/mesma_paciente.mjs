// v3.0.0-alpha.46 — Caso real de 25/11/2026 (Melanie, unidade 4): a linha do MV «MARTA APARECIDA DA» (mamografia convencional)
// pareava com o laudo de OUTRA paciente de nome apenas semelhante («MARIA APARECIDA FLORA…», 3 dias antes, outro médico), porque
// o título desse laudo estava validado para o código cobrado e o da paciente certa («Mamografia Digital») estava validado para a
// digital. O laudo certo sobrava «Só no laudo». Agora a mesma paciente, na mesma data, vem antes do nome apenas semelhante.
// Dados fictícios montados no próprio teste, direto no motor.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), p = await b.newPage(), erros = [];
p.on('pageerror', e => erros.push(e.message));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const R = await p.evaluate(() => {
  const { S: E, t } = window.__RM;
  const eq = { ...E.eq, itens: [['40808033', 'MAMOGRAFIA BILATERAL'], ['40808041', 'MAMOGRAFIA DIGITAL']].map(([codigo, titulo], i) => ({ id: 'e' + i, codigo, titulo, status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'Teste' })), compostas: [] };
  const dt = d => new Date(Date.UTC(2026, 9, d)), n = s => s;
  const laudo = (i, pac, d, titulo, med, conv) => ({ i, paciente: pac, pn: pac, data: dt(d), dia: t.diaSerial(dt(d)), titulo, modalidade: 'MG', medico: med, mn: med.toUpperCase(), unidade: 'Ultramed Cambe', convenio: conv });
  const laudos = [laudo(0, 'MARIA APARECIDA FLORA DE SOUZA', 16, 'MAMOGRAFIA BILATERAL', 'Dr Caio', 'UNIMED'), laudo(1, 'MARTA APARECIDA DA ENCARNACAO GERTRUDES', 19, 'Mamografia Digital', 'Dra Melanie', 'BRADESCO SAUDE - ULTRAMED CAMBE')];
  const regs = [{ seq: 1, chave: 'k1', codigo: '40808033', procDesc: 'MAMOGRAFIA CONVENCIONAL BILATERAL - OP', grupoNome: 'MAMOGRAFIA DIAGNOSTICA', convenio: 'BRADESCO SAUDE -', paciente: 'MARTA APARECIDA DA', data: dt(19), vlTotal: 60, vlRepasse: 18, quant: 1, conta: '1', atendimento: '2' }];
  const res = t.conferirCruzado({ regs, cab: { prestadorCod: '10264', prestadorNome: 'MELANIE', repasse: '1', descricao: 'IMG' } }, { laudos }, E.cfg, eq, { tol: 7, unidadeCod: '*', medicos: ['DRA MELANIE'] });
  const mv = res.linhas.find(x => x.r), sl = res.linhas.filter(x => !x.r && x.status === 'so-laudo').map(x => x.l.paciente);
  return { par: mv.l?.paciente, st: mv.status, marc: [...mv.marcadores], sl };
});
ok(R.par === 'MARTA APARECIDA DA ENCARNACAO GERTRUDES', `a linha do MV pareia com o laudo da mesma paciente e data (${R.par})`);
ok(R.st === 'pendente' && R.marc.includes('eq-divergente') && !R.marc.includes('nome-semelhante'), `fica Pendente com «Procedimento diverge», sem «nome semelhante» (${R.marc.join(', ')})`);
ok(!R.sl.includes('MARTA APARECIDA DA ENCARNACAO GERTRUDES'), `o laudo certo não sobra como «Só no laudo» (sobram: ${R.sl.join(', ') || 'nenhum da Marta'})`);
ok(!erros.length, 'sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
