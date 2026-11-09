// Pasta raiz na rede (SOL-F36/37/38) com uma pasta simulada em disco e dois usuários (navegadores separados):
// reconhece as pastas que já existem, cria as da competência, lê PDFs e planilhas e sincroniza as equivalências.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', d = f => raiz + 'dados/' + f;
const R = out + 'raiz_rede/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.rmSync(R, { recursive: true, force: true });
for (const p of ['fluxo mensal', 'Equivalencia tuss (sincronização)', 'Bases de dados', 'backups']) fs.mkdirSync(R + p, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
let relogio = Date.parse('2026-10-30T10:00:00');
const tocar = p => { relogio += 1000; fs.utimesSync(p, relogio / 1000, relogio / 1000); };
async function usuario(nome) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
  p.on('pageerror', e => erros.push(`${nome}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error') erros.push(`${nome}: ${m.text()}`); });
  await p.exposeFunction('__fs', (op, rel, dado) => {
    const c = R + rel.replace(/^\/+/, '');
    if (op === 'stat') return fs.existsSync(c) ? (fs.statSync(c).isDirectory() ? 'dir' : 'file') : null;
    if (op === 'mkdir') { fs.mkdirSync(c, { recursive: true }); return true; }
    if (op === 'list') return fs.readdirSync(c, { withFileTypes: true }).map(e => ({ name: e.name, dir: e.isDirectory() }));
    if (op === 'read') return fs.existsSync(c) ? { b64: fs.readFileSync(c).toString('base64'), lm: fs.statSync(c).mtimeMs } : null;
    if (op === 'write') { fs.writeFileSync(c, dado); tocar(c); return true; }
  });
  await p.addInitScript(n => localStorage.setItem('rm2.operador', JSON.stringify(n)), nome);
  await p.goto(html + '#inicio');
  await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
  return p;
}
// Pasta com a mesma interface do Edge (getDirectoryHandle, getFileHandle, values, getFile, createWritable).
const conectar = p => p.evaluate(() => {
  const NF = () => new DOMException('não existe', 'NotFoundError');
  const arq = (path, name) => ({ kind: 'file', name,
    getFile: async () => { const r = await window.__fs('read', path); if (!r) throw NF(); return new File([Uint8Array.from(atob(r.b64), c => c.charCodeAt(0))], name, { lastModified: r.lm }); },
    createWritable: async () => { let buf = ''; return { write: async t => { buf += t; }, close: async () => window.__fs('write', path, buf) }; } });
  const dir = (path, name) => ({ kind: 'directory', name,
    getDirectoryHandle: async (n, o = {}) => { const q = `${path}/${n}`, st = await window.__fs('stat', q); if (!st) { if (!o.create) throw NF(); await window.__fs('mkdir', q); } return dir(q, n); },
    getFileHandle: async (n, o = {}) => { const q = `${path}/${n}`, st = await window.__fs('stat', q); if (!st && !o.create) throw NF(); return arq(q, n); },
    values: async function* () { for (const e of await window.__fs('list', path)) yield e.dir ? dir(`${path}/${e.name}`, e.name) : arq(`${path}/${e.name}`, e.name); } });
  return window.__RM.t.definirPastaSync(dir('', 'Repasse Médico'));
});
const okDlg = async (p, v = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${v}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(250); };

const ana = await usuario('Ana Teste');
// Equivalência validada pela Ana antes de conectar.
await ana.evaluate(() => { const { S, t } = window.__RM; const e = t.novaRelacao({ codigo: '40901114', titulo: 'USG DE MAMAS', descMV: 'USG MAMAS - OP', escopo: { unidade: '*', modalidade: '*' }, origem: 'teste' }); S.eq.itens.push(e); t.alterarStatusEq(S.eq, [e.id], 'validada', 'Ana Teste', 'teste', '2026-10');
  const e2 = t.novaRelacao({ codigo: '40901386', titulo: 'DOPPLER DE TIREOIDE', descMV: 'DOPPLER COLORIDO', escopo: { unidade: '*', modalidade: '*' }, origem: 'teste' }); S.eq.itens.push(e2); });
ok(/Lembrete:.*pasta raiz/s.test(await ana.textContent('#pag-inicio')), 'Início lembra de conectar a pasta raiz');
await conectar(ana); await ana.waitForTimeout(500);
ok(fs.existsSync(R + 'Equivalencia tuss (sincronização)/equivalencias.json') && !fs.existsSync(R + 'Equivalência TUSS (sincronização)'), 'equivalências gravadas na pasta que já existia (nome com outra grafia reconhecido)');
// Criar as pastas da competência pelo Início.
await ana.goto(html + '#fluxo'); await ana.goto(html + '#inicio'); await ana.waitForSelector('#prCriar'); await ana.waitForTimeout(500);
ok(/pasta\(s\) faltando/.test(await ana.textContent('.pr-card')), 'Início mostra as pastas da competência que faltam');
await ana.click('#prCriar'); await okDlg(ana); await ana.waitForTimeout(800);
ok(/pastas da competência em ordem/.test(await ana.textContent('.pr-card')), 'depois de criar, o Início mostra «pastas da competência em ordem»');
const comp = R + 'Competências/Comp_10-2026/', usg1 = fs.readdirSync(comp + 'Relatórios para conferência/USG').find(n => /^Unidade 1 - /.test(n));
ok(usg1 && fs.existsSync(comp + 'Relatórios para conferência/IMG') && fs.existsSync(comp + 'Relatórios para conferência/Curitiba') && fs.existsSync(comp + 'Correção de prestador') && fs.existsSync(R + 'Bases de dados/Comp_10-2026') && !fs.existsSync(R + 'Fluxo mensal'), `pastas criadas com os nomes que a ferramenta lê (ex.: Relatórios para conferência › USG › ${usg1}); «fluxo mensal» existente mantido`);
await ana.screenshot({ path: out + 'pasta_raiz_inicio.png' });
// PDFs e planilhas do mês, lidos da pasta.
fs.copyFileSync(d('mv_usg_medico15_unidade1.pdf'), comp + `Relatórios para conferência/USG/${usg1}/relatorio_dr15.pdf`); tocar(comp + `Relatórios para conferência/USG/${usg1}/relatorio_dr15.pdf`);
fs.mkdirSync(comp + 'Relatórios para conferência/USG/_antigos', { recursive: true }); fs.copyFileSync(d('mv_usg_medico15_unidade1.pdf'), comp + 'Relatórios para conferência/USG/_antigos/velho.pdf');
fs.copyFileSync(d('apolo_09-2026.xlsx'), R + 'Bases de dados/Comp_10-2026/laudos_apolo.xlsx'); tocar(R + 'Bases de dados/Comp_10-2026/laudos_apolo.xlsx');
await ana.click('#prAtualizar'); await ana.waitForFunction(() => window.__RM.S.relatorios.length === 1 && !!window.__RM.S.apolo, null, { timeout: 120000 }); await ana.waitForTimeout(500);
const lido = await ana.evaluate(() => { const x = window.__RM.S.relatorios[0]; return { un: x.unidadePasta, gr: x.grupoPasta, n: window.__RM.S.relatorios.length }; });
ok(lido.n === 1 && lido.un === '1' && lido.gr === 'usg', '«Atualizar da pasta»: lê o PDF da pasta da unidade (unidade 1, USG) e a planilha de laudos; ignora _antigos');
await ana.goto(html + '#inicio'); await ana.waitForSelector('#lmUn');
await ana.selectOption('#lmUn', '-'); await ana.waitForTimeout(200);
const vazio = /0 de 1 relatório/.test(await ana.textContent('#listaMV'));
await ana.selectOption('#lmUn', '1'); await ana.waitForTimeout(200);
ok(vazio && /1 de 1 relatório/.test(await ana.textContent('#listaMV')) && /1 · USG \(pasta\)/.test(await ana.textContent('#listaMV')), 'lista de relatórios com filtros (unidade, grupo, finalidade, totais) e a coluna «Unidade · grupo» da pasta');
await ana.evaluate(() => { window.__RM.S.relatorios[0].grupoPasta = 'img'; }); await ana.selectOption('#lmGrupo', '*'); await ana.waitForTimeout(200);
ok(/PDF de USG na pasta IMG/.test(await ana.textContent('#listaMV')), 'avisa quando o PDF é de um grupo diferente da pasta onde está (relatório errado na pasta)');
await ana.evaluate(() => { window.__RM.S.relatorios[0].grupoPasta = 'usg'; });
await ana.goto(html + '#conferencia'); await ana.waitForSelector('#cfUn');
ok(await ana.inputValue('#cfUn') === '1' && /Pela pasta da unidade/.test(await ana.textContent('#pag-conferencia')), 'Conferência já vem com a unidade da pasta');
await ana.goto(html + '#inicio'); await ana.waitForSelector('#prAtualizar');
let r = await ana.evaluate(() => window.__RM.t.atualizarDaPasta());
ok(r.novos === 0 && r.mudaram === 0, 'sem mudança na pasta: nada é lido de novo');
tocar(comp + `Relatórios para conferência/USG/${usg1}/relatorio_dr15.pdf`);
r = await ana.evaluate(() => window.__RM.t.atualizarDaPasta());
ok(r.mudaram === 1 && (await ana.evaluate(() => window.__RM.S.relatorios.length)) === 1, 'PDF salvo de novo no MV: relido e substitui o anterior (avisa para rodar a conferência de novo)');
// Segundo usuário: junta as equivalências com a da pasta.
const leo = await usuario('Leo Teste');
await leo.evaluate(() => { const { S, t } = window.__RM; const e = t.novaRelacao({ codigo: '40901386', titulo: 'DOPPLER DE TIREOIDE', descMV: 'DOPPLER COLORIDO', escopo: { unidade: '*', modalidade: '*' }, origem: 'teste' }); S.eq.itens.push(e); t.alterarStatusEq(S.eq, [e.id], 'validada', 'Leo Teste', 'teste', '2026-10');
  S.eq.itens.push(t.novaRelacao({ codigo: '40901114', titulo: 'USG DE MAMAS', descMV: 'USG MAMAS - OP', escopo: { unidade: '*', modalidade: '*' }, origem: 'teste' })); });
const pr = conectar(leo); await leo.waitForSelector('#dlg[open]');
ok(/Juntar a sua base/.test(await leo.textContent('#dlgTitulo')) && /Resultado/.test(await leo.textContent('#dlgCorpo')), 'primeira vez: mostra a sua base, a da pasta e o resultado antes de juntar');
await leo.click('#dlgBotoes button[value="ok"]'); await pr; await leo.waitForTimeout(500);
const st = await leo.evaluate(() => Object.fromEntries(window.__RM.S.eq.itens.map(e => [e.titulo, e.status])));
ok(st['USG DE MAMAS'] === 'validada' && st['DOPPLER DE TIREOIDE'] === 'validada', 'junção: validada por um e pendente para o outro fica validada (as duas)');
await ana.evaluate(() => window.__RM.t.sincronizarEq());
ok((await ana.evaluate(() => window.__RM.S.eq.itens.find(e => e.titulo === 'DOPPLER DE TIREOIDE')?.status)) === 'validada', 'a validação do Leo chega à Ana pela pasta');
// Decisão diferente na mesma relação: pede escolha.
await ana.evaluate(() => { const { S, t } = window.__RM, e = S.eq.itens.find(x => x.titulo === 'USG DE MAMAS'); t.alterarStatusEq(S.eq, [e.id], 'desativada', 'Ana Teste', 'código errado', '2026-10'); return t.sincronizarEq(); });
await leo.evaluate(() => { const { S, t } = window.__RM, e = S.eq.itens.find(x => x.titulo === 'USG DE MAMAS'); t.alterarStatusEq(S.eq, [e.id], 'pendente', 'Leo Teste', 'rever', '2026-10'); });
const pr2 = leo.evaluate(() => window.__RM.t.sincronizarEq({ interativo: true })); await leo.waitForSelector('#dlg[open]');
ok(/decisão\(ões\) diferentes/.test(await leo.textContent('#dlgTitulo')) && /USG DE MAMAS/.test(await leo.textContent('#dlgCorpo')), 'mesma relação mudada pelos dois: pede escolha');
await leo.check('#dlgCorpo input[value="remoto"]'); await leo.click('#dlgBotoes button[value="ok"]'); await pr2;
ok((await leo.evaluate(() => window.__RM.S.eq.itens.find(e => e.titulo === 'USG DE MAMAS').status)) === 'desativada', 'escolhida a da pasta: fica a decisão da Ana, com o histórico dos dois');
ok(!/PACIENTE|CPF/i.test(fs.readFileSync(R + 'Equivalencia tuss (sincronização)/equivalencias.json', 'utf8')), 'arquivo de equivalências sem dado de paciente');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + [...new Set(erros)].slice(0, 3).join(' | ') : ''));
await b.close();
