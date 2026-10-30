/* ============================================================
 * Configurações: operador, parâmetros, tema, backup e dados locais
 * ============================================================ */
RENDER.configuracoes = () => {
  const p = S.cfg.parametros, tema = lerLocal(CHAVES.tema) || 'auto';
  $('pag-configuracoes').innerHTML = `
  <div class="grid2">
    <div class="card"><h2>Operador</h2><p class="lead">Nome registrado nas validações, aliases, aceites e rodadas.</p>
      <label class="campo">Nome<input type="text" id="cfgOp" value="${esc(S.operador)}"></label><div class="acoes"><button id="cfgOpSalvar">Salvar</button></div></div>
    <div class="card"><h2>Aparência</h2><label class="campo">Tema<select id="cfgTema">${opcoes([['auto', 'Automático (sistema)'], ['light', 'Claro'], ['dark', 'Escuro']], tema)}</select></label></div>
  </div>
  <div class="card"><h2>Parâmetros de conferência</h2><p class="lead">Padrões usados ao abrir as análises; cada rodada registra o valor efetivamente usado.</p>
    <div class="grid4">
      <label class="campo">Tolerância — conferência (dias)<input type="number" id="pTolC" min="0" max="60" value="${p.tolConferencia}"><span class="small muted">Data diferente na tolerância = «com ressalva».</span></label>
      <label class="campo">Tolerância — correção de prestador (dias)<input type="number" id="pTolP" min="0" max="60" value="${p.tolCorrecao}"><span class="small muted">0 = mesma data (recomendado).</span></label>
      <label class="campo">Truncamento mínimo do nome (caracteres)<input type="number" id="pTrunc" min="10" max="60" value="${p.minTruncamento}"><span class="small muted">Prefixo no meio de palavra só conta a partir deste tamanho.</span></label>
      <label class="campo">Valor simbólico até (R$)<input type="number" id="pSimb" min="0" step="0.01" value="${p.valorSimbolico}"><span class="small muted">Só marca a linha; não muda a categoria.</span></label>
      <label class="campo">Retenção dos dados de pacientes nas NCs (dias)<input type="number" id="pRet" min="1" max="366" value="${p.retencaoNC ?? RETENCAO_NC_PADRAO}"><span class="small muted">Depois desse prazo, nome e ID/atendimento são apagados; o resto da NC fica para os indicadores.</span></label></div>
    <div class="acoes"><button id="pSalvar">Salvar parâmetros</button></div></div>
  <div class="card"><h2>Regras financeiras</h2><p class="lead">Percentuais de USG por prestador e unidade, classes A/B/C/D, valores fixos por laudo, vigências e descontos estão especificados (RN-180, RN-183), mas <strong>não estão ativos nesta versão</strong>. Nenhum valor é calculado: a conferência é de existência e consistência.</p></div>
  <div class="card"><h2>Backup e dados locais</h2>
    <p class="lead">Configuração e equivalências ficam no armazenamento deste navegador; as rodadas, no IndexedDB. Arquivos de backup contêm a configuração, a base de equivalências e o fluxo mensal (sem dados de pacientes); o histórico de rodadas pode ser incluído.</p>
    <dl class="kv"><dt>Configuração</dt><dd>revisão ${S.cfg.revisao} · ${S.cfg.unidades.length} unidades · ${S.cfg.prestadores.length} prestadores · ${S.cfg.classificacao.length} regras</dd>
      <dt>Equivalências</dt><dd>revisão ${S.eq.revisao} · ${S.eq.itens.length} relações</dd><dt>Fluxo mensal</dt><dd>modelo rev. ${S.fluxo.modelo.revisao} · ${Object.keys(S.fluxo.competencias).length} competência(s)</dd><dt>Não conformidades</dt><dd>${S.nc.itens.length} NC(s) · retenção de ${retencaoNC()} dias para dados de pacientes</dd><dt>Rodadas</dt><dd>${S.rodadas.length} ${DB.ok ? '(IndexedDB)' : '(só nesta sessão)'}</dd></dl>
    <div class="acoes"><button id="bkExp">Exportar backup (.json)</button><label class="small"><input type="checkbox" id="bkRod"> incluir rodadas</label><label class="small"><input type="checkbox" id="bkNC"> incluir não conformidades (contém nomes de pacientes)</label><button id="bkImp" class="sec">Restaurar backup</button><input type="file" id="bkArq" accept=".json" hidden>
      <button id="bkDesfazerEq" class="sec">Desfazer última substituição de equivalências</button><button id="bkApagar" class="perigo">Apagar todos os dados locais</button></div></div>
  <div class="card"><h2>Sobre</h2><dl class="kv"><dt>Versão</dt><dd>${MOTOR_VERSAO} (alpha)</dd><dt>Especificação</dt><dd>Documentação v1.6 — RN-178 a RN-215</dd><dt>Bibliotecas</dt><dd>pdf.js (Apache-2.0) e JSZip (MIT/GPLv3), embutidas</dd></dl></div>`;
  $('cfgOpSalvar').onclick = () => { S.operador = $('cfgOp').value.trim(); gravarLocal(CHAVES.operador, S.operador); mostrarOperador(); avisar('Operador salvo.', 'ok'); };
  $('cfgTema').onchange = e => { gravarLocal(CHAVES.tema, e.target.value); aplicarTema(); };
  $('pSalvar').onclick = () => {
    const n = { tolConferencia: +$('pTolC').value, tolCorrecao: +$('pTolP').value, minTruncamento: +$('pTrunc').value, valorSimbolico: +$('pSimb').value, retencaoNC: +$('pRet').value };
    if (Object.values(n).some(v => !Number.isFinite(v) || v < 0) || n.retencaoNC < 1 || n.retencaoNC > 366) return avisar('Valores inválidos (retenção: 1 a 366 dias).', 'err');
    S.cfg.parametros = n; salvarCfg('Parâmetros salvos.');
    const apagadas = aplicarRetencaoNC(S.nc, n.retencaoNC); if (apagadas) { salvarNC(); avisar(`Parâmetros salvos. ${apagadas} NC(s) passaram do novo prazo: dados de pacientes apagados.`, 'ok'); }
  };
  $('bkExp').onclick = async () => baixarJSON({ schema: SCHEMA_BACKUP, versaoSchema: 1, exportadoEm: agoraISO(), motor: MOTOR_VERSAO, configuracao: S.cfg, equivalencias: S.eq, fluxo: S.fluxo, nc: $('bkNC').checked ? S.nc : undefined, rodadas: $('bkRod').checked ? await dbTodas() : undefined }, `backup_repasse_medico_${carimbo()}.json`);
  $('bkImp').onclick = () => $('bkArq').click();
  $('bkArq').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const b = JSON.parse(await f.text());
      if (b.schema !== SCHEMA_BACKUP) throw new Error('não é um backup do Repasse Médico');
      const erros = [...validarConfig(b.configuracao), ...validarEq(b.equivalencias)];
      if (erros.length) throw new Error(erros.join('; '));
      if (!await confirmar('Restaurar backup?', `Configuração rev. ${b.configuracao.revisao} e equivalências rev. ${b.equivalencias.revisao} (${b.equivalencias.itens.length} relações) substituirão as atuais. Uma cópia das atuais será guardada.`, 'Restaurar')) return;
      backupAntesDeSubstituir(CHAVES.cfgAnterior, S.cfg); backupAntesDeSubstituir(CHAVES.eqAnterior, S.eq);
      S.cfg = b.configuracao; S.eq = b.equivalencias; salvarCfg(); salvarEq();
      if (b.fluxo && !validarFluxo(b.fluxo).length) { backupAntesDeSubstituir(CHAVES.fluxoAnterior, S.fluxo); S.fluxo = b.fluxo; salvarFluxo(); }
      if (b.nc && !validarNC(b.nc).length) { backupAntesDeSubstituir(CHAVES.ncAnterior, S.nc); S.nc = b.nc; aplicarRetencaoNC(S.nc, retencaoNC()); salvarNC(); }
      if (migrarConfig(S.cfg)) salvarCfg();
      if (Array.isArray(b.rodadas)) for (const r of b.rodadas) await guardarRodada(r);
      avisar('Backup restaurado.', 'ok'); RENDER.configuracoes();
    } catch (err) { avisar(`Backup não restaurado: ${err.message}`, 'err'); }
    e.target.value = '';
  };
  $('bkDesfazerEq').onclick = async () => {
    const ant = lerLocal(CHAVES.eqAnterior); if (!ant) return avisar('Não há cópia anterior da base de equivalências.', 'warn');
    if (!await confirmar('Voltar à base anterior?', `Cópia de ${new Date(ant.em).toLocaleString('pt-BR')}, revisão ${ant.valor.revisao}, ${ant.valor.itens.length} relações.`, 'Voltar')) return;
    const atual = S.eq; S.eq = ant.valor; backupAntesDeSubstituir(CHAVES.eqAnterior, atual); salvarEq('Base anterior restaurada.'); RENDER.configuracoes();
  };
  $('bkApagar').onclick = async () => {
    if (!await confirmar('Apagar todos os dados locais?', 'Configuração, equivalências, fluxo mensal, não conformidades, operador e rodadas deste navegador serão apagados. Exporte um backup antes.', 'Apagar tudo')) return;
    for (const k of Object.values(CHAVES)) try { localStorage.removeItem(k); } catch (e) { }
    await dbApagar(null); location.reload();
  };
};
function aplicarTema() {
  const t = lerLocal(CHAVES.tema) || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}
