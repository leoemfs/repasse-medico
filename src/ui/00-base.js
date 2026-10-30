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
const CHAVES = { cfg: 'rm2.configuracao', eq: 'rm2.equivalencias', eqAnterior: 'rm2.equivalencias.anterior', cfgAnterior: 'rm2.configuracao.anterior', operador: 'rm2.operador', tema: 'rm2.tema', menu: 'rm2.menu', fluxo: 'rm2.fluxo', fluxoAnterior: 'rm2.fluxo.anterior', nc: 'rm2.nc', ncAnterior: 'rm2.nc.anterior', comp: 'rm2.competencia', compReg: 'rm2.competencias' };
function lerLocal(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
// Grava e confere a gravação; devolve falso se o navegador bloquear (o usuário é avisado).
function gravarLocal(k, v) {
  try { const j = JSON.stringify(v); localStorage.setItem(k, j); return localStorage.getItem(k) === j; } catch (e) { return false; }
}
// Alterações nas bases valem para todas as competências e ficam registradas na competência do topo.
function registrarAlteracaoBase(motivo, tipo) {
  if (!motivo || !S.compReg) return;
  registrarAlteracao(S.compReg, S.comp, S.operador, tipo || tipoDaAlteracao(motivo), motivo); salvarCompReg();
}
function salvarCfg(motivo = '', tipo = '') {
  registrarAlteracaoBase(motivo, tipo);
  S.cfg.revisao = (S.cfg.revisao || 0) + 1; S.cfg.atualizadoEm = agoraISO();
  if (!gravarLocal(CHAVES.cfg, S.cfg)) avisar('Não foi possível gravar a configuração neste navegador. Exporte um backup em Configurações para não perder as alterações.', 'err');
  else if (motivo) avisar(motivo, 'ok');
}
function salvarEq(motivo = '') {
  registrarAlteracaoBase(motivo, 'equivalencias');
  if (!gravarLocal(CHAVES.eq, S.eq)) avisar('Não foi possível gravar a base de equivalências neste navegador. Exporte o JSON para não perder as alterações.', 'err');
  else if (motivo) avisar(motivo, 'ok');
  atualizarNavPendencias();
}
// Cópia de segurança antes de substituir uma base inteira (RN-215).
function backupAntesDeSubstituir(chaveAnterior, valor) { gravarLocal(chaveAnterior, { em: agoraISO(), valor }); }

// Rodadas em IndexedDB (sem nomes de pacientes); se indisponível, ficam só na memória.
const DB = { db: null, ok: false };
function abrirDB() {
  return new Promise(res => {
    try {
      const rq = indexedDB.open('repasse-medico-v2', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('rodadas', { keyPath: 'id' });
      rq.onsuccess = () => { DB.db = rq.result; DB.ok = true; res(true); };
      rq.onerror = () => res(false);
    } catch (e) { res(false); }
  });
}
function dbTodas() {
  if (!DB.ok) return Promise.resolve(S.rodadas);
  return new Promise(res => { const rq = DB.db.transaction('rodadas').objectStore('rodadas').getAll(); rq.onsuccess = () => res(rq.result || []); rq.onerror = () => res([]); });
}
function dbGravar(r) {
  if (!DB.ok) return Promise.resolve(false);
  return new Promise(res => { const tx = DB.db.transaction('rodadas', 'readwrite'); tx.objectStore('rodadas').put(r); tx.oncomplete = () => res(true); tx.onerror = () => res(false); });
}
function dbApagar(id) {
  if (!DB.ok) return Promise.resolve(false);
  return new Promise(res => { const tx = DB.db.transaction('rodadas', 'readwrite'); id ? tx.objectStore('rodadas').delete(id) : tx.objectStore('rodadas').clear(); tx.oncomplete = () => res(true); tx.onerror = () => res(false); });
}
async function guardarRodada(r) {
  const i = S.rodadas.findIndex(x => x.id === r.id);
  if (i >= 0) S.rodadas[i] = r; else S.rodadas.push(r);
  return dbGravar(r);
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
    const d = $('dlg'); $('dlgTitulo').textContent = titulo; $('dlgCorpo').innerHTML = corpoHtml;
    $('dlgBotoes').innerHTML = botoes.map(([v, t, cls]) => `<button value="${esc(v)}" class="${cls || ''}">${esc(t)}</button>`).join('');
    d.onclose = () => {
      const campos = {}; $('dlgCorpo').querySelectorAll('[name]').forEach(el => { if (el.type === 'radio') { if (el.checked) campos[el.name] = el.value; else if (!(el.name in campos)) campos[el.name] = ''; } else campos[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
      res({ botao: d.returnValue, campos });
    };
    d.returnValue = ''; d.showModal();
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
  if (typeof NCV !== 'undefined') { NCV.sel.clear(); NCV.revisar = null; NCV.selCand.clear(); }
  atualizarNavFluxo();
  irPara(paginaAtual, true);
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
const PAGINAS = { inicio: 'Início', fluxo: 'Fluxo mensal', conferencia: 'Conferência cruzada', correcao: 'Correção de prestador', nc: 'Não conformidades', equivalencias: 'Equivalências TUSS', bases: 'Bases', rodadas: 'Rodadas', configuracoes: 'Configurações' };
const RENDER = {};
function irPara(pag) {
  if (!PAGINAS[pag]) pag = 'inicio';
  paginaAtual = pag;
  desenharSeletorCompetencia();
  for (const k of Object.keys(PAGINAS)) $('pag-' + k).hidden = k !== pag;
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('ativo', a.dataset.pag === pag));
  $('titulo').textContent = PAGINAS[pag];
  if (RENDER[pag]) RENDER[pag]();
  window.scrollTo(0, 0);
}
function atualizarNavPendencias() {
  const n = S.eq ? S.eq.itens.filter(e => e.status === 'pendente').length : 0;
  const b = $('navPend'); b.hidden = !n; b.textContent = n; b.title = `${n} equivalências pendentes de validação`;
  // A dica e o nome lido pelo leitor de tela levam o número; recolhido/celular, o selo vira só um ponto.
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
function iniciarMenu() {
  aplicarMenu(lerLocal(CHAVES.menu) === true);
  $('btnMenu').onclick = alternarMenu;
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'b') { e.preventDefault(); alternarMenu(); } });
}

/* ---------- Tabela paginada com detalhe expansível ---------- */
function tabela(cont, { colunas, linhas, porPagina = 200, detalhe = null, classeLinha = null, vazio = 'Nenhum registro.' }) {
  let pag = 0, aberto = null;
  const desenhar = () => {
    const total = linhas.length, ini = pag * porPagina, fatia = linhas.slice(ini, ini + porPagina);
    cont.innerHTML = `<div class="tw"><table><thead><tr>${colunas.map(c => `<th class="${c.n ? 'n' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${fatia.length ? fatia.map((x, i) => {
      const linha = `<tr class="${detalhe ? 'clicavel ' : ''}${classeLinha ? classeLinha(x) : ''}" data-i="${ini + i}">${colunas.map(c => `<td class="${c.n ? 'n' : ''}">${c.html ? c.html(x) : esc(c.v(x))}</td>`).join('')}</tr>`;
      return linha + (detalhe && aberto === ini + i ? `<tr class="detalhe"><td colspan="${colunas.length}">${detalhe(x)}</td></tr>` : '');
    }).join('') : `<tr><td colspan="${colunas.length}" class="muted">${esc(vazio)}</td></tr>`}</tbody></table></div>` +
      (total > porPagina ? `<div class="paginacao"><button class="sec" data-p="-1" ${pag ? '' : 'disabled'}>‹ Anterior</button><span>${ini + 1}–${Math.min(total, ini + porPagina)} de ${total}</span><button class="sec" data-p="1" ${ini + porPagina < total ? '' : 'disabled'}>Próxima ›</button></div>` : `<div class="paginacao"><span>${total} registro(s)</span></div>`);
    cont.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { pag += +b.dataset.p; aberto = null; desenhar(); });
    if (detalhe) cont.querySelectorAll('tbody tr.clicavel').forEach(tr => tr.onclick = e => { if (e.target.closest('input,button,select,a')) return; const i = +tr.dataset.i; aberto = aberto === i ? null : i; desenhar(); });
  };
  desenhar();
  return { atualizar(novas) { linhas = novas; pag = 0; aberto = null; desenhar(); } };
}
const chipStatus = (cls, nome) => `<span class="st st-${esc(cls)}">${esc(nome)}</span>`;
const opcoes = (lista, sel) => lista.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(t)}</option>`).join('');
