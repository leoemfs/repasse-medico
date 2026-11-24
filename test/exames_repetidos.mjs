// v3.0.0-alpha.31 — Exames compostos repetidos no mesmo dia (achado nos relatórios de USG de 11/2026):
// 1) dois Dopplers de tireoide, cada um com a sua página de USG: as páginas não tornam a 2ª linha «ambígua»;
// 2) punção e Doppler no mesmo dia: a página de USG é «mesmo estudo» do Doppler, mesmo com a regra da punção antes.
// Dados fictícios; códigos reais do MV (40901203 órgãos superficiais, 40901386 Doppler, 40809161 punção).
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];
const p = await (await b.newContext()).newPage();
p.on('pageerror', e => erros.push(e.message));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const r = await p.evaluate(() => {
  const { S, t } = window.__RM, d = new Date(Date.UTC(2026, 9, 10)), dia = Math.round(d / 864e5);
  const L = (i, titulo) => ({ i, linhaPlanilha: i + 2, idLaudo: String(100 + i), unidade: 'AlphaSonic Palhano', paciente: 'ANA LIMA', pn: 'ANA LIMA', idPac: '1', titulo, tn: titulo, data: d, dia, convenio: 'UNIMED', modalidade: 'US', medico: 'DR X', mn: 'DR X' });
  const DESC = { '40901203': 'USG ORGAOS SUPERF. (TIREOIDE OU ESCROTO OU PENIS OU CRANIO)', '40901386': 'DOPPLER COLORIDO DE ORGAO OU ESTRUTURA ISOLADA - OP', '40809161': 'PUNÇÃO BIÓPSIA/ASPIRATIVA DE ÓRGÃO OU ESTRUTURA ORIENTADA POR USG' };
  const R = (seq, codigo) => ({ seq, codigo, procDesc: DESC[codigo], grupoNome: 'ULTRASSONOGRAFIA', conta: String(seq), atendimento: '1', paciente: 'ANA LIMA', convenio: 'UNIMED', data: d, vlRepasse: 10, vlTotal: 20, prestadorCod: '1' });
  const regra = (id, nome, titulos, itens) => ({ id, nome, titulos, palavras: null, itens: itens.map(([rotulo, codigos]) => ({ rotulo, codigos, qtd: 1, excecoes: [] })), escopo: { unidade: '*', modalidade: '*' }, status: 'validada', responsavel: 'T', historico: [] });
  const DOP = 'DOPPLER DE TIREÓIDE', USG = 'ULTRASSONOGRAFIA DA TIREOIDE', PUN = 'PUNÇÃO ASPIRATIVA POR AGULHA FINA DE TIREÓIDE GUIADA POR ULTRASSOM';
  const eq = { schema: 'repasse-medico/equivalencias', versaoSchema: 1, revisao: 1, catalogoTitulos: [], catalogoTUSS: [],
    itens: [{ id: 'u', codigo: '40901203', titulo: USG, status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [] }],
    compostas: [regra('pun', 'Punção (um ou outro)', [PUN], [['punção', ['40809099', '40809161']]]), regra('dop', 'Doppler de tireoide', [DOP], [['USG', ['40901654', '40901203']], ['Doppler', ['40901386']]])] };
  const ver = (cods, tits) => t.conferirCruzado({ regs: cods.map((c, i) => R(i + 1, c)), cab: {} }, { laudos: tits.map((x, i) => L(i, x)) }, S.cfg, eq, { unidadeCod: '17', tol: 0 })
    .linhas.map(x => `${x.r?.codigo || x.l.titulo}:${x.status}${x.marcadores.has('ambiguo') ? ':ambiguo' : ''}${x.marcadores.has('mesmo-estudo') ? ':mesmo-estudo' : ''}${x.marcadores.has('mesmo-estudo-possivel') ? ':possivel' : ''}`).join(' | ');
  return {
    dois: ver(['40901203', '40901203', '40901386', '40901386'], [DOP, USG, DOP, USG]),
    punDop: ver(['40809161', '40901203', '40901386'], [PUN, DOP, USG]),
    um: ver(['40901203', '40901386'], [DOP, USG])
  };
});
ok(r.um === '40901203:conferido | 40901386:conferido | ULTRASSONOGRAFIA DA TIREOIDE:conferido:mesmo-estudo', `um Doppler de tireoide em duas páginas: as duas linhas conferidas e a página de USG é «mesmo estudo» (${r.um})`);
ok(!/ambiguo/.test(r.dois) && (r.dois.match(/conferido/g) || []).length === 6, `dois Dopplers de tireoide no mesmo dia, cada um com a sua página de USG: tudo conferido, sem «ambíguo» (${r.dois})`);
ok(/ULTRASSONOGRAFIA DA TIREOIDE:conferido:mesmo-estudo/.test(r.punDop) && !/possivel/.test(r.punDop), `punção e Doppler no mesmo dia: a página de USG é «mesmo estudo» do Doppler, não «pode ser» da punção (${r.punDop})`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
