// v3.0.0-alpha.21 — Cadastro de USG pela planilha de controle (pedido de 23/11/2026): faixa «Repasse 42%» nova, migração
// das faixas sem mexer nas editadas, residente que muda de faixa volta a médico, e o % esperado por unidade de cada faixa.
// Importa pela tela (Bases → Prestadores → «Importar regras da planilha de controle»). Nomes e códigos fictícios.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Cadastro')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });

// Migração: configuração antiga sem a faixa 42% e com a faixa 50% renomeada pelo usuário.
const mig = await p.evaluate(() => {
  const { t } = window.__RM, c = { unidades: [], prestadores: [], faixasUSG: [{ id: 'geral', nome: 'Geral', base: 'unidade', acrescimo: 0 }, { id: 'p40', nome: 'Repasse 40%', base: 'fixo', pct: 0.4 }, { id: 'p50', nome: 'Meu nome 50%', base: 'fixo', pct: 0.5 }] };
  const mudou = t.migrarRegras(c);
  return { mudou, ids: c.faixasUSG.map(f => f.id).join(','), p50: c.faixasUSG.find(f => f.id === 'p50').nome, p42: c.faixasUSG.find(f => f.id === 'p42')?.pct };
});
ok(mig.mudou && mig.ids === 'geral,mais2,residente,p40,p42,p49,p50,p55,p70', `faixas que faltam entram na posição do padrão (${mig.ids})`);
ok(mig.p42 === 0.42 && mig.p50 === 'Meu nome 50%', `faixa 42% fixa e a faixa editada pelo usuário continua como estava (${mig.p42} · ${mig.p50})`);

// Planilha no formato da planilha de controle, gerada aqui.
const b64 = await p.evaluate(async () => {
  const { t, S } = window.__RM;
  S.cfg.prestadores = S.cfg.prestadores.filter(x => !['901', '902', '903', '904', '905', '906'].includes(String(x.cod)));
  const vazias = { tipo: 'medico', faixaUSG: '', pctUSGUnidade: {}, board: 0, participaIMG: false, v3: false, v3regra: null, classeFixa: '', tabelaIMG: 'padrao', excecoesIMG: [], obs: '' };
  S.cfg.prestadores.push({ cod: '901', nomeMV: 'MEDICO GERAL ANTIGO', aliases: [], regras: { ...vazias, faixaUSG: 'residente', tipo: 'residente', board: 1234.5 } });
  S.cfg.prestadores.push({ cod: '903', nomeMV: 'RESIDENTE NOVO', aliases: [], regras: { ...vazias, faixaUSG: 'geral' } });
  const UN = ['1- ULTRAMED APUCARANA', '2- ULTRAMED JACAREZINHO', '4- ULTRAMED CAMBÉ', '7 - ULTRAMED ARAPONGAS', '10- ALPHASONIC APUCARANA', '17- ALPHASONIC LONDRINA'];
  const bloco = (titulo, meds) => [[titulo], ['EMPRESAS', '', ...UN, 'BOARD'], ...meds, []];
  const linhas = [
    ...bloco('REPASSE MÉDICOS GERAL', [[901, 'MEDICO GERAL ANTIGO'], [904, 'MEDICO GERAL NOVO']]),
    ...bloco('REPASSE COM ACRÉSCIMO DE 2% (DIRETRIZES ESPECÍFICAS)', [[902, 'MEDICO MAIS DOIS', '', '', '', '', '', '', 800]]),
    ...bloco('REPASSE RESIDENTES 35%', [[903, 'RESIDENTE NOVO']]),
    ...bloco('REPASSE 42% (INDEPENDENTE DA UNIDADE)', [[905, 'MEDICO QUARENTA E DOIS']]),
    ...bloco('REPASSE 70% (SÓ NA 17 - LONDRINA PALHANO)', [[906, 'MEDICO SETENTA']])
  ];
  const bytes = await t.criarXlsx([{ nome: 'REPASSE USG 11-2026', linhas }]).generateAsync({ type: 'uint8array' });
  let s = ''; for (const x of bytes) s += String.fromCharCode(x); return btoa(s);
});
await p.evaluate(() => window.__RM.irPara('bases'));
await p.waitForSelector('[data-bsub="prestadores"]'); await p.click('[data-bsub="prestadores"]');
await p.setInputFiles('#prCtrlArq', { name: 'cadastro_usg.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(b64, 'base64') });
await p.waitForSelector('#dlg[open]');
const dlg = await p.textContent('#dlgCorpo');
ok(/6 prestadores \(4 novos no cadastro\)/.test(dlg) && /42%: 1/.test(dlg), `a importação mostra os prestadores e a faixa 42% antes de gravar (${dlg.replace(/\s+/g, ' ').slice(0, 160)}…)`);
await p.click('#dlgBotoes button[value="ok"]'); await p.waitForTimeout(400);
const r = await p.evaluate(() => {
  const { t, S } = window.__RM, pr = c => S.cfg.prestadores.find(x => String(x.cod) === c);
  const pcts = c => ['1', '2', '4', '7', '10', '17'].map(u => Math.round(t.pctUSGEsperado(S.cfg, pr(c), u) * 1000) / 10).join('/');
  return Object.fromEntries(['901', '902', '903', '904', '905', '906'].map(c => [c, `${pr(c).regras.faixaUSG}|${pr(c).regras.tipo}|${pr(c).regras.board}|${pcts(c)}`]));
});
ok(r['901'] === 'geral|medico|1234.5|44/49/40/40/44/42', `residente que passou para a faixa geral volta a médico e mantém o BOARD já cadastrado (${r['901']})`);
ok(r['904'] === 'geral|medico|0|44/49/40/40/44/42', `faixa geral: 44% · 49% · 40% · 40% · 44% · 42% nas unidades 1, 2, 4, 7, 10 e 17 (${r['904']})`);
ok(r['902'] === 'mais2|medico|800|46/51/42/42/46/44', `acréscimo de 2%: 46% · 51% · 42% · 42% · 46% · 44%, com o BOARD da coluna (${r['902']})`);
ok(r['903'] === 'residente|residente|0|35/35/35/35/35/35', `residentes: 35% em todas as unidades (${r['903']})`);
ok(r['905'] === 'p42|medico|0|42/42/42/42/42/42', `«Repasse 42%» independente da unidade (${r['905']})`);
ok(r['906'] === 'p70|medico|0|70/70/70/70/70/70', `«Repasse 70%» com observação no título continua lido como 70% (${r['906']})`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
