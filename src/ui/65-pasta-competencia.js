/* ============================================================
 * Exportar competência: pasta .zip no padrão de rede do usuário (pedido de 03/11/2026)
 *
 * Comp_MM-AAAA/
 *   REPASSE_MM-AAAA_CONTROLE.xlsx                       (planilha do Fechamento)
 *   Correção de prestador/correcao_prestador_unidade_[un].xlsx (+ o PDF do prestador genérico)
 *   Não conformidades/nc_comp_MM-AAAA.xlsx              (todas as NCs de todas as unidades)
 *   Planilhas utilizadas para conferência/               (Power BI e laudos do Apolo, como carregados)
 *   Relatórios para conferência/[USG|IMG]/Unidade [un]/  (PDFs do MV, com nome identificado)
 *   Conferência cruzada/[USG|IMG]/Unidade [un]/          (Excel da conferência por prestador)
 *   Controle da ferramenta/                              (fluxo, rodadas e resumo)
 *   LEIA-ME.txt                                          (o que entrou e o que faltou)
 *
 * Arquivos originais (PDFs, Apolo, Power BI) só existem na memória da sessão: precisam estar
 * carregados no Início. As planilhas de análise são refeitas na hora com os parâmetros da última
 * rodada de cada relatório e a base de equivalências atual.
 * ============================================================ */
const nomeArquivo = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
const tipoDoRelatorio = rel => tipoRepasseDaRodada({ descricao: rel.cab.descricao || '', repasse: '', linhas: rel.regs.map(r => ({ grupo: r.grupoNome })) });
// Última rodada (do tipo) deste PDF na competência: dá a unidade e os parâmetros usados.
function ultimaRodadaDoRelatorio(x, tipo, ch) {
  return (S.rodadas || []).filter(r => r.tipo === tipo && competenciaDaRodada(r) === ch && (r.arquivos || []).some(a => a.papel === 'MV' && a.hash === x.hash))
    .sort((a, b) => b.em.localeCompare(a.em))[0] || null;
}

