// v3.0.0-alpha.26 — SOL-F51: roteiro da conferência por relatório (Node puro). O passo é lido do que já existe:
// PDF lido, rodadas, decisões (Resolvido no MV, NC, aceitar), aceite e e-mail marcado.
import fs from 'fs'; import vm from 'vm';
const raiz = new URL('..', import.meta.url).pathname;
const ctx = vm.createContext({ TextDecoder, console });
for (const f of ['00-util.js', '63-classes.js', '84-decisoes.js', '64-roteiro.js']) vm.runInContext(fs.readFileSync(raiz + 'src/engine/' + f, 'utf8'), ctx);
let falhas = 0;
const ok = (desc, obtido, esperado) => { const b = JSON.stringify(obtido) === JSON.stringify(esperado); if (!b) falhas++; console.log(`${b ? '✔' : '✘'} ${desc}: ${JSON.stringify(obtido)}${b ? '' : ` (esperado ${JSON.stringify(esperado)})`}`); };
ctx.rot = o => vm.runInContext('roteiroDoRelatorio', ctx)(o);
const linha = (kd, estado = 'conferido', extra = {}) => ({ kd, kl: '', estado, tipoItem: 'procedimento', vlRepasse: 10, ...extra });
const rodada = (id, em, hash, linhas, extra = {}) => ({ id, tipo: 'conferencia', em, arquivos: [{ papel: 'MV', nome: `mv_${hash}.pdf`, hash }], linhas, aceite: null, ...extra });
const idx = (considerar = [], ncs = []) => vm.runInContext('indiceDecisoes', ctx)(ncs, considerar);
const pdf = h => ({ nome: `mv_${h}.pdf`, hash: h });
const passo = o => ctx.rot(o).passo;

ok('sem PDF e sem rodada: passo 1 (versão hospitalar no MV)', passo({ pdf: null, rodadas: [] }), 0);
ok('PDF lido, sem rodada: passo 2 (falta executar)', passo({ pdf: pdf('a'), rodadas: [] }), 1);
const r1 = rodada('r1', '2026-11-23T10:00:00Z', 'a', [linha('M|1'), linha('M|2', 'pendente'), linha('M|3', 'ressalva')]);
const p2 = ctx.rot({ pdf: pdf('a'), rodadas: [r1], idx: idx() });
ok('rodada com 2 pendentes: passo 2 e quantas faltam', [p2.passo, p2.pendentes, p2.detalhes[1]], [1, 2, '2 decisão(ões) faltam']);
const dec = idx([{ tipo: 'considerar', chaves: ['M|2'], justificativa: 'ok' }, { tipo: 'resolvido', chaves: ['M|3'], justificativa: 'corrigi' }]);
const p3 = ctx.rot({ pdf: pdf('a'), rodadas: [r1], idx: dec });
ok('tudo decidido, 1 «Resolvido no MV»: passo 3 (corrigir no MV)', [p3.passo, p3.resolvidos, p3.alerta], [2, 1, false]);
ok('PDF novo lido (outro hash): passo 4 (gerar de novo e reconferir)', passo({ pdf: pdf('b'), rodadas: [r1], idx: dec }), 3);
const r2 = rodada('r2', '2026-11-23T15:00:00Z', 'b', [linha('M|1'), linha('M|2', 'pendente'), linha('M|3', 'ressalva')]);
const p3b = ctx.rot({ pdf: pdf('b'), rodadas: [r1, r2], idx: dec });
ok('PDF novo conferido e a linha continua lá: passo 3 com alerta', [p3b.passo, p3b.alerta], [2, true]);
const r3 = rodada('r3', '2026-11-23T16:00:00Z', 'c', [linha('M|1'), linha('M|2', 'pendente')]);
const p5 = ctx.rot({ pdf: pdf('c'), rodadas: [r1, r2, r3], idx: dec });
ok('correção saiu do MV: passo 5 (aceite), reconferido', [p5.passo, p5.detalhes[3]], [4, 'reconferido ✓']);
const r3a = { ...r3, aceite: { por: 'Leo', em: '2026-11-23T16:10:00Z' } };
ok('aceito, e-mail não marcado: passo 6 (versão final e envio)', passo({ pdf: pdf('c'), rodadas: [r1, r2, r3a], idx: dec }), 5);
ok('aceito e e-mail marcado: concluído', passo({ pdf: pdf('c'), rodadas: [r1, r2, r3a], idx: dec, enviado: '2026-11-24' }), 6);
const ra = rodada('ra', '2026-11-23T10:00:00Z', 'a', [linha('M|1'), linha('M|9', 'pendente')], { aceite: { por: 'Ana', em: '2026-11-23T11:00:00Z' } });
const pa = ctx.rot({ pdf: pdf('a'), rodadas: [ra], idx: idx() });
ok('aceite com pendência justificada: segue para o envio', [pa.passo, pa.detalhes[1]], [5, '1 pendente(s) no aceite, com observação']);
ok('NC numa linha que continua no PDF: passo 3', passo({ pdf: pdf('a'), rodadas: [rodada('rn', '2026-11-23T10:00:00Z', 'a', [linha('M|1'), linha('M|5', 'pendente')])], idx: idx([], [{ situacao: 'aberta', origem: { chavesLinha: ['M|5'] } }]) }), 2);
ok('rótulo do passo para a lista de relatórios', [vm.runInContext('rotuloPassoRoteiro', ctx)({ passo: 3 }), vm.runInContext('rotuloPassoRoteiro', ctx)({ passo: 6 })], ['passo 4 de 6', '✓ enviado']);
if (falhas) process.exitCode = 1;
