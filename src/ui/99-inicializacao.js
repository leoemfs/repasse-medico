/* ============================================================
 * Inicialização
 * ============================================================ */
(async () => {
  await abrirKV();   // valores guardados no IndexedDB entram antes da primeira leitura (v3.0)
  aplicarTema();
  S.cfg = lerLocal(CHAVES.cfg);
  // Instalação nova também recebe as migrações (ex.: cadastro padrão dos médicos da V3, SOL-F46); antes só a configuração antiga recebia.
  if (!S.cfg || validarConfig(S.cfg).length) { S.cfg = configPadrao(); migrarConfig(S.cfg); gravarLocal(CHAVES.cfg, S.cfg); }
  else if (migrarConfig(S.cfg)) gravarLocal(CHAVES.cfg, S.cfg);
  aplicarPastasConfig(); aplicarRegrasConfig(S.cfg);   // nomes das pastas configurados (v3.0)
  S.eq = lerLocal(CHAVES.eq);
  if (!S.eq || validarEq(S.eq).length) { S.eq = eqVazia(); gravarLocal(CHAVES.eq, S.eq); }
  else if (aplicarCobertas(S.eq, '', S.comp)) gravarLocal(CHAVES.eq, S.eq);   // base gravada antes de a cobertura ir para o salvarEq (P2)
  S.operador = lerLocal(CHAVES.operador) || '';
  carregarCompetencia(); carregarFluxo(); carregarNC();
  iniciarMenu(); mostrarOperador(); atualizarNavPendencias(); atualizarNavFluxo(); atualizarNavNC();
  $('operadorTopo').onclick = () => { S.operador = ''; exigirOperador(); };
  $('operadorTopo').style.cursor = 'pointer'; $('operadorTopo').title = 'Clique para trocar o operador';
  S.usoEq = lerLocal(CHAVES.usoEq) || usoEqVazio();
  // SOL-F50: o uso das equivalências é tirado das rodadas ANTES de a retenção resumir as antigas (o resumo guarda o histórico).
  await abrirDB(); if (DB.ok) { const todas = await dbTodas(), u = atualizarUsoComRodadas(S.usoEq, todas, S.eq); if (u.mudou) { S.usoEq = u.uso; gravarLocal(CHAVES.usoEq, S.usoEq); } await reterRodadas(null, todas); } S.rodadas = await dbRodadasJanela();
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
    iniciarVerificacaoAtualizacao();   // aviso de versão nova publicada (v3.0)
    const st = $('stInit'); st.className = 'badge ok'; st.textContent = 'Pronto · processamento local';
  } catch (e) {
    const st = $('stInit'); st.className = 'badge err'; st.textContent = 'Erro ao carregar componentes';
    avisar(`Não foi possível carregar os componentes de leitura de PDF/Excel (${e.message}). Políticas do navegador podem bloquear scripts em arquivos locais.`, 'err');
  }
  window.__RM = { S, irPara, t: { guardarRodada: r => guardarRodada(r), registroRodada, usoEquivalencias, impactoTirarValidacao, resumoUsoDaRodada, mesclarUsoEq, atualizarUsoComRodadas, sincronizarUsoEq: () => sincronizarUsoEq(), afinidadeTitulo, criarXlsx, lancarDescontoMes, lembreteReajuste, marcarReajusteFeito, validarDesconto, interpretarPlanilhaControle, pctUSGEsperado, migrarRegras, aplicarCadastroV3Padrao, migrarConfig, hmV3Situacao, avisosConferenciaV3, modalidadeDoTituloV3, laudaV3Producao, medicosProducaoV3, calcularV3, textoEmailV3, regraV3Padrao, conferirCruzado, dbGravar, parcelaDoMes, ultimaCompetenciaDesconto, historicoDesconto, coberturaCompetencia, fechamentoAtual: () => fechamentoAtual(), regraV3Fixa, diaSerial, novaComposta, alterarStatusComposta, avaliarProcedimento, indiceEquivalencias, conciliarLaudo, valorEsperadoIMG, regraComposta, simularComposta, efetividadeCompostas, controlePrestadoresUnidade, laudoNaRegraV3, mesclarFluxo, aplicarEscolhasFluxo, novaRelacao, alterarStatusEq, causasDaConferencia, corrigirPrestador, mesclarEq, sincronizarEq, atualizarDaPasta, criarEstrutura: c => criarEstrutura(c), verificarEstrutura, syncEqEstado: () => ({ status: SYQ.status, erro: SYQ.erro }), definirPastaSync, sincronizarFluxo, salvarFluxo: m => salvarFluxo(m), mudarStatusTarefa, marcarDivisao, syncEstado: () => ({ status: SY.status, erro: SY.erro, conflitos: SY.conflitos, pasta: !!SY.handle }),
    sincronizarCfg, salvarCfg: m => salvarCfg(m), salvarEq: m => salvarEq(m), syncCfgEstado: () => ({ status: SYC.status, erro: SYC.erro, conflitos: SYC.conflitos }), mesclarCfg, classeDaLinhaConf, totaisPorClasse, candidatoDaLinhaConferencia, dadosDoCandidato, registrarNCs, indiceDecisoes, estadoCompetencia, classeDaLinhaRodada, chaveMVDecisao, chaveMVBase, decisaoDaLinha, normalizarChavesRodada, escopoCandidatosNC, compactarCandidatosNC, verificarEstrutura: c => verificarEstrutura(c), criarEstruturaAno: a => criarEstruturaAno(a), entregarArquivo: (...a) => entregarArquivo(...a), aplicarRetencaoObservacoes, estadoCompetenciaObs: c => estadoCompetencia(window.__RM.S.compReg, c).observacoes, modalidadesDoGrupo, hmV3Devido, unidadeDoArquivoCorrecao: (n, p) => unidadeDoArquivoCorrecao(n, p), estruturaCompetencia: c => estruturaCompetencia(c), expandirCandidatoNC, resultadoFiltrado, xlsxConferencia, dbTodas: () => dbTodas(), dbRodadasJanela: (c, s) => dbRodadasJanela(c, s), mudarCompetencia: c => mudarCompetencia(c), situacaoCorrecoesMV, montarBackup, validarBackup, partesAtuaisBackup, restaurarBackup, gravarBackupPasta, listarBackupsPasta, versaoMaior, colunasDoModelo, xlsxConferencia, indiceNomes, titulosDoApolo: (...a) => titulosDoApolo(...a), retrospectivaDe: c => retrospectivaDe(c), backlogDaCompetencia, diasUteisEntre, sugerirCodigos: (...a) => sugerirCodigos(...a), KV } };   // usado pelos testes automatizados
})();
