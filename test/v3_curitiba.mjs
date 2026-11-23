// v3.0.0-alpha.21 — Regras de Curitiba (V3) de 23/11/2026, com dados fictícios:
// HM de raio-X e mamografia nunca pago (o 78 PF segue a regra geral) (aviso para excluir do MV) · HM de USG Unimed pelo valor da USG do médico, sem laudo,
// com o exame base no relatório · modalidade pelo TITLE na V3 · pacote de ressonância/mamografia considerado e notificado,
// substituindo o exame base Bradesco a 100% · V3 sem tomografia · médicos de Londrina que laudam na V3 por produção.
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
await p.clock.install({ time: new Date('2026-11-23T10:00:00') });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Curitiba')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });

// 1) HM: grupos que nunca são pagos valem antes de tudo.
const hm = await p.evaluate(() => { const t = window.__RM.t; return [
  ['77 - HONORARIO MEDICO RAIO X', 'RX TORAX - HM', 'UNIMED CURITIBA'], ['78 - HONORARIOS MEDICOS PF', 'RMN ARTICULAR (POR ARTICULACAO) - HM', 'UNIMED CURITIBA'],
  ['81 - HONORARIO MEDICO MAMOGRAFIA', 'MAMOGRAFIA DIGITAL BILATERAL - HM', 'UNIMED'], ['78 - HONORARIOS MEDICOS PF', 'USG MAMAS - HM', 'UNIMED CURITIBA -'],
  ['78 - HONORARIOS MEDICOS PF', 'USG MAMAS - HM', 'PARTICULAR - GRUPO SRA'], ['81 - HONORARIO MEDICO MAMOGRAFIA', 'USG MAMAS - HM', 'UNIMED CURITIBA']].map(a => { const s = t.hmV3Situacao(...a); return s.devido ? 'devido' : s.motivo; }).join(' '); });
ok(hm === 'grupo procedimento grupo devido convenio grupo', `HM: raio-X e mamografia nunca pagos (nem USG Unimed lançado lá); no 78 PF só USG Unimed é devido (RMN e particular não) (${hm})`);

// 2) Modalidade pelo TITLE.
const mt = await p.evaluate(() => { const t = window.__RM.t; return ['ULTRASSONOGRAFIA MAMÁRIA BILATERAL', 'DOPPLER COLORIDO DE CARÓTIDAS', 'MAMOGRAFIA DIGITAL BILATERAL', 'RESSONÂNCIA MAGNÉTICA DO CRÂNIO', 'DENSITOMETRIA ÓSSEA', 'RX DE TÓRAX PA E PERFIL', 'TÍTULO SEM MODALIDADE'].map(x => t.modalidadeDoTituloV3(x) || '-').join(' '); });
ok(mt === 'US US MG MR OT CR -', `modalidade pelo TITLE (${mt})`);

