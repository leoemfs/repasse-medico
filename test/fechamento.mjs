// Teste da aba Fechamento: valores da última rodada com aceite, situação, ajustes do mês,
// avisos de regra, «Copiar prévia», exportação em 3 abas + indicadores e evidência no Fluxo.
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
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Fechamento')));
await p.goto(html + '#inicio');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const S = expr => p.evaluate(expr);
const okDlg = async () => { await p.waitForSelector('#dlg[open]'); await p.click('#dlgBotoes button[value=ok]'); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };
const abrirFech = async (sub = 'usg') => { await p.goto(html + '#fechamento'); await p.waitForSelector('[data-fsub]'); await p.click(`[data-fsub="${sub}"]`); await p.waitForTimeout(250); };
const linhaPrest = cod => p.locator(`#fhCorpo tr:has(td:text-is("${cod}"))`).first();

// Regras do cadastro (planilha de controle) e fluxo da competência iniciado.
await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub]'); await p.click('[data-bsub="prestadores"]');
await p.setInputFiles('#prCtrlArq', d('repasse_10-2026_controle.xlsx')); await okDlg();
await p.goto(html + '#fluxo'); await p.waitForSelector('#fxCriar'); await p.click('#fxCriar'); await p.waitForSelector('.marco');

// 1) Sem rodada: todos «Sem valores», exportação como prévia.
await abrirFech();
const nSem = (await p.$$('#fhCorpo .fs-sem')).length;
ok(/PRÉVIA/.test(await p.textContent('#pag-fechamento .aviso-fixo')) && nSem === 33, `sem rodadas: ${nSem} prestadores de USG «Sem valores» e fechamento em prévia`);
const faixas = await p.$$eval('#fhCorpo tr.fh-faixa', trs => trs.map(tr => [...tr.cells].map(c => c.textContent.trim()).filter(Boolean).join('|')));
ok(faixas.some(f => f === 'Repasse médicos geral|44%|49%|40%|40%|44%|42%') && faixas.some(f => f === 'Repasse com acréscimo de 2%|46%|51%|42%|42%|46%|44%'), `percentuais da faixa embaixo de cada unidade (${faixas[0]})`);
// Ao rolar a tabela para baixo, o cabeçalho continua por cima dos nomes (SOL-F27).
await p.$eval('#fhCorpo .tw', el => { el.scrollTop = 400; }); await p.waitForTimeout(150);
const topo = await p.$eval('#fhCorpo th.fh-nome', th => { const r = th.getBoundingClientRect(); const e = document.elementFromPoint(r.left + 10, r.top + r.height / 2); return e === th || th.contains(e); });
ok(topo, 'ao rolar, o cabeçalho «Prestador» fica por cima das linhas');
await p.$eval('#fhCorpo .tw', el => { el.scrollTop = 0; });

// 2) Conferência do relatório de USG do prestador 15 na unidade 1 (sem aceite → Verificar).
await p.goto(html + '#inicio');
await p.setInputFiles('#inMV', [d('mv_usg_medico15_unidade1.pdf')]); await p.waitForFunction(() => window.__RM.S.relatorios.length === 1, null, { timeout: 60000 });
await p.setInputFiles('#inApolo', d('apolo_09-2026.xlsx')); await p.waitForFunction(() => !!window.__RM.S.apolo, null, { timeout: 60000 });
await p.goto(html + '#conferencia'); await p.waitForSelector('#cfRodar'); await p.selectOption('#cfUn', '1'); await p.click('#cfRodar'); await p.waitForSelector('#cfTab table');
await abrirFech();
const l15 = await linhaPrest('15').textContent();
ok(/Verificar/.test(l15) && /4\.926,59/.test(l15) && /sem aceite na\(s\) unidade\(s\) 1/.test(l15), 'rodada sem aceite: valor 4.926,59 (igual ao PDF) como prévia e situação «Verificar»');

// 3) Aceite → «Conferido · a enviar»; exportação final.
await p.goto(html + '#rodadas'); await p.waitForSelector('[data-ac]'); await p.click('[data-ac]'); await p.waitForSelector('#dlg[open]');
await p.fill('#dlgCorpo input[name=obs]', 'pendências por equivalência ainda não validada'); await okDlg();
await abrirFech();
ok(/Conferido/.test(await linhaPrest('15').textContent()) && await p.isVisible('text=versão final'), 'com aceite: «Conferido · a enviar» e exportação final');
ok(!/linha\(s\) fora de/.test(await linhaPrest('15').textContent()), 'percentual de USG do relatório bate com a faixa geral (44% na unidade 1)');

