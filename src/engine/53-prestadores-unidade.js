/* ============================================================
 * SOL-F35 — Controle por unidade: quem laudou (planilha de laudos) × quem já tem repasse.
 * Grupos: USG (US, com o Doppler) e IMG (demais modalidades) nas unidades fora da V3; Curitiba (unidade V3)
 * num grupo só, só com médicos V3 e só os exames que a regra V3 de cada um cobre.
 * Situação calculada: gerar no MV · relatório sem conferência · conferido · aceito · relatório sem laudo (aviso)
 * · sem cadastro · fora do repasse. Só médico, unidade e contagens: nenhum dado de paciente.
 * ============================================================ */
const GRUPOS_CONTROLE = { usg: 'USG (com Doppler)', img: 'IMG (demais exames)', curitiba: 'Curitiba (V3)' };
const SITUACAO_CONTROLE = {
  gerar: ['err', 'Gerar no MV'], 'sem-conferencia': ['warn', 'Relatório sem conferência'], conferido: ['info', 'Conferindo'],   // há rodada, ainda sem aceite: continua «Conferindo» até o aceite
  aceito: ['ok', 'Aceito'], 'sem-laudo': ['warn', 'Relatório sem laudo'], 'sem-cadastro': ['warn', 'Sem cadastro'],
  conflito: ['err', 'Nome em dois cadastros'], fora: ['info', 'Fora do repasse'], verificado: ['info', 'Verificado']
};
// Situações que contam como «falta» (pendência de repasse).
const FALTA_CONTROLE = new Set(['gerar', 'sem-conferencia', 'conferido', 'sem-cadastro', 'conflito']);

// Nome da unidade no Apolo → código (cadastro de unidades, campo «apolo»).
function mapaUnidadesApolo(cfg) {
  const m = new Map();
  for (const u of cfg.unidades || []) for (const n of u.apolo || []) m.set(norm(n), String(u.cod));
  return m;
}
// O laudo está coberto pela regra V3 do médico? Percentual = todos; valor fixo = só os grupos cadastrados.
function laudoNaRegraV3(regra, modalidade) {
  if (!regra || regra.modo !== 'fixo') return true;
  return (regra.grupos || []).some(g => {
    if (g.grupo === GRUPO_USG_V3) return modalidade === 'US';
    const mods = modalidadesDoGrupo(g.grupo);
    return !mods || mods.includes(modalidade);
  });
}
const grupoDoLaudo = (cfg, unidadeCod, modalidade) => ehUnidadeV3(cfg, unidadeCod) ? 'curitiba' : (modalidade === 'US' ? 'usg' : 'img');

/* laudos: laudos do Apolo; rodadas: todas; chave: competência; sessao: [{prestadorCod, tipo}] dos PDFs carregados;
 * marcas: {gerado:{k:{por,em}}, dispensado:{k:{motivo,por,em}}}; naoSRA: [{mn, nome, por, em}] (médicos fora da SRA na V3). */
