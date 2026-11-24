/* ============================================================
 * Interface — base: estado da sessão, armazenamento local, navegação e componentes
 * ============================================================ */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const libBytes = id => { const s = atob($(id).textContent.trim()); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const libUrl = id => URL.createObjectURL(new Blob([libBytes(id)], { type: 'text/javascript' }));
let pdfjs = null;
async function carregarBibliotecas() {
  const s = document.createElement('script');
  s.textContent = new TextDecoder().decode(libBytes('lib-jszip'));
  document.head.appendChild(s);
  pdfjs = await import(libUrl('lib-pdf'));
  pdfjs.GlobalWorkerOptions.workerSrc = libUrl('lib-worker');
}

/* ---------- Estado da sessão (arquivos ficam só na memória) ---------- */
const S = {
  cfg: null, eq: null, operador: '',
  relatorios: [],          // [{id, nome, tamanho, hash, rel}]
  apolo: null, pbi: null,
  conf: null, corr: null,  // {res, ctx, rodada, comparacao}
  rodadas: [],
  fluxo: null,            // {schema, versaoSchema, modelo, competencias:{chave: competência}}
  comp: '',               // competência escolhida no topo (AAAA-MM), vale para todas as abas
  compReg: null,          // {schema, versaoSchema, itens:{chave:{status, historico, alteracoes}}}
  nc: null,               // {schema, versaoSchema, itens:[NC]} — contém dados de pacientes (retenção)
  ncCand: [],             // candidatos das análises desta sessão: [{chave, rotulo, itens}]
  ncDispensados: new Set()
};

/* ---------- Armazenamento local ---------- */
const CHAVES = { cfg: 'rm2.configuracao', eq: 'rm2.equivalencias', eqAnterior: 'rm2.equivalencias.anterior', cfgAnterior: 'rm2.configuracao.anterior', operador: 'rm2.operador', tema: 'rm2.tema', menu: 'rm2.menu', fluxo: 'rm2.fluxo', fluxoAnterior: 'rm2.fluxo.anterior', nc: 'rm2.nc', ncAnterior: 'rm2.nc.anterior', comp: 'rm2.competencia', compReg: 'rm2.competencias',
  controleUn: 'rm2.controleUnidades', fluxoSyncBase: 'rm2.fluxoSyncBase', eqSyncBase: 'rm2.eqSyncBase', cfgSyncBase: 'rm2.cfgSyncBase', cfgAnteriorSync: 'rm2.configuracao.anteriorSync', acento: 'rm2.acento', bkPasta: 'rm2.backupPasta', exportModelo: 'rm2.exportacaoModelo', bkAntes: 'rm2.backupAntesDeRestaurar', pdfsIgnorados: 'rm2.pdfsIgnorados', usoEq: 'rm2.usoEquivalencias' };
// Preferências de cada pessoa (ficam neste navegador e não vão para a pasta compartilhada).
const CHAVES_INDIVIDUAIS = ['operador', 'tema', 'acento', 'menu', 'comp', 'exportModelo', 'bkPasta'];
// Modelo de exportação escolhido por esta pessoa (Configurações → Exportação).
const idModeloExportacao = () => (lerLocal(CHAVES.exportModelo) || {}).conferencia || 'padrao';
const colunasExportacaoAtuais = () => modeloExportacao(S.cfg, idModeloExportacao()).colunas;
/* v3.0 — o localStorage tem cerca de 5 MB por endereço e recusa a gravação quando enche (base de equivalências,
 * fluxo, NCs e as cópias «anterior» e de sincronização somam rápido). Toda gravação vai também para o IndexedDB
 * («repasse-medico-kv»); se o localStorage recusar, o valor antigo sai dele e fica só um marcador, e a leitura
 * passa a vir do IndexedDB. Os valores do IndexedDB são carregados na memória antes da primeira leitura. */
const KV = { db: null, cache: new Map(), erros: 0, ultimoErro: '', persistente: null, estimativa: null };
const MARCA_KV = '{"__kv":1}';
function abrirKV() {
  return new Promise(res => {
    try {
      const rq = indexedDB.open('repasse-medico-kv', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
      rq.onerror = () => res(false);
      rq.onsuccess = () => {
        KV.db = rq.result;
        try {
          const st = KV.db.transaction('kv').objectStore('kv'), cur = st.openCursor();
          cur.onsuccess = () => { const c = cur.result; if (c) { KV.cache.set(c.key, c.value); c.continue(); } else res(true); };
          cur.onerror = () => res(true);
        } catch (e) { res(true); }
      };
    } catch (e) { res(false); }
  }).then(ok => {
    // Pede ao navegador para não apagar os dados sozinho (Edge concede para app instalado ou site muito usado).
    try { navigator.storage?.persist?.().then(p => { KV.persistente = p; }).catch(() => {}); navigator.storage?.estimate?.().then(e => { KV.estimativa = e; }).catch(() => {}); } catch (e) { }
    return ok;
  });
}
function kvGravar(k, j) {
  if (!KV.db) return false;
  KV.cache.set(k, j);
  try { const tx = KV.db.transaction('kv', 'readwrite'); j === null ? tx.objectStore('kv').delete(k) : tx.objectStore('kv').put(j, k); tx.onerror = () => { KV.erros++; KV.ultimoErro = String(tx.error?.message || tx.error); }; }
  catch (e) { KV.erros++; KV.ultimoErro = e.message; return false; }
  return true;
}
function lerLocal(k) {
  let s = null; try { s = localStorage.getItem(k); } catch (e) { }
  if (s && s !== MARCA_KV) { try { return JSON.parse(s); } catch (e) { } }
  const j = KV.cache.get(k); if (j) { try { return JSON.parse(j); } catch (e) { } }
  return null;
}
// Grava e confere a gravação; devolve falso só se nem o localStorage nem o IndexedDB aceitarem (o usuário é avisado).
function gravarLocal(k, v) {
  const j = JSON.stringify(v); let ok = false;
  try { localStorage.setItem(k, j); ok = localStorage.getItem(k) === j; } catch (e) { }
  if (!ok) { try { localStorage.removeItem(k); localStorage.setItem(k, MARCA_KV); } catch (e) { } }
  const okKV = kvGravar(k, j);
  return ok || okKV;
}
function apagarLocal(k) { try { localStorage.removeItem(k); } catch (e) { } kvGravar(k, null); KV.cache.delete(k); }
// Alterações nas bases valem para todas as competências e ficam registradas na competência do topo.
function registrarAlteracaoBase(motivo, tipo) {
  if (!motivo || !S.compReg) return;
  registrarAlteracao(S.compReg, S.comp, S.operador, tipo || tipoDaAlteracao(motivo), motivo); salvarCompReg();
}
// P2 (v3.0.0-alpha.11): salvar = gravar neste navegador + agendar a sincronização com a pasta (29c-sincronizacao.js).
// A própria sincronização e a restauração usam só o gravar*Local, para não agendar de novo.
function salvarCfg(motivo = '', tipo = '') { gravarCfgLocal(motivo, tipo); agendarSincronizacao('cfg'); }
function gravarCfgLocal(motivo = '', tipo = '') {
  aplicarRegrasConfig(S.cfg);   // modalidade por grupo e HM da V3 (P3)
  registrarAlteracaoBase(motivo, tipo);
  S.cfg.revisao = (S.cfg.revisao || 0) + 1; S.cfg.atualizadoEm = agoraISO();
  if (!gravarLocal(CHAVES.cfg, S.cfg)) avisar('Não foi possível gravar a configuração neste navegador. Exporte um backup em Configurações para não perder as alterações.', 'err');
  else if (motivo) avisar(motivo, 'ok');
}
function salvarEq(motivo = '') {
  // P2 (v3.0.0-alpha.11): relações resolvidas por regra composta validada ficam «cobertas» ao GRAVAR (antes, a tela de
  // Equivalências fazia isso — e gravava — só por abrir).
  aplicarCobertas(S.eq, S.operador, S.comp);
  registrarAlteracaoBase(motivo, 'equivalencias');
  if (!gravarLocal(CHAVES.eq, S.eq)) avisar('Não foi possível gravar a base de equivalências neste navegador. Exporte o JSON para não perder as alterações.', 'err');
  else if (motivo) avisar(motivo, 'ok');
  atualizarNavPendencias();
  agendarSincronizacao('eq');
}
// Cópia de segurança antes de substituir uma base inteira (RN-215).
// v3.0: a base inteira vai ser trocada (backup, desfazer, substituir): a próxima sincronização com a pasta compara
// SEM a «última versão sincronizada». Sem isso, a versão antiga parecia «mudança minha» na mescla de três vias e
// passava por cima das decisões mais novas da outra pessoa; assim, decisões diferentes viram escolha explícita.
function backupAntesDeSubstituir(chaveAnterior, valor) {
  gravarLocal(chaveAnterior, { em: agoraISO(), valor });
  const base = { [CHAVES.eqAnterior]: CHAVES.eqSyncBase, [CHAVES.fluxoAnterior]: CHAVES.fluxoSyncBase, [CHAVES.cfgAnterior]: CHAVES.cfgSyncBase }[chaveAnterior];
  if (base) apagarLocal(base);
}

// Rodadas em IndexedDB (sem nomes de pacientes); se indisponível, ficam só na memória.
const DB = { db: null, ok: false };
function abrirDB() {
  return new Promise(res => {
    try {
      // v2: «arquivos» guarda as planilhas de laudos e do Power BI por competência (já lidas, sem CPF).
      // v3 (3.0.0-alpha.10): índice «comp» nas rodadas, para ler só a competência aberta e as vizinhas.
      const rq = indexedDB.open('repasse-medico-v2', 3);
      rq.onupgradeneeded = e => {
        const db = rq.result; for (const n of ['rodadas', 'arquivos']) if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: 'id' });
        const st = rq.transaction.objectStore('rodadas');
        if (!st.indexNames.contains('comp')) {
          st.createIndex('comp', 'comp');
          st.openCursor().onsuccess = ev => { const c = ev.target.result; if (!c) return; const r = c.value; if (r.comp !== competenciaDaRodada(r)) { r.comp = competenciaDaRodada(r); c.update(r); } c.continue(); };
        }
      };
      rq.onsuccess = () => { DB.db = rq.result; DB.ok = true; res(true); };
      rq.onerror = () => res(false);
    } catch (e) { res(false); }
  });
}
// Todas as rodadas (Rodadas → todas as competências, restauração). As telas usam dbRodadasJanela.
function dbTodas() {
  if (!DB.ok) return Promise.resolve(S.rodadas);
  return new Promise(res => { const rq = DB.db.transaction('rodadas').objectStore('rodadas').getAll(); rq.onsuccess = () => res((rq.result || []).map(normalizarChavesRodada)); rq.onerror = () => res([]); });
}
// P1: só as rodadas da competência aberta e das vizinhas (índice «comp»), ou só as de uma competência (para o backup).
function dbRodadasJanela(ch = S.comp, so = false) {
  const [de, ate] = so ? [ch, ch] : janelaCompetencias(ch);
  if (!DB.ok) return Promise.resolve(S.rodadas.filter(r => { const c = competenciaDaRodada(r); return c >= de && c <= ate; }));
  return new Promise(res => {
    try {
      const rq = DB.db.transaction('rodadas').objectStore('rodadas').index('comp').getAll(IDBKeyRange.bound(de, ate));
      rq.onsuccess = () => res((rq.result || []).map(normalizarChavesRodada)); rq.onerror = () => res([]);
    } catch (e) { dbTodas().then(t => res(t.filter(r => { const c = competenciaDaRodada(r); return c >= de && c <= ate; }))); }
  });
}
function dbGravar(r) {
  if (!DB.ok) return Promise.resolve(false);
  r.comp = competenciaDaRodada(r);
  return new Promise(res => { const tx = DB.db.transaction('rodadas', 'readwrite'); tx.objectStore('rodadas').put(r); tx.oncomplete = () => res(true); tx.onerror = () => res(false); });
}
function dbApagar(id) {
  if (!DB.ok) return Promise.resolve(false);
  return new Promise(res => { const tx = DB.db.transaction('rodadas', 'readwrite'); id ? tx.objectStore('rodadas').delete(id) : tx.objectStore('rodadas').clear(); tx.oncomplete = () => res(true); tx.onerror = () => res(false); });
}
async function guardarRodada(r, { reter = true } = {}) {
  const i = S.rodadas.findIndex(x => x.id === r.id);
  if (i >= 0) S.rodadas[i] = r; else S.rodadas.push(r);
  const ok = await dbGravar(r);
  if (r.tipo === 'conferencia' && typeof registrarUsoDaRodada === 'function') registrarUsoDaRodada(r);   // SOL-F50, antes da retenção
  if (reter) await reterRodadas(new Set([grupoRodada(r)]));
  return ok;
}
// Retenção (P1): resume as rodadas substituídas dos grupos indicados (ou de todos, na abertura).
async function reterRodadas(grupos = null, base = S.rodadas) {
  const lista = rodadasParaResumir(base, grupos);
  for (const r of lista) { resumirRodada(r); await dbGravar(r); const j = S.rodadas.findIndex(x => x.id === r.id); if (j >= 0) S.rodadas[j] = r; }
  return lista.length;
}

