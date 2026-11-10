/* ============================================================
 * SOL-F36 — Fluxo mensal sincronizado por arquivo numa pasta da rede (Edge/Chrome, File System Access)
 * e divisão do trabalho por unidade × grupo («Assumir», «Liberar», «Concluir»).
 * Só o Fluxo vai para a pasta: nada de paciente, PDF ou planilha.
 * ============================================================ */
const SY = { handle: null, status: 'off', erro: '', conferidoEm: 0, lm: 0, meta: null, ocupado: false, pendente: false, conflitos: 0, timer: null, aviso: new Set() };
const CHAVE_SYNC_BASE = CHAVES.fluxoSyncBase;
const arquivoSync = chave => `fluxo_comp_${chave.slice(5)}-${chave.slice(0, 4)}.json`;
const suportaPasta = () => typeof window.showDirectoryPicker === 'function';

// A pasta escolhida fica guardada neste navegador (IndexedDB próprio, separado dos dados da ferramenta).
function dbSync(modo, valor) {
  return new Promise((ok, falha) => {
    const rq = indexedDB.open('repasse-medico-sync', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('k');
    rq.onerror = () => falha(rq.error);
    rq.onsuccess = () => {
      try {
        const tx = rq.result.transaction('k', modo === 'ler' ? 'readonly' : 'readwrite'), st = tx.objectStore('k');
        const op = modo === 'ler' ? st.get('pasta') : modo === 'apagar' ? st.delete('pasta') : st.put(valor, 'pasta');
        op.onsuccess = () => ok(op.result); op.onerror = () => falha(op.error);
      } catch (e) { falha(e); }
    };
  });
}
async function temPermissaoPasta(pedir = false) {
  const h = SY.handle; if (!h) return false;
  if (!h.queryPermission) return true;
  if (await h.queryPermission({ mode: 'readwrite' }) === 'granted') return true;
  return pedir && h.requestPermission ? await h.requestPermission({ mode: 'readwrite' }) === 'granted' : false;
}
async function definirPastaSync(handle) {
  SY.handle = handle; SY.lm = 0; SY.meta = null; SY.legado = ehPastaLegadaFluxo(handle); if (typeof SYQ !== 'undefined') { SYQ.lm = 0; SYQ.status = handle ? 'ok' : 'off'; }
  if (handle) await dbSync('gravar', handle).catch(() => {}); else await dbSync('apagar').catch(() => {});
  iniciarTimerSync();
  if (handle) { await sincronizarFluxo({ interativo: true }); await sincronizarEq({ interativo: true }); if (location.hash === '#inicio' || !location.hash) RENDER.inicio(); } else { SY.status = 'off'; atualizarBarraSync(); if (location.hash === '#inicio' || !location.hash) RENDER.inicio(); }
}
async function escolherPastaSync() {
  if (!suportaPasta()) return avisar('Este navegador não grava em pastas. Use o Edge ou o Chrome no computador.', 'warn');
  const op = await exigirOperador(); if (!op) return;
  try {
    const h = await window.showDirectoryPicker({ id: 'rm-raiz', mode: 'readwrite' });
    if (ehSubpastaConhecida(h.name)) return avisar(`«${h.name}» é uma das subpastas. Escolha a pasta raiz do aplicativo (a que contém Fluxo mensal, Equivalência TUSS, Bases de dados…).`, 'warn');
    await definirPastaSync(h); avisar(`Pasta raiz «${h.name}» conectada: Fluxo, equivalências e relatórios passam a usar as subpastas dela.`, 'ok');
  }
  catch (e) { if (e.name !== 'AbortError') avisar(`Não foi possível usar a pasta (${e.message}).`, 'err'); }
}
async function restaurarPastaSync() {
  try { const h = await dbSync('ler'); if (h) { SY.handle = h; SY.legado = ehPastaLegadaFluxo(h); SY.status = await temPermissaoPasta() ? 'ok' : 'permissao'; iniciarTimerSync(); if (SY.status === 'ok') { await sincronizarFluxo(); await sincronizarEq(); if (S.cfg.parametros.lerPastaAoAbrir !== false) atualizarDaPasta({ silencioso: true }); } else atualizarBarraSync(); if (location.hash === '#inicio' || !location.hash) RENDER.inicio(); } } catch (e) { /* sem pasta guardada */ }
}

// Lê a pasta, mescla com a versão local e grava o resultado. interativo: pode abrir o diálogo de conflitos.
async function sincronizarFluxo({ interativo = false } = {}) {
  const chave = S.comp;
  if (!SY.handle || !chave) return;
  if (SY.ocupado) { SY.pendente = true; return; }
  if (!(await temPermissaoPasta(interativo))) { SY.status = 'permissao'; atualizarBarraSync(); return; }
  SY.ocupado = true;
  try {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const nome = arquivoSync(chave); let remoto = null, lm = 0;
      try { const f = await (await (await dirFluxo()).getFileHandle(nome)).getFile(); lm = f.lastModified; const d = JSON.parse(await f.text()); if (d.schema !== SCHEMA_FLUXO_SYNC || d.chave !== chave) throw new Error(`${nome} não é o Fluxo desta competência`); remoto = d; }
      catch (e) { if (e.name !== 'NotFoundError') throw e; }
      const local = S.fluxo.competencias[chave] || null, bases = lerLocal(CHAVE_SYNC_BASE) || {};
      let { comp, conflitos } = mesclarFluxo(local, remoto?.comp || null, bases[chave] || null);
      if (conflitos.length) {
        if (!interativo && location.hash !== '#fluxo') { SY.status = 'conflito'; SY.conflitos = conflitos.length; return; }
        const escolhas = await resolverConflitosFluxo(conflitos, remoto);
        if (!escolhas) { SY.status = 'conflito'; SY.conflitos = conflitos.length; return; }
        comp = aplicarEscolhasFluxo(comp, conflitos, escolhas);
      }
      if (!comp) { SY.status = 'ok'; SY.conferidoEm = Date.now(); return; }
      if (json(comp) !== json(local)) { S.fluxo.competencias[chave] = comp; gravarFluxoLocal(); if (location.hash === '#fluxo') RENDER.fluxo(); }
      if (json(comp) !== json(remoto?.comp)) {
        const fh = await (await dirFluxo()).getFileHandle(nome, { create: true });
        if (lm && (await fh.getFile()).lastModified !== lm) continue;   // alguém gravou enquanto eu mesclava: mescla de novo
        const meta = { atualizadoEm: agoraISO(), atualizadoPor: S.operador || '' };
        const texto = JSON.stringify({ schema: SCHEMA_FLUXO_SYNC, versaoSchema: 1, chave, motor: MOTOR_VERSAO, ...meta, comp });
        const w = await fh.createWritable(); await w.write(texto); await w.close();
        // v3.0: confere o que ficou gravado; se a outra pessoa gravou no mesmo instante, mescla de novo com a versão dela.
        const gravado = await fh.getFile(); if (await gravado.text() !== texto) continue;
        SY.lm = gravado.lastModified; SY.meta = meta;
      } else { SY.lm = lm; SY.meta = remoto ? { atualizadoEm: remoto.atualizadoEm, atualizadoPor: remoto.atualizadoPor } : SY.meta; }
      bases[chave] = comp; gravarLocal(CHAVE_SYNC_BASE, bases);
      SY.status = 'ok'; SY.erro = ''; SY.conflitos = 0; SY.conferidoEm = Date.now();
      return;
    }
    SY.status = 'erro'; SY.erro = 'o arquivo da pasta mudou durante a gravação; tente de novo';
  } catch (e) { SY.status = 'erro'; SY.erro = e.message || String(e); }
  finally { SY.ocupado = false; atualizarBarraSync(); if (SY.pendente) { SY.pendente = false; setTimeout(() => sincronizarFluxo(), 50); } }
}
async function resolverConflitosFluxo(conflitos, remoto) {
  const quem = remoto?.atualizadoPor || 'outra pessoa';
  const r = await dialogo(`${conflitos.length} item(ns) mudados pelos dois`, `<p class="small">Você e ${esc(quem)} mudaram os mesmos itens desde a última sincronização. Escolha qual versão fica; nas etapas, o histórico das duas é guardado.</p>
    ${conflitos.map((c, i) => `<div class="sy-conf"><b>${esc(c.rotulo)}</b>
      <label class="small"><input type="radio" name="c${i}" value="local" checked> A minha: ${esc(resumoValorFluxo(c.local))}</label>
      <label class="small"><input type="radio" name="c${i}" value="remoto"> A de ${esc(quem)}: ${esc(resumoValorFluxo(c.remoto))}</label></div>`).join('')}`, [['', 'Decidir depois', 'sec'], ['ok', 'Aplicar escolhas']]);
  return r.botao === 'ok' ? conflitos.map((c, i) => r.campos[`c${i}`] === 'remoto' ? 'remoto' : 'local') : null;
}
function iniciarTimerSync() {
  clearInterval(SY.timer); if (!SY.handle) return;
  SY.timer = setInterval(async () => {
    if (document.visibilityState !== 'visible' || SY.ocupado || SY.status === 'permissao') return atualizarBarraSync();
    try { if (typeof checarEqPasta === 'function') checarEqPasta(); const f = await (await (await dirFluxo()).getFileHandle(arquivoSync(S.comp))).getFile(); if (f.lastModified !== SY.lm) return sincronizarFluxo(); }
    catch (e) { if (e.name === 'NotFoundError' && S.fluxo.competencias[S.comp]) return sincronizarFluxo(); }
    atualizarBarraSync();
  }, 30000);
}

