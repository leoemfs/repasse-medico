// v3.0.0-alpha.21 — SOL-F47: descontos que mudam todo mês (lembrete com o valor conferido no portal) e lembrete do
// reajuste anual. Cadastro pela tela, «a conferir» no Fechamento até lançar (prestador em «Verificar»), Início e menu,
// «Sem desconto este mês», corrigir, e o reajuste anual no mês escolhido. Dados fictícios.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];
const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.clock.install({ time: new Date('2026-11-23T10:00:00') });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Descontos')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const okDlg = async (botao = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${botao}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };

// Motor: parcela do mês de um desconto variável, lançamento e lembrete do reajuste.
const m = await p.evaluate(() => {
  const { t } = window.__RM, d = { id: 'x', cod: '9', nome: 'X', motivo: 'Plano de saúde', variavel: true, onde: 'Portal', valorParcela: 0, parcelas: 0, inicio: '2026-11', tipo: 'img', adiadas: [] };
  const antes = t.parcelaDoMes(d, '2026-11'); t.lancarDescontoMes(d, '2026-11', 612.4, 'Ana'); const depois = t.parcelaDoMes(d, '2026-11'), dez = t.parcelaDoMes(d, '2026-12');
  t.lancarDescontoMes(d, '2026-12', null, 'Ana'); const zero = t.parcelaDoMes(d, '2026-12');
  const cfg = { reajusteAnual: { mes: 1, desde: 2027, feitos: {} } }, L = dt => t.lembreteReajuste(cfg, new Date(dt));
  const r = [L('2026-11-23'), L('2027-01-05'), L('2027-03-10')]; t.marcarReajusteFeito(cfg, 2027, 'Ana'); r.push(L('2027-03-10'), L('2028-01-02'));
  return { antes, depois, dez, zero, r: r.map(x => x ? x.ano : '-').join(','), val: t.validarDesconto({ ...d, onde: '' }).join('; ') };
});
ok(m.antes.conferir && m.antes.valor === 0 && m.depois.valor === 612.4 && !m.depois.conferir && m.dez.conferir, 'variável: «a conferir» (zero) até lançar; o lançamento vale só para o mês dele');
ok(m.zero.semDesconto && m.zero.valor === 0 && !m.zero.conferir, '«Sem desconto este mês» conta como conferido, com valor zero');
ok(m.r === '-,2027,2027,-,2028', `reajuste anual: lembra a partir do mês escolhido, some quando marcado e volta no ano seguinte (${m.r})`);
ok(/onde conferir/.test(m.val), `variável exige «onde conferir» em vez do valor (${m.val})`);

// Prestador 15 com conferência e aceite (dados fictícios, como no teste do quadro).
await p.evaluate(() => {
  const { S } = window.__RM, d = n => new Date(Date.UTC(2026, 9, n)), dia = n => Math.round(d(n) / 864e5);
  const L = (i, pac, n) => ({ i, linhaPlanilha: i + 2, idLaudo: String(300 + i), unidade: 'AlphaSonic Palhano', paciente: pac, pn: pac, idPac: String(i), titulo: 'USG TIREOIDE', tn: 'USG TIREOIDE', descricao: '', data: d(n), dia: dia(n), convenio: 'UNIMED', modalidade: 'US', medico: 'DR X', mn: 'DR X' });
  S.apolo = { nome: 'apolo.xlsx', hash: 'h', ultimaLinha: 3, segundos: 0.1, laudos: [L(0, 'ANA PAULA ROCHA', 3), L(1, 'BRUNA LIMA COSTA', 4)] };
  S.eq.itens.push({ id: 'eqQ', codigo: '40901173', titulo: 'USG TIREOIDE', status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'T' });
  const R = (seq, pac, n, vl) => ({ seq, pagina: 1, codigo: '40901173', procDesc: 'US TIREOIDE', grupoNome: 'ULTRASSONOGRAFIA', conta: String(9000 + seq), atendimento: String(7000 + seq), paciente: pac, convenio: 'UNIMED', data: d(n), vlRepasse: vl, vlTotal: vl * 2, pct: .5, quant: 1, prestadorCod: '15', prestadorNome: 'DR X', repasse: '25022' });
  S.relatorios = [{ id: 'rQ', nome: 'mv.pdf', tamanho: 1, hash: 'hQ', unidadePasta: '17', grupoPasta: 'usg', rel: { arquivo: 'mv.pdf', cab: { prestadorCod: '15', prestadorNome: 'DR X', repasse: '25022', descricao: 'REPASSE USG', competencia: '11/2026', repasses: [] }, regs: [R(1, 'ANA PAULA ROCHA', 3, 1000), R(2, 'BRUNA LIMA COSTA', 4, 2000)], totExtraido: [3000, 6000], notas: [], avisos: [], conferencias: [], ok: true } }];
  if (!S.cfg.prestadores.some(x => String(x.cod) === '15')) S.cfg.prestadores.push({ cod: '15', nomeMV: 'DR X', aliases: [], naoRealizaRepasse: false, regras: { faixaUSG: 'geral' } });
  window.__RM.irPara('conferencia');
});
await p.waitForSelector('#cfRodar'); await p.selectOption('#cfUn', '17').catch(() => {}); await p.click('#cfRodar'); await p.waitForSelector('#cfAbas', { timeout: 15000 });
await p.click('#cfAba-aceite'); await p.waitForTimeout(150); await p.click('#cfAceitar'); await p.waitForTimeout(300); if (await p.isVisible('#dlg[open]')) await okDlg();
const linha = () => p.evaluate(() => { const f = window.__RM.t.fechamentoAtual(); for (const t of ['usg', 'img', 'curitiba']) { const x = (f[t] || []).find(y => y.cod === '15'); if (x) return { tipo: t, sit: x.situacao, desc: x.descontos, total: x.total, avisos: x.avisos.join(' | ') }; } return null; });
const l0 = await linha();
ok(l0 && l0.sit === 'conferido', `com aceite e sem desconto: «Conferido · a enviar» (${l0?.tipo} · ${l0?.sit})`);

