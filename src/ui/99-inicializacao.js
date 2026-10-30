/* ============================================================
 * Inicialização
 * ============================================================ */
(async () => {
  aplicarTema();
  S.cfg = lerLocal(CHAVES.cfg);
  if (!S.cfg || validarConfig(S.cfg).length) { S.cfg = configPadrao(); gravarLocal(CHAVES.cfg, S.cfg); }
  else if (migrarConfig(S.cfg)) gravarLocal(CHAVES.cfg, S.cfg);
  S.eq = lerLocal(CHAVES.eq);
  if (!S.eq || validarEq(S.eq).length) { S.eq = eqVazia(); gravarLocal(CHAVES.eq, S.eq); }
  S.operador = lerLocal(CHAVES.operador) || '';
  carregarCompetencia(); carregarFluxo(); carregarNC();
  iniciarMenu(); mostrarOperador(); atualizarNavPendencias(); atualizarNavFluxo(); atualizarNavNC();
  $('operadorTopo').onclick = () => { S.operador = ''; exigirOperador(); };
  $('operadorTopo').style.cursor = 'pointer'; $('operadorTopo').title = 'Clique para trocar o operador';
  await abrirDB(); S.rodadas = await dbTodas();
  window.addEventListener('hashchange', () => irPara(location.hash.slice(1)));
  irPara(location.hash.slice(1) || 'inicio');
  try {
    await carregarBibliotecas();
    const st = $('stInit'); st.className = 'badge ok'; st.textContent = 'Pronto · processamento local';
  } catch (e) {
    const st = $('stInit'); st.className = 'badge err'; st.textContent = 'Erro ao carregar componentes';
    avisar(`Não foi possível carregar os componentes de leitura de PDF/Excel (${e.message}). Políticas do navegador podem bloquear scripts em arquivos locais.`, 'err');
  }
  window.__RM = { S, irPara };   // usado pelos testes automatizados
})();
