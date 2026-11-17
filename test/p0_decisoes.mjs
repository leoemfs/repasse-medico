// v3.0.0-alpha.9 — P0 da auditoria de 16/11/2026 (decisões por linha que mudavam o valor pago). Dados fictícios.
// 1. A NC «não lançado» de um laudo «Só no laudo» (gravada pela chave do laudo) NÃO passa para o lançamento que o MV fez
//    depois para corrigir: a linha conferida volta a ser Devido, e a NC aparece como «lançada no MV» na reconferência.
// 2. Linha repetida no MV: a NC na cobrança duplicada («Esta é a repetida → NC») tira só a duplicata; a cobrança legítima
//    continua Devido. Decisões gravadas antes (chave sem a ordem) valem para uma linha só; rodadas antigas são lidas certo.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.clock.install({ time: new Date('2026-11-17T10:00:00') });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste P0')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });

// Monta o relatório do MV (seqs pedidos) e os laudos; roda a conferência pela tela, como o usuário.
const montar = (seqs, hash) => p.evaluate(({ seqs, hash }) => {
  const { S } = window.__RM, d = n => new Date(Date.UTC(2026, 9, n)), dia = n => Math.round(d(n) / 864e5);
  const L = (i, pac, titulo, n) => ({ i, linhaPlanilha: i + 2, idLaudo: String(800 + i), unidade: 'AlphaSonic Palhano', paciente: pac, pn: pac, idPac: String(i), titulo, tn: titulo, descricao: '', data: d(n), dia: dia(n), convenio: 'UNIMED', modalidade: 'US', medico: 'DR X', mn: 'DR X' });
  S.apolo = { nome: 'apolo.xlsx', hash: 'h', laudos: [L(0, 'ANA PAULA ROCHA', 'USG TIREOIDE', 3), L(1, 'BRUNA LIMA COSTA', 'USG TIREOIDE', 4), L(2, 'CARLA DIAS MOTA', 'USG TIREOIDE', 5)] };
  if (!S.eq.itens.some(e => e.id === 'eqP0')) S.eq.itens.push({ id: 'eqP0', codigo: '40901173', titulo: 'USG TIREOIDE', status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'T' });
  const R = (seq, pac, n, vl, conta = String(9000 + seq), atend = String(7000 + seq)) => ({ seq, pagina: 1, codigo: '40901173', procDesc: 'US TIREOIDE', grupoNome: 'ULTRASSONOGRAFIA', conta, atendimento: atend, paciente: pac, convenio: 'UNIMED', data: d(n), vlRepasse: vl, vlTotal: vl * 2, pct: .5, quant: 1, prestadorCod: '15', prestadorNome: 'DR X', repasse: '25022' });
  // 1 e 2: Ana, cobrança repetida (mesma conta, atendimento, código, data e valor); 3: Bruna; 4: Carla (o MV só lança na 2ª rodada).
  const todas = { 1: R(1, 'ANA PAULA ROCHA', 3, 10, '9001', '7001'), 2: R(2, 'ANA PAULA ROCHA', 3, 10, '9001', '7001'), 3: R(3, 'BRUNA LIMA COSTA', 4, 20), 4: R(4, 'CARLA DIAS MOTA', 5, 30) };
  const regs = seqs.map(s => ({ ...todas[s] }));
  // Repetição como o leitor do PDF marca (RN-185).
  const k = r => [r.codigo, r.conta, r.atendimento, r.vlRepasse].join('|'), n = new Map(), o = new Map();
  for (const r of regs) n.set(k(r), (n.get(k(r)) || 0) + 1);
  for (const r of regs) { o.set(k(r), (o.get(k(r)) || 0) + 1); r.repeticao = n.get(k(r)) > 1 ? { i: o.get(k(r)), n: n.get(k(r)) } : null; r.chave = `${r.codigo}|${r.conta}|${r.atendimento}|${r.data.toISOString().slice(0, 10)}|${o.get(k(r))}`; }
  S.relatorios = [{ id: 'r' + hash, nome: 'mv.pdf', tamanho: 1, hash, unidadePasta: '17', rel: { arquivo: 'mv.pdf', cab: { prestadorCod: '15', prestadorNome: 'DR X', repasse: '25022', descricao: 'REPASSE USG', competencia: '11/2026', repasses: [] }, regs, avisos: [], conferencias: [], ok: true } }];
  window.__RM.irPara('conferencia');
}, { seqs, hash });
const rodar = async () => { await p.waitForSelector('#cfRodar'); if (await p.isVisible('#cfUn')) await p.selectOption('#cfUn', '17').catch(() => {}); await p.click('#cfRodar'); await p.waitForSelector('#cfAbas', { timeout: 15000 }); await p.waitForTimeout(200); };
const classes = () => p.evaluate(() => window.__RM.S.conf.res.linhas.filter(x => x.r).map(x => `${x.r.seq}:${window.__RM.t.classeDaLinhaConf(x)}`).join(' '));
// Registra a NC pelo mesmo caminho da tela: candidato da linha → dados → registrarNCs (com a natureza escolhida).
const ncDaLinha = (filtro, natureza) => p.evaluate(({ filtro, natureza }) => {
  const { S } = window.__RM, T = window.__RM.t, res = S.conf.res, ctx = S.conf.ctx, x = res.linhas.find(new Function('x', `return ${filtro}`));
  const c = T.candidatoDaLinhaConferencia(x, ctx, S.cfg);
  const { novas } = T.registrarNCs(S.nc, [T.dadosDoCandidato(c, { natureza, competencia: S.comp })], 'Teste P0');
  return { tipo: c.tipo, chaves: c.chavesLinha, n: novas.length };
}, { filtro, natureza });
const reabrir = () => p.evaluate(() => window.__RM.irPara('conferencia'));