// 4) Ajustes do mês: plantão e desconto com observação.
await linhaPrest('15').locator('[data-aj$="|plantao"]').fill('725'); await linhaPrest('15').locator('[data-aj$="|plantao"]').dispatchEvent('change'); await p.waitForTimeout(250);
await linhaPrest('15').locator('[data-aj$="|descontos"]').fill('100'); await linhaPrest('15').locator('[data-aj$="|descontos"]').dispatchEvent('change'); await p.waitForTimeout(250);
await linhaPrest('15').locator('[data-aj$="|obs"]').fill('adiantamento parcela 1/3'); await linhaPrest('15').locator('[data-aj$="|obs"]').dispatchEvent('change'); await p.waitForTimeout(250);
const t15 = await linhaPrest('15').textContent();
ok(/5\.651,59/.test(t15) && /5\.551,59/.test(t15), 'total = 4.926,59 + plantão 725 = 5.651,59; total geral − 100 = 5.551,59');
ok(/R\$ 2\.000,00|2\.000,00/.test(await linhaPrest('5').textContent()) && /Sem valores/.test(await linhaPrest('5').textContent()), 'BOARD do cadastro aparece mesmo sem relatório (Gustavo: 2.000,00)');

// 5) Copiar prévia.
await linhaPrest('15').locator('[data-copiar]').click(); await p.waitForTimeout(300);
const clip = await p.evaluate(() => navigator.clipboard.readText());
ok(/Prestador: 15 - /.test(clip) && /1- ULTRAMED APUCARANA \(HPA\) \(CNPJ 10\.304\.593\/0001-33\): R\$ 4\.926,59/.test(clip) && /PLANTÃO \(CNPJ 10\.304\.593\/0001-33\): R\$ 725,00/.test(clip) && /Total geral bruto: R\$ 5\.551,59/.test(clip) && /Pagamento previsto: 15\/10\/2026/.test(clip), 'prévia do e-mail com CNPJ por unidade, plantão, desconto e data de pagamento');
await p.screenshot({ path: out + 'fechamento_usg.png' });

// 6) IMG: classe fixa e blocos manuais.
await abrirFech('img');
ok(/Marcelo Miyazaki Yoshida/.test(await p.textContent('#fhCorpo')) && /fixo/.test(await linhaPrest('15').textContent()), 'IMG lista os prestadores do cadastro com classe fixa');
ok(!/Gilson/i.test(await p.textContent('#fhCorpo')), 'médicos V3 saíram do IMG');
// NF complementar (F28): Curso Cetrus com prestador do cadastro; a categoria traz a unidade 17 e R$ 1.000 por período.
await p.click('[data-nf-nova="img"]'); await p.waitForSelector('#dlg[open]');
await p.fill('#dlgCorpo [name="prestador"]', 'henrique pini'); await p.waitForSelector('#dlgCorpo .busca-lista:not([hidden])'); await p.press('#dlgCorpo [name="prestador"]', 'Enter');
await p.fill('#dlgCorpo [name="categoria"]', 'Curso Cetrus'); await p.dispatchEvent('#dlgCorpo [name="categoria"]', 'change');
await p.fill('#dlgCorpo [name="quantidade"]', '4');
const nfForm = await S(() => [document.querySelector('#dlgCorpo [name="cod"]').value, document.querySelector('#dlgCorpo [name="unidade"]').value, document.querySelector('#dlgCorpo [name="valorUnitario"]').value]);
ok(nfForm.join() === '10175,17,1000', `formulário: código do cadastro, unidade 17 e R$ 1.000 da categoria (${nfForm})`);
await p.click('#dlgBotoes button[value=ok]'); await p.waitForTimeout(300);
const nf = await S(() => window.__RM.S.compReg.itens['2026-10'].fechamento.nfs[0]);
ok(nf && nf.valor === 4000 && nf.tipo === 'img' && nf.unidade === '17' && /Henrique/i.test(nf.nome), 'NF complementar gravada: 4 × R$ 1.000 = R$ 4.000, unidade 17');
ok(/Curso Cetrus/.test(await p.textContent('.nf-cartao')) && /4\.000,00/.test(await p.textContent('.nf-cartao')), 'cartão mostra a NF com uma coluna por categoria');
// Sem unidade/CNPJ não grava.
await p.click('[data-nf-nova="img"]'); await p.waitForSelector('#dlg[open]');
await p.fill('#dlgCorpo [name="cod"]', '5'); await p.fill('#dlgCorpo [name="categoria"]', 'Reajuste nova'); await p.fill('#dlgCorpo [name="valor"]', '300');
await p.click('#dlgBotoes button[value=ok]'); await p.waitForTimeout(300);
ok(/unidade\/CNPJ/.test(await p.textContent('#aviso')) && await S(() => window.__RM.S.compReg.itens['2026-10'].fechamento.nfs.length) === 1, 'CNPJ de emissão obrigatório');
// Curitiba (V3): sub-aba própria com os médicos V3 e NF complementar.
await abrirFech('curitiba');
ok(/Gilson/i.test(await p.textContent('#fhCorpo')) && !!(await p.$('[data-nf-nova="curitiba"]')), 'sub-aba Curitiba (V3) com os médicos V3 e NF complementar');
await abrirFech('img');
await p.screenshot({ path: out + 'fechamento_img.png' });

