// Teste SOL-F31: descontos parcelados — cadastro em Bases, parcela automática no Fechamento,
// alertas (última parcela, sem valores, maior que o repasse), adiar, ajuste manual registrado e exportação.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', d = f => raiz + 'dados/' + f;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Descontos')));
await p.goto(html + '#inicio');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const S = (fn, arg) => p.evaluate(fn, arg);
const okDlg = async () => { await p.waitForSelector('#dlg[open]'); await p.click('#dlgBotoes button[value="ok"]'); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };

// 1) Motor: numeração das parcelas.
const m = await S(() => {
  const { parcelaDoMes: P, ultimaCompetenciaDesconto: U, historicoDesconto: H } = window.__RM.t;
  const d = { inicio: '2026-04', parcelas: 10, valorParcela: 1000 }, ad = { ...d, adiadas: ['2026-08'] }, rec = { inicio: '2026-01', parcelas: 0, valorParcela: 7590 };
  const f = x => x ? `${x.n}/${x.total}${x.ultima ? '*' : ''}` : '-';
  return { base: ['2026-03', '2026-04', '2026-10', '2027-01', '2027-02'].map(c => f(P(d, c))), adiada: ['2026-08', '2026-10', '2027-02'].map(c => f(P(ad, c))),
    ult: [U(d), U(ad)], rec: P(rec, '2030-05')?.recorrente, hist: H(ad, '2026-10').map(x => x.adiada ? 'A' : x.n).join('') };
});
ok(m.base.join() === '-,1/10,7/10,10/10*,-', `10 parcelas desde 04/2026: 10/2026 = 7/10, 01/2027 = última, 02/2027 quitado (${m.base.join(' ')})`);
ok(m.adiada.join() === '-,6/10,10/10*' && m.ult.join() === '2027-01,2027-02', `parcela adiada em 08/2026: as seguintes andam um mês (${m.adiada.join(' ')}; última ${m.ult[1]})`);
ok(m.rec === true && m.hist === '1234A56', `recorrente não acaba; histórico por competência (${m.hist})`);

// 2) Cadastro em Bases → Prestadores.
await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub]'); await p.click('[data-bsub="prestadores"]');
await p.setInputFiles('#prCtrlArq', d('repasse_10-2026_controle.xlsx')); await okDlg();
const novo = async ({ busca, motivo, valor, parcelas, inicio, tipo }) => {
  await p.click('#cardDesc [data-desc-novo]'); await p.waitForSelector('#dlg[open]');
  await p.fill('#dlgCorpo [name="prestador"]', busca); await p.waitForSelector('#dlgCorpo .busca-lista:not([hidden])'); await p.press('#dlgCorpo [name="prestador"]', 'Enter');
  await p.fill('#dlgCorpo [name="motivo"]', motivo); await p.fill('#dlgCorpo [name="valorParcela"]', String(valor));
  await p.fill('#dlgCorpo [name="parcelas"]', parcelas ? String(parcelas) : ''); await p.fill('#dlgCorpo [name="inicio"]', inicio); await p.selectOption('#dlgCorpo [name="tipo"]', tipo);
  await okDlg();
};
await novo({ busca: 'nilton', motivo: 'Adiantamento', valor: 1000, parcelas: 10, inicio: '2026-04', tipo: 'img' });
await novo({ busca: 'marcelo miyazaki', motivo: 'Pensão alimentícia', valor: 1200, parcelas: 0, inicio: '2026-01', tipo: 'usg' });
await novo({ busca: 'marcelo miyazaki', motivo: 'Ajuste de repasse', valor: 500, parcelas: 3, inicio: '2026-08', tipo: 'usg' });
const cad = await S(() => window.__RM.S.cfg.descontos.map(x => `${x.cod}|${x.motivo}|${x.valorParcela}|${x.parcelas}|${x.inicio}|${x.tipo}`));
ok(cad.length === 3 && cad[0] === '12|Adiantamento|1000|10|2026-04|img' && cad[1] === '15|Pensão alimentícia|1200|0|2026-01|usg', `3 descontos cadastrados (${cad.join(' · ')})`);
const tab = await p.textContent('#cardDesc');
ok(/7 de 10/.test(tab) && /recorrente/.test(tab) && /última parcela/.test(tab), 'lista: «7 de 10», «recorrente» e «última parcela» na competência 10/2026');
ok(await S(() => window.__RM.S.compReg.competencias?.['2026-10']?.alteracoes?.some(a => /Desconto cadastrado/.test(a.descricao)) ?? JSON.stringify(window.__RM.S.compReg).includes('Desconto cadastrado')), 'cadastro fica registrado nas alterações da competência');
await p.screenshot({ path: out + 'descontos_bases.png', fullPage: false });