// ---------- P0-1: NC de «Só no laudo» não passa para o lançamento feito depois ----------
await montar([1, 3], 'mv-1'); await rodar();
const sl = await p.evaluate(() => window.__RM.S.conf.res.linhas.filter(x => !x.r && x.status === 'so-laudo').map(x => x.l.paciente));
ok(sl.includes('CARLA DIAS MOTA'), `1ª rodada: laudo da Carla «Só no laudo» (${sl.join(', ')})`);
const nc1 = await ncDaLinha(`!x.r && x.l?.paciente === 'CARLA DIAS MOTA'`, 'nao-lancado');
ok(nc1.n === 1 && nc1.tipo === 'so-laudo' && nc1.chaves.length === 1 && nc1.chaves[0].startsWith('L|'), `NC «não lançado» registrada pela chave do laudo (${nc1.chaves.join(', ')})`);
await reabrir(); await rodar();
ok(await p.evaluate(() => window.__RM.S.conf.res.linhas.find(x => !x.r && x.l?.paciente === 'CARLA DIAS MOTA')?.decisao?.tipo) === 'nc', 'o laudo continua reconhecido como NC enquanto não há lançamento');
// O MV lançou o procedimento da Carla: a linha forma par com o laudo e é conferida.
await montar([1, 3, 4], 'mv-2'); await rodar();
const st4 = await p.evaluate(() => window.__RM.S.conf.res.linhas.find(x => x.r?.seq === 4)?.status);
const c2 = await classes();
ok(st4 === 'conferido' && c2.includes('4:devido'), `2ª rodada: o lançamento novo (Carla) é conferido e fica Devido, sem herdar a NC do laudo (${c2})`);
const pag2 = await p.evaluate(() => window.__RM.t.totaisPorClasse(window.__RM.S.conf.res.linhas, window.__RM.t.classeDaLinhaConf));
ok(pag2.pagar === 60 && pag2.nc.valor === 0, `valor para pagamento inclui a linha corrigida no MV: R$ ${pag2.pagar} (NC R$ ${pag2.nc.valor})`);
// Na rodada gravada, o Fechamento também conta a linha.
const f2 = await p.evaluate(() => { const { S, t } = window.__RM, T = t, r = S.rodadas.find(y => y.id === S.conf.ctx.rodadaId), idx = T.indiceDecisoes(S.nc.itens.filter(x => x.competencia === S.comp), T.estadoCompetencia(S.compReg, S.comp).decisoes); return { cl: r.linhas.map(l => T.classeDaLinhaRodada(l, idx)).join(' '), f: t.fechamentoAtual().prestadores.find(y => y.cod === '15')?.unidades?.['17'] }; });
ok(f2.cl === 'devido devido devido' && f2.f === 60, `rodada gravada: as três linhas Devido; Fechamento R$ ${f2.f}`);
await p.click('#cfAba-nc'); await p.waitForTimeout(150);
const txNC = await p.textContent('[data-cfsec="nc"]');
ok(/lançada no MV/.test(txNC), 'aba «NCs e correções no MV»: a NC «não lançado» aparece como corrigida (lançada no MV)');
await p.screenshot({ path: out + 'p0_nc_lancada.png' });
await p.click('#cfAba-previa');
// A memória da decisão pela chave do laudo continua para o caso previsto (SOL-F6): NC de linha com par cujo procedimento sai do MV.
const nc3 = await ncDaLinha(`x.r?.seq === 3`, 'lancado-incorreto');
await montar([1, 4], 'mv-3'); await rodar();
ok(nc3.chaves.length === 2 && await p.evaluate(() => window.__RM.S.conf.res.linhas.find(x => !x.r && x.l?.paciente === 'BRUNA LIMA COSTA')?.decisao?.tipo) === 'nc', 'NC de linha com par: se o procedimento sai do MV, o laudo «Só no laudo» continua reconhecido como NC');
await p.evaluate(() => { const { S } = window.__RM; for (const n of S.nc.itens) n.situacao = 'nao-procede'; });