function controlePrestadoresUnidade({ laudos, cfg, rodadas, chave, sessao = [], marcas = {}, naoSRA = [] }) {
  const mapaUn = mapaUnidadesApolo(cfg), idx = indicePrestadores(cfg), foraSRA = new Set(naoSRA.map(x => x.mn));
  const unidades = new Map(), semUnidade = new Map();
  const un = cod => unidades.get(cod) || unidades.set(cod, { cod, nome: unidadePorCod(cfg, cod)?.nome || '', v3: ehUnidadeV3(cfg, cod), grupos: {}, outros: new Map() }).get(cod);
  const grp = (u, g) => u.grupos[g] || (u.grupos[g] = { grupo: g, itens: new Map() });
  const item = (G, k, base) => G.itens.get(k) || G.itens.set(k, { k, laudos: 0, foraRegra: new Map(), linhasMV: 0, medicos: new Set(), ...base }).get(k);
  // 1) Laudos do Apolo.
  for (const l of laudos || []) {
    const cod = mapaUn.get(norm(l.unidade));
    if (!cod) { semUnidade.set(l.unidade, (semUnidade.get(l.unidade) || 0) + 1); continue; }
    const u = un(cod), g = grupoDoLaudo(cfg, cod, l.modalidade), G = grp(u, g), r = prestadorDoMedico(idx, l.medico);
    if (r.estado === 'ok') {
      const p = r.prestador;
      if (g === 'curitiba' && !p.regras?.v3) { const o = u.outros.get('p' + p.cod) || u.outros.set('p' + p.cod, { nome: p.nomeMV, cod: p.cod, laudos: 0, motivo: 'sem regra V3 no cadastro' }).get('p' + p.cod); o.laudos++; continue; }
      const it = item(G, `${g}|${cod}|${p.cod}`, { cod: String(p.cod), nome: p.nomeMV, p });
      it.medicos.add(l.medico);
      if (g === 'curitiba' && !laudoNaRegraV3(p.regras?.v3regra, l.modalidade)) { const n = NOME_MODALIDADE[l.modalidade] || l.modalidade || 'sem modalidade'; it.foraRegra.set(n, (it.foraRegra.get(n) || 0) + 1); }
      else it.laudos++;
    } else {
      const mn = norm(l.medico);
      if (!mn) continue;
      if (g === 'curitiba' && foraSRA.has(mn)) { const o = u.outros.get('m' + mn) || u.outros.set('m' + mn, { nome: l.medico, cod: '', laudos: 0, motivo: 'não é pago pela SRA', marca: naoSRA.find(x => x.mn === mn) }).get('m' + mn); o.laudos++; continue; }
      const it = item(G, `${g}|${cod}|apolo:${mn}`, { cod: '', nome: l.medico, mn, conflito: r.estado === 'conflito' ? r.candidatos.map(p => p.cod) : null });
      it.medicos.add(l.medico); it.laudos++;
    }
  }
  // 2) Rodadas de conferência da competência (prestador × unidade × grupo), a mais recente.
  for (const r of rodadas || []) {
    if (r.tipo !== 'conferencia' || competenciaDaRodada(r) !== chave || !r.unidadeCod || r.unidadeCod === '*') continue;
    const cod = String(r.unidadeCod), g = ehUnidadeV3(cfg, cod) ? 'curitiba' : tipoRepasseDaRodada(r), G = grp(un(cod), g);
    const p = cfg.prestadores.find(x => String(x.cod) === String(r.prestadorCod));
    const it = item(G, `${g}|${cod}|${r.prestadorCod}`, { cod: String(r.prestadorCod), nome: p?.nomeMV || r.prestadorNome, p });
    if (!it.rodada || r.em > it.rodada.em) it.rodada = r;
  }
  // 3) Situação de cada item.
  // PDF carregado: vale para a unidade sugerida pelo nome do arquivo; sem sugestão, para qualquer unidade.
  const temSessao = (cod, g, un) => sessao.some(s => String(s.prestadorCod) === String(cod) && (g === 'curitiba' || s.tipo === g) && (!s.unidade || String(s.unidade) === String(un)));
  const resultado = [];
  for (const u of [...unidades.values()].sort((a, b) => +a.cod - +b.cod)) {
    const grupos = Object.values(u.grupos).map(G => {
      const itens = [...G.itens.values()].map(it => {
        const linhas = it.rodada ? it.rodada.linhas.filter(l => !l.tipoItem || l.tipoItem === 'procedimento').length : 0;
        let sit;
        if (it.conflito) sit = 'conflito';
        else if (!it.cod) sit = 'sem-cadastro';
        else if (it.p?.naoRealizaRepasse) sit = 'fora';
        else if (!it.laudos && it.rodada) sit = 'sem-laudo';
        else if (it.rodada) sit = it.rodada.aceite ? 'aceito' : 'conferido';
        else if (temSessao(it.cod, G.grupo, u.cod)) sit = 'sem-conferencia';
        else sit = 'gerar';
        const disp = marcas.dispensado?.[it.k];
        if (disp && (sit === 'sem-laudo' || sit === 'gerar')) sit = sit === 'sem-laudo' ? 'verificado' : 'fora';
        return { k: it.k, cod: it.cod, nome: it.nome, mn: it.mn || '', medicos: [...it.medicos], laudos: it.laudos, foraRegra: [...it.foraRegra].map(([n, q]) => ({ n, q })),
          linhasMV: linhas, rodadaId: it.rodada?.id || '', relId: it.rodada?.relId || '', aceite: it.rodada?.aceite || null, regraV3: G.grupo === 'curitiba' ? it.p?.regras?.v3regra || null : null,
          situacao: sit, gerado: marcas.gerado?.[it.k] || null, dispensado: disp || null, conflito: it.conflito };
      }).sort((a, b) => (FALTA_CONTROLE.has(b.situacao) - FALTA_CONTROLE.has(a.situacao)) || b.laudos - a.laudos || a.nome.localeCompare(b.nome));
      const c = s => itens.filter(x => x.situacao === s).length;
      const resumo = { laudaram: itens.filter(x => x.laudos > 0 && x.situacao !== 'fora').length, aceitos: c('aceito'), conferidos: c('conferido'), semConferencia: c('sem-conferencia'),
        gerar: c('gerar'), semLaudo: c('sem-laudo'), semCadastro: c('sem-cadastro') + c('conflito'), fora: c('fora'), verificados: c('verificado') };
      resumo.falta = itens.filter(x => FALTA_CONTROLE.has(x.situacao)).length;
      return { grupo: G.grupo, itens, resumo };
    }).sort((a, b) => Object.keys(GRUPOS_CONTROLE).indexOf(a.grupo) - Object.keys(GRUPOS_CONTROLE).indexOf(b.grupo));
    resultado.push({ cod: u.cod, nome: u.nome, v3: u.v3, grupos, outros: [...u.outros.values()].sort((a, b) => b.laudos - a.laudos) });
  }
  return { unidades: resultado, semUnidade: [...semUnidade].map(([nome, laudos]) => ({ nome, laudos })) };
}
// Avisos para o Início e o Fechamento: quem laudou e não tem relatório, e relatório sem laudo.
function avisosControleUnidade(ctl) {
  const av = [];
  for (const u of ctl.unidades) for (const G of u.grupos) {
    const rot = `unidade ${u.cod} (${G.grupo === 'curitiba' ? 'Curitiba' : G.grupo.toUpperCase()})`;
    const ger = G.itens.filter(x => x.situacao === 'gerar');
    if (ger.length) av.push({ tipo: 'gerar', unidade: u.cod, grupo: G.grupo, texto: `${ger.length} prestador(es) laudaram na ${rot} e não têm relatório: ${ger.map(x => `${x.cod} ${x.nome}`).join(', ')}` });
    for (const x of G.itens.filter(y => y.situacao === 'sem-laudo')) av.push({ tipo: 'sem-laudo', unidade: u.cod, grupo: G.grupo, texto: `Relatório sem laudo: ${x.cod} ${x.nome} (${rot}): ${x.linhasMV} linha(s) no MV e nenhum laudo no Apolo` });
    const sc = G.itens.filter(y => y.situacao === 'sem-cadastro' || y.situacao === 'conflito');
    if (sc.length) av.push({ tipo: 'sem-cadastro', unidade: u.cod, grupo: G.grupo, texto: `${sc.length} médico(s) do Apolo sem cadastro na ${rot}: ${sc.map(x => x.nome).join(', ')}` });
  }
  return av;
}
// Planilha «Lista para gerar no MV» (e o resto do que falta), sem dado de paciente.
function planilhaControleUnidade(ctl, chave) {
  const linhas = [cabecalho(['Unidade', 'Grupo', 'Cód. prestador', 'Prestador', 'Laudos no Apolo', 'Laudos fora da regra V3', 'Linhas no MV', 'Situação', 'Gerado no MV (marcado)', 'Observação'])];
  const todas = [cabecalho(linhas[0].map(c => c.v))];
  for (const u of ctl.unidades) for (const G of u.grupos) for (const x of G.itens) {
    const row = [`${u.cod} - ${u.nome}`, GRUPOS_CONTROLE[G.grupo], x.cod, x.nome, { v: x.laudos, st: { fmt: 'int' } }, x.foraRegra.map(f => `${f.n}: ${f.q}`).join('; '), { v: x.linhasMV, st: { fmt: 'int' } },
      SITUACAO_CONTROLE[x.situacao][1], x.gerado ? `${x.gerado.por} · ${String(x.gerado.em).slice(0, 10)}` : '', x.dispensado?.motivo || ''];
    if (x.situacao === 'gerar') linhas.push(row);
    todas.push(row);
  }
  const larg = [30, 20, 12, 36, 14, 26, 12, 24, 22, 36];
  return criarXlsx([{ nome: 'Gerar no MV', larguras: larg, linhas, filtro: true, congelar: 1 }, { nome: `Todos ${chave}`, larguras: larg, linhas: todas, filtro: true, congelar: 1 }]);
}
