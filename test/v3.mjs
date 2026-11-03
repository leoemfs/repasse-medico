// Teste SOL-F30: regras da V3 (Curitiba) — cálculo pela regra do médico, texto do e-mail,
// Bases → Médicos V3, Fechamento → Curitiba, exportação e marcadores de HM na conferência da unidade 5.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', d = f => raiz + 'dados/' + f;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctx.newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste V3')));
await p.goto(html + '#inicio');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const S = (fn, arg) => p.evaluate(fn, arg);
const okDlg = async (botao = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${botao}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };

// Linhas fictícias no formato da rodada (sem paciente), reproduzindo o exemplo do Dr. Ian (10/2026).
const LINHAS_IAN = [
  { grupo: 'ULTRASSONOGRAFIA - OUTROS', desc: 'USG ABDOME TOTAL', convenio: 'UNIMED CURITIBA', quant: 1500, vlTotal: 90000, vlRepasse: 0, tipoItem: 'procedimento' },
  { grupo: 'ULTRASSONOGRAFIA - OUTROS', desc: 'DOPPLER COLORIDO VENOSO DE MEMBRO INFERIOR - UNILAT', convenio: 'PARTICULAR', quant: 39, vlTotal: 3838.16, vlRepasse: 0, tipoItem: 'procedimento' },
  { grupo: 'HONORARIOS MEDICOS PF', desc: 'USG MAMAS - HM', convenio: 'UNIMED CURITIBA', quant: 300, vlTotal: 21907.88, vlRepasse: 0, tipoItem: 'hm' },
  { grupo: 'HONORARIO MEDICO RAIO X', desc: 'RX TORAX - 2 INCIDENCIAS-HM', convenio: 'UNIMED CURITIBA', quant: 1, vlTotal: 50, vlRepasse: 0, tipoItem: 'hm' },
  { grupo: 'HONORARIOS MEDICOS PF', desc: 'USG MAMAS - HM', convenio: 'PARTICULAR', quant: 1, vlTotal: 80, vlRepasse: 0, tipoItem: 'hm' }
];
const EMAIL_IAN = ['Boa tarde, segue relatório de produção para conferência.', '', 'Foram realizados 1539 exames de ultrassom.', '',
  'Densitometria: R$ 0,00 (SEM PRODUÇÃO)', 'Honorários USG UNIMED: R$ 21.907,88', 'USG: R$ 93.838,16', '',
  'Ultrassom: R$ 93.838,16 mais HM R$ 21.907,88 = R$ 115.746,04', 'menos os impostos (9,15%) = R$ 105.155,28 * 70% = R$ 73.608,69', '',
  'Total para emissão da nota fiscal: R$ 73.608,69'].join('\n');