// ---------- P0-2: linha repetida — NC só na duplicata ----------
await montar([1, 2, 3, 4], 'mv-4'); await rodar();
const rep = await p.evaluate(() => window.__RM.S.conf.res.linhas.filter(x => x.r?.repeticao).map(x => `${x.r.seq}:${x.status}:${window.__RM.t.chaveMVDecisao(x.r)}`));
ok(rep.length === 2 && rep[0].endsWith('|1') && rep[1].endsWith('|2'), `as duas linhas repetidas têm chaves de decisão diferentes (${rep.join(' · ')})`);
const ncDup = await ncDaLinha(`x.r?.seq === 2`, 'duplicidade');
ok(ncDup.tipo === 'duplicidade', `«Esta é a repetida → NC» registra a NC de duplicidade na 2ª linha (${ncDup.chaves.join(', ')})`);
await reabrir(); await rodar();
const c4 = await classes();
ok(c4.startsWith('1:devido 2:nc'), `só a duplicata vira NC; a cobrança legítima continua Devido (${c4})`);
const t4 = await p.evaluate(() => window.__RM.t.totaisPorClasse(window.__RM.S.conf.res.linhas, window.__RM.t.classeDaLinhaConf));
ok(t4.nc.valor === 10 && t4.pagar === 60, `NC R$ ${t4.nc.valor} (só a duplicata); para pagamento R$ ${t4.pagar}`);
const rod4 = await p.evaluate(() => { const { S } = window.__RM, T = window.__RM.t, r = S.rodadas.find(y => y.id === S.conf.ctx.rodadaId), idx = T.indiceDecisoes(S.nc.itens.filter(x => x.competencia === S.comp), T.estadoCompetencia(S.compReg, S.comp).decisoes); return { kd: r.linhas.slice(0, 2).map(l => l.kd), cl: r.linhas.map(l => T.classeDaLinhaRodada(l, idx)).join(' '), v: r.chavesV }; });
ok(rod4.v === 2 && rod4.cl === 'devido nc devido devido', `rodada gravada com a ordem na chave: ${rod4.cl}`);
// Reconferência: o MV tirou a duplicata → NC corrigida; a linha legítima não é tomada pela NC.
await montar([1, 3, 4], 'mv-5'); await rodar();
const c5 = await classes();
ok(c5.startsWith('1:devido'), `sem a duplicata, a linha que ficou continua Devido (${c5})`);
await p.click('#cfAba-nc'); await p.waitForTimeout(150);
ok(/Corrigida no MV/.test(await p.textContent('[data-cfsec="nc"]')), 'a NC da duplicata aparece como corrigida no MV');
await p.click('#cfAba-previa');
await p.evaluate(() => { const { S } = window.__RM; for (const n of S.nc.itens) n.situacao = 'nao-procede'; });

