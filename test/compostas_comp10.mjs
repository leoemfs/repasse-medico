// Regras compostas com os arquivos reais da competência 10/2026 (dados/comp_10-2026, fora do Git):
// as conferências rodam sem regra, as 5 regras das anotações de 04/11/2026 são simuladas pela tela,
// validadas, e as conferências rodam de novo. Compara a simulação com o resultado e a cobertura.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', pasta = raiz + 'dados/comp_10-2026/', d = f => raiz + 'dados/' + f;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const info = msg => console.log('· ' + msg);
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Compostas 10')));
await p.goto(html + '#inicio');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const S = (fn, arg) => p.evaluate(fn, arg);
const okDlg = async () => { await p.waitForSelector('#dlg[open]'); await p.click('#dlgBotoes button[value=ok]'); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(250); };

// Bases, equivalências (pendentes, como estão), arquivos.
await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub]'); await p.click('[data-bsub="prestadores"]');
await p.setInputFiles('#prCtrlArq', d('repasse_10-2026_controle.xlsx')); await okDlg();
await p.goto(html + '#equivalencias'); await p.waitForSelector('#eqArqX', { state: 'attached' }); await p.setInputFiles('#eqArqX', d('equivalencias_tuss.xlsx'));
await p.waitForFunction(() => window.__RM.S.eq.itens.length > 900, null, { timeout: 60000 }); if (await p.isVisible('#dlg[open]')) await okDlg();
const pdfs = fs.readdirSync(pasta).filter(f => f.endsWith('.pdf') && !/CORRECAO/.test(f)).sort();
await p.goto(html + '#inicio'); await p.setInputFiles('#inMV', pdfs.map(f => pasta + f)); await p.waitForFunction(n => window.__RM.S.relatorios.length === n, pdfs.length, { timeout: 300000 });
await p.setInputFiles('#inApolo', pasta + 'APOLO_10-2026_ref_09-2026.xlsx'); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 300000 });
while (await p.isVisible('#dlg[open]')) await okDlg();
const rels = await S(() => window.__RM.S.relatorios.map(x => ({ id: x.id, nome: x.nome })));
const conferirTudo = async () => { for (const rel of rels) {
  await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar'); await p.selectOption('#cfRel', rel.id); await p.selectOption('#cfUn', rel.nome.match(/_un(\d+)/)[1]); await p.waitForTimeout(100);
  if (!(await p.$eval('#cfMed option[value="@prest"]', o => !o.disabled))) await p.selectOption('#cfMed', '*');
  const n0 = await S(() => window.__RM.S.rodadas.length); await p.click('#cfRodar'); await p.waitForFunction(n => window.__RM.S.rodadas.length > n, n0, { timeout: 300000 });
} };
const cobertura = () => S(() => { const c = window.__RM.t.coberturaCompetencia(window.__RM.S.rodadas, window.__RM.S.comp); return { pct: c.pct, conferidas: c.conferidas, total: c.total }; });
await conferirTudo();
const antes = await cobertura();
info(`sem regra composta: cobertura ${antes.pct}% (${antes.conferidas} de ${antes.total} linhas)`);

// As 5 regras das anotações, como pendentes (códigos e títulos reais do MV e do Apolo de 10/2026).
await S(() => {
  const E = window.__RM.S, nv = (nome, campos) => ({ id: 'cmp' + nome.replace(/\W/g, ''), nome, escopo: { unidade: '*', modalidade: '*' }, status: 'pendente', responsavel: '', historico: [], palavras: null, titulos: [], ...campos });
  const it = (rotulo, codigos, qtd = 1, excecoes = []) => ({ rotulo, codigos, qtd, excecoes });
  E.eq.compostas = [
    nv('TC abdome total', { titulos: ['TOMOGRAFIA COMPUTADORIZADA DE ABDOME TOTAL', 'TOMOGRAFIA DE ABDOME TOTAL', 'TOMOGRAFIA COMPUTADORIZADA DO ABDOME TOTAL', 'TOMOGRAFIA DE ABDOME TOTAL COM CONTRASTE'], itens: [it('TC abdome superior', ['41001109']), it('TC pelve', ['41001117'])] }),
    nv('RM abdome total', { titulos: ['RESSONÂNCIA MAGNÉTICA DE ABDOME TOTAL', 'RESSONÂNCIA MAGNÉTICA ABDOME TOTAL'], itens: [it('RM abdome superior', ['41101170']), it('RM pelve', ['41101189'])] }),
    nv('USG mamas + Doppler', { titulos: ['ULTRASSONOGRAFIA DAS MAMAS COM DOPPLER', 'ULTRASSONOGRAFIA DAS MAMAS COM DOPPLER COLORIDO', 'USG DE MAMAS COM DOPPLER', 'DOPPLER DE MAMAS', 'DOPPLER MAMAS'], itens: [it('USG mamas', ['40901114']), it('Doppler', ['40901386'], 2, [{ convenio: 'UNIMED', tipo: 'quantidade', qtd: 1 }])] }),
    nv('Tireoide com Doppler', { titulos: ['ULTRASSONOGRAFIA DA TIREOIDE COM DOPPLER', 'ULTRASSONOGRAFIA DA TIREOIDE COM DOPPLER COLORIDO', 'DOPPLER DE TIREOIDE', 'USG DE TIREOIDE COM DOPPLER'], itens: [it('USG órgãos superficiais', ['40901203'], 1, [{ convenio: 'UNIMED', tipo: 'nao-exigido', qtd: 0 }]), it('Doppler', ['40901386'])] }),
    nv('USG articular + Doppler', { palavras: { todas: ['DOPPLER'], umaDe: ['PUNHO', 'OMBRO', 'JOELHO', 'COTOVELO', 'TORNOZELO', 'QUADRIL', 'ARTICULA'] }, itens: [it('USG articular', ['40901220'], 1, [{ convenio: 'UNIMED', tipo: 'nao-exigido', qtd: 0 }]), it('Doppler', ['40901386'])] })
  ];
});