// 1) Motor: cálculo e texto do e-mail.
const m = await S(([L]) => {
  const { calcularV3, textoEmailV3, regraV3Padrao } = window.__RM.t, c = calcularV3(regraV3Padrao(), L);
  const comVolume = n => calcularV3(regraV3Padrao(), [{ grupo: 'ULTRASSONOGRAFIA', desc: 'USG', quant: n, vlTotal: 1000, tipoItem: 'procedimento' }]).pct;
  const densito = calcularV3(regraV3Padrao(), [...L, { grupo: 'DENSITOMETRIA', desc: 'DENSITOMETRIA OSSEA - ROTINA', quant: 40, vlTotal: 12000, tipoItem: 'procedimento' }]);
  const alex = calcularV3({ impostos: 9.15, usg: { forma: 'por-laudo', valor: 20, faixas: [] }, hm: 'valor-laudo', outros: [{ nome: 'Raio-X', padrao: 'RX|RADIOLOG', forma: 'por-laudo', valor: 8 }] }, [
    { grupo: 'ULTRASSONOGRAFIA - OUTROS', desc: 'USG TIREOIDE', quant: 100, vlTotal: 9000, tipoItem: 'procedimento' },
    { grupo: 'HONORARIOS MEDICOS PF', desc: 'DOPPLER COLORIDO DE ORGAO OU ESTRUTURA ISOLADA - HM', convenio: 'UNIMED CURITIBA', quant: 10, vlTotal: 700, tipoItem: 'hm' },
    { grupo: 'RADIOLOGIA', desc: 'RX TORAX', quant: 5, vlTotal: 300, tipoItem: 'procedimento' },
    { grupo: 'MAMOGRAFIA', desc: 'MAMOGRAFIA DIGITAL', quant: 2, vlTotal: 400, tipoItem: 'procedimento' }]);
  return { c: { total: c.total, exames: c.exames, base: c.base, liquido: c.liquido, pct: c.pct, hm: c.hm.valor, exc: c.hmExcluir.qtd }, texto: textoEmailV3(c),
    faixas: [799, 800, 999, 1000].map(comVolume), densito: densito.total, alex: { total: alex.total, semRegra: [...alex.semRegra.keys()] } };
}, [LINHAS_IAN]);
ok(m.c.total === 73608.69 && m.c.exames === 1539 && m.c.base === 115746.04 && m.c.liquido === 105155.28 && m.c.pct === 70, `Dr. Ian: 1539 exames (Doppler conta), R$ 115.746,04 − 9,15% = 105.155,28 × 70% = ${m.c.total}`);
ok(m.c.hm === 21907.88 && m.c.exc === 2, 'HM: só USG/Doppler Unimed entra; RX e HM de outro convênio ficam «a excluir» (2)');
ok(m.texto === EMAIL_IAN, 'texto do e-mail igual ao exemplo de 10/2026' + (m.texto === EMAIL_IAN ? '' : '\n' + m.texto));
ok(m.faixas.join() === '65,68,68,70', `faixas por volume: 799→65 · 800→68 · 999→68 · 1000→70 (${m.faixas.join(', ')})`);
ok(m.densito === r2(73608.694 + 1200), `densitometria a 10% do bruto soma ao total (${m.densito})`);
ok(m.alex.total === 2240 && m.alex.semRegra.join() === 'MAMOGRAFIA', `por laudo: 110 × 20 (USG + HM = laudo) + 5 RX × 8 = ${m.alex.total}; mamografia fora, com aviso`);
function r2(x) { return Math.round(x * 100) / 100; }

// 2) Bases → Prestadores → Médicos V3.
await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub]'); await p.click('[data-bsub="prestadores"]');
await p.setInputFiles('#prCtrlArq', d('repasse_10-2026_controle.xlsx')); await okDlg();
const v3 = await S(() => window.__RM.S.cfg.prestadores.filter(x => x.regras?.v3).map(x => [x.cod, x.nomeMV]));
ok(v3.length >= 1 && await p.isVisible('#cardV3') && (await p.$$('#cardV3 tbody tr')).length === v3.length, `cartão «Médicos V3» com os ${v3.length} médico(s) da planilha (${v3.map(x => x[1]).join(', ')})`);
ok(/sem regra cadastrada/.test(await p.textContent('#cardV3')), 'médico V3 sem regra aparece marcado');
const [codV3, nomeV3] = v3[0];
await p.click(`#cardV3 tr:has(td:text-is("${codV3}")) [data-v3regra]`); await p.waitForSelector('#dlg[open]');
ok(await p.inputValue('#dlgCorpo [name="impostos"]') === '9.15' && await p.inputValue('#dlgCorpo [name="fxPct2"]') === '70', 'regra nova começa com a do Dr. Ian (9,15%, 65/68/70)');
await p.screenshot({ path: out + 'v3_regra.png' });
await okDlg();
const regra = await S(cod => window.__RM.S.cfg.prestadores.find(x => x.cod === cod).regras.v3regra, codV3);
ok(regra?.usg.faixas.map(f => `${f.de}:${f.pct}`).join() === '0:65,800:68,1000:70' && regra.outros[0].nome === 'Densitometria', 'regra gravada com as faixas e a densitometria');
ok(/65 \/ 68 \/ 70% do líquido por volume/.test(await p.textContent('#cardV3')), 'resumo da regra no cartão');
// + Médico V3 com regra por laudo.
await p.click('#v3Add'); await p.waitForSelector('#dlg[open]');
await p.fill('#dlgCorpo [name="prestador"]', 'roberto'); await p.waitForSelector('#dlgCorpo .busca-lista:not([hidden])'); await p.press('#dlgCorpo [name="prestador"]', 'Enter');
await p.click('#dlgBotoes button[value="ok"]'); await p.waitForFunction(() => document.getElementById('dlg').open && /Regras da V3/.test(document.getElementById('dlgTitulo').textContent));
await p.selectOption('#dlgCorpo [name="usgForma"]', 'por-laudo'); await p.fill('#dlgCorpo [name="usgValor"]', '20'); await p.selectOption('#dlgCorpo [name="hm"]', 'valor-laudo');
await okDlg();
const r9 = await S(() => window.__RM.S.cfg.prestadores.find(x => x.cod === '9').regras);
ok(r9.v3 && r9.v3regra.usg.forma === 'por-laudo' && r9.v3regra.usg.valor === 20 && r9.v3regra.hm === 'valor-laudo', '+ Médico V3: prestador da busca entra na V3 com regra por laudo');