// ---------- Decisões e rodadas gravadas antes desta versão (chave sem a ordem) ----------
const leg = await p.evaluate(() => {
  const T = window.__RM.t, d = n => new Date(Date.UTC(2026, 9, n));
  const r = { conta: '9001', atendimento: '7001', codigo: '40901173', data: d(3) }, base = T.chaveMVBase(r);
  const L1 = r1 => ({ r: { ...r, ordDecisao: { i: r1, n: 2 } }, l: null });
  const res = {};
  // NC antiga de duplicidade (chave base): só a 2ª.
  let idx = T.indiceDecisoes([{ id: 'a', situacao: 'aberta', origem: { tipoCandidato: 'duplicidade', chavesLinha: [base] } }], []);
  res.dup = [1, 2].map(i => T.decisaoDaLinha(idx, L1(i).r, null)?.tipo || '-').join(' ');
  // Aceite antigo (chave base, sem laudo): só a 1ª — nunca paga a cobrança a mais sem decisão.
  idx = T.indiceDecisoes([], [{ id: 'b', chaves: [base], justificativa: 'x' }]);
  res.ace = [1, 2].map(i => T.decisaoDaLinha(idx, L1(i).r, null)?.tipo || '-').join(' ');
  // NC antiga com laudo: vale para a linha do mesmo laudo.
  idx = T.indiceDecisoes([{ id: 'c', situacao: 'aberta', origem: { tipoCandidato: 'outro-medico', chavesLinha: [base, 'L|900'] } }], []);
  res.lau = [[1, 'L|1'], [2, '900']].map(([i, id]) => T.decisaoDaLinha(idx, L1(i).r, { idLaudo: id.replace('L|', '') })?.tipo || '-').join(' ');
  // Linha única: a chave de sempre (as decisões já gravadas continuam valendo).
  res.unica = T.chaveMVDecisao({ ...r, ordDecisao: null }) === base;
  // Rodada antiga: linhas com a mesma chave ganham a ordem ao ler; as únicas ficam como estão.
  const rod = T.normalizarChavesRodada({ linhas: [{ kd: base }, { kd: base }, { kd: 'M|1|2|3|2026-10-04' }] });
  res.rod = rod.linhas.map(l => l.kd.split('|').slice(5).join('') || 'base').join(' ') + ' v' + rod.chavesV;
  return res;
});
ok(leg.dup === '- nc', `NC de duplicidade gravada antes: só a repetida (${leg.dup})`);
ok(leg.ace === 'considerar -', `aceite gravado antes numa linha repetida: só a 1ª (${leg.ace})`);
ok(leg.lau === '- nc', `NC gravada antes com laudo: só a linha do mesmo laudo (${leg.lau})`);
ok(leg.unica, 'linha única mantém a chave de sempre');
ok(leg.rod === '1 2 base v2', `rodada antiga lida com a ordem nas linhas repetidas (${leg.rod})`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