// 3) Conferência da unidade 5 com relatório e laudos fictícios.
const conf = await p.evaluate(() => {
  const { S, t } = window.__RM, d = dd => new Date(Date.UTC(2026, 9, dd));
  let seq = 0;
  const R = (paciente, dia, codigo, procDesc, grupoNome, convenio, vlRepasse, vlTotal, atendimento) => ({ seq: ++seq, pagina: 1, codigo, procDesc, grupoNome, conta: 'C' + seq, atendimento: atendimento || 'A' + seq, paciente, convenio, data: d(dia), vlRepasse, vlTotal, pct: vlTotal ? vlRepasse / vlTotal : 0, quant: 1, prestadorCod: '6703', prestadorNome: 'DR ALEXANDRE' });
  const regs = [
    R('ANA LIMA SOUZA', 3, '40901114', 'US MAMAS', 'ULTRASSONOGRAFIA', 'UNIMED CURITIBA', 33, 120, 'AT1'),
    R('ANA LIMA SOUZA', 3, '40901114', 'USG MAMAS - HM', '78 - HONORARIOS MEDICOS PF', 'UNIMED CURITIBA -', 33, 60, 'AT1'),
    R('BEATRIZ COSTA', 4, '40901114', 'USG MAMAS - HM', '78 - HONORARIOS MEDICOS PF', 'UNIMED CURITIBA -', 33, 60),
    R('CAIO REIS', 5, '40805026', 'RX TORAX - HM', '77 - HONORARIO MEDICO RAIO X', 'UNIMED CURITIBA', 10, 20),
    R('CAIO REIS', 5, '41101318', 'RMN ARTICULAR (POR ARTICULACAO) - HM', '78 - HONORARIOS MEDICOS PF', 'UNIMED CURITIBA -', 30, 60),
    R('DORA NUNES', 6, '40808041', 'MAMOGRAFIA DIGITAL - HM', '81 - HONORARIO MEDICO MAMOGRAFIA', 'UNIMED CURITIBA', 12, 25),
    R('DORA NUNES', 6, '40901114', 'USG MAMAS - HM', '81 - HONORARIO MEDICO MAMOGRAFIA', 'UNIMED CURITIBA', 12, 25),
    R('ELIS PRADO', 7, '99000001', 'PACOTE RESSONANCIA DO CRANIO', 'PACOTE', 'BRADESCO SAUDE', 45, 450),
    R('ELIS PRADO', 7, '41101014', 'RM CRANIO', 'RESSONANCIA MAGNETICA', 'BRADESCO SAUDE', 300, 300),
    R('FABIO RAMOS', 8, '41001010', 'TC CRANIO', 'TOMOGRAFIA COMPUTADORIZADA', 'UNIMED CURITIBA', 30, 300)
  ];
  const L = (i, paciente, dia, titulo, modalidade) => ({ i, paciente, pn: t.norm ? t.norm(paciente) : paciente, data: d(dia), dia: t.diaSerial(d(dia)), titulo, tn: titulo, modalidade, medico: 'ALEXANDRE ROMANUS', mn: 'ALEXANDRE ROMANUS', unidade: 'AlphaSonic Curitiba', convenio: 'UNIMED CURITIBA' });
  // Laudo de USG com MODALITY errada no Apolo («OT»): na V3 vale o TITLE.
  const laudos = [L(0, 'ANA LIMA SOUZA', 3, 'ULTRASSONOGRAFIA MAMÁRIA BILATERAL', 'OT'), L(1, 'ELIS PRADO', 7, 'RESSONÂNCIA MAGNÉTICA DO CRÂNIO', 'MR')];
  const res = t.conferirCruzado({ regs, cab: { prestadorCod: '6703', prestadorNome: 'DR ALEXANDRE' } }, { laudos }, S.cfg, S.eq, { unidadeCod: '5', tol: 0 });
  const mv = res.linhas.filter(x => x.r);
  const av = t.avisosConferenciaV3(res), cz = t.causasDaConferencia(res, []);
  return { linhas: mv.map(x => `${x.r.seq}:${x.status}:${t.classeDaLinhaConf(x)}`), parAna: mv[0].l ? `${mv[0].l.modalidade}/${mv[0].l.modalidadeApolo}` : '',
    av: { exc: av.hmExcluir.n, grupos: av.hmExcluir.grupos.map(g => g.grupo).join('|'), semBase: av.hmSemBase.n, pac: av.pacotes.n, sub: av.substituidos.n, fora: av.foraEscopo.n, usgNoPF: av.hmExcluir.usgUnimed.n },
    causaSemBase: cz.grupos.some(g => g.tipo === 'hm-sem-base') };
});
const L = Object.fromEntries(conf.linhas.map(x => { const [s, st, cl] = x.split(':'); return [s, `${st}:${cl}`]; }));
ok(conf.parAna === 'US/OT', `laudo com MODALITY «OT» e TITLE de ultrassom pareia com a USG pela modalidade do TITLE (${conf.parAna})`);
ok(L[2] === 'conferido:devido', `HM de USG Unimed com o exame base no relatório = Devido, sem laudo próprio (${L[2]})`);
ok(L[3] === 'hm-sem-base:pend' && conf.causaSemBase, `HM de USG Unimed sem exame base = Pendente, com causa própria para decidir (${L[3]})`);
ok(L[4] === 'hm-pendente:excluido' && L[5] === 'hm-pendente:excluido' && L[6] === 'hm-pendente:excluido' && L[7] === 'hm-pendente:excluido', `HM raio-X, RMN no 78 PF, mamografia e USG lançado no grupo de mamografia = Excluído (${L[4]} ${L[5]} ${L[6]} ${L[7]})`);
ok(L[8] === 'conferido:devido', `pacote de ressonância = Devido pelo valor do MV (${L[8]})`);
ok(L[9] === 'substituido-pacote:excluido', `ressonância Bradesco a 100% do mesmo paciente e dia = substituída pelo pacote, fora do fechamento (${L[9]})`);
ok(conf.av.usgNoPF === 1, `HM de USG Unimed lançado no grupo de mamografia: excluído, mas com destaque no aviso (${conf.av.usgNoPF})`);
ok(conf.av.exc === 4 && conf.av.semBase === 1 && conf.av.pac === 1 && conf.av.sub === 1 && conf.av.fora === 1, `avisos de Curitiba: 4 HM a excluir, 1 sem base, 1 pacote, 1 base substituída, 1 tomografia (${JSON.stringify(conf.av)})`);