// Cadastro pela tela: «Muda todo mês» mostra «Onde conferir» no lugar do valor.
await p.evaluate(() => window.__RM.irPara('bases')); await p.waitForSelector('[data-bsub="prestadores"]'); await p.click('[data-bsub="prestadores"]');
await p.click('#cardDesc [data-desc-novo]'); await p.waitForSelector('#dlg[open]');
const vis0 = await p.evaluate(() => [!document.getElementById('dcFixo').hidden, !document.getElementById('dcOnde').hidden].join());
await p.check('#dlgCorpo [name="tipoValor"][value="variavel"]');
const vis1 = await p.evaluate(() => [!document.getElementById('dcFixo').hidden, !document.getElementById('dcOnde').hidden].join());
ok(vis0 === 'true,false' && vis1 === 'false,true', `fixo mostra o valor; «Muda todo mês» troca pelo «Onde conferir» (${vis0} → ${vis1})`);
await p.fill('#dlgCorpo [name="prestador"]', 'DR X'); await p.fill('#dlgCorpo [name="cod"]', '15');
await p.fill('#dlgCorpo [name="motivo"]', 'Adiantamento Unimed'); await p.fill('#dlgCorpo [name="onde"]', 'Portal da Unimed');
await p.selectOption('#dlgCorpo [name="tipo"]', l0.tipo);
await okDlg();
const cad = await p.evaluate(() => { const d = window.__RM.S.cfg.descontos.find(x => x.motivo === 'Adiantamento Unimed'); return d ? `${d.variavel}|${d.onde}|${d.valorParcela}|${d.inicio}` : ''; });
ok(cad === 'true|Portal da Unimed|0|2026-11', `desconto variável gravado sem valor fixo, com onde conferir (${cad})`);
const bases = await p.textContent('#cardDesc');
ok(/muda todo mês/.test(bases) && /conferir em: Portal da Unimed/.test(bases) && /a conferir em/.test(bases), 'a lista em Bases mostra «muda todo mês», onde conferir e «a conferir» no mês');

// Fechamento: «a conferir», prestador em «Verificar», Início e menu.
const l1 = await linha();
ok(l1.sit === 'verificar' && l1.desc === 0 && /desconto a conferir: Adiantamento Unimed/.test(l1.avisos), `sem o valor do mês: «Verificar», DESCONTOS zero e aviso (${l1.sit} · ${l1.desc})`);
const pill = await p.evaluate(() => document.querySelector('.nav a[data-pag="fechamento"] .pill-desc')?.textContent || '');
ok(pill === '1', `menu «Fechamento e envio» mostra 1 desconto a conferir (${pill})`);
await p.evaluate(() => window.__RM.irPara('inicio')); await p.waitForSelector('.ini-pede');
const ini = await p.textContent('.ini-pede');
ok(/Descontos a conferir no portal: 1/.test(ini) && /15 · Adiantamento Unimed/.test(ini), 'Início: «Descontos a conferir no portal: 1» com o prestador e o motivo');
ok(!/Reajuste anual/.test(ini), 'reajuste anual não aparece em novembro de 2026 (primeiro lembrete em janeiro de 2027)');
await p.click('.ini-pede [data-ir="fechamento"]'); await p.waitForSelector('.desc-cartao [data-desc-lanca]');
const card = await p.textContent('.desc-cartao');
ok(/1 desconto\(s\) a conferir/.test(card) && /Portal da Unimed/.test(card) && /a conferir/.test(card), '«Conferir» abre o Fechamento no repasse certo, com o alerta e a linha «a conferir»');

