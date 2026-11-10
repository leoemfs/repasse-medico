// v3.0 — Consolidação: armazenamento durável, configuração compartilhada entre dois usuários pela pasta da rede,
// proteção contra backup antigo, backup verificável, Títulos do Apolo, modelos de exportação, versões e Configurações.
// Dados fictícios; pasta simulada em disco (test/saida/pasta_v3) com a mesma interface do Edge.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, out = raiz + 'test/saida/', pasta = out + 'pasta_v3/';
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
fs.rmSync(pasta, { recursive: true, force: true }); fs.mkdirSync(pasta, { recursive: true });
const b = await chromium.launch(), erros = [];
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
let relogio = Date.parse('2026-11-10T10:00:00');
const seguro = p => { const r = path.resolve(pasta, p); if (!r.startsWith(path.resolve(pasta))) throw new Error('fora da pasta'); return r; };
async function usuario(nome, { semEspacoNoLocalStorage = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-11-10T10:00:00') });
  p.on('pageerror', e => erros.push(`${nome}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error') erros.push(`${nome}: ${m.text()}`); });
  await p.exposeFunction('__fs', (op, rel, arg) => {
    const f = seguro(rel);
    if (op === 'lista') return fs.existsSync(f) ? fs.readdirSync(f, { withFileTypes: true }).map(d => ({ nome: d.name, dir: d.isDirectory() })) : null;
    if (op === 'existe') return fs.existsSync(f) ? (fs.statSync(f).isDirectory() ? 'dir' : 'arq') : '';
    if (op === 'mkdir') { fs.mkdirSync(f, { recursive: true }); return true; }
    if (op === 'ler') return fs.existsSync(f) ? { txt: fs.readFileSync(f, 'utf8'), lm: fs.statSync(f).mtimeMs, tam: fs.statSync(f).size } : null;
    if (op === 'gravar') { fs.writeFileSync(f, arg.b64 ? Buffer.from(arg.b64, 'base64') : arg.txt); relogio += 1000; fs.utimesSync(f, relogio / 1000, relogio / 1000); return true; }
    if (op === 'apagar') { fs.rmSync(f, { force: true }); return true; }
  });
  await p.addInitScript(([n, semEspaco]) => {
    localStorage.setItem('rm2.operador', JSON.stringify(n));
    if (semEspaco) { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'rm2.equivalencias' && v.length > 2000) throw new DOMException('cheio', 'QuotaExceededError'); return orig.call(this, k, v); }; }
    // Pasta simulada: diretório e arquivo com a interface do File System Access do Edge.
    const arq = (rel, nome) => ({ kind: 'file', name: nome,
      getFile: async () => { const r = await window.__fs('ler', rel); if (!r) throw new DOMException('não existe', 'NotFoundError'); return { name: nome, lastModified: r.lm, size: r.tam, text: async () => r.txt }; },
      createWritable: async () => { let partes = []; return { write: async d => { partes.push(d); }, close: async () => { const bl = new Blob(partes); const u8 = new Uint8Array(await bl.arrayBuffer()); let s = ''; for (const x of u8) s += String.fromCharCode(x); await window.__fs('gravar', rel, { b64: btoa(s) }); } }; } });
    const dir = (rel, nome) => ({ kind: 'directory', name: nome, queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      async *values() { for (const e of (await window.__fs('lista', rel)) || []) yield e.dir ? dir(`${rel}/${e.nome}`, e.nome) : arq(`${rel}/${e.nome}`, e.nome); },
      getDirectoryHandle: async (n, o = {}) => { const r = `${rel}/${n}`, t = await window.__fs('existe', r); if (t === 'dir') return dir(r, n); if (!o.create) throw new DOMException('não existe', 'NotFoundError'); await window.__fs('mkdir', r); return dir(r, n); },
      getFileHandle: async (n, o = {}) => { const r = `${rel}/${n}`, t = await window.__fs('existe', r); if (!t && !o.create) throw new DOMException('não existe', 'NotFoundError'); return arq(r, n); },
      removeEntry: async n => window.__fs('apagar', `${rel}/${n}`) });
    window.__pastaRaiz = () => dir('.', 'Repasse Medico');
  }, [nome, semEspacoNoLocalStorage]);
  await p.goto(html + '#inicio');
  await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
  return p;
}
const conectar = p => p.evaluate(() => window.__RM.t.definirPastaSync(window.__pastaRaiz()));
const okDlg = async (p, botao = 'ok') => { await p.waitForSelector('#dlg[open]'); await p.click(`#dlgBotoes button[value="${botao}"]`); await p.waitForFunction(() => !document.getElementById('dlg').open); await p.waitForTimeout(150); };

// 1) Versões: pré-versões, versão final e a linha 2.1.0.
const ana = await usuario('Ana Teste');
const vers = await ana.evaluate(() => { const v = window.__RM.t.versaoMaior; return [v('3.0.0-alpha.2', '3.0.0-alpha.1'), v('3.0.0-alpha.1', '2.1.0-alpha.19'), v('3.0.0', '3.0.0-alpha.9'), v('3.0.0-alpha.1', '3.0.0-alpha.1'), v('2.1.0-alpha.19', '3.0.0-alpha.1')]; });
ok(JSON.stringify(vers) === '[true,true,true,false,false]', `comparação de versões para o aviso de atualização (${vers})`);

// 2) Armazenamento: localStorage cheio para a base de equivalências → vai para o IndexedDB e volta depois de recarregar.
const cheio = await usuario('Cheio Teste', { semEspacoNoLocalStorage: true });
// Grava a base pelo caminho real da tela: Equivalências → «Substituir base (.json)».
const baseGrande = { schema: 'repasse-medico/equivalencias', versaoSchema: 1, revisao: 7, atualizadoEm: '2026-11-10T10:00:00Z', itens: Array.from({ length: 40 }, (_, i) => ({ id: 'eqG' + i, codigo: String(40901100 + i), descMV: 'PROC ' + i, titulo: 'TITULO GRANDE ' + i + ' ' + 'X'.repeat(40), campo: 'TITLE', tipo: 'titulo', status: 'validada', direcao: 'mv->apolo', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'Cheio Teste' })), compostas: [], catalogoTitulos: [], catalogoTUSS: [] };
fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(out + 'v3_base_grande.json', JSON.stringify(baseGrande));
await cheio.evaluate(() => window.__RM.irPara('equivalencias')); await cheio.waitForSelector('#eqArqJS', { state: 'attached' });
await cheio.setInputFiles('#eqArqJS', out + 'v3_base_grande.json'); await okDlg(cheio);
const marca = await cheio.evaluate(() => localStorage.getItem('rm2.equivalencias'));
await cheio.reload(); await cheio.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
const depois = await cheio.evaluate(() => window.__RM.S.eq.itens.length);
ok(marca === '{"__kv":1}' && depois === 40, `localStorage recusou a base (marcador «${marca}»); depois de recarregar, as 40 relações voltam do IndexedDB (${depois})`);
await cheio.context().close();

// 3) Configuração compartilhada: Ana conecta a pasta raiz; Leo conecta depois; aliases e regras chegam ao outro.
await ana.evaluate(() => { const { S } = window.__RM; S.cfg.prestadores.push({ cod: '15', nomeMV: 'MEDICO QUINZE', aliases: [], naoRealizaRepasse: false, origem: 'teste', em: new Date().toISOString(), regras: {} }); window.__RM.t.salvarCfg(); });
await ana.evaluate(() => window.__RM.irPara('bases'));
await conectar(ana);
const arqCfg = pasta + 'Configuração compartilhada/configuracao.json';
ok(fs.existsSync(arqCfg) && JSON.parse(fs.readFileSync(arqCfg, 'utf8')).atualizadoPor === 'Ana Teste', 'ao conectar a pasta raiz, a configuração vai para «Configuração compartilhada/configuracao.json», com quem gravou');
const semPaciente = !/operador|"tema"|acento/.test(fs.readFileSync(arqCfg, 'utf8'));
ok(semPaciente, 'preferências individuais (operador, tema, cor) não vão para a pasta');
const leo = await usuario('Leo Teste');
await leo.evaluate(() => { const { S } = window.__RM; S.cfg.prestadores.push({ cod: '7', nomeMV: 'MEDICO SETE', aliases: [], naoRealizaRepasse: false, origem: 'teste', em: new Date().toISOString(), regras: {} }); window.__RM.t.salvarCfg(); });
await conectar(leo);
const leoP = await leo.evaluate(() => window.__RM.S.cfg.prestadores.map(p => p.cod).sort().join(','));
ok(leoP === '15,7', `primeira sincronização junta os prestadores dos dois sem conflito (${leoP})`);
await ana.evaluate(() => window.__RM.t.sincronizarCfg());
ok((await ana.evaluate(() => window.__RM.S.cfg.prestadores.map(p => p.cod).sort().join(','))) === '15,7', 'Ana recebe o prestador cadastrado pelo Leo');
// Mudanças em prestadores diferentes: juntam sozinhas.
const sincC = p => p.evaluate(() => window.__RM.t.sincronizarCfg());
await ana.evaluate(() => { const { S } = window.__RM; S.cfg.prestadores.find(p => p.cod === '15').aliases.push({ nome: 'Medico Quinze da Silva', status: 'validado', responsavel: 'Ana Teste' }); window.__RM.t.salvarCfg(); });
await sincC(ana);
await leo.evaluate(() => { const { S } = window.__RM; S.cfg.prestadores.find(p => p.cod === '7').naoRealizaRepasse = true; window.__RM.t.salvarCfg(); });
await sincC(leo); await sincC(ana);
const a15 = await leo.evaluate(() => window.__RM.S.cfg.prestadores.find(p => p.cod === '15').aliases.length), a7 = await ana.evaluate(() => window.__RM.S.cfg.prestadores.find(p => p.cod === '7').naoRealizaRepasse);
ok(a15 === 1 && a7 === true, 'alias validado pela Ana e «não realiza repasse» do Leo chegam aos dois (itens diferentes não conflitam)');
// O mesmo parâmetro mudado pelos dois: conflito, sem troca silenciosa.
await ana.evaluate(() => { window.__RM.S.cfg.parametros.tolConferencia = 3; window.__RM.t.salvarCfg(); }); await sincC(ana);
await leo.evaluate(() => { window.__RM.S.cfg.parametros.tolConferencia = 5; window.__RM.t.salvarCfg(); }); await sincC(leo);
const st = await leo.evaluate(() => window.__RM.t.syncCfgEstado());
const tolPasta = JSON.parse(fs.readFileSync(arqCfg, 'utf8')).cfg.parametros.tolConferencia;
ok(st.status === 'conflito' && tolPasta === 3, `o mesmo parâmetro mudado pelos dois vira conflito para escolher; a pasta continua com a versão da Ana (${st.status}, tolerância ${tolPasta})`);
// Leo resolve pela tela: escolhe a versão da Ana.
const resolver = leo.evaluate(() => window.__RM.t.sincronizarCfg({ interativo: true }));
await leo.waitForSelector('#dlg[open] .sy-conf'); await leo.check('#dlgCorpo input[value="remoto"]'); await okDlg(leo); await resolver;
ok((await leo.evaluate(() => [window.__RM.S.cfg.parametros.tolConferencia, window.__RM.t.syncCfgEstado().status].join()) ) === '3,ok', 'no diálogo de conflito, o Leo escolhe a versão da Ana e fica sincronizado');

// 4) Equivalências: backup antigo restaurado pelo Leo não passa por cima da validação mais nova da Ana.
await ana.evaluate(() => { const { S, t } = window.__RM; S.eq.itens.push(t.novaRelacao({ codigo: '40901114', titulo: 'USG MAMAS', descMV: 'US MAMAS' })); window.__RM.t.salvarEq(); });
await ana.evaluate(() => window.__RM.t.sincronizarEq());
await leo.evaluate(() => window.__RM.t.sincronizarEq());
const bkAntigo = await leo.evaluate(() => { const { t } = window.__RM; return t.montarBackup(t.partesAtuaisBackup({}), { operador: 'Leo Teste' }); });
ok(bkAntigo.equivalencias.itens.some(e => e.codigo === '40901114' && e.status === 'pendente'), 'backup do Leo com a relação ainda pendente');
await ana.evaluate(() => { const { S, t } = window.__RM; t.alterarStatusEq(S.eq, [S.eq.itens.find(e => e.codigo === '40901114').id], 'validada', 'Ana Teste', 'conferido'); window.__RM.t.salvarEq(); });
await ana.evaluate(() => window.__RM.t.sincronizarEq());
await leo.evaluate(() => window.__RM.t.sincronizarEq());
fs.writeFileSync(out + 'v3_backup_antigo.json', JSON.stringify(bkAntigo));
await leo.evaluate(() => window.__RM.irPara('configuracoes'));
await leo.locator('[data-cfsub="backup"]:visible').click();
await leo.setInputFiles('#bkArq', out + 'v3_backup_antigo.json');
await leo.waitForSelector('#dlg[open]');
const prev = await leo.textContent('#dlgCorpo');
ok(/Equivalências TUSS/.test(prev) && /Configuração/.test(prev), 'prévia do backup lista as partes antes de restaurar');
await leo.uncheck('#dlgCorpo [name="p_configuracao"]');
await okDlg(leo);
await leo.waitForTimeout(500); if (await leo.isVisible('#dlg[open]')) await okDlg(leo, '');   // «Agora não» no juntar
await leo.evaluate(() => window.__RM.t.sincronizarEq());
const eqPasta = JSON.parse(fs.readFileSync(pasta + 'Equivalência TUSS (sincronização)/equivalencias.json', 'utf8')).eq.itens.find(e => e.codigo === '40901114');
const leoSt = await leo.evaluate(() => window.__RM.t.syncEqEstado().status);
ok(eqPasta.status === 'validada' && leoSt === 'juntar', `o backup antigo restaurado não sobrescreve a pasta: a relação continua validada lá e o Leo precisa escolher ao juntar (${eqPasta.status}, ${leoSt})`);
const bks = fs.readdirSync(pasta + 'backups');
ok(bks.some(n => /^backup_repasse_\d{8}-\d{6}_LEO_TESTE\.json$/.test(n)), `antes de restaurar, o estado atual vira backup na pasta (${bks.join(', ')})`);

// 5) Integridade do backup: arquivo alterado ou incompleto é recusado.
const integ = await ana.evaluate(() => { const { t } = window.__RM; const bk = t.montarBackup(t.partesAtuaisBackup({}), {}); const v1 = t.validarBackup(bk, {}); bk.equivalencias.itens.push({ codigo: '1' }); const v2 = t.validarBackup(bk, {}); delete bk.fluxo; const v3 = t.validarBackup(bk, {}); return [v1.partes.every(p => p.ok), v2.partes.find(p => p.k === 'equivalencias').ok, v3.partes.find(p => p.k === 'fluxo').ok]; });
ok(JSON.stringify(integ) === '[true,false,false]', `backup íntegro passa; parte alterada ou ausente é recusada (${integ})`);
const nomeBk = await ana.evaluate(async () => { const { t } = window.__RM; return t.gravarBackupPasta(t.montarBackup(t.partesAtuaisBackup({}), { operador: 'Ana Teste' }), { auto: true, silencioso: false }); });
if (!nomeBk) console.log('aviso:', await ana.textContent('#aviso'));
ok(/_auto\.json$/.test(nomeBk) && fs.existsSync(pasta + 'backups/' + nomeBk), `backup automático gravado e conferido na pasta (${nomeBk})`);

// 6) Títulos do Apolo: títulos distintos, sugestão e confirmação na mesma tela.
await ana.evaluate(() => {
  const { S, t } = window.__RM, d = n => new Date(Date.UTC(2026, 9, n));
  const L = (i, titulo, mod) => ({ i, linhaPlanilha: i + 2, idLaudo: String(i), unidade: 'GrupoSRA HPA', paciente: 'PACIENTE ' + i, pn: 'PACIENTE ' + i, titulo, tn: titulo, data: d(1 + i % 20), dia: Math.round(d(1 + i % 20) / 864e5), convenio: 'UNIMED', modalidade: mod, medico: 'MEDICO QUINZE', mn: 'MEDICO QUINZE', descricao: '' });
  const laudos = []; let i = 0;
  for (let k = 0; k < 12; k++) laudos.push(L(i++, 'ULTRASSONOGRAFIA DE TIREOIDE', 'US'));
  for (let k = 0; k < 5; k++) laudos.push(L(i++, 'ULTRASSONOGRAFIA DAS MAMAS', 'US'));
  for (let k = 0; k < 3; k++) laudos.push(L(i++, 'USG MAMAS', 'US'));
  S.apolo = { nome: 'apolo_ficticio.xlsx', laudos };
  S.eq.catalogoTUSS = [{ codigo: '40901173', desc: 'US - TIREOIDE', grupo: 'ULTRASSONOGRAFIA' }, { codigo: '40901114', desc: 'US - MAMAS', grupo: 'ULTRASSONOGRAFIA' }, { codigo: '41001109', desc: 'TC - TORAX', grupo: 'TOMOGRAFIA' }];
});
await ana.evaluate(() => window.__RM.irPara('equivalencias'));
await ana.click('[data-esub="titulos"]'); await ana.waitForSelector('#ttPainel');
const linhas = await ana.$$eval('[data-tt]', trs => trs.map(t => t.textContent.replace(/\s+/g, ' ').trim()));
ok(linhas.length === 2 && /TIREOIDE.*12/.test(linhas[0]) && /DAS MAMAS.*5/.test(linhas[1]), `lista só os títulos distintos a resolver, os mais frequentes primeiro, com a contagem (USG MAMAS já validado fica fora) (${linhas.join(' | ')})`);
const sug = await ana.$$eval('#ttPainel [data-ttcod]', cs => cs.map(c => c.dataset.ttcod));
ok(sug[0] === '40901173' && !sug.includes('41001109'), `sugestão por semelhança põe US - TIREOIDE primeiro e não sugere tomografia (${sug})`);
await ana.check('#ttPainel [data-ttcod="40901173"]'); await ana.waitForSelector('#ttConfirmar:not([disabled])');
await ana.click('#ttConfirmar'); await ana.waitForTimeout(300);
const rel = await ana.evaluate(() => window.__RM.S.eq.itens.find(e => e.codigo === '40901173'));
ok(rel && rel.status === 'validada' && rel.responsavel === 'Ana Teste' && rel.historico.length === 1, 'confirmar cria a relação validada, com responsável e histórico');
await ana.selectOption('#ttSit', 'todos'); await ana.waitForTimeout(150);
const todos = await ana.$$eval('[data-tt]', trs => trs.map(t => t.textContent.replace(/\s+/g, ' ').trim()));
ok(todos.length === 3 && todos.some(x => /USG MAMAS.*3.*Validada/.test(x)) && todos.some(x => /TIREOIDE.*Validada/.test(x)), `«USG MAMAS» (validado pelo Leo/Ana antes) e a tireoide aparecem como validados (${todos.join(' | ')})`);
// Um ou outro em dois códigos.
await ana.click('[data-tt="ULTRASSONOGRAFIA DAS MAMAS"]'); await ana.waitForSelector('#ttPainel [data-ttcod]');
await ana.check('#ttPainel [data-ttcod="40901114"]'); await ana.waitForTimeout(100);
await ana.fill('#ttPainel [name="ttProc"]', '41001109'); await ana.waitForTimeout(150); await ana.press('#ttPainel [name="ttProc"]', 'Enter'); await ana.waitForTimeout(200);
ok(await ana.isVisible('#ttOu') && await ana.isVisible('#ttJuntos'), 'com dois procedimentos escolhidos, oferece «Juntos» e «Um ou outro»');
await ana.click('#ttOu'); await okDlg(ana);
const cmp = await ana.evaluate(() => window.__RM.S.eq.compostas.find(c => c.titulos.includes('ULTRASSONOGRAFIA DAS MAMAS')));
ok(cmp && cmp.status === 'validada' && cmp.itens[0].codigos.join() === '40901114,41001109', 'regra «um ou outro» validada com os dois códigos');
await ana.screenshot({ path: out + 'v3_titulos_apolo.png' });

// 7) Modelos de exportação: «Padrão» = layout atual; modelo próprio muda só a aba principal.
const exp = await ana.evaluate(() => { const { t } = window.__RM; return { padrao: t.colunasDoModelo(null).map(c => c.rotulo), custom: t.colunasDoModelo(['paciente', 'conta', 'situacao', 'xx']).map(c => c.rotulo) }; });
ok(exp.padrao.join('|') === 'Situação|Decisão na competência|Paciente|Data|Cód. TUSS MV|Procedimento no MV|Laudo (TITLE)|O que falta / por quê|Vl Repasse|Convênio MV|Unidade MV|Grupo de procedimento MV|Médico MV|Paciente MV|Paciente Apolo|Data Apolo|Descrição do estudo (STUDY)|Convênio Apolo|Unidade Apolo|Modalidade Apolo|Médico Apolo|Ressalvas|Observações e análise', 'modelo «Padrão» tem exatamente as 23 colunas e a ordem do layout operacional');
ok(exp.custom.join('|') === 'Paciente|Conta|Situação', `modelo próprio: escolhe e ordena colunas, ignora id desconhecido (${exp.custom})`);
await ana.evaluate(() => window.__RM.irPara('configuracoes'));
await ana.locator('[data-cfsub=\"exportacao\"]:visible').click(); await ana.waitForSelector('#exSalvarComo');
await ana.uncheck('[data-excol="decisao"]'); await ana.waitForTimeout(100); await ana.click('[data-exup="paciente"]'); await ana.waitForTimeout(100);
await ana.click('#exSalvarComo'); await ana.waitForSelector('#dlg[open]'); await ana.fill('#dlgCorpo [name="nome"]', 'Sem decisão'); await okDlg(ana);
const mx = await ana.evaluate(() => ({ m: window.__RM.S.cfg.modelosExportacao.at(-1), uso: JSON.parse(localStorage.getItem('rm2.exportacaoModelo') || '{}') }));
ok(mx.m && mx.m.nome === 'Sem decisão' && mx.m.colunas[0] === 'paciente' && !mx.m.colunas.includes('decisao') && mx.uso.conferencia === mx.m.id, 'modelo salvo pela tela (sem «Decisão», «Paciente» primeiro) e escolhido para as minhas exportações');
await ana.waitForTimeout(1200);
ok(JSON.parse(fs.readFileSync(arqCfg, 'utf8')).cfg.modelosExportacao.some(m => m.nome === 'Sem decisão'), 'o modelo vai para a configuração compartilhada (vale para os dois)');

// 8) Configurações: categorias, cor de destaque e Bases dentro das Configurações.
for (const k of ['geral', 'conferencia', 'pastas', 'backup', 'sobre']) { await ana.locator(`[data-cfsub=\"${k}\"]:visible`).click(); await ana.waitForTimeout(120); }
await ana.locator('[data-cfsub=\"geral\"]:visible').click(); await ana.check('[name="acento"][value="petroleo"]', { force: true }); await ana.waitForTimeout(150);
ok((await ana.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())) === '#0e6670', 'cor de destaque «Petróleo» aplicada (--accent)');
await ana.locator('[data-cfsub=\"bases\"]:visible').click(); await ana.waitForFunction(() => location.hash === '#bases');
await ana.waitForSelector('#pag-bases .cfg-abas', { timeout: 5000 }).catch(() => {});
const bInfo = await ana.evaluate(() => [location.hash, document.getElementById('pag-bases').hidden, !!document.querySelector('#pag-bases .cfg-abas'), !!document.getElementById('cfgSync'), document.getElementById('cfgSync')?.closest('section')?.id]);
ok(bInfo.join() === '#bases,false,true,true,pag-bases', `Bases e regras abre como categoria das Configurações, com a barra de sincronização da configuração (${bInfo})`);
await ana.screenshot({ path: out + 'v3_configuracoes_bases.png' });
await ana.locator('[data-cfsub=\"pastas\"]:visible').click(); await ana.waitForSelector('[data-pasta="backups"]');
await ana.fill('[data-pasta="backups"]', 'Backups do repasse'); await ana.click('#psSalvarNomes'); await ana.waitForTimeout(200);
const nomePasta = await ana.evaluate(async () => { const { t } = window.__RM; return t.gravarBackupPasta(t.montarBackup(t.partesAtuaisBackup({}), {}), { silencioso: true }); });
if (!nomePasta) console.log('dirs', fs.readdirSync(pasta), await ana.evaluate(() => [window.__RM.S.cfg.pastas, document.getElementById('aviso').textContent]));
ok(nomePasta && fs.existsSync(pasta + 'Backups do repasse/' + nomePasta), 'nome da pasta de backups configurado na tela vale para a próxima gravação');
await ana.screenshot({ path: out + 'v3_configuracoes_pastas.png' });

ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 5).join(' | ') : ''));
await b.close();
