/* ============================================================
 * Planilhas guardadas por competência (pedido de 04/11/2026)
 * A planilha de laudos (Apolo) e a do Power BI ficam guardadas neste navegador para a competência:
 * ao recarregar ou voltar, já estão carregadas. Guardar é opcional (padrão: sim) e trocar é só
 * carregar outra (ex.: Power BI atualizado no meio do mês).
 * Privacidade: guarda-se o que a ferramenta leu, não o arquivo original — o CPF do Power BI nunca é
 * lido nem guardado. Têm nomes de pacientes: seguem a retenção das NCs (60 dias) e saem sozinhas depois.
 * ============================================================ */
const TIPOS_GUARDADOS = { apolo: 'planilha de laudos (Apolo)', pbi: 'planilha do Power BI' };
const chaveGuardada = (tipo, comp = S.comp) => `${comp}|${tipo}`;
const guardarPlanilhasAtivo = tipo => S.cfg.parametros.guardarPlanilhas?.[tipo] !== false;
function dbArquivo(op, valor) {
  if (!DB.ok || !DB.db.objectStoreNames.contains('arquivos')) return Promise.resolve(op === 'todas' ? [] : null);
  return new Promise(res => {
    const modo = op === 'get' || op === 'todas' ? 'readonly' : 'readwrite', tx = DB.db.transaction('arquivos', modo), st = tx.objectStore('arquivos');
    const rq = op === 'get' ? st.get(valor) : op === 'todas' ? st.getAll() : op === 'put' ? st.put(valor) : st.delete(valor);
    rq.onsuccess = () => res(op === 'get' || op === 'todas' ? (rq.result || (op === 'todas' ? [] : null)) : true);
    rq.onerror = () => res(op === 'todas' ? [] : null);
  });
}
// Cópia só com o que a ferramenta usa (sem bytes do arquivo original).
function copiaParaGuardar(obj) { const c = {}; for (const k of Object.keys(obj)) c[k] = obj[k]; return c; }
async function guardarPlanilha(tipo, obj) {
  if (!guardarPlanilhasAtivo(tipo)) return false;
  const reg = { id: chaveGuardada(tipo), comp: S.comp, tipo, nome: obj.nome, tamanho: obj.tamanho || 0, em: agoraISO(), por: S.operador || '', dados: copiaParaGuardar(obj) };
  const ok = await dbArquivo('put', reg);
  if (ok) obj.guardada = { em: reg.em, por: reg.por, comp: S.comp };
  else avisar(`Não foi possível guardar a ${TIPOS_GUARDADOS[tipo]} neste navegador: ela fica só nesta sessão.`, 'warn');
  return ok;
}
async function removerPlanilhaGuardada(tipo, comp = S.comp) {
  await dbArquivo('del', chaveGuardada(tipo, comp));
  const obj = tipo === 'apolo' ? S.apolo : S.pbi; if (obj?.guardada?.comp === comp) delete obj.guardada;
}
// Carrega as planilhas guardadas da competência do topo (troca as da sessão se forem de outra competência).
async function restaurarPlanilhasDaCompetencia() {
  let n = 0;
  for (const tipo of Object.keys(TIPOS_GUARDADOS)) {
    const atual = tipo === 'apolo' ? S.apolo : S.pbi;
    if (atual?.guardada?.comp === S.comp) continue;
    const reg = await dbArquivo('get', chaveGuardada(tipo));
    if (!reg?.dados) continue;
    const obj = reg.dados; obj.guardada = { em: reg.em, por: reg.por, comp: reg.comp };
    if (tipo === 'apolo') S.apolo = obj; else S.pbi = obj;
    n++;
  }
  return n;
}
// Retenção: planilhas guardadas há mais dias que o prazo das NCs saem do navegador.
async function aplicarRetencaoPlanilhas() {
  const dias = +S.cfg.parametros.retencaoNC || RETENCAO_NC_PADRAO, hoje = new Date();
  let n = 0;
  for (const r of await dbArquivo('todas')) if (idadeDias(r.em, hoje) > dias) { await dbArquivo('del', r.id); n++; }
  return n;
}
// Linha de estado no cartão do Início: guardada desde quando, com as ações.
function estadoGuardada(tipo, obj) {
  if (!obj) return '';
  const g = obj.guardada;
  return `<div class="guardada small">${g ? `💾 Guardada nesta competência desde ${new Date(g.em).toLocaleString('pt-BR')}${g.por ? ` · ${esc(g.por)}` : ''}. Para trocar, carregue outra. <button class="sec mini" data-desguardar="${tipo}">Remover da competência</button>`
    : `<span class="muted">Só nesta sessão (some ao recarregar).</span> <button class="sec mini" data-guardar="${tipo}">Guardar nesta competência</button>`}
    <span class="small muted" style="display:block;margin-top:4px">Guardar automaticamente ao carregar: <b>${guardarPlanilhasAtivo(tipo) ? 'sim' : 'não'}</b> · <a href="#configuracoes" data-cfg-ir="conferencia">mudar em Configurações</a></span></div>`;
}
function ligarPlanilhasGuardadas(raiz) {
  raiz.querySelectorAll('[data-desguardar]').forEach(b => b.onclick = async () => {
    const tipo = b.dataset.desguardar;
    if (!await confirmar('Remover da competência?', `A ${TIPOS_GUARDADOS[tipo]} deixa de ficar guardada para ${rotuloCompetencia(S.comp)}. Ela continua carregada até você recarregar a página.`, 'Remover')) return;
    await removerPlanilhaGuardada(tipo); avisar(`${TIPOS_GUARDADOS[tipo]} removida da competência ${rotuloCompetencia(S.comp)}.`, 'ok'); RENDER.inicio();
  });
  raiz.querySelectorAll('[data-guardar]').forEach(b => b.onclick = async () => {
    const tipo = b.dataset.guardar, obj = tipo === 'apolo' ? S.apolo : S.pbi; if (!obj) return;
    const ativo = S.cfg.parametros.guardarPlanilhas || {}; const antes = ativo[tipo];
    S.cfg.parametros.guardarPlanilhas = { ...ativo, [tipo]: true };
    if (await guardarPlanilha(tipo, obj)) avisar(`${TIPOS_GUARDADOS[tipo]} guardada para ${rotuloCompetencia(S.comp)}.`, 'ok');
    S.cfg.parametros.guardarPlanilhas[tipo] = antes; RENDER.inicio();
  });
  raiz.querySelectorAll('[data-cfg-ir]').forEach(a => a.onclick = () => { CF.sub = a.dataset.cfgIr; });   // v3.0: a opção fica em Configurações
}