// 7) Produção e indicadores.
await abrirFech('producao');
const prod = await linhaPrest('15').textContent();
ok(/A/.test(prod) && /fixo classe A/.test(prod), 'produção e classe: Marcelo com classe fixa A');
await abrirFech('indicadores');
ok(/total USG/.test(await p.textContent('#fhCorpo')) && /5\.551,59/.test(await p.textContent('#fhCorpo')), 'indicadores: total de USG');

// 8) Exportação: três abas no layout da planilha de controle + indicadores à parte.
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#fhExp')]);
const arq = out + 'fechamento.xlsx'; await dl.saveAs(arq);
const x = JSON.parse(execFileSync('python3', ['-I', '-c', `import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1]); u=wb.worksheets[0]
linha=[r for r in u.iter_rows(values_only=True) if r[0]==15][0]
form=[c.value for c in u[[c.row for c in u['A'] if c.value==15][0]] if isinstance(c.value,str) and c.value.startswith('=')]
print(json.dumps({'abas':wb.sheetnames,'linha':[v for v in linha if v is not None],'form':form,'leg':any(r[1]=='Concluído' for r in u.iter_rows(values_only=True)),'mesc':[str(m) for m in u.merged_cells.ranges],'fmt':u.cell(row=[c.row for c in u['A'] if c.value==15][0],column=3).number_format,'zoom':u.sheet_view.zoomScale}))`, arq]).toString());
ok(JSON.stringify(x.abas) === JSON.stringify(['REPASSE USG 15-10-2026', 'REPASSE IMG 30-10-2026', 'REPASSE CURITIBA 30-10-2026', 'PRODUÇÃO USG CLASSE 10-2026']), `abas: ${x.abas.join(', ')}`);
ok(x.mesc.includes('A1:M1') && x.mesc.includes('A3:M3') && x.mesc.includes('A4:B4') && x.mesc.includes('K4:K6') && x.mesc.includes('I5:I6') && x.fmt.includes('R$') && x.zoom === 85, `layout do modelo: mesclagens, formato contábil R$ e zoom 85% (${x.mesc.slice(0, 6).join(' ')})`);
ok(x.linha.includes(4926.59) && x.linha.includes(725) && x.form.length === 2 && x.leg, `linha do prestador 15 com valor, plantão e fórmulas de total (${JSON.stringify(x.linha.slice(0, 6))})`);
const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#fhInd')]);
ok(/^Indicadores_fechamento_10-2026/.test(dl2.suggestedFilename()), 'indicadores exportados à parte');
// Evidência no Fluxo (não conclui a etapa).
const ev = await S(() => { const t = window.__RM.S.fluxo.competencias['2026-10'].grupos.usg.tarefas.envio; return [t.evidencias?.length, t.status].join(); });
ok(ev === '1,ni', `evidência registrada na etapa de envio de USG sem concluí-la (${ev})`);

// 9) Variação × competência anterior: rodada de 09/2026 com metade do valor.
await S(() => { const r = window.__RM.S.rodadas.at(-1), c = JSON.parse(JSON.stringify(r)); c.id = 'rodant'; c.chaveCompetencia = '2026-09'; c.em = '2026-09-20T10:00:00Z'; c.linhas.forEach(l => { l.vlRepasse = l.vlRepasse / 2; }); window.__RM.S.rodadas.push(c); return new Promise(res => { const rq = indexedDB.open('repasse-medico-v2', 1); rq.onsuccess = () => { const tx = rq.result.transaction('rodadas', 'readwrite'); tx.objectStore('rodadas').put(c); tx.oncomplete = () => res(); }; }); });
await abrirFech();
ok(/variação de \+/.test(await linhaPrest('15').textContent()), 'aviso de variação acima de 30% contra a competência anterior');
// Celular sem rolagem da página.
const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
await m.goto(html + '#fechamento'); await m.waitForSelector('[data-fsub]');
ok(await m.evaluate(() => document.documentElement.scrollWidth) <= 390, 'celular sem rolagem horizontal da página');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
