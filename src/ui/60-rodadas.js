/* ============================================================
 * Rodadas: histórico de execuções, comparação e aceite humano (RN-186)
 * ============================================================ */
const RD = { todas: false };
RENDER.rodadas = async () => {
  S.rodadas = await dbTodas();
  const lista = [...S.rodadas].filter(r => RD.todas || competenciaDaRodada(r) === S.comp).sort((a, b) => b.em.localeCompare(a.em));
  $('pag-rodadas').innerHTML = `<div class="card"><h2>Rodadas registradas</h2>
    <p class="lead">Cada execução guarda entradas (nome e impressão digital dos arquivos), parâmetros, versões do motor e das bases, contagens e o estado de cada linha (sem nomes de pacientes). O aceite final é sempre humano e fica registrado.</p>
    <p class="small muted">${DB.ok ? 'Guardadas neste navegador (IndexedDB).' : 'Armazenamento do navegador indisponível: as rodadas ficam só nesta sessão.'}</p>
    <div class="acoes"><label class="small"><input type="checkbox" id="rdTodas"${RD.todas ? ' checked' : ''}> mostrar todas as competências</label><button id="rdExp" class="sec">Exportar histórico (.json)</button><button id="rdLimpar" class="perigo">Apagar histórico</button></div>
    <div id="rdTab" style="margin-top:10px"></div></div>`;
  tabela($('rdTab'), {
    linhas: lista, vazio: RD.todas ? 'Nenhuma rodada ainda.' : `Nenhuma rodada na competência ${rotuloCompetencia(S.comp)}.`, colunas: [
      { t: 'Competência', v: r => rotuloCompetencia(competenciaDaRodada(r)) }, { t: 'Rodada', html: r => `<code class="small">${esc(r.id)}</code>` }, { t: 'Data', v: r => new Date(r.em).toLocaleString('pt-BR') }, { t: 'Tipo', v: r => r.tipo === 'conferencia' ? 'Conferência' : 'Correção de prestador' },
      { t: 'Prestador', v: r => `${r.prestadorCod} - ${r.prestadorNome}` }, { t: 'Repasse', v: r => `${r.repasse} · ${r.descricao}` }, { t: 'Unidade', v: r => r.unidadeCod },
      { t: 'Resultado', v: r => Object.entries(r.contagens).filter(([, n]) => n).map(([k, n]) => `${(STATUS_CONF[k] || ESTADO_CORR[k])?.nome || k}: ${n}`).join(' · ') },
      { t: 'Operador', v: r => r.operador }, { t: 'Aceite', html: r => r.aceite ? `<span class="badge ok">${esc(r.aceite.por)} · ${new Date(r.aceite.em).toLocaleDateString('pt-BR')}</span> <button class="sec mini" data-desfazer="${r.id}" title="Desfazer aceite">↺</button>` : `<button class="sec" data-ac="${r.id}">Registrar aceite</button>` }
    ],
    detalhe: r => {
      const ant = rodadaAnterior(S.rodadas, r), g = ant ? compararRodadas(ant, r) : null;
      return `<div class="det"><div><h4>Entradas e versões</h4><ul class="small">${r.arquivos.map(a => `<li>${esc(a.papel)}: ${esc(a.nome)} <code>${esc(a.hash || '')}</code></li>`).join('')}
        <li>Motor ${esc(r.versoes.motor)} · equivalências rev. ${r.versoes.equivalencias} · configuração rev. ${r.versoes.configuracao}</li><li>Parâmetros: ${esc(JSON.stringify(r.parametros))}</li></ul>
        ${(r.aceitesDesfeitos || []).length ? `<h4>Aceites desfeitos</h4><ul class="small">${r.aceitesDesfeitos.map(a => `<li>${esc(a.por)} em ${new Date(a.em).toLocaleString('pt-BR')} — desfeito por ${esc(a.desfeitoPor)} em ${new Date(a.desfeitoEm).toLocaleString('pt-BR')}</li>`).join('')}</ul>` : ''}
        ${r.aceite ? `<h4>Aceite</h4><p class="small">${esc(r.aceite.por)} em ${new Date(r.aceite.em).toLocaleString('pt-BR')}: ${esc(r.aceite.obs || '')} (${r.aceite.pendencias} pendência(s) abertas no aceite)</p>` : ''}</div>
        <div><h4>Comparação com a rodada anterior</h4>${g ? `<ul class="small"><li>Agora conferidos/identificados: ${g.agoraIdentificados.length}</li><li>Continuam pendentes: ${g.continuamPendentes.length}</li><li>Mudaram de categoria: ${g.mudaramEstado.length}</li><li>Mudaram de médico: ${g.mudaramMedico.length}</li><li>Novas linhas: ${g.novos.length}</li><li>Saíram da extração: ${g.desapareceram.length}</li><li>Sem mudança: ${g.semMudanca.length}</li></ul>` : '<p class="muted small">Sem rodada anterior comparável (mesma competência, tipo, unidade e prestador).</p>'}</div></div>`;
    }
  });
  $('rdTab').addEventListener('click', async e => {
    const bd = e.target.closest('[data-desfazer]');
    if (bd) {
      const r = S.rodadas.find(x => x.id === bd.dataset.desfazer);
      if (!exigirAberta(competenciaDaRodada(r), 'desfazer o aceite')) return;
      const op = await exigirOperador(); if (!op) return;
      if (!await confirmar('Desfazer o aceite?', `O aceite de ${esc(r.aceite.por)} sai desta rodada e fica no histórico.`, 'Desfazer aceite')) return;
      desfazerAceiteRodada(r, op); await guardarRodada(r); avisar('Aceite desfeito.', 'ok'); RENDER.rodadas(); return;
    }
    const b = e.target.closest('[data-ac]'); if (!b) return;
    const r = S.rodadas.find(x => x.id === b.dataset.ac);
    if (!exigirAberta(competenciaDaRodada(r), 'registrar aceite')) return;
    const op = await exigirOperador(); if (!op) return;
    const pend = pendenciasDaRodada(r, indiceDecisoesComp(competenciaDaRodada(r))).length;
    const d = await dialogo('Registrar aceite da rodada', `<p>${pend ? `<span class="badge warn">${pend} linha(s) ainda não conferidas/identificadas (já descontadas as NCs e as linhas consideradas no repasse)</span>` : '<span class="badge ok">Sem pendências</span>'}</p><p class="small">O aceite registra que <strong>${esc(op)}</strong> revisou o resultado. Ele não altera o MV nem os dados.</p><label class="campo">Observação${pend ? ' (obrigatória com pendências)' : ''}<input type="text" name="obs"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Registrar aceite']]);
    if (d.botao !== 'ok') return;
    if (pend && !d.campos.obs.trim()) return avisar('Com pendências abertas, informe uma observação para o aceite.', 'warn');
    aceitarRodada(r, op, d.campos.obs, pend);
    await guardarRodada(r); avisar('Aceite registrado.', 'ok'); RENDER.rodadas();
  });
  $('rdTodas').onchange = e => { RD.todas = e.target.checked; RENDER.rodadas(); };
  $('rdExp').onclick = () => baixarJSON({ schema: 'repasse-medico/rodadas', versaoSchema: 1, exportadoEm: agoraISO(), rodadas: S.rodadas }, `rodadas_${carimbo()}.json`);
  $('rdLimpar').onclick = async () => { if (await confirmar('Apagar todo o histórico de rodadas?', 'Exporte antes se precisar guardar a rastreabilidade. Esta ação não pode ser desfeita.', 'Apagar')) { await dbApagar(null); S.rodadas = []; RENDER.rodadas(); } };
};
