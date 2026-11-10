/* ============================================================
 * Complementos de tela aplicados depois que TODAS as telas foram definidas (v3.0).
 * Antes, 29-pasta-raiz.js envolvia RENDER.equivalencias antes de 40-equivalencias.js defini-la, e a definição
 * posterior apagava o complemento: a barra de sincronização das equivalências nunca aparecia. Aqui a ordem é garantida.
 * ============================================================ */
// Equivalências: barra de sincronização da base compartilhada (SOL-F37).
const _renderEqSync = RENDER.equivalencias;
RENDER.equivalencias = (...a) => { const r = _renderEqSync(...a); const pg = $('pag-equivalencias'); if (pg && !$('eqSync')) { pg.insertAdjacentHTML('afterbegin', barraEq()); ligarBarraEq(); } return r; };
// Bases e regras = categoria das Configurações: mesmas abas no topo e a barra da configuração compartilhada.
const _renderBasesV3 = RENDER.bases;
RENDER.bases = (...a) => {
  const r = _renderBasesV3(...a), pg = $('pag-bases');
  if (pg && !$('cfgSync')) { pg.insertAdjacentHTML('afterbegin', barraCfg()); ligarBarraCfg(); }
  if (pg && !pg.querySelector('.cfg-abas')) { pg.insertAdjacentHTML('afterbegin', abasConfiguracoes('bases')); ligarAbasConfiguracoes(pg); }
  return r;
};