// 3) Fechamento → Curitiba com rodada da unidade 5 (aceita).
await p.goto(html + '#fluxo'); await p.waitForSelector('#fxCriar'); await p.click('#fxCriar'); await p.waitForSelector('.marco');
await S(async ([cod, nome, L]) => {
  const { S: E, t } = window.__RM;
  await t.dbGravar({ id: 'rodV3', tipo: 'conferencia', em: new Date().toISOString(), operador: 'Teste', unidadeCod: '5', prestadorCod: cod, prestadorNome: nome, repasse: 'REPASSE USG', descricao: 'REPASSE USG V3', chaveCompetencia: E.comp, competencia: '', contagens: {},
    linhas: L.map((l, i) => ({ chave: 'k' + i, estado: 'conferido', medico: '', codigo: String(i), kd: 'M|' + i, kl: '', decisao: '', ...l })), aceite: { por: 'Teste', em: new Date().toISOString() } });
}, [codV3, nomeV3, LINHAS_IAN]);
await p.goto(html + '#fechamento'); await p.waitForSelector('[data-fsub]'); await p.click('[data-fsub="curitiba"]'); await p.waitForTimeout(300);
const linha = p.locator(`#fhCorpo tr:has(td:text-is("${codV3}"))`).first();
const txt = await linha.textContent();
ok(/1\.539/.test(txt) && /93\.838,16/.test(txt) && /21\.907,88/.test(txt) && /105\.155,28/.test(txt) && /70%/.test(txt) && /73\.608,69/.test(txt), 'linha do médico: exames, bruto, HM, líquido, 70% e total da NF 73.608,69');
ok(/2 HM a excluir/.test(txt), 'aviso dos HM a excluir');
ok(/Sem valores/.test(await p.locator('#fhCorpo tr:has(td:text-is("9"))').first().textContent()), 'médico V3 sem relatório: «Sem valores»');
await p.screenshot({ path: out + 'v3_fechamento.png' });
await linha.locator('[data-memoria]').click(); await p.waitForSelector('#dlg[open]');
ok((await p.textContent('#dlgCorpo pre')).trim() === EMAIL_IAN && /RX TORAX/.test(await p.textContent('#dlgCorpo')), 'memória de cálculo: texto do e-mail e HM a excluir listados');
await p.screenshot({ path: out + 'v3_memoria.png' });
await okDlg('copiar');
ok(await p.evaluate(() => navigator.clipboard.readText()) === EMAIL_IAN, '«Copiar texto do e-mail» copia o texto');
// Ajuste do mês na V3 (desconto) entra no total geral.
await linha.locator('[data-aj$="|descontos"]').fill('608.69'); await linha.locator('[data-aj$="|descontos"]').dispatchEvent('change'); await p.waitForTimeout(300);
ok(/73\.000,00/.test(await p.locator(`#fhCorpo tr:has(td:text-is("${codV3}"))`).first().textContent()), 'desconto do mês: total geral 73.000,00');
await p.click('[data-fsub="img"]'); await p.waitForTimeout(200);
ok(!(await p.textContent('#fhCorpo')).includes(nomeV3), 'médico V3 não aparece no IMG');