/* ---------- Mensagens, diálogos e downloads ---------- */
let avisoTimer = null;
function avisar(texto, tipo = 'info') {
  const a = $('aviso'); a.className = `aviso ${tipo}`; a.textContent = texto; a.hidden = false;
  clearTimeout(avisoTimer); avisoTimer = setTimeout(() => { a.hidden = true; }, tipo === 'err' ? 15000 : 6000);
}
// Diálogo simples: devolve o valor do botão clicado e os campos preenchidos.
function dialogo(titulo, corpoHtml, botoes = [['ok', 'OK']]) {
  return new Promise(res => {
    const d = $('dlg'); $('dlgTitulo').textContent = titulo; $('dlgCorpo').innerHTML = corpoHtml; ligarBuscas($('dlgCorpo'));
    $('dlgBotoes').innerHTML = botoes.map(([v, t, cls]) => `<button value="${esc(v)}" class="${cls || ''}">${esc(t)}</button>`).join('');
    d.onclose = () => {
      const campos = {}; $('dlgCorpo').querySelectorAll('[name]').forEach(el => { if (el.type === 'radio') { if (el.checked) campos[el.name] = el.value; else if (!(el.name in campos)) campos[el.name] = ''; } else campos[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
      res({ botao: d.returnValue, campos });
    };
    // v3.0.0-alpha.28: Enter confirma. Antes o Enter acionava o primeiro botão (quase sempre «Cancelar»), e o foco
    // inicial também caía nele. Agora o Enter num campo aciona o botão principal (o último que não é «Cancelar»),
    // e, sem campos, o foco começa no botão principal. Numa área de texto o Enter continua quebrando linha;
    // com o foco num botão, o Enter aciona aquele botão.
    const principal = () => { const bs = [...$('dlgBotoes').querySelectorAll('button')]; return bs.filter(b => b.value !== '').pop() || bs.pop(); };
    d.onkeydown = e => {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
      const t = e.target; if (['TEXTAREA', 'BUTTON', 'SELECT', 'A'].includes(t.tagName)) return;
      const b = principal(); if (b) { e.preventDefault(); b.click(); }
    };
    d.returnValue = ''; d.showModal();
    if (!$('dlgCorpo').querySelector('input:not([type=hidden]),select,textarea')) principal()?.focus();
  });
}
async function confirmar(titulo, texto, ok = 'Confirmar') { return (await dialogo(titulo, `<p>${texto}</p>`, [['', 'Cancelar', 'sec'], ['ok', ok]])).botao === 'ok'; }
async function exigirOperador() {
  if (S.operador) return S.operador;
  const r = await dialogo('Quem está operando?', `<p class="muted">O nome fica registrado nas validações, correções e aceites (rastreabilidade, RN-184). Fica salvo só neste navegador.</p><label class="campo">Nome do operador<input type="text" name="nome" autofocus></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Salvar']]);
  const nome = (r.campos.nome || '').trim();
  if (r.botao === 'ok' && nome) { S.operador = nome; gravarLocal(CHAVES.operador, nome); mostrarOperador(); return nome; }
  return '';
}
function mostrarOperador() { $('operadorTopo').textContent = S.operador ? `Operador: ${S.operador}` : 'Operador não informado'; }
async function baixarZip(zip, nome) {
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
  baixarBlob(blob, nome);
}
function baixarBlob(blob, nome) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
const baixarJSON = (obj, nome) => baixarBlob(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }), nome);
const nomeSeguro = s => norm(s).replace(/\s+/g, '_').slice(0, 60);
const carimbo = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
// Nome do Excel de uma análise: tipo, médico (código do MV), unidade, competência e a rodada — a mesma
// chave que aparece no resultado, na aba «Informações» e em Rodadas (aceite). Sem «/», que corta o nome.
const nomeArquivoAnalise = (tipo, ctx) => `${tipo}_medico_${String(ctx.relatorio.cab.prestadorCod || 'sem-codigo').replace(/[^\w-]/g, '')}_unidade_${ctx.unidadeCod === '*' ? 'todas' : String(ctx.unidadeCod || 'x').replace(/[^\w-]/g, '')}_comp_${(ctx.chaveCompetencia || S.comp).slice(5)}-${(ctx.chaveCompetencia || S.comp).slice(0, 4)}_rodada_${ctx.rodadaId || carimbo()}.xlsx`;
const lerArquivo = f => f.arrayBuffer().then(b => new Uint8Array(b));

// Área de soltar/clicar para arquivos.
function zonaArquivo(el, input, aoReceber) {
  el.onclick = () => input.click();
  el.ondragover = e => { e.preventDefault(); el.classList.add('over'); };
  el.ondragleave = () => el.classList.remove('over');
  el.ondrop = e => { e.preventDefault(); el.classList.remove('over'); if (e.dataTransfer.files.length) aoReceber([...e.dataTransfer.files]); };
  input.onchange = () => { if (input.files.length) aoReceber([...input.files]); input.value = ''; };
}

/* ---------- Competência no topo (vale para todas as abas) ---------- */
const PAGINAS_GLOBAIS = new Set(['equivalencias', 'bases', 'configuracoes']);
let paginaAtual = 'inicio';
function salvarCompReg() { if (!gravarLocal(CHAVES.compReg, S.compReg)) avisar('Não foi possível gravar o registro de competências neste navegador.', 'err'); }
function carregarCompetencia() {
  const r = lerLocal(CHAVES.compReg);
  S.compReg = r && !validarRegistroCompetencias(r).length ? r : registroCompetenciasVazio();
  const c = lerLocal(CHAVES.comp);
  S.comp = /^\d{4}-\d{2}$/.test(c || '') ? c : chaveAtual();
}
function mudarCompetencia(chave) {
  if (!/^\d{4}-\d{2}$/.test(chave || '') || chave === S.comp) return;
  S.comp = chave; gravarLocal(CHAVES.comp, chave);
  agendarSincronizacao('nc');   // SOL-F18: NCs da competência nova vêm da pasta
  // P1: as telas usam as rodadas da competência aberta e das vizinhas; recarrega e redesenha.
  if (typeof DB !== 'undefined' && DB.ok) dbRodadasJanela(chave).then(r => { if (S.comp !== chave) return; S.rodadas = r; irPara(paginaAtual, true); });
  if (typeof NCV !== 'undefined') { NCV.sel.clear(); NCV.revisar = null; NCV.selCand.clear(); }
  atualizarNavFluxo();
  irPara(paginaAtual, true);
  // Planilhas guardadas da nova competência entram no lugar das da sessão.
  (typeof restaurarPlanilhasDaCompetencia === 'function' ? restaurarPlanilhasDaCompetencia() : Promise.resolve(0)).then(n => {
    if (n) { irPara(paginaAtual, true); avisar(`Planilha(s) guardada(s) da competência ${rotuloCompetencia(chave)} carregada(s).`, 'ok'); }
    if (typeof oferecerLimpezaNaTroca === 'function') oferecerLimpezaNaTroca();
  });
}
const compFechada = (chave = S.comp) => competenciaFechada(S.compReg, chave);
// Bloqueia alterações numa competência fechada; devolve verdadeiro se pode seguir.
function exigirAberta(chave = S.comp, oque = 'alterar') {
  if (!compFechada(chave)) return true;
  avisar(`A competência ${rotuloCompetencia(chave)} está fechada (somente leitura): não é possível ${oque}. Reabra no Início ou escolha outra competência no topo.`, 'warn');
  return false;
}
function desenharSeletorCompetencia() {
  const el = $('compGlobal'); if (!el) return;
  const fechada = compFechada(), global = PAGINAS_GLOBAIS.has(paginaAtual);
  // Bases, equivalências e configurações valem para todas as competências: sem seletor.
  el.hidden = global;
  el.innerHTML = `<button type="button" class="sec ic" id="compAnt" aria-label="Competência anterior" title="Competência anterior">‹</button>
    <div class="comp-rot"><b>Competência ${rotuloCompetencia(S.comp)} <span class="comp-st ${fechada ? 'fechada' : 'aberta'}">${fechada ? 'fechada' : 'aberta'}</span></b>
    <small>produção ${rotuloMes(producaoEsperada(S.comp))}</small></div>
    <button type="button" class="sec ic" id="compProx" aria-label="Próxima competência" title="Próxima competência">›</button>`;
  $('compAnt').onclick = () => mudarCompetencia(competenciaVizinha(S.comp, -1));
  $('compProx').onclick = () => mudarCompetencia(competenciaVizinha(S.comp, 1));
  const est = estadoCompetencia(S.compReg, S.comp), aviso = $('compAviso');
  aviso.hidden = !fechada || global;
  if (fechada && !global) {
    aviso.innerHTML = `🔒 Competência ${rotuloCompetencia(S.comp)} fechada em ${new Date(est.fechadaEm).toLocaleDateString('pt-BR')} por ${esc(est.fechadaPor || '—')}: somente leitura. ${paginaAtual === 'inicio' ? 'Use «Reabrir…» no painel abaixo' : '<a href="#inicio">Reabrir no Início</a>'} ou escolha outra competência.`;
  }
}

/* ---------- Navegação ---------- */
// v3.0.0-alpha.20 (simplificação): menu com 7 itens. Correção de prestador e Rodadas ficam dentro da Conferência;
// o Fluxo mensal (etapas e marcos) fica dentro do Fechamento e envio. As rotas antigas continuam valendo.
const PAGINAS = { inicio: 'Início', fluxo: 'Fechamento e envio', conferencia: 'Conferência', correcao: 'Conferência', nc: 'Não conformidades', fechamento: 'Fechamento e envio', equivalencias: 'Equivalências TUSS', bases: 'Bases e regras', rodadas: 'Conferência', configuracoes: 'Configurações' };
const PAI_PAGINA = { correcao: 'conferencia', rodadas: 'conferencia', fluxo: 'fechamento' };
const SUBNAV = {
  conferencia: [['conferencia', 'Conferência cruzada'], ['correcao', 'Correção de prestador'], ['rodadas', 'Histórico de rodadas']],
  fechamento: [['fluxo', 'Etapas do mês'], ['fechamento', 'Repasses e envio']]
};
const RENDER = {};
function desenharSubnav(pag) {
  const el = $('subnav'); if (!el) return;
  const grupo = SUBNAV[PAI_PAGINA[pag] || pag];
  el.hidden = !grupo;
  el.classList.toggle('modo-abas', (PAI_PAGINA[pag] || pag) === 'fechamento');
  el.innerHTML = !grupo ? '' : (PAI_PAGINA[pag] || pag) === 'fechamento' && typeof itensSubnavFechamento === 'function' ? itensSubnavFechamento(pag)
    : grupo.map(([k, t]) => `<a href="#${k}" class="${k === pag ? 'on' : ''}"${k === pag ? ' aria-current="page"' : ''}>${esc(t)}</a>`).join('');
  el.setAttribute('aria-label', grupo ? PAGINAS[pag] : '');
}
function irPara(pag) {
  if (!PAGINAS[pag]) pag = 'inicio';
  paginaAtual = pag;
  desenharSeletorCompetencia();
  for (const k of Object.keys(PAGINAS)) $('pag-' + k).hidden = k !== pag;
  const ativo = PAI_PAGINA[pag] || pag;
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('ativo', a.dataset.pag === ativo));
  $('titulo').textContent = PAGINAS[pag];
  desenharSubnav(pag);
  try { atualizarPillMenu(); } catch (e) { }
  if (RENDER[pag]) RENDER[pag]();
  window.scrollTo(0, 0);
}
function atualizarNavPendencias() {
  const n = S.eq ? S.eq.itens.filter(e => e.status === 'pendente').length : 0;
  const b = $('navPend'); b.hidden = !n; b.textContent = n; b.title = `${n} equivalências pendentes de validação`;
  // A dica e o nome lido pelo leitor de tela levam o número; recolhido, o selo vira só um ponto.
  const a = b.closest('a'), nome = n ? `Equivalências TUSS · ${n} pendentes` : 'Equivalências TUSS';
  a.setAttribute('aria-label', nome); a.querySelector('.dica').textContent = nome;
}

/* ---------- Menu lateral recolhível (☰ e Ctrl+B); a escolha fica salva neste navegador ---------- */
function aplicarMenu(recolhido) {
  document.querySelector('.shell').classList.toggle('recolhido', recolhido);
  const b = $('btnMenu'); b.setAttribute('aria-expanded', String(!recolhido)); b.setAttribute('aria-label', recolhido ? 'Expandir menu' : 'Recolher menu');
}
function alternarMenu() {
  const recolhido = !document.querySelector('.shell').classList.contains('recolhido');
  aplicarMenu(recolhido); gravarLocal(CHAVES.menu, recolhido);
}
// v3.0.0-alpha.27: em tela estreita (celular ou janela pequena, até 900 px) o menu começa recolhido, só com ícones,
// para o conteúdo caber. O ☰ continua abrindo. No computador, vale a escolha guardada.
const telaEstreita = () => !!window.matchMedia?.('(max-width: 900px)').matches;
function iniciarMenu() {
  aplicarMenu(lerLocal(CHAVES.menu) === true || telaEstreita());
  try { window.matchMedia('(max-width: 900px)').addEventListener('change', e => { if (e.matches) aplicarMenu(true); else aplicarMenu(lerLocal(CHAVES.menu) === true); }); } catch (e) { }
  $('btnMenu').onclick = alternarMenu;
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'b') { e.preventDefault(); alternarMenu(); } });
}

/* ---------- Tabela paginada com detalhe expansível ---------- */
function tabela(cont, { colunas, linhas, porPagina = 200, detalhe = null, classeLinha = null, vazio = 'Nenhum registro.' }) {
  let pag = 0, aberto = null;
  // manter: abrir/fechar uma linha não pode levar a lista de volta ao topo (pedido de 24/11/2026) — guarda a rolagem da
  // área da tabela (.tw) e da página e devolve depois de redesenhar.
  const desenhar = (manter = false) => {
    const tw0 = cont.querySelector('.tw'), rol = manter && tw0 ? [tw0.scrollTop, tw0.scrollLeft] : null, pagY = manter ? window.scrollY : null;
    const total = linhas.length, ini = pag * porPagina, fatia = linhas.slice(ini, ini + porPagina);
    cont.innerHTML = `<div class="tw"><table><thead><tr>${colunas.map(c => `<th class="${c.n ? 'n' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${fatia.length ? fatia.map((x, i) => {
      const linha = `<tr class="${detalhe ? 'clicavel ' : ''}${classeLinha ? classeLinha(x) : ''}" data-i="${ini + i}">${colunas.map(c => `<td class="${c.n ? 'n' : ''}">${c.html ? c.html(x) : esc(c.v(x))}</td>`).join('')}</tr>`;
      return linha + (detalhe && aberto === ini + i ? `<tr class="detalhe"><td colspan="${colunas.length}">${detalhe(x)}</td></tr>` : '');
    }).join('') : `<tr><td colspan="${colunas.length}" class="muted">${esc(vazio)}</td></tr>`}</tbody></table></div>` +
      (total > porPagina ? `<div class="paginacao"><button class="sec" data-p="-1" ${pag ? '' : 'disabled'}>‹ Anterior</button><span>${ini + 1}–${Math.min(total, ini + porPagina)} de ${total}</span><button class="sec" data-p="1" ${ini + porPagina < total ? '' : 'disabled'}>Próxima ›</button></div>` : `<div class="paginacao"><span>${total} registro(s)</span></div>`);
    cont.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { pag += +b.dataset.p; aberto = null; desenhar(); });
    if (detalhe) cont.querySelectorAll('tbody tr.clicavel').forEach(tr => tr.onclick = e => { if (e.target.closest('input,button,select,a')) return; const i = +tr.dataset.i; aberto = aberto === i ? null : i; desenhar(true); });
    if (rol) { const tw = cont.querySelector('.tw'); if (tw) { tw.scrollTop = rol[0]; tw.scrollLeft = rol[1]; } }
    if (pagY != null && window.scrollY !== pagY) window.scrollTo(window.scrollX, pagY);
  };
  desenhar();
  return { atualizar(novas) { linhas = novas; pag = 0; aberto = null; desenhar(); }, abrir(k) { if (k < 0 || k >= linhas.length) return; pag = Math.floor(k / porPagina); aberto = k; desenhar(); cont.querySelector('tr.detalhe')?.scrollIntoView({ block: 'nearest' }); } };
}
const chipStatus = (cls, nome) => `<span class="st st-${esc(cls)}">${esc(nome)}</span>`;
const opcoes = (lista, sel) => lista.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(t)}</option>`).join('');

// Botão de execução: mostra «Processando…» e, se algo der errado, a mensagem na tela (antes o erro ficava só no console).
async function comProcessando(bt, fn, oque) {
  if (!bt || bt.dataset.rodando) return;
  const txt = bt.textContent; bt.dataset.rodando = '1'; bt.disabled = true; bt.textContent = 'Processando…';
  await new Promise(r => setTimeout(r, 30));   // deixa a tela mostrar o «Processando…»
  try { await fn(); }
  catch (e) { console.error(e); avisar(`Não foi possível executar ${oque}: ${e?.message || e}. Se continuar, me envie esta mensagem.`, 'err'); }
  finally { if (document.body.contains(bt)) { bt.disabled = false; bt.textContent = txt; delete bt.dataset.rodando; } }
}
// Erro inesperado em qualquer tela: aparece como aviso (e continua no console).
window.addEventListener('error', e => { if (e?.message && !/ResizeObserver/.test(e.message)) avisar(`Erro inesperado: ${e.message}. Se continuar, me envie esta mensagem.`, 'err'); });
window.addEventListener('unhandledrejection', e => { const m = e?.reason?.message || String(e?.reason || ''); if (m && e.reason?.name !== 'AbortError') avisar(`Erro inesperado: ${m}. Se continuar, me envie esta mensagem.`, 'err'); });