async function exportarPastaCompetencia(ch = S.comp) {
  if (ch !== S.comp) return avisar('Exporte a competência que está selecionada no topo.', 'warn');
  S.rodadas = await dbTodas();
  const mm = `${ch.slice(5)}-${ch.slice(0, 4)}`, raiz = `Comp_${mm}/`, z = new JSZip(), leia = [], bin = zip => zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const usados = new Set(), unico = caminho => { let c = caminho, i = 2; while (usados.has(c)) c = caminho.replace(/(\.\w+)$/, `_${i++}$1`); usados.add(c); return c; };
  const add = (caminho, dados) => z.file(unico(raiz + caminho), dados);
  leia.push(`Competência ${rotuloCompetencia(ch)} (produção ${rotuloMes(producaoEsperada(ch))}) — exportada em ${new Date().toLocaleString('pt-BR')} por ${S.operador || '—'} · Repasse Médico ${MOTOR_VERSAO}`, '');

  // Fechamento
  try {
    const f = fechamentoAtual(), mk = marcosFech(ch);
    add(`REPASSE_${mm}_CONTROLE${f.previa ? '_PREVIA' : ''}.xlsx`, await bin(xlsxFechamento(f, S.cfg, { pagUSG: mk.pagUSG, pagIMG: mk.pagIMG, pagCuritiba: mk.pagCuritiba })));
    leia.push(`Planilha de controle do repasse${f.previa ? ' (PRÉVIA: há prestadores sem aceite)' : ''}.`);
  } catch (e) { leia.push(`Planilha de controle: não gerada (${e.message}).`); }

  // Não conformidades (todas as unidades)
  const ncs = S.nc.itens.filter(x => x.competencia === ch);
  if (ncs.length) {
    const pr = prazosNC(ch);
    add(`Não conformidades/nc_comp_${mm}.xlsx`, await bin(xlsxNC(ncs, ch, { operador: S.operador, prazos: Object.fromEntries(Object.entries(pr.grupos).map(([k, g]) => [k, g.data])) })));
    leia.push(`Não conformidades: ${ncs.length} NC(s) de todas as unidades.`);
  } else leia.push('Não conformidades: nenhuma NC registrada na competência.');

  // Planilhas usadas na conferência (originais, como carregadas)
  for (const [obj, rot] of [[S.pbi, 'Power BI'], [S.apolo, 'planilha de laudos do Apolo']]) {
    if (obj?.bytes) { add(`Planilhas utilizadas para conferência/${nomeArquivo(obj.nome)}`, obj.bytes); leia.push(`${rot}: ${obj.nome}.`); }
    else leia.push(`${rot}: não carregada nesta sessão (carregue no Início e exporte de novo para incluir).`);
  }

  // Relatórios do MV, conferências e correções
  const idxDec = indiceDecisoesComp(ch);
  const semRodada = [];
  for (const x of S.relatorios) {
    const cab = x.rel.cab, correcao = (x.finalidade || finalidadePadrao(x.rel)) === 'correcao';
    const rod = ultimaRodadaDoRelatorio(x, correcao ? 'correcao' : 'conferencia', ch);
    const un = rod?.unidadeCod || unidadeSugeridaPeloArquivo(x.nome) || '';
    const unRot = un && un !== '*' ? un : 'sem_unidade';
    if (correcao) {
      if (x.bytes) add(`Correção de prestador/relatorio_correcao_prestador_unidade_${unRot}.pdf`, x.bytes);
      if (rod && S.apolo) {
        const res = corrigirPrestador(x.rel, S.apolo, S.cfg, S.eq, { unidadeCod: rod.unidadeCod, tol: rod.parametros?.tol ?? S.cfg.parametros.tolCorrecao });
        const ctx = { chaveCompetencia: ch, relatorio: x.rel, apoloNome: S.apolo.nome, unidadeCod: rod.unidadeCod, unidadeNome: `${rod.unidadeCod} - ${unidadePorCod(S.cfg, rod.unidadeCod)?.nome || ''}`, parametros: rod.parametros || {}, operador: S.operador, em: new Date().toLocaleString('pt-BR'), rodadaId: rod.id };
        add(`Correção de prestador/correcao_prestador_unidade_${unRot}.xlsx`, await bin(xlsxCorrecao(res, ctx)));
      } else semRodada.push(`${x.nome} (correção de prestador${S.apolo ? ', sem rodada nesta competência' : ', Apolo não carregado'})`);
      continue;
    }
    const tipo = tipoDoRelatorio(x.rel).toUpperCase();
    const nomePdf = `medico_${nomeArquivo(cab.prestadorCod)}_${nomeArquivo(cab.prestadorNome)}_repasse_${tipo.toLowerCase()}_unidade_${unRot}.pdf`;
    if (x.bytes) add(`Relatórios para conferência/${tipo}/Unidade ${unRot}/${nomePdf}`, x.bytes);
    if (rod && S.apolo) {
      const medSel = rod.parametros?.medico || '@prest';
      const medicos = medSel === '*' ? null : medSel === '@prest' ? medicosDoPrestador(S.cfg, cab.prestadorCod) : [medSel];
      const res = aplicarDecisoes(conferirCruzado(x.rel, S.apolo, S.cfg, S.eq, { unidadeCod: rod.unidadeCod, tol: rod.parametros?.tol ?? S.cfg.parametros.tolConferencia, medicos }), idxDec);
      const ctx = { chaveCompetencia: ch, relatorio: x.rel, apoloNome: S.apolo.nome, unidadeCod: rod.unidadeCod, unidadeNome: `${rod.unidadeCod} - ${unidadePorCod(S.cfg, rod.unidadeCod)?.nome || ''}`,
        medicosNomes: medicos ? [...new Set(S.apolo.laudos.filter(l => medicos.includes(l.mn)).map(l => l.medico))].join(', ') : '', parametros: rod.parametros || {}, operador: S.operador, rodadaId: rod.id };
      add(`Conferência cruzada/${tipo}/Unidade ${unRot}/${nomeArquivoAnalise('conferencia', ctx)}`, await bin(xlsxConferencia(res, ctx)));
    } else semRodada.push(`${x.nome} (${tipo}${S.apolo ? ', sem conferência nesta competência' : ', Apolo não carregado'})`);
  }
  leia.push(`Relatórios do MV: ${S.relatorios.length} PDF(s) carregado(s) nesta sessão.`);
  if (semRodada.length) leia.push('', 'Sem planilha de análise (rode a conferência ou a correção e exporte de novo):', ...semRodada.map(s => `- ${s}`));
  if (!S.relatorios.length) leia.push('Nenhum PDF do MV carregado nesta sessão: carregue no Início para incluir os relatórios e as conferências.');

  // Controle da ferramenta
  const R = resumoCompetencia(ch);
  if (R.fx) add(`Controle da ferramenta/Fluxo_mensal_${mm}.xlsx`, await bin(xlsxFluxo(R.fx)));
  add(`Controle da ferramenta/rodadas_${mm}.json`, JSON.stringify({ schema: 'repasse-medico/rodadas', versaoSchema: 1, competencia: ch, exportadoEm: agoraISO(), rodadas: R.rods }, null, 1));
  add('Controle da ferramenta/resumo_competencia.json', JSON.stringify({ competencia: ch, producao: producaoEsperada(ch), exportadoEm: agoraISO(), operador: S.operador, motor: MOTOR_VERSAO,
    estado: estadoCompetencia(S.compReg, ch), rodadas: { conferencia: R.conf.length, correcao: R.corr.length, semAceite: R.semAceite }, naoConformidades: R.indNC,
    fluxo: R.indFx ? { concluidas: R.indFx.ok, total: R.indFx.total, vencidas: R.indFx.vencidas.length } : null, equivalenciasValidadas: R.eqVal }, null, 1));
  leia.push('', 'As planilhas de conferência e de correção foram refeitas na exportação, com os parâmetros da última rodada de cada relatório e a base de equivalências atual', `(revisão ${S.eq.revisao}). O nome de cada uma traz a rodada correspondente (veja Rodadas na ferramenta).`,
    '', 'Atenção: os arquivos têm dados de pacientes. Guarde na rede conforme a política da empresa.');
  z.file(raiz + 'LEIA-ME.txt', leia.join('\r\n'));
  baixarBlob(await z.generateAsync({ type: 'blob', compression: 'DEFLATE' }), `Comp_${mm}.zip`);
  avisar(`Pasta da competência ${rotuloCompetencia(ch)} gerada (Comp_${mm}.zip).${semRodada.length ? ` ${semRodada.length} relatório(s) sem planilha de análise: veja o LEIA-ME.` : ''}`, semRodada.length ? 'warn' : 'ok');
}