// 4) Exportação: aba REPASSE CURITIBA com o cálculo e a memória.
await p.click('[data-fsub="curitiba"]'); await p.waitForTimeout(200);
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#fhExp')]);
const arq = out + 'v3_fechamento.xlsx'; await dl.saveAs(arq);
const py = `import openpyxl,sys,json
wb=openpyxl.load_workbook(sys.argv[1])
ws=[w for w in wb.worksheets if w.title.startswith('REPASSE CURITIBA')][0]
vals=[[c.value for c in r] for r in ws.iter_rows()]
print(json.dumps([[v if isinstance(v,(int,float,str)) or v is None else str(v) for v in r] for r in vals]))`;
const rows = JSON.parse(execFileSync('python3', ['-I', '-c', py, arq]).toString());
const lin = rows.find(r => String(r[0]) === codV3);
ok(lin && lin[2] === 1539 && lin[3] === 93838.16 && lin[4] === 21907.88 && lin[6] === 105155.28 && lin[7] === 0.7 && lin[8] === 73608.69, `planilha: linha do médico com exames, bruto, HM, líquido, 70% e total (${lin?.slice(0, 9).join(' | ')})`);
ok(rows.some(r => r[1] === 'Total para emissão da nota fiscal: R$ 73.608,69') && rows.some(r => /MEMÓRIA DE CÁLCULO/.test(r[1] || '')), 'planilha: memória de cálculo com o texto do e-mail');

// 5) Conferência da unidade 5: marcadores de HM.
const conf = await S(() => {
  const { S: E, t } = window.__RM;
  const reg = (seq, desc, grupo, conv) => ({ seq, chave: 'c' + seq, codigo: '1' + seq, procDesc: desc, grupoNome: grupo, convenio: conv, paciente: 'PACIENTE FICTICIO', data: new Date(Date.UTC(2026, 8, 10)), vlTotal: 70, vlRepasse: 0, quant: 1 });
  const rel = { regs: [reg(1, 'USG MAMAS - HM', 'HONORARIOS MEDICOS PF', 'UNIMED CURITIBA'), reg(2, 'RX TORAX - 2 INCIDENCIAS-HM', 'HONORARIO MEDICO RAIO X', 'UNIMED CURITIBA'), reg(3, 'DOPPLER COLORIDO DE ORGAO OU ESTRUTURA ISOLADA - HM', 'HONORARIOS MEDICOS PF', 'PARTICULAR')], cab: {} };
  const eq = { itens: [], revisao: 1 }, apolo = { laudos: [] };
  const em = un => t.conferirCruzado(rel, apolo, E.cfg, eq, { tol: 0, unidadeCod: un, medicos: [] }).linhas.map(x => `${x.status}:${[...x.marcadores].join('+')}`);
  return { v3: em('5'), sra: em('1') };
});
ok(conf.v3.join() === 'conferido:hm-v3-devido,hm-pendente:hm-v3-excluir,hm-pendente:hm-v3-excluir', `unidade 5: HM USG Unimed «devido» (conferido); RX e outro convênio «a excluir» (${conf.v3.join(' · ')})`);
ok(conf.sra.every(x => x === 'hm-pendente:'), 'outras unidades: HM continua «regra pendente», sem marcador da V3');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