// 3) Fechamento: rodada de USG do prestador 15 (R$ 5.000,00) com aceite.
await p.goto(html + '#fluxo'); await p.waitForSelector('#fxCriar'); await p.click('#fxCriar'); await p.waitForSelector('.marco');
await S(async () => {
  const { S: E, t } = window.__RM;
  await t.dbGravar({ id: 'rodDesc', tipo: 'conferencia', em: new Date().toISOString(), operador: 'Teste', unidadeCod: '1', prestadorCod: '15', prestadorNome: 'MARCELO MIYAZAKI YOSHIDA', repasse: 'REPASSE USG', descricao: 'REPASSE USG', chaveCompetencia: E.comp, competencia: '', contagens: {},
    linhas: [{ chave: 'k1', estado: 'conferido', codigo: '1', vlRepasse: 5000, vlTotal: 11363.64, quant: 50, grupo: 'ULTRASSONOGRAFIA - OUTROS', desc: 'USG', convenio: 'X', tipoItem: 'procedimento', kd: 'M|1', kl: '', decisao: '' }], aceite: { por: 'Teste', em: new Date().toISOString() } });
});
const abrir = async sub => { await p.goto(html + '#fechamento'); await p.waitForSelector('[data-fsub]'); await p.click(`[data-fsub="${sub}"]`); await p.waitForTimeout(300); };
const linha15 = () => p.locator('#fhCorpo .fh-tab tr:has(td:text-is("15"))').first();
await abrir('usg');
ok(await linha15().locator('[data-aj$="|descontos"]').inputValue() === '1700' && /5\.000,00/.test(await linha15().textContent()) && /3\.300,00/.test(await linha15().textContent()), 'USG: parcelas do mês somadas em DESCONTOS (1.200 + 500) e total geral 3.300,00');
ok(await linha15().locator('[data-aj$="|obs"]').inputValue() === 'Pensão alimentícia; Ajuste de repasse · parcela 3/3' && /auto/.test(await linha15().textContent()), 'observação automática «parcela 3/3» e selo «auto»');
const cartao = await p.textContent('.desc-cartao');
ok(/última parcela do desconto «Ajuste de repasse» \(3\/3\)/.test(cartao), 'alerta de última parcela');
await p.screenshot({ path: out + 'descontos_fechamento.png' });
// Ajuste à mão no mês: fica marcado e registrado; apagar volta ao automático.
await linha15().locator('[data-aj$="|descontos"]').fill('1200'); await linha15().locator('[data-aj$="|descontos"]').dispatchEvent('change'); await p.waitForTimeout(300);
ok(/manual/.test(await linha15().textContent()) && /3\.800,00/.test(await linha15().textContent()), 'desconto alterado à mão: selo «manual» e total 3.800,00');
ok(await S(() => JSON.stringify(window.__RM.S.compReg).includes('desconto alterado à mão para R$ 1.200,00')), 'mudança manual registrada na competência');
await linha15().locator('[data-aj$="|descontos"]').fill(''); await linha15().locator('[data-aj$="|descontos"]').dispatchEvent('change'); await p.waitForTimeout(300);
ok(await linha15().locator('[data-aj$="|descontos"]').inputValue() === '1700', 'apagar o valor volta ao automático (1.700)');
// IMG: Nilton sem valores → alerta e «Levar para o próximo mês».
await abrir('img');
const alertaNilton = p.locator('.alerta-desc:has-text("Nilton")');
ok(/sem valores neste mês\. A parcela 7\/10/.test(await alertaNilton.textContent()), 'IMG: desconto ativo sem valores → alerta com a parcela 7/10');
await alertaNilton.locator('[data-desc-adiar]').click(); await p.waitForTimeout(300);
const ad = await S(() => window.__RM.S.cfg.descontos.find(x => x.cod === '12'));
ok(ad.adiadas.join() === '2026-10' && /Adiadas neste mês/.test(await p.textContent('.desc-cartao')), 'parcela levada para o próximo mês (adiada em 10/2026)');
ok(await S(() => window.__RM.t.parcelaDoMes(window.__RM.S.cfg.descontos.find(x => x.cod === '12'), '2026-11').n) === 7, 'em 11/2026 o desconto continua na parcela 7/10');
// Desconto maior que o repasse.
await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub]'); await p.click('[data-bsub="prestadores"]');
await novo({ busca: 'marcelo miyazaki', motivo: 'Adiantamento', valor: 4000, parcelas: 2, inicio: '2026-10', tipo: 'usg' });
await abrir('usg');
ok(/maior que o repasse do mês/.test(await p.textContent('.desc-cartao')) && /maior que o repasse/.test(await linha15().textContent()), 'alerta de desconto maior que o repasse (5.700 > 5.000)');
// Exportação: observação do desconto na planilha.
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#fhExp')]);
const arq = out + 'descontos_fechamento.xlsx'; await dl.saveAs(arq);
const py = `import openpyxl,sys,json
wb=openpyxl.load_workbook(sys.argv[1]); ws=wb.worksheets[0]
print(json.dumps([str(c.value) for r in ws.iter_rows() for c in r if isinstance(c.value,str) and c.value.startswith('DESCONTO ')]))`;
const obs = JSON.parse(execFileSync('python3', ['-I', '-c', py, arq]).toString());
ok(obs.some(t => /DESCONTO MARCELO MIYAZAKI.*R\$ 5\.700,00 .*PENSÃO ALIMENTÍCIA.*PARCELA 3\/3.*PARCELA 1\/2/.test(t)), `planilha: observação com as parcelas (${obs[0]})`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
