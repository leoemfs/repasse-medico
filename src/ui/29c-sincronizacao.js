/* ============================================================
 * Sincronização pela pasta raiz — orquestração única (v3.0.0-alpha.11, P2 da auditoria de 16/11/2026).
 * As três bases compartilhadas têm a sua leitura/mescla/gravação no próprio arquivo:
 *   Fluxo mensal → 28-fluxo-sync.js (SY) · Equivalências → 29-pasta-raiz.js (SYQ) · Configuração → 29b-cfg-sync.js (SYC).
 * Aqui fica o que é comum às três, chamado explicitamente (antes, cada arquivo redefinia salvarCfg, salvarEq,
 * salvarFluxo e restaurarPastaSync por cima do anterior, e o resultado dependia da ordem dos arquivos):
 *   - agendarSincronizacao(tipo): toda gravação (salvarCfg, salvarEq, salvarFluxo) agenda a da sua base;
 *   - sincronizarTudo, liberarPastaSync, definirPastaSync, restaurarPastaSync e o relógio de checagem.
 * ============================================================ */
const AGENDA_SYNC = { fluxo: 0, eq: 0, cfg: 0 };
const SYNC_DE = { fluxo: () => sincronizarFluxo(), eq: () => sincronizarEq(), cfg: () => sincronizarCfg() };
// Pode agendar: há pasta e acesso; Equivalências e Configuração não vão para a pasta antiga do Fluxo («legado»).
function podeSincronizar(tipo) {
  if (!SY.handle) return false;
  if (tipo === 'fluxo') return SY.status !== 'permissao';
  if (SY.legado) return false;
  return (tipo === 'eq' ? SYQ : SYC).status !== 'permissao';
}
function agendarSincronizacao(tipo) {
  if (!podeSincronizar(tipo)) return;
  clearTimeout(AGENDA_SYNC[tipo]); AGENDA_SYNC[tipo] = setTimeout(() => SYNC_DE[tipo](), 800);
}
async function sincronizarTudo(opc = {}) { await sincronizarFluxo(opc); await sincronizarEq(opc); await sincronizarCfg(opc); }
// Botões «Liberar acesso» (Início, Fluxo, Configurações): mesma ação nos três lugares.
async function liberarPastaSync() {
  if (!(await temPermissaoPasta(true))) { avisar('O acesso à pasta não foi liberado.', 'warn'); return false; }
  SY.status = 'ok'; iniciarTimerSync(); await sincronizarTudo({ interativo: true });
  return true;
}
async function definirPastaSync(handle) {
  SY.handle = handle; SY.lm = 0; SY.meta = null; SY.legado = ehPastaLegadaFluxo(handle); SYQ.lm = 0; SYQ.status = handle ? 'ok' : 'off';
  if (handle) await dbSync('gravar', handle).catch(() => {}); else await dbSync('apagar').catch(() => {});
  iniciarTimerSync();
  if (handle) await sincronizarTudo({ interativo: true });
  else { SY.status = 'off'; SYC.status = 'off'; atualizarBarraSync(); }
  if (location.hash === '#inicio' || !location.hash) RENDER.inicio();
}
// Ao abrir: volta a pasta guardada, sincroniza as três bases, lê a pasta da competência e faz o backup do dia.
async function restaurarPastaSync() {
  try {
    const h = await dbSync('ler'); if (!h) return;
    SY.handle = h; SY.legado = ehPastaLegadaFluxo(h); SY.status = await temPermissaoPasta() ? 'ok' : 'permissao'; iniciarTimerSync();
    if (SY.status === 'ok') {
      await sincronizarTudo();
      if (S.cfg.parametros.lerPastaAoAbrir !== false) atualizarDaPasta({ silencioso: true });
      setTimeout(() => backupAutomaticoDiario().catch(() => {}), 3000);
    } else atualizarBarraSync();
    if (location.hash === '#inicio' || !location.hash) RENDER.inicio();
  } catch (e) { /* sem pasta guardada */ }
}
// A cada 30 s, com a janela visível: as três bases conferem se o arquivo da pasta mudou.
function iniciarTimerSync() {
  clearInterval(SY.timer); if (!SY.handle) return;
  SY.timer = setInterval(async () => {
    if (document.visibilityState !== 'visible' || SY.ocupado || SY.status === 'permissao') return atualizarBarraSync();
    checarEqPasta(); checarCfgPasta();
    try { const f = await (await (await dirFluxo()).getFileHandle(arquivoSync(S.comp))).getFile(); if (f.lastModified !== SY.lm) return sincronizarFluxo(); }
    catch (e) { if (e.name === 'NotFoundError' && S.fluxo.competencias[S.comp]) return sincronizarFluxo(); }
    atualizarBarraSync();
  }, 30000);
}
