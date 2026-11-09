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
  S.restaurando = true;   // o Início mostra «Restaurando…» até as planilhas guardadas voltarem
  window.addEventListener('hashchange', () => irPara(location.hash.slice(1)));
  irPara(location.hash.slice(1) || 'inicio');
  try {
    await carregarBibliotecas();
    // Planilhas de laudos e do Power BI guardadas para a competência (pedido de 04/11/2026).
    await aplicarRetencaoPlanilhas();
    const nRest = await restaurarPlanilhasDaCompetencia(); S.restaurando = false;
    if (nRest) irPara(location.hash.slice(1) || 'inicio', true); else if ((location.hash.slice(1) || 'inicio') === 'inicio') RENDER.inicio();
    restaurarPastaSync();   // Fluxo compartilhado pela pasta da rede (SOL-F36)
    const st = $('stInit'); st.className = 'badge ok'; st.textContent = 'Pronto · processamento local';
  } catch (e) {
    const st = $('stInit'); st.className = 'badge err'; st.textContent = 'Erro ao carregar componentes';
    avisar(`Não foi possível carregar os componentes de leitura de PDF/Excel (${e.message}). Políticas do navegador podem bloquear scripts em arquivos locais.`, 'err');
  }
  window.__RM = { S, irPara, t: { calcularV3, textoEmailV3, regraV3Padrao, conferirCruzado, dbGravar, parcelaDoMes, ultimaCompetenciaDesconto, historicoDesconto, coberturaCompetencia, fechamentoAtual: () => fechamentoAtual(), regraV3Fixa, diaSerial, novaComposta, alterarStatusComposta, avaliarProcedimento, indiceEquivalencias, conciliarLaudo, valorEsperadoIMG, regraComposta, simularComposta, efetividadeCompostas, controlePrestadoresUnidade, laudoNaRegraV3, mesclarFluxo, aplicarEscolhasFluxo, novaRelacao, alterarStatusEq, causasDaConferencia, corrigirPrestador, mesclarEq, sincronizarEq, atualizarDaPasta, criarEstrutura: c => criarEstrutura(c), verificarEstrutura, syncEqEstado: () => ({ status: SYQ.status, erro: SYQ.erro }), definirPastaSync, sincronizarFluxo, salvarFluxo: m => salvarFluxo(m), mudarStatusTarefa, marcarDivisao, syncEstado: () => ({ status: SY.status, erro: SY.erro, conflitos: SY.conflitos, pasta: !!SY.handle }), registroRodada, guardarRodada, usoEquivalencias, impactoTirarValidacao } };   // usado pelos testes automatizados
})();