// Toda gravação do Fluxo agenda a sincronização (sem esperar).
const gravarFluxoLocal = salvarFluxo;
let syncAgendada = 0;
salvarFluxo = function (msg = '') { gravarFluxoLocal(msg); if (SY.handle && SY.status !== 'permissao') { clearTimeout(syncAgendada); syncAgendada = setTimeout(() => sincronizarFluxo(), 800); } };

/* ---------- Barra de sincronização ---------- */
function barraSync() {
  const pasta = SY.handle ? `${esc(SY.handle.name)}${SY.legado ? '' : '\\' + esc(SY.nomeFluxo || PASTAS_RAIZ.fluxo.nome)}\\${esc(arquivoSync(S.comp))}` : '';
  const ha = ms => { const s = Math.round((Date.now() - ms) / 1000); return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`; };
  if (!SY.handle) return `<div class="sy-barra off" id="fxSync"><span class="sy-dot"></span><b>Fluxo só neste navegador.</b><span class="muted">Para trabalhar junto com outra pessoa, conecte a pasta raiz do aplicativo na rede (no Início).</span><span class="sy-esp"></span>${suportaPasta() ? '<button class="sec mini" data-sy="escolher">Conectar a pasta raiz…</button>' : '<span class="small muted">Use o Edge ou o Chrome no computador para conectar.</span>'}</div>`;
  const ult = SY.meta?.atualizadoEm ? ` · última mudança de <b>${esc(SY.meta.atualizadoPor || '—')}</b> às ${new Date(SY.meta.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';
  const bt = `<button class="sec mini" data-sy="agora">Atualizar agora</button><button class="sec mini" data-sy="escolher">Trocar pasta raiz…</button><button class="sec mini" data-sy="desconectar">Desconectar</button>`;
  if (SY.status === 'permissao') return `<div class="sy-barra warn" id="fxSync"><span class="sy-dot"></span><b>Acesso à pasta ${esc(SY.handle.name)} precisa ser liberado.</b><span class="muted">O Edge pede uma vez por sessão (ou marque «permitir sempre»).</span><span class="sy-esp"></span><button class="mini" data-sy="liberar">Liberar acesso</button>${bt}</div>`;
  if (SY.status === 'erro') return `<div class="sy-barra warn" id="fxSync"><span class="sy-dot"></span><b>Sem acesso à pasta</b><span class="muted">— mudanças guardadas neste navegador; vão para a pasta quando voltar (${esc(SY.erro)}).</span><span class="sy-esp"></span><button class="mini" data-sy="agora">Tentar de novo</button>${bt}</div>`;
  if (SY.status === 'conflito') return `<div class="sy-barra warn" id="fxSync"><span class="sy-dot"></span><b>${SY.conflitos} item(ns) mudados pelos dois.</b><span class="muted">Escolha qual versão fica.</span><span class="sy-esp"></span><button class="mini" data-sy="resolver">Resolver</button>${bt}</div>`;
  return `<div class="sy-barra ok" id="fxSync"><span class="sy-dot"></span><b>${SY.ocupado ? 'Sincronizando…' : 'Sincronizado'}</b> com <code>${pasta}</code><span class="muted">${SY.conferidoEm ? ` · conferido há ${ha(SY.conferidoEm)}` : ''}${ult}</span><span class="sy-esp"></span>${bt}</div>`;
}
function ligarBarraSync(raiz) {
  raiz.querySelectorAll('[data-sy]').forEach(b => b.onclick = async () => {
    const a = b.dataset.sy;
    if (a === 'escolher') return escolherPastaSync();
    if (a === 'desconectar') { if (await confirmar('Desconectar da pasta?', 'O Fluxo continua neste navegador; a pasta e o arquivo não são apagados.', 'Desconectar')) definirPastaSync(null); return; }
    if (a === 'liberar') { if (await temPermissaoPasta(true)) { iniciarTimerSync(); await sincronizarFluxo({ interativo: true }); await sincronizarEq({ interativo: true }); if (location.hash === '#inicio' || !location.hash) RENDER.inicio(); return; } return avisar('O acesso à pasta não foi liberado.', 'warn'); }
    sincronizarFluxo({ interativo: true });
  });
}
function atualizarBarraSync() { const b = $('fxSync'); if (!b) return; b.outerHTML = barraSync(); ligarBarraSync($('fxSync').parentElement); }

/* ---------- Divisão do trabalho ---------- */
// Unidade × grupo: USG e IMG nas unidades com nome do Apolo; Curitiba nas unidades V3.
function celulasDivisao() {
  const ctl = S.apolo ? controleAtual() : null, cel = [];
  for (const u of S.cfg.unidades.filter(x => (x.apolo || []).length).sort((a, b) => +a.cod - +b.cod))
    for (const g of ehUnidadeV3(S.cfg, u.cod) ? ['curitiba'] : ['usg', 'img']) {
      const G = ctl?.unidades.find(x => x.cod === String(u.cod))?.grupos.find(x => x.grupo === g);
      cel.push({ un: String(u.cod), nome: u.nome, gr: g, resumo: G ? { falta: G.resumo.falta, gerar: G.resumo.gerar, conferindo: G.resumo.conferidos, aceitos: G.resumo.aceitos, laudaram: G.resumo.laudaram } : null });
    }
  return cel;
}
// Quem está com a unidade grava o resumo dela na pasta (os outros não têm as conferências dele).
function atualizarResumosDivisao(comp) {
  if (!comp?.divisao || !S.operador) return false;
  let mudou = false;
  for (const c of celulasDivisao()) {
    const d = comp.divisao[chaveDivisao(c.un, c.gr)];
    if (!c.resumo || !d || d.por !== S.operador || d.status === 'livre') continue;
    const { em, por, ...ant } = d.resumo || {};
    if (json(ant) !== json(c.resumo)) { d.resumo = { ...c.resumo, em: agoraISO(), por: S.operador }; mudou = true; }
  }
  return mudou;
}
function cartaoDivisao(comp) {
  if (atualizarResumosDivisao(comp)) salvarFluxo();
  const hora = iso => { const d = new Date(iso), hoje = isoDia(new Date()) === iso.slice(0, 10); return `${hoje ? 'hoje' : d.toLocaleDateString('pt-BR').slice(0, 5)} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`; };
  const cels = celulasDivisao().map(c => {
    const d = comp.divisao?.[chaveDivisao(c.un, c.gr)], st = d?.status || 'livre', meu = d?.por === S.operador;
    const r = (st !== 'livre' && !meu && d?.resumo) ? d.resumo : (c.resumo || d?.resumo);
    const falta = r ? (r.falta ? `faltam ${r.falta}${r.gerar ? ` · ${r.gerar} a gerar no MV` : ''}${r.conferindo ? ` · ${r.conferindo} conferindo` : ''}` : (r.laudaram ? 'todos com aceite' : 'sem laudos')) + (r.por && r.por !== S.operador ? ` <span class="muted">(resumo de ${esc(r.por)})</span>` : '') : '<span class="muted">carregue a planilha de laudos para ver o que falta</span>';
    const cls = st === 'concluida' ? 'ok' : st === 'assumida' ? (meu ? 'eu' : 'outro') : '';
    const quem = st === 'concluida' ? `Concluída por ${esc(d.por)}` : st === 'assumida' ? (meu ? 'Você' : esc(d.por)) : 'Livre';
    const acoes = st === 'livre' ? `<button class="mini" data-dv="assumir">Assumir</button>` : st === 'assumida' ? (meu ? `<button class="sec mini" data-dv="liberar">Liberar</button><button class="${r && !r.falta && r.laudaram ? '' : 'sec '}mini" data-dv="concluir">Concluir</button>` : `<button class="sec mini" data-dv="assumir">Assumir eu</button>`) : `<button class="sec mini" data-dv="reabrir">Reabrir</button>`;
    return `<div class="dv-cel ${cls}" data-dvk="${c.un}|${c.gr}"><b>Unidade ${esc(c.un)} · ${c.gr === 'curitiba' ? 'Curitiba' : c.gr.toUpperCase()}</b><span class="dv-quem">${quem}</span>
      <small>${st === 'livre' ? '—' : `${st === 'concluida' ? 'concluiu' : 'assumiu'} ${hora(d.em)}`}</small><small>${falta}</small><div class="acoes">${acoes}</div></div>`;
  }).join('');
  const feed = feedFluxo(comp, 8);
  return `<div class="card" id="fxDivisao"><div class="fx-topo"><h2 style="margin:0">Divisão do trabalho <span class="muted small">competência ${rotuloCompetencia(comp.chave)}</span></h2></div>
    <p class="small muted">Quem está com cada unidade. «Assumir» marca o seu nome; os outros veem pela pasta da rede (barra acima). O «faltam» vem de Prestadores por unidade, gravado por quem está com a unidade.</p>
    <div class="dv-quadro">${cels}</div>
    ${feed.length ? `<details class="dv-feed"${FX.feedAberto ? ' open' : ''}><summary>Últimas mudanças</summary>${feed.map(f => `<div><b>${esc(f.por || '—')}</b> ${esc(f.texto)} <small class="muted">· ${hora(f.em)}</small></div>`).join('')}</details>` : ''}</div>`;
}
function ligarDivisao(raiz, comp) {
  raiz.querySelectorAll('[data-dv]').forEach(b => b.onclick = async () => {
    if (!exigirAberta(comp.chave, 'mudar a divisão do trabalho')) return;
    const op = await exigirOperador(); if (!op) return;
    const [un, gr] = b.closest('[data-dvk]').dataset.dvk.split('|'), d = comp.divisao?.[chaveDivisao(un, gr)], a = b.dataset.dv;
    if (a === 'assumir' && d?.status === 'assumida' && d.por !== op && !await confirmar('Assumir a unidade?', `A unidade ${esc(un)} está com ${esc(d.por)}. Ela passa para você, e fica registrado.`, 'Assumir')) return;
    marcarDivisao(comp, un, gr, a === 'assumir' || a === 'reabrir' ? 'assumida' : a === 'concluir' ? 'concluida' : 'livre', op);
    atualizarResumosDivisao(comp); salvarFluxo(); RENDER.fluxo();
  });
  const det = raiz.querySelector('.dv-feed'); if (det) det.ontoggle = () => { FX.feedAberto = det.open; };
}

// Aviso ao escolher uma unidade que está com outra pessoa (não bloqueia).
function avisoDivisao(un, gr) {
  const d = S.fluxo.competencias[S.comp]?.divisao?.[chaveDivisao(un, gr)], k = `${S.comp}|${un}|${gr}`;
  if (!d || d.status !== 'assumida' || !S.operador || d.por === S.operador || SY.aviso.has(k)) return '';
  return `<div class="dv-aviso" data-dvav="${esc(k)}"><b>A unidade ${esc(un)} · ${gr === 'curitiba' ? 'Curitiba' : gr.toUpperCase()} está com ${esc(d.por)}</b> desde ${new Date(d.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. <span class="muted">Você pode continuar (fica registrado) ou combinar com ${esc(d.por)}.</span>
    <div class="acoes"><button class="sec mini" data-dvc="${esc(un)}|${gr}">Continuar mesmo assim</button></div></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-dvc]'); if (!b) return;
  const [un, gr] = b.dataset.dvc.split('|'), comp = S.fluxo.competencias[S.comp], d = comp?.divisao?.[chaveDivisao(un, gr)];
  if (d) { (d.intervencoes ||= []).push({ por: S.operador, em: agoraISO() }); d.intervencoes = d.intervencoes.slice(-20); salvarFluxo(); }
  SY.aviso.add(`${S.comp}|${un}|${gr}`); b.closest('.dv-aviso')?.remove();
});

// Fluxo: barra de sincronização e divisão no topo do acompanhamento.
const _desenharAcompanhamento = desenharAcompanhamento;
desenharAcompanhamento = function () {
  _desenharAcompanhamento();
  const c = $('fxCorpo'), comp = compAtual(); if (!c) return;
  c.insertAdjacentHTML('afterbegin', barraSync()); ligarBarraSync(c);
};
// Subaba «Divisão do trabalho»: barra de sincronização + quadro unidade × grupo + últimas mudanças.
function desenharDivisaoFluxo() {
  const c = $('fxCorpo'), comp = compAtual(); if (!c) return;
  c.innerHTML = barraSync() + (comp ? cartaoDivisao(comp) : `<div class="card"><h2>Competência ${rotuloCompetencia(FX.chave)} ainda não iniciada</h2><p class="lead">Inicie o checklist da competência em «Acompanhamento» para dividir as unidades.</p></div>`);
  ligarBarraSync(c); if (comp) ligarDivisao(c, comp);
}
// Prestadores por unidade e Conferência: aviso da divisão.
const _desenharControleUnidade = desenharControleUnidade;
desenharControleUnidade = async function () {
  await _desenharControleUnidade();
  const alvo = document.querySelector('#pag-conferencia .cu-res'); if (!alvo || !CU.unidade || !CU.grupo) return;
  alvo.insertAdjacentHTML('beforebegin', avisoDivisao(CU.unidade, CU.grupo));
};
document.addEventListener('change', e => {
  if (e.target.id !== 'cfUn' && e.target.id !== 'cfRel') return;
  document.querySelectorAll('#pag-conferencia .dv-aviso').forEach(x => x.remove());
  const un = $('cfUn')?.value, x = S.relatorios.find(r => r.id === $('cfRel')?.value); if (!un || un === '*' || !x) return;
  const gr = ehUnidadeV3(S.cfg, un) ? 'curitiba' : tipoRepasseDaRodada({ descricao: x.rel.cab.descricao, repasse: x.rel.cab.repasse, linhas: x.rel.regs.map(r => ({ grupo: r.grupoNome })) });
  $('cfUn').closest('.campo, label, div')?.insertAdjacentHTML('afterend', avisoDivisao(un, gr));
});
// Ao entrar no Fluxo ou trocar de competência, confere a pasta.
window.addEventListener('hashchange', () => { if (location.hash === '#fluxo' && SY.handle && SY.status !== 'permissao') sincronizarFluxo({ interativo: true }); });
