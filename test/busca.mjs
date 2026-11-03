// Teste SOL-F29 (parte 1): campo de busca no cadastro, aplicado nas não conformidades.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', d = f => raiz + 'dados/' + f;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Busca')));
await p.goto(html + '#bases');
await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const S = expr => p.evaluate(expr);
const okDlg = async () => { await p.click('#dlgBotoes button[value=ok]'); await p.waitForTimeout(250); };
// Cadastro: regras da planilha de controle; Power BI na sessão (convênios e faturistas vistos).
await p.click('[data-bsub="prestadores"]'); await p.setInputFiles('#prCtrlArq', d('repasse_10-2026_controle.xlsx')); await p.waitForSelector('#dlg[open]'); await okDlg();
await p.goto(html + '#inicio'); await p.setInputFiles('#inPBI', d('powerbi_completo_raw.xlsx')); await p.waitForFunction(() => !!window.__RM.S.pbi, null, { timeout: 120000 });

await p.goto(html + '#nc'); await p.waitForSelector('#ncNova'); await p.click('#ncNova'); await p.waitForSelector('#dlg[open]');
const campo = n => `#dlgCorpo [name="${n}"]`, lista = n => `#dlgCorpo label:has([name="${n}"]) .busca-lista`;
// Médico: busca no cadastro de prestadores.
await p.fill(campo('medico'), 'marc'); await p.waitForSelector(lista('medico') + ':not([hidden])');
const ops = await p.$$eval(lista('medico') + ' .op', e => e.map(x => x.textContent));
ok(ops.some(t => /^7Marcelo Garcia Marini/i.test(t)) && ops.some(t => /^15Marcelo Miyazaki/i.test(t)), `médico: lista do cadastro com código (${ops.slice(0, 3).join(' | ')})`);
await p.screenshot({ path: out + 'busca_nc.png' });
await p.press(campo('medico'), 'ArrowDown'); await p.press(campo('medico'), 'Enter');
const med = await S(() => [document.querySelector('#dlgCorpo [name="medico"]').value, document.querySelector('#dlgCorpo [name="medicoCod"]').value, document.getElementById('dlg').open]);
ok(/MARCELO/i.test(med[0]) && /^(7|15)$/.test(med[1]) && med[2], `setas + Enter escolhem sem fechar o diálogo (${med.join(' · ')})`);
// Prestador incorreto guarda o código.
await p.fill(campo('prestadorIncorreto'), 'gilb'); await p.waitForSelector(lista('prestadorIncorreto') + ':not([hidden])');
await p.press(campo('prestadorIncorreto'), 'Enter');
ok(await p.inputValue(campo('prestadorIncorreto')) === '2', 'prestador incorreto: escolher «Gilberto» grava o código 2');
// Esc fecha só a lista.
await p.fill(campo('convenio'), 'unimed curit'); await p.waitForSelector(lista('convenio') + ':not([hidden])');
const conv = await p.$$eval(lista('convenio') + ' .op', e => e.map(x => x.textContent));
ok(conv.some(t => /UNIMED CURITIBA/.test(t)), `convênio: busca nos convênios vistos no Power BI (${conv[0]})`);
await p.press(campo('convenio'), 'Escape');
ok(await S(() => document.getElementById('dlg').open) && await p.isHidden(lista('convenio')), 'Esc fecha a lista, não o diálogo');
// Responsável novo: usar o texto e cadastrar.
await p.fill(campo('responsavel'), 'NOVO.FATURISTA'); await p.waitForSelector(lista('responsavel') + ' .op.novo');
await p.press(campo('responsavel'), 'Enter');
await p.fill(campo('paciente'), 'Paciente Teste'); await p.fill(campo('titulo'), 'RX TORAX');
await okDlg(); await p.waitForSelector('#dlg[open]');
ok(/Cadastrar faturista/.test(await p.textContent('#dlgTitulo')), 'faturista fora do cadastro: pergunta se quer cadastrar');
await okDlg();
const r = await S(() => ({ fat: window.__RM.S.cfg.faturistas.some(f => f.nome === 'NOVO.FATURISTA'), nc: window.__RM.S.nc.itens.at(-1) }));
ok(r.fat && r.nc.responsavel === 'NOVO.FATURISTA' && r.nc.prestadorIncorreto === '2' && /MARCELO/i.test(r.nc.medico), 'NC gravada com os valores escolhidos e o faturista cadastrado');