// Simulação pela tela, regra por regra.
await p.goto(html + '#equivalencias'); await p.waitForSelector('#cardCompostas');
const sim = {};
for (const nome of ['TC abdome total', 'RM abdome total', 'USG mamas + Doppler', 'Tireoide com Doppler', 'USG articular + Doppler']) {
  const linha = p.locator(`#cardCompostas tbody tr:has-text("${nome}")`).first();
  await linha.locator('[data-cmpsim]').click(); await p.waitForFunction(n => [...document.querySelectorAll('#cardCompostas tbody tr')].some(tr => tr.textContent.includes(n) && /simulação/.test(tr.textContent)), nome, { timeout: 300000 });
  sim[nome] = (await p.locator(`#cardCompostas tbody tr:has-text("${nome}")`).first().locator('td').nth(4).textContent()).trim();
  info(`simulação — ${nome}: ${sim[nome]}`);
}
await p.locator('#cardCompostas').screenshot({ path: out + 'compostas_comp10_simulacao.png' });
const nSim = Object.values(sim).reduce((s, t) => s + (+(t.match(/(\d+) conta/) || [])[1] || 0), 0);
ok(nSim > 0, `as regras simuladas sustentam ${nSim} conta(s) nos PDFs de 10/2026`);

// Validar todas e rodar as conferências de novo.
await S(() => { for (const c of window.__RM.S.eq.compostas) { c.status = 'validada'; c.responsavel = 'Teste Compostas 10'; c.validadoEm = new Date().toISOString(); } });
await conferirTudo();
const depois = await cobertura();
info(`com as 5 regras validadas: cobertura ${depois.pct}% (${depois.conferidas} de ${depois.total} linhas)`);
await p.goto(html + '#equivalencias'); await p.waitForSelector('#cardCompostas');
const ef = await p.$$eval('#cardCompostas tbody tr', trs => trs.map(tr => `${tr.cells[0].textContent.trim()}: ${tr.cells[4].textContent.replace(/exemplos/, '').trim()}`));
for (const e of ef) info(`efetividade — ${e}`);
await p.locator('#cardCompostas').screenshot({ path: out + 'compostas_comp10.png' });
ok(depois.conferidas > antes.conferidas, `com as regras validadas, mais linhas conferidas (${antes.conferidas} → ${depois.conferidas})`);
const nEf = ef.reduce((s, t) => s + (+(t.match(/(\d+) conta/) || [])[1] || 0), 0);
info(`antes de validar, cada regra foi simulada sozinha (${nSim} contas); validadas juntas, regras que dividem o Doppler disputam o mesmo lançamento (${nEf} contas)`);
ok(Math.abs(nEf - nSim) <= Math.max(3, nSim * 0.05), `simulação isolada próxima da efetividade (${nSim} × ${nEf} contas)`);
// Simular de novo com todas validadas: deve bater exatamente com a efetividade da conferência.
const sim2 = await S(async () => { const out = {}; for (const c of window.__RM.S.eq.compostas) { const r = await window.__RM.t.simularComposta(c); out[c.nome] = { contas: r.contas, linhas: r.linhas, falta: r.falta }; } return out; });
const ef2 = await S(() => { const m = window.__RM.t.efetividadeCompostas(window.__RM.S.rodadas, window.__RM.S.comp), out = {}; for (const c of window.__RM.S.eq.compostas) { const e = m.get(c.id); out[c.nome] = { contas: e ? e.contas.size : 0, linhas: e ? e.linhas : 0, falta: e ? e.falta : 0 }; } return out; });
const difs = Object.keys(sim2).filter(n => JSON.stringify(sim2[n]) !== JSON.stringify(ef2[n]));
ok(!difs.length, 'com as regras validadas, simulação = efetividade da conferência (contas, linhas e faltas)' + (difs.length ? ': ' + difs.map(n => `${n} sim ${JSON.stringify(sim2[n])} × conf ${JSON.stringify(ef2[n])}`).join(' | ') : ''));
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + [...new Set(erros)].slice(0, 3).join(' | ') : ''));
await b.close();