// 4) Cálculo da V3 (valor fixo): HM Unimed vale o mesmo do laudo de USG; pacote entra pelo valor do MV.
const fx = await p.evaluate(() => { const { calcularV3, textoEmailV3 } = window.__RM.t;
  const regra = { modo: 'fixo', grupos: [{ grupo: '*USG*', valorLaudo: 33, valorHM: 10 }, { grupo: 'RESSONANCIA MAGNETICA', valorLaudo: 45 }] };
  const c = calcularV3(regra, [
    { grupo: 'ULTRASSONOGRAFIA', desc: 'US MAMAS', convenio: 'UNIMED CURITIBA', quant: 10, vlTotal: 1200, vlRepasse: 330, tipoItem: 'procedimento' },
    { grupo: '78 - HONORARIOS MEDICOS PF', desc: 'USG MAMAS - HM', convenio: 'UNIMED CURITIBA', quant: 4, vlTotal: 240, vlRepasse: 132, tipoItem: 'hm' },
    { grupo: 'RESSONANCIA MAGNETICA', desc: 'RM JOELHO', convenio: 'UNIMED', quant: 2, vlTotal: 900, vlRepasse: 90, tipoItem: 'procedimento' },
    { grupo: 'PACOTE', desc: 'PACOTE RESSONANCIA DO CRANIO', convenio: 'BRADESCO SAUDE', quant: 1, vlTotal: 450, vlRepasse: 45, tipoItem: 'pacote' }]);
  return { total: c.total, hm: c.hm.valor, pac: c.pacotes.valor, texto: textoEmailV3(c) }; });
ok(fx.hm === 132 && fx.pac === 45 && fx.total === 330 + 132 + 90 + 45, `valor fixo: 10 USG × 33 + 4 HM × 33 (o valor de HM antigo, 10, é ignorado) + 2 RM × 45 + pacote 45 = ${fx.total}`);
ok(/Pacotes \(ressonância\/mamografia\): 1 = R\$ 45,00/.test(fx.texto), 'o e-mail mostra o pacote');
// HM de USG Unimed = valor do exame base correspondente, para todos na V3 (23/11/2026): se a USG muda (exceção), o HM muda junto.
const hmb = await p.evaluate(() => { const { calcularV3, textoEmailV3 } = window.__RM.t;
  const regra = { modo: 'fixo', grupos: [{ grupo: '*USG*', valorLaudo: 33, excecoes: [{ convenio: 'UNIMED', valorLaudo: 40 }] }] };
  const c = calcularV3(regra, [
    { grupo: 'ULTRASSONOGRAFIA', desc: 'US MAMAS', convenio: 'UNIMED CURITIBA -', quant: 2, vlTotal: 200, vlRepasse: 66, tipoItem: 'procedimento' },
    { grupo: 'ULTRASSONOGRAFIA', desc: 'US TIREOIDE', convenio: 'PARTICULAR', quant: 1, vlTotal: 100, vlRepasse: 33, tipoItem: 'procedimento' },
    { grupo: '78 - HONORARIOS MEDICOS PF', desc: 'USG MAMAS - HM', convenio: 'UNIMED CURITIBA -', baseConvenio: 'UNIMED CURITIBA -', quant: 2, vlTotal: 120, vlRepasse: 66, tipoItem: 'hm' }]);
  return { hm: c.hm.valor, total: c.total, texto: textoEmailV3(c) }; });