// Lançar o valor conferido.
await p.fill('.desc-cartao [data-desc-valor]', '1234.56'); await p.click('.desc-cartao [data-desc-lanca]'); await p.waitForTimeout(400);
const l2 = await linha(), card2 = await p.textContent('.desc-cartao');
const pill2 = await p.evaluate(() => document.querySelector('.nav a[data-pag="fechamento"] .pill-desc')?.textContent || '');
ok(l2.sit === 'conferido' && l2.desc === 1234.56 && /conferido/.test(card2) && /Teste Descontos/.test(card2) && !pill2, `lançado: DESCONTOS R$ 1.234,56, volta a «Conferido · a enviar», com quem lançou; menu sem contagem (${l2.sit} · ${l2.desc})`);
// Corrigir → volta a conferir; «Sem desconto este mês» → zero e conferido.
await p.click('.desc-cartao [data-desc-corrige]'); await p.waitForTimeout(400);
ok((await linha()).sit === 'verificar' && await p.isVisible('.desc-cartao [data-desc-valor]'), '«Corrigir» desfaz o lançamento e o desconto volta a «a conferir»');
await p.click('.desc-cartao [data-desc-zero]'); await p.waitForTimeout(400);
const l3 = await linha();
ok(l3.sit === 'conferido' && l3.desc === 0 && /sem desconto este mês/.test(await p.textContent('.desc-cartao')), '«Sem desconto este mês»: DESCONTOS zero e o prestador volta a «Conferido · a enviar»');
const reg = await p.evaluate(() => { const d = window.__RM.S.cfg.descontos.find(x => x.motivo === 'Adiantamento Unimed'); return JSON.stringify(d.lancamentos['2026-11']); });
ok(/"semDesconto":true/.test(reg) && /"por":"Teste Descontos"/.test(reg), `o lançamento do mês guarda quem e quando (${reg})`);

// Valor fixo continua automático, ao lado do variável.
await p.evaluate(() => { const { S } = window.__RM; S.cfg.descontos.push({ id: 'pensao', cod: '15', nome: 'DR X', motivo: 'Pensão alimentícia', valorParcela: 500, parcelas: 0, inicio: '2026-11', tipo: S.cfg.descontos[0].tipo, adiadas: [], obs: '' }); window.__RM.irPara('fechamento'); });
await p.waitForSelector('.desc-cartao'); await p.waitForTimeout(200);
const l4 = await linha();
ok(l4.desc === 500 && /fixo · automático/.test(await p.textContent('.desc-cartao')), `pensão (fixa) entra sozinha junto com o variável (${l4.desc})`);

// Reajuste anual: em janeiro de 2027 o Início lembra; «feito» tira o lembrete.
await p.clock.setSystemTime(new Date('2027-01-05T10:00:00'));
await p.evaluate(() => window.__RM.irPara('inicio')); await p.waitForSelector('.ini-pede');
ok(/Reajuste anual de 2027/.test(await p.textContent('.ini-pede')), 'em janeiro de 2027 o Início mostra «Reajuste anual de 2027»');
await p.evaluate(() => window.__RM.irPara('bases')); await p.waitForSelector('#cardReajuste');
await p.click('[data-reaj-feito="2027"]'); await okDlg();
const rj = await p.evaluate(() => JSON.stringify(window.__RM.S.cfg.reajusteAnual));
await p.evaluate(() => window.__RM.irPara('inicio')); await p.waitForSelector('#pag-inicio .card');
const pede = await p.evaluate(() => document.querySelector('.ini-pede')?.textContent || '');
ok(/"2027":\{"por":"Teste Descontos"/.test(rj) && !/Reajuste anual de 2027/.test(pede), `«Reajuste de 2027 feito» grava quem e tira o lembrete (${rj})`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
