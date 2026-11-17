// v3.0.0-alpha.15 — SOL-F19: quadro por prestador no Fechamento. As colunas saem dos dados (rodada, aceite, e-mail e NF
// no controle documental do Fluxo); «Aguardando terceiros» é marca à mão com motivo; clicar no cartão abre o menu da
// situação e «Abrir conferência»; aba «Quadro» no Excel de indicadores. Dados fictícios.
import { createRequire } from 'module';
import fs from 'fs';
import { execFileSync } from 'child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.mkdirSync(out, { recursive: true });
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];
const p = await (await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.clock.install({ time: new Date('2026-11-17T10:00:00') });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Quadro')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const okDlg = async (botao = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${botao}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(200); };
// Prestador 15 (USG, unidade 17) com 2 linhas conferidas; o checklist da competência iniciado no Fluxo.
await p.goto(html + '#fluxo'); await p.waitForSelector('#fxCriar'); await p.click('#fxCriar'); await p.waitForSelector('.marco');
await p.evaluate(() => {
  const { S } = window.__RM, d = n => new Date(Date.UTC(2026, 9, n)), dia = n => Math.round(d(n) / 864e5);
  const L = (i, pac, n) => ({ i, linhaPlanilha: i + 2, idLaudo: String(300 + i), unidade: 'AlphaSonic Palhano', paciente: pac, pn: pac, idPac: String(i), titulo: 'USG TIREOIDE', tn: 'USG TIREOIDE', descricao: '', data: d(n), dia: dia(n), convenio: 'UNIMED', modalidade: 'US', medico: 'DR X', mn: 'DR X' });
  S.apolo = { nome: 'apolo.xlsx', hash: 'h', laudos: [L(0, 'ANA PAULA ROCHA', 3), L(1, 'BRUNA LIMA COSTA', 4)] };
  S.eq.itens.push({ id: 'eqQ', codigo: '40901173', titulo: 'USG TIREOIDE', status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'T' });
  const R = (seq, pac, n, vl) => ({ seq, pagina: 1, codigo: '40901173', procDesc: 'US TIREOIDE', grupoNome: 'ULTRASSONOGRAFIA', conta: String(9000 + seq), atendimento: String(7000 + seq), paciente: pac, convenio: 'UNIMED', data: d(n), vlRepasse: vl, vlTotal: vl * 2, pct: .5, quant: 1, prestadorCod: '15', prestadorNome: 'DR X', repasse: '25022' });
  S.relatorios = [{ id: 'rQ', nome: 'mv.pdf', tamanho: 1, hash: 'hQ', unidadePasta: '17', grupoPasta: 'usg', rel: { arquivo: 'mv.pdf', cab: { prestadorCod: '15', prestadorNome: 'DR X', repasse: '25022', descricao: 'REPASSE USG', competencia: '11/2026', repasses: [] }, regs: [R(1, 'ANA PAULA ROCHA', 3, 10), R(2, 'BRUNA LIMA COSTA', 4, 20)], avisos: [], conferencias: [], ok: true } }];
  // Prestador de USG cadastrado (com faixa) e ainda sem relatório: «A conferir».
  S.cfg.prestadores.push({ cod: '77', nomeMV: 'DRA SEM RELATORIO', aliases: [], naoRealizaRepasse: false, regras: { faixaUSG: S.cfg.faixasUSG[0]?.id || 'f1' } });
  window.__RM.irPara('conferencia');
});
await p.waitForSelector('#cfRodar'); await p.selectOption('#cfUn', '17').catch(() => {}); await p.click('#cfRodar'); await p.waitForSelector('#cfAbas', { timeout: 15000 }); await p.waitForTimeout(200);
const coluna = () => p.evaluate(() => { const f = window.__RM.t.fechamentoAtual(); for (const t of ['usg', 'img', 'curitiba']) { const x = (f[t] || []).find(y => y.cod === '15'); if (x) return `${t}:${x.coluna}`; } return '-'; });
const abrirQuadro = async () => { await p.evaluate(() => window.__RM.irPara('fechamento')); await p.waitForSelector('[data-fsub="quadro"]'); await p.click('[data-fsub="quadro"]'); await p.waitForSelector('.quadro'); };
const menu = async ac => { await p.click('.qd-card[data-sit$="|15"]'); await p.waitForSelector('#menuSit'); await p.click(`#menuSit [data-ac="${ac}"]`); await p.waitForTimeout(300); };
const naColuna = k => p.evaluate(k => !!document.querySelector(`.qd-col[data-col="${k}"] .qd-card[data-sit$="|15"]`), k);
const c1 = await coluna(); const tipo = c1.split(':')[0];
ok(c1.endsWith(':correcao'), `rodada sem aceite → «Em correção» (${c1})`);
await abrirQuadro();
const cols = await p.$$eval('.qd-col h3', e => e.map(x => x.textContent.replace(/\s*\d+$/, '').trim()));
ok(cols.join('|') === 'A conferir|Em correção|Aguardando terceiros|Com aceite|Enviado|NF recebida|Concluído', `subaba «Quadro» com as 7 colunas (${cols.join(' · ')})`);
ok(await naColuna('correcao'), 'cartão do DR X na coluna «Em correção»');
ok(await p.evaluate(() => !!document.querySelector('.qd-col[data-col="conferir"] .qd-card[data-sit$="|77"]')), 'prestador cadastrado sem relatório (77) fica em «A conferir»');
// Aceite → «Com aceite».
await p.evaluate(() => window.__RM.irPara('conferencia')); await p.waitForSelector('#cfAbas'); await p.click('#cfAba-aceite'); await p.waitForTimeout(150);
await p.click('#cfAceitar'); await p.waitForTimeout(300); if (await p.isVisible('#dlg[open]')) await okDlg();
ok((await coluna()).endsWith(':aceite'), `aceite → «Com aceite» (${await coluna()})`);
// Aguardando terceiros (marca à mão, com motivo) e tirar.
await abrirQuadro(); await menu('aguardando'); await p.waitForSelector('#dlg[open]');
await p.selectOption('#dlgCorpo select[name=quem]', 'medico'); await p.fill('#dlgCorpo input[name=motivo]', 'médico vai conferir os valores'); await okDlg();
ok((await coluna()).endsWith(':terceiros') && await naColuna('terceiros') && /Médico: médico vai conferir os valores/.test(await p.textContent('.qd-col[data-col="terceiros"]')), '«Aguardando terceiros…» pede de quem e o motivo; o cartão mostra os dois');
await p.screenshot({ path: out + 'quadro_fechamento.png' });
await menu('tirarAguardando'); ok((await coluna()).endsWith(':aceite'), 'tirar a marca: volta para «Com aceite»');
// E-mail → NF → Financeiro, pelo menu do cartão (grava no Fluxo).
await menu('relatorio'); ok((await coluna()).endsWith(':enviado') && await naColuna('enviado'), 'menu do cartão «E-mail enviado» → coluna «Enviado» (gravado no Fluxo)');
await menu('nfRecebida'); ok((await coluna()).endsWith(':nf'), '«NF recebida» → coluna «NF recebida»');
await menu('nfFinanceiro'); ok((await coluna()).endsWith(':concluido') && await naColuna('concluido'), '«NF encaminhada ao Financeiro» → «Concluído»');
const doc = await p.evaluate(t => window.__RM.S.fluxo.competencias['2026-11'].grupos[t].documental['15'], tipo);
ok(doc?.relatorio && doc?.nfRecebida && doc?.nfFinanceiro, 'as marcas ficam no controle documental do Fluxo (dono do dado)');
// Excel de indicadores com a aba «Quadro».
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#fhInd')]); await dl.saveAs(out + 'quadro_indicadores.xlsx');
const q = JSON.parse(execFileSync('python3', ['-I', '-c', `import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1],read_only=True); ws=wb['Quadro']; rows=[list(r) for r in ws.iter_rows(values_only=True)]
print(json.dumps({'cab':rows[0],'x':[r for r in rows if str(r[1])=='15']},default=str))`, out + 'quadro_indicadores.xlsx'], { encoding: 'utf8' }));
ok(q.cab[3] === 'Coluna do quadro' && q.x[0]?.[3] === 'Concluído', `Excel de indicadores: aba «Quadro» com a coluna de cada prestador (${q.x[0]?.[2]}: ${q.x[0]?.[3]})`);
// Abrir conferência a partir do cartão.
await menu('abrir'); await p.waitForFunction(() => location.hash === '#conferencia', null, { timeout: 5000 }).catch(() => {});
ok(await p.evaluate(() => location.hash) === '#conferencia', '«Abrir conferência» leva à Conferência do prestador');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