ok(hmb.hm === 80 && hmb.total === 80 + 33 + 80 && /Honorários USG UNIMED: 2 × R\$ 40,00 = R\$ 80,00/.test(hmb.texto), `HM segue o exame base: USG Unimed R$ 40 (exceção) → HM R$ 40 (2 HM = R$ ${hmb.hm}); total ${hmb.total}`);
const bc = await p.evaluate(() => { const { S, t } = window.__RM, d = new Date(Date.UTC(2026, 9, 3));
  const r = (seq, desc, grupoNome, convenio) => ({ seq, pagina: 1, codigo: '40901114', procDesc: desc, grupoNome, conta: 'C', atendimento: 'AT9', paciente: 'GIL SOUZA', convenio, data: d, vlRepasse: 33, vlTotal: 60, pct: .5, quant: 1, prestadorCod: '1', prestadorNome: 'X' });
  const res = t.conferirCruzado({ regs: [r(1, 'USG MAMAS - OP', 'ULTRASSONOGRAFIA - OUTROS', 'UNIMED CURITIBA -'), r(2, 'USG MAMAS - HM', '78 - HONORARIOS MEDICOS PF', 'UNIMED CURITIBA -')], cab: {} }, { laudos: [] }, S.cfg, S.eq, { unidadeCod: '5', tol: 0 });
  return res.linhas.find(x => x.tipo === 'hm')?.baseConvenio; });
ok(bc === 'UNIMED CURITIBA -', `a conferência guarda o convênio do exame base do HM (${bc})`);

// 5) Médicos de Londrina por produção: lista padrão e contagem na unidade 5 só dos laudos que não são de USG.
const prod = await p.evaluate(() => { const { S, t } = window.__RM, cfg = JSON.parse(JSON.stringify(S.cfg));
  cfg.prestadores = [{ cod: '15', nomeMV: 'MARCELO MIYAZAKI YOSHIDA', aliases: [], regras: { tipo: 'medico', participaIMG: true } },
    { cod: '777', nomeMV: 'OUTRO MEDICO TESTE', aliases: [], regras: { tipo: 'medico', participaIMG: true } }];
  const lista = t.medicosProducaoV3(cfg);
  const d = new Date(Date.UTC(2026, 9, 3)), lau = (medico, titulo, modalidade) => ({ paciente: 'X', data: d, dia: t.diaSerial(d), titulo, modalidade, medico, unidade: 'AlphaSonic Curitiba' });
  const ctl = t.controlePrestadoresUnidade({ laudos: [lau('MARCELO MIYAZAKI YOSHIDA', 'MAMOGRAFIA DIGITAL BILATERAL', 'MG'), lau('MARCELO MIYAZAKI YOSHIDA', 'RX DE TÓRAX', 'CR'), lau('MARCELO MIYAZAKI YOSHIDA', 'ULTRASSONOGRAFIA DE ABDOME', 'US'), lau('OUTRO MEDICO TESTE', 'MAMOGRAFIA DIGITAL', 'MG')], cfg, rodadas: [], chave: '10-2026' });
  const u5 = ctl.unidades ? ctl.unidades.find(u => u.cod === '5') : (ctl.find ? ctl.find(u => u.cod === '5') : null);
  const it = u5?.grupos.flatMap(g => g.itens).find(x => x.cod === '15');
  return { n: lista.length, ativos: lista.filter(x => x.ativo).length, semCad: lista.filter(x => !x.p).length, it: it ? { laudos: it.laudos, producao: it.producao, fora: (it.foraRegra || []).map(f => `${f.n}:${f.q}`).join() } : null,
    outros: (u5?.outros || []).map(o => o.cod).join(), ehProd: [t.laudaV3Producao(cfg.prestadores[0]), t.laudaV3Producao(cfg.prestadores[1]), t.laudaV3Producao({ cod: '15', regras: { v3producao: false } })].join() }; });
ok(prod.n === 16 && prod.ativos === 16 && prod.semCad === 15, `lista padrão com os 16 médicos de Londrina (${prod.n}; 15 sem cadastro neste teste)`);
ok(prod.ehProd === 'true,false,false', `por produção: 15 sim (padrão), 777 não, 15 retirado à mão não (${prod.ehProd})`);
ok(prod.it && prod.it.producao && prod.it.laudos === 2 && prod.it.fora === 'Ultrassonografia:1', `unidade 5: o 15 conta 2 laudos (mamo e RX) e a USG fica fora (${JSON.stringify(prod.it)})`);
ok(prod.outros === '777', `médico fora da lista e sem regra V3 continua em «não pagos pela SRA» (${prod.outros})`);