// ---- Parte 2 ----
// Bases → Faturistas: a busca mostra quem fechou contas no Power BI e ainda não está cadastrado.
await p.goto(html + '#bases'); await p.waitForSelector('[data-bsub]'); await p.click('[data-bsub="faturistas"]'); await p.click('#fatAdd'); await p.waitForSelector('#dlg[open]');
await p.fill(campo('nome'), 'caroline'); await p.waitForSelector(lista('nome') + ':not([hidden])');
ok(/CAROLINE\.HASHIMOTO.*Power BI, sem cadastro/.test(await p.textContent(lista('nome'))), 'Bases → novo faturista: sugere os nomes do Power BI ainda sem cadastro');
await p.click('#dlgBotoes button[value=""]'); await p.waitForTimeout(200);
// Atualizar a base de dados com o Power BI (uma ação).
await p.goto(html + '#inicio'); await p.waitForSelector('#btPbiBase'); await p.click('#btPbiBase'); await p.waitForSelector('#dlg[open]');
ok(/faturista\(s\) novo\(s\)/.test(await p.textContent('#dlgCorpo')) && /procedimento\(s\) \(TUSS\)/.test(await p.textContent('#dlgCorpo')), 'prévia da atualização: faturistas, convênios e procedimentos');
await okDlg();
const base = await S(() => ({ fat: window.__RM.S.cfg.faturistas.length, conv: window.__RM.S.cfg.convenios.length, tuss: (window.__RM.S.eq.catalogoTUSS || []).length, un: window.__RM.S.cfg.faturistas.find(f => f.nome === 'MARCOS.CAETANO')?.unidades }));
ok(base.fat >= 50 && base.conv === 220 && base.tuss > 50 && /\d/.test(base.un || ''), `base atualizada: ${base.fat} faturistas, ${base.conv} convênios, ${base.tuss} procedimentos (MARCOS.CAETANO: un. ${base.un})`);
// Fluxo: + Prestador do mês pela busca.
await p.goto(html + '#fluxo'); await p.waitForSelector('#fxCriar'); await p.click('#fxCriar'); await p.waitForSelector('[data-tg="usg"]'); await p.click('[data-tg="usg"]');
await p.click('[data-g="usg"] [data-docadd]'); await p.waitForSelector('#dlg[open]');
await p.fill(campo('nome'), 'roberto'); await p.waitForSelector(lista('nome') + ':not([hidden])'); await p.press(campo('nome'), 'Enter');
ok(await p.inputValue(campo('cod')) === '9', 'Fluxo → + Prestador: escolher pelo nome preenche o código (9)');
await okDlg();
ok(await S(() => !!window.__RM.S.fluxo.competencias['2026-10'].grupos.usg.documental['9']), 'prestador incluído no controle documental do mês');
// Equivalências: código TUSS pela busca no catálogo.
await p.goto(html + '#equivalencias'); await p.waitForSelector('#eqNova'); await p.click('#eqNova'); await p.waitForSelector('#dlg[open]');
await p.fill(campo('codigo'), '4090112'); await p.waitForSelector(lista('codigo') + ':not([hidden])'); await p.press(campo('codigo'), 'Enter');
ok(/^4090112\d$/.test(await p.inputValue(campo('codigo'))), `Equivalências → nova relação: código TUSS do catálogo (${await p.inputValue(campo('codigo'))})`);
await p.click('#dlgBotoes button[value=""]');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