// 6) Exceção por convênio na regra da V3 (prévia aprovada em 23/11/2026): incluir, tirar e salvar pela tela.
await p.evaluate(() => { const { S } = window.__RM; S.cfg.prestadores.push({ cod: '9003', nomeMV: 'MEDICA EXEMPLO MAMOGRAFIA', aliases: [], regras: { tipo: 'medico', v3: true, v3regra: { modo: 'fixo', grupos: [{ grupo: 'MAMOGRAFIA DIAGNOSTICA', valorLaudo: 15, excecoes: [{ convenio: 'HOSPITAL EXEMPLO', valorLaudo: 10 }] }] } } }); });
await p.goto(html + '#inicio'); await p.goto(html + '#bases'); await p.waitForTimeout(400); await p.click('[data-bsub="prestadores"]').catch(() => {}); await p.waitForTimeout(300);
const iP = await p.evaluate(() => window.__RM.S.cfg.prestadores.findIndex(x => x.cod === '9003'));
const abrirRegra = async () => { await p.click(`[data-v3regra="${iP}"]`); await p.waitForSelector('#dlg[open]'); };
await abrirRegra();
ok(/HOSPITAL EXEMPLO/.test(await p.textContent('[data-fxexc="0"]')), 'diálogo mostra a exceção cadastrada (chip «HOSPITAL EXEMPLO R$ 10,00»)');
await p.click('[data-excadd="0"]'); await p.fill('[data-excconv="0"]', 'convenio exemplo a'); await p.fill('[data-excval="0"]', '12'); await p.click('[data-excok="0"]');
await p.fill('[name="fxGrupo1"]', 'USG (inclui Doppler)'); await p.fill('[name="fxLaudo1"]', '35');
await p.click('[data-excadd="1"]'); await p.fill('[data-excconv="1"]', 'HOSPITAL EXEMPLO'); await p.fill('[data-excval="1"]', '30');   // sem «Incluir»: entra ao salvar
await p.click('[data-excrm="0:0"]');
await p.screenshot({ path: out + 'v3_excecao_convenio.png' });
await p.click('#dlgBotoes button[value="ok"]'); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200);
const gs = await p.evaluate(() => window.__RM.S.cfg.prestadores.find(x => x.cod === '9003').regras.v3regra.grupos);
ok(JSON.stringify(gs) === JSON.stringify([{ grupo: 'MAMOGRAFIA DIAGNOSTICA', valorLaudo: 15, excecoes: [{ convenio: 'CONVENIO EXEMPLO A', valorLaudo: 12 }] }, { grupo: '*USG*', valorLaudo: 35, excecoes: [{ convenio: 'HOSPITAL EXEMPLO', valorLaudo: 30 }] }]), `salvar grava as exceções por grupo (incluída, tirada e a preenchida sem «Incluir») (${JSON.stringify(gs)})`);
ok(/MAMOGRAFIA DIAGNOSTICA: R\$ 15,00 \(CONVENIO EXEMPLO A R\$ 12,00\)/.test(await p.textContent('#cardV3')), 'resumo da regra no cartão mostra a exceção');
await abrirRegra(); await p.click('#dlgBotoes button[value=""]'); await p.waitForFunction(() => !document.getElementById('dlg').open);
await abrirRegra(); await p.click('[data-excadd="0"]');
ok(await p.$$eval('[data-excconv="0"]', e => e.length) === 1, 'reabrir o diálogo não acumula cliques (um formulário só)');
await p.click('#dlgBotoes button[value=""]'); await p.waitForFunction(() => !document.getElementById('dlg').open);

// 7) Telas: Bases (lista por produção e HM V3) sem erro.
await p.goto(html + '#bases'); await p.waitForTimeout(400);
const tela = await p.evaluate(() => ({ prod: !!document.getElementById('v3ProdAdd'), exc: document.getElementById('hmExc')?.value || '' }));
ok(tela.prod, 'Bases → Médicos V3 mostra a lista dos médicos por produção');
ok(/HONORARIO MEDICO MAMOGRAFIA/.test(tela.exc) && !/ PF/.test(tela.exc), `Bases → Modalidades e HM V3 mostra os grupos que nunca são pagos (${tela.exc})`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
