/* ============================================================
 * Configurações (v3.0): tudo o que é ajuste permanente fica aqui, em categorias.
 * As páginas operacionais (Conferência, Correção, NCs, Fechamento…) só têm a atividade do dia.
 *   Geral · Conferência · Bases e regras (página Bases) · Pastas e sincronização · Exportação · Backup e dados · Sobre
 * O que é da equipe vai com a configuração compartilhada (pasta da rede); o que é de cada pessoa fica no navegador.
 * ============================================================ */
const CF = { sub: 'geral', colunas: null, modelo: '' };
const ABAS_CONFIG = [['geral', 'Geral'], ['conferencia', 'Conferência'], ['bases', 'Bases e regras'], ['pastas', 'Pastas e sincronização'], ['exportacao', 'Exportação'], ['backup', 'Backup e dados'], ['sobre', 'Sobre']];
const abasConfiguracoes = atual => `<div class="subabas cfg-abas" role="tablist" aria-label="Categorias de configuração">${ABAS_CONFIG.map(([k, t]) => `<button role="tab" class="${atual === k ? 'on' : ''}" aria-selected="${atual === k}" data-cfsub="${k}">${t}</button>`).join('')}</div>`;
function ligarAbasConfiguracoes(raiz) {
  raiz.querySelectorAll('[data-cfsub]').forEach(b => b.onclick = () => {
    const k = b.dataset.cfsub;
    if (k === 'bases') { if (location.hash !== '#bases') location.hash = '#bases'; return; }
    CF.sub = k; if (location.hash !== '#configuracoes') location.hash = '#configuracoes'; else RENDER.configuracoes();
  });
}
// A página Bases é a categoria «Bases e regras» das Configurações: mesmas abas no topo.
const _renderBasesAbas = RENDER.bases;
RENDER.bases = (...a) => { const r = _renderBasesAbas(...a), pg = $('pag-bases'); if (pg && !pg.querySelector('.cfg-abas')) { pg.insertAdjacentHTML('afterbegin', abasConfiguracoes('bases')); ligarAbasConfiguracoes(pg); } return r; };

/* ---------- Cor de destaque (tema leve): no máximo cinco cores sérias, com contraste ≥ 4,5:1 ---------- */
const ACENTOS = {
  azul: { nome: 'Azul institucional', claro: ['#1f5f99', '#2b74b8'], escuro: ['#5fa3e3', '#7db7ee'] },
  petroleo: { nome: 'Petróleo', claro: ['#0e6670', '#13808b'], escuro: ['#4fb3bd', '#72c7cf'] },
  verde: { nome: 'Verde', claro: ['#2d6a3e', '#388450'], escuro: ['#6cc28a', '#8fd3a6'] },
  grafite: { nome: 'Grafite', claro: ['#44505f', '#56657a'], escuro: ['#a3b1c2', '#bcc8d6'] },
  vinho: { nome: 'Vinho', claro: ['#8c2f45', '#a63b55'], escuro: ['#e08a9e', '#eaa5b5'] }
};
function aplicarTema() {
  const t = lerLocal(CHAVES.tema) || 'auto', el = document.documentElement;
  if (t === 'auto') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', t);
  const a = ACENTOS[lerLocal(CHAVES.acento)] || ACENTOS.azul;
  const escuro = t === 'dark' || (t === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const [c1, c2] = escuro ? a.escuro : a.claro;
  el.style.setProperty('--accent', c1); el.style.setProperty('--accent2', c2); el.style.setProperty('--info', c1);
  el.style.setProperty('--nav-ativo', a.claro[0]);
}
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema()); } catch (e) { }

RENDER.configuracoes = () => {
  const pg = $('pag-configuracoes'), corpo = ({ geral: cfgGeral, conferencia: cfgConferencia, pastas: cfgPastas, exportacao: cfgExportacao, backup: cfgBackup, sobre: cfgSobre }[CF.sub] || cfgGeral)();
  pg.innerHTML = abasConfiguracoes(CF.sub) + corpo;
  ligarAbasConfiguracoes(pg);
  ({ geral: ligarGeral, conferencia: ligarConferencia, pastas: ligarPastas, exportacao: ligarExportacao, backup: ligarBackup, sobre: ligarSobre }[CF.sub] || ligarGeral)(pg);
};
const notaEscopo = (compartilhado) => `<span class="badge ${compartilhado ? 'info' : 'ok'}" title="${compartilhado ? 'Vai com a configuração compartilhada na pasta da rede: vale para os dois.' : 'Fica só neste navegador: cada pessoa tem a sua.'}">${compartilhado ? 'da equipe' : 'só sua'}</span>`;

/* ---------- Geral ---------- */
function cfgGeral() {
  const tema = lerLocal(CHAVES.tema) || 'auto', acento = lerLocal(CHAVES.acento) || 'azul';
  return `<div class="grid2">
    <div class="card"><h2>Operador ${notaEscopo(false)}</h2><p class="lead">Nome registrado nas validações, aliases, aceites, NCs e rodadas.</p>
      <label class="campo">Nome<input type="text" id="cfgOp" value="${esc(S.operador)}"></label><div class="acoes"><button id="cfgOpSalvar">Salvar</button></div></div>
    <div class="card"><h2>Aparência ${notaEscopo(false)}</h2>
      <label class="campo">Tema<select id="cfgTema">${opcoes([['auto', 'Automático (sistema)'], ['light', 'Claro'], ['dark', 'Escuro']], tema)}</select></label>
      <div class="campo"><span>Cor de destaque</span><div class="acentos" role="radiogroup" aria-label="Cor de destaque">${Object.entries(ACENTOS).map(([k, a]) => `<label class="acento${k === acento ? ' on' : ''}" title="${esc(a.nome)}"><input type="radio" name="acento" value="${k}"${k === acento ? ' checked' : ''}><i style="background:${a.claro[0]}"></i><span class="small">${esc(a.nome)}</span></label>`).join('')}</div>
      <span class="small muted">Cores com contraste adequado no tema claro e no escuro. As cores de situação (conferido, pendente, só no laudo…) não mudam: elas têm significado.</span></div></div>
  </div>`;
}
function ligarGeral() {
  $('cfgOpSalvar').onclick = () => { S.operador = $('cfgOp').value.trim(); gravarLocal(CHAVES.operador, S.operador); mostrarOperador(); avisar('Operador salvo.', 'ok'); };
  $('cfgTema').onchange = e => { gravarLocal(CHAVES.tema, e.target.value); aplicarTema(); };
  document.querySelectorAll('[name="acento"]').forEach(r => r.onchange = () => { gravarLocal(CHAVES.acento, r.value); aplicarTema(); RENDER.configuracoes(); });
}

/* ---------- Conferência: parâmetros e onde ficam as regras ---------- */
function cfgConferencia() {
  const p = S.cfg.parametros;
  return `<div class="card"><h2>Parâmetros de conferência ${notaEscopo(true)}</h2><p class="lead">Padrões usados ao abrir as análises; cada rodada registra o valor efetivamente usado.</p>
    <div class="grid4">
      <label class="campo">Tolerância — conferência (dias)<input type="number" id="pTolC" min="0" max="60" value="${p.tolConferencia}"><span class="small muted">Data diferente na tolerância = «com ressalva».</span></label>
      <label class="campo">Tolerância — correção de prestador (dias)<input type="number" id="pTolP" min="0" max="60" value="${p.tolCorrecao}"><span class="small muted">0 = mesma data (recomendado).</span></label>
      <label class="campo">Truncamento mínimo do nome (caracteres)<input type="number" id="pTrunc" min="10" max="60" value="${p.minTruncamento}"><span class="small muted">Prefixo no meio de palavra só conta a partir deste tamanho.</span></label>
      <label class="campo">Valor simbólico até (R$)<input type="number" id="pSimb" min="0" step="0.01" value="${p.valorSimbolico}"><span class="small muted">Só marca a linha; não muda a categoria.</span></label>
      <label class="campo">Prestador genérico (código no MV)<input type="text" id="pGen" value="${esc(p.prestadorGenerico ?? '2')}"><span class="small muted">O relatório dele vai para a Correção de prestador.</span></label>
      <label class="campo">Retenção dos dados de pacientes nas NCs (dias)<input type="number" id="pRet" min="1" max="366" value="${p.retencaoNC ?? RETENCAO_NC_PADRAO}"><span class="small muted">Depois desse prazo, nome e ID/atendimento são apagados; o resto da NC fica para os indicadores.</span></label></div>
    <div class="acoes"><button id="pSalvar">Salvar parâmetros</button></div></div>
  <div class="card"><h2>Regras e bases usadas pela conferência</h2><p class="lead">As regras de negócio ficam num lugar só e valem para os dois motores (conferência cruzada e correção de prestador).</p>
    <dl class="kv"><dt>Equivalências TUSS</dt><dd>${S.eq.itens.filter(e => e.status === 'validada').length} validadas · ${S.eq.itens.filter(e => e.status === 'pendente').length} pendentes · ${(S.eq.compostas || []).filter(c => c.status === 'validada').length} regras compostas validadas — <a href="#equivalencias">Equivalências TUSS</a> (títulos do Apolo, base, regras compostas, o que mais destrava)</dd>
      <dt>Unidades e nomes no Apolo</dt><dd>${S.cfg.unidades.length} unidades — <a href="#bases" data-bsub-link="unidades">Bases e regras</a></dd>
      <dt>Prestadores, aliases e regras de repasse</dt><dd>${S.cfg.prestadores.length} prestadores · ${S.cfg.prestadores.reduce((n, p) => n + (p.aliases || []).filter(a => a.status === 'validado').length, 0)} alias(es) validado(s) — <a href="#bases">Bases e regras</a></dd>
      <dt>Classificação do tipo de item</dt><dd>${S.cfg.classificacao.filter(r => r.ativa).length} regras ativas (HM, taxa, material…) — <a href="#bases">Bases e regras</a></dd>
      <dt>Convênios e faturistas</dt><dd>${S.cfg.convenios.length} convênios · ${S.cfg.faturistas.length} faturistas — <a href="#bases">Bases e regras</a></dd></dl></div>`;
}
function ligarConferencia() {
  $('pSalvar').onclick = () => {
    const n = { ...S.cfg.parametros, tolConferencia: +$('pTolC').value, tolCorrecao: +$('pTolP').value, minTruncamento: +$('pTrunc').value, valorSimbolico: +$('pSimb').value, retencaoNC: +$('pRet').value, prestadorGenerico: $('pGen').value.trim() };
    if (['tolConferencia', 'tolCorrecao', 'minTruncamento', 'valorSimbolico'].some(k => !Number.isFinite(n[k]) || n[k] < 0) || !(n.retencaoNC >= 1 && n.retencaoNC <= 366)) return avisar('Valores inválidos (retenção: 1 a 366 dias).', 'err');
    S.cfg.parametros = n; salvarCfg('Parâmetros salvos.', 'parametros');
    const apagadas = aplicarRetencaoNC(S.nc, n.retencaoNC); if (apagadas) { salvarNC(); avisar(`Parâmetros salvos. ${apagadas} NC(s) passaram do novo prazo: dados de pacientes apagados.`, 'ok'); }
  };
}

/* ---------- Pastas e sincronização ---------- */
function cfgPastas() {
  const p = S.cfg.parametros, st = (s, mapa) => `<b>${esc(mapa[s] || s)}</b>`;
  const MAPA = { ok: 'sincronizado', erro: 'sem acesso', conflito: 'mudanças dos dois para escolher', permissao: 'liberar acesso', juntar: 'falta juntar com a pasta', edicao: 'alterações não salvas', off: '—' };
  const conectada = SY.handle && !SY.legado;
  return `<div class="card"><h2>Pasta raiz na rede ${notaEscopo(false)}</h2>
    <p class="lead">Uma pasta raiz (ex.: <code>\\\\servidor\\Repasse Médico</code>, mapeada ou não) com as subpastas abaixo. O Edge guarda a pasta escolhida neste navegador e pede para <b>liberar o acesso</b> a cada sessão, a menos que você marque «Permitir sempre» no aviso do Edge. Nenhum caminho fica fixo no código: os nomes das subpastas se configuram aqui.</p>
    ${suportaPasta() ? `<dl class="kv"><dt>Pasta conectada</dt><dd>${SY.handle ? `<b>${esc(SY.handle.name)}</b>${SY.legado ? ' (só a pasta do Fluxo — conecte a raiz)' : ''}` : 'nenhuma'}</dd>
      ${conectada ? `<dt>Fluxo mensal</dt><dd>${st(SY.status, MAPA)}</dd><dt>Equivalências TUSS</dt><dd>${st(SYQ.status, MAPA)}</dd><dt>Configuração compartilhada</dt><dd>${st(SYC.status, MAPA)}${SYC.erro ? ` <span class="small muted">(${esc(SYC.erro)})</span>` : ''}</dd>` : ''}</dl>
    <div class="acoes"><button id="psConectar">${SY.handle ? 'Trocar pasta raiz…' : 'Conectar a pasta raiz…'}</button>${SY.handle ? `<button class="sec" id="psLiberar">Liberar acesso / sincronizar agora</button><button class="sec" id="psDesc">Desconectar</button>` : ''}</div>`
    : '<p class="small">Este navegador não grava em pastas. Use o Edge (ou o Chrome) no computador.</p>'}</div>
  <div class="card"><h2>Comportamento ${notaEscopo(true)}</h2>
    <label class="small"><input type="checkbox" id="psLerAbrir"${p.lerPastaAoAbrir !== false ? ' checked' : ''}> Ler os PDFs e as planilhas da competência ao abrir a ferramenta</label><br>
    <label class="small"><input type="checkbox" id="psExport"${p.exportarNaPasta !== false ? ' checked' : ''}> Gravar os Excel gerados (conferência, correção e NCs) na pasta da competência, em vez de Downloads</label>
    <div class="acoes"><button id="psSalvarComp">Salvar</button></div></div>
  <div class="card"><h2>Nomes das pastas ${notaEscopo(true)}</h2><p class="lead">A ferramenta cria as pastas com estes nomes e, ao ler, reconhece também os nomes padrão e os que a equipe já usava. Deixe em branco para usar o padrão.</p>
    <table><thead><tr><th>Finalidade</th><th>Nome da pasta</th><th>Padrão</th></tr></thead><tbody>
    ${Object.entries(PASTAS_EDITAVEIS).map(([k, [, desc]]) => `<tr><td class="small">${esc(desc)}</td><td><input type="text" data-pasta="${k}" value="${esc(S.cfg.pastas?.[k] || '')}" placeholder="${esc(PADRAO_PASTAS[k].nome)}"></td><td class="small muted">${esc(PADRAO_PASTAS[k].nome)}</td></tr>`).join('')}</tbody></table>
    <p class="small muted">Hierarquia: raiz › (Fluxo, Equivalências, Configuração, Backups, Bases de dados › Comp_MM-AAAA, Competências › Comp_MM-AAAA › Relatórios para conferência › USG | IMG › Unidade N…, Correção de prestador, Conferência cruzada, Não conformidades).</p>
    <div class="acoes"><button id="psSalvarNomes">Salvar nomes</button><button class="sec" id="psPadrao">Voltar aos nomes padrão</button>${conectada ? `<button class="sec" id="psCriar">Criar pastas da competência ${rotuloCompetencia(S.comp)}</button>` : ''}</div></div>`;
}
function ligarPastas() {
  if ($('psConectar')) $('psConectar').onclick = async () => { await escolherPastaSync(); RENDER.configuracoes(); };
  if ($('psLiberar')) $('psLiberar').onclick = async () => { if (await temPermissaoPasta(true)) { SY.status = 'ok'; iniciarTimerSync(); await sincronizarFluxo({ interativo: true }); await sincronizarEq({ interativo: true }); await sincronizarCfg({ interativo: true }); } else avisar('O acesso à pasta não foi liberado.', 'warn'); RENDER.configuracoes(); };
  if ($('psDesc')) $('psDesc').onclick = async () => { if (await confirmar('Desconectar da pasta?', 'Os dados continuam neste navegador; a pasta e os arquivos não são apagados.', 'Desconectar')) { await definirPastaSync(null); RENDER.configuracoes(); } };
  if ($('psCriar')) $('psCriar').onclick = () => criarEstrutura(S.comp);
  $('psSalvarComp').onclick = () => { S.cfg.parametros = { ...S.cfg.parametros, lerPastaAoAbrir: $('psLerAbrir').checked, exportarNaPasta: $('psExport').checked }; salvarCfg('Preferências de pasta salvas.', 'parametros'); };
  $('psSalvarNomes').onclick = () => {
    const n = {}; document.querySelectorAll('[data-pasta]').forEach(i => { const v = limparNomePasta(i.value); if (v) n[i.dataset.pasta] = v; });
    const nomes = Object.keys(PASTAS_EDITAVEIS).map(k => norm(n[k] || PADRAO_PASTAS[k].nome)), rep = nomes.find((x, i) => nomes.indexOf(x) !== i);
    if (rep) return avisar(`Dois destinos com o mesmo nome de pasta («${rep}»).`, 'err');
    S.cfg.pastas = n; aplicarPastasConfig(); PRI.verifComp = ''; salvarCfg('Nomes das pastas salvos.', 'parametros'); RENDER.configuracoes();
  };
  $('psPadrao').onclick = async () => { if (await confirmar('Voltar aos nomes padrão?', 'Os nomes das subpastas voltam ao padrão. Nenhuma pasta é renomeada ou apagada.', 'Voltar')) { S.cfg.pastas = {}; aplicarPastasConfig(); salvarCfg('Nomes das pastas: padrão.', 'parametros'); RENDER.configuracoes(); } };
}

/* ---------- Exportação: modelos e colunas ---------- */
function cfgExportacao() {
  const modelos = modelosExportacao(S.cfg), escolhido = idModeloExportacao();
  if (!CF.modelo || !modelos.some(m => m.id === CF.modelo)) CF.modelo = escolhido;
  const m = modeloExportacao(S.cfg, CF.modelo);
  if (!CF.colunas || CF.colunasDe !== m.id) { CF.colunas = [...m.colunas]; CF.colunasDe = m.id; }
  const sel = new Set(CF.colunas), ordem = [...CF.colunas, ...COLUNAS_EXPORT_CONF.map(c => c.id).filter(id => !sel.has(id))];
  const amostra = S.conf?.res?.linhas?.slice(0, 5) || [];
  const prev = amostra.length ? amostra.map(x => `<tr>${CF.colunas.map(id => { const v = colunaExport(id).valor(x, { unidadeNome: S.conf.ctx?.unidadeNome || '' }, { f: {}, dec: x.decisao, textoDecisao: d => d ? TIPOS_DECISAO[d.tipo] : '', falta: x.motivos?.[0] || '' }); const t = v && typeof v === 'object' && !(v instanceof Date) ? v.v : v; return `<td class="small">${esc(t instanceof Date ? fmtData(t) : typeof t === 'number' ? fmtBR(t) : String(t ?? '')).slice(0, 60)}</td>`; }).join('')}</tr>`).join('')
    : `<tr><td class="small muted" colspan="${CF.colunas.length}">Rode uma conferência nesta sessão para ver a prévia com dados (sem dados, só os cabeçalhos).</td></tr>`;
  return `<div class="card"><h2>Modelo usado ao exportar ${notaEscopo(false)}</h2><p class="lead">Vale para a aba principal («Conferência») do Excel da conferência cruzada. As demais abas (O que falta decidir, Resumo, Técnico, MV original…) não mudam. Os dados da conferência nunca são alterados para caber no layout.</p>
    <label class="campo">Meu modelo<select id="exModeloUso">${opcoes(modelos.map(x => [x.id, x.nome]), escolhido)}</select></label></div>
  <div class="card"><h2>Editar modelos ${notaEscopo(true)}</h2>
    <div class="grid2"><label class="campo">Modelo<select id="exModelo">${opcoes(modelos.map(x => [x.id, x.nome + (x.fixo ? ' (predefinido)' : '')]), CF.modelo)}</select></label>
      <div class="acoes" style="align-self:end"><button class="sec" id="exRestaurar">Restaurar colunas do modelo</button>${m.fixo ? '' : '<button class="perigo" id="exExcluir">Excluir modelo</button>'}</div></div>
    <p class="small muted">Marque as colunas e use ↑ ↓ para mudar a ordem. ${m.fixo ? 'Modelos predefinidos não mudam: salve como um modelo novo.' : ''}</p>
    <ol class="ex-cols">${ordem.map(id => { const c = colunaExport(id), on = sel.has(id), i = CF.colunas.indexOf(id); return `<li class="${on ? '' : 'off'}"><label><input type="checkbox" data-excol="${id}"${on ? ' checked' : ''}> ${esc(c.rotulo)}</label>${on ? `<span class="ex-mov"><button class="sec mini" data-exup="${id}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button class="sec mini" data-exdn="${id}" ${i === CF.colunas.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button></span>` : ''}</li>`; }).join('')}</ol>
    <div class="acoes">${m.fixo ? '' : '<button id="exSalvar">Salvar alterações no modelo</button>'}<button class="${m.fixo ? '' : 'sec'}" id="exSalvarComo">Salvar como novo modelo…</button></div>
    <h3>Prévia (${CF.colunas.length} colunas)</h3><div class="tw"><table><thead><tr>${CF.colunas.map(id => `<th class="small">${esc(colunaExport(id).rotulo)}</th>`).join('')}</tr></thead><tbody>${prev}</tbody></table></div></div>
  <div class="card"><h2>Formatos fixos</h2><p class="small">Seguem os layouts operacionais já usados e não têm seleção de colunas: Excel da correção de prestador (aba «Corrigir no MV»), planilha de não conformidades (abas PARTICULAR, CONVENIOS (FAT) e Correção de prestadores), controle do fechamento (planilha de controle) e Fluxo mensal.</p></div>`;
}
function ligarExportacao(pg) {
  $('exModeloUso').onchange = e => { const p = lerLocal(CHAVES.exportModelo) || {}; p.conferencia = e.target.value; gravarLocal(CHAVES.exportModelo, p); avisar('Modelo de exportação escolhido.', 'ok'); };
  $('exModelo').onchange = e => { CF.modelo = e.target.value; CF.colunas = null; RENDER.configuracoes(); };
  $('exRestaurar').onclick = () => { CF.colunas = null; RENDER.configuracoes(); };
  pg.querySelectorAll('[data-excol]').forEach(c => c.onchange = () => { const id = c.dataset.excol; CF.colunas = c.checked ? [...CF.colunas, id] : CF.colunas.filter(x => x !== id); if (!CF.colunas.length) { CF.colunas = [id]; avisar('O modelo precisa de ao menos uma coluna.', 'warn'); } RENDER.configuracoes(); });
  const mover = (id, d) => { const i = CF.colunas.indexOf(id), j = i + d; if (j < 0 || j >= CF.colunas.length) return; [CF.colunas[i], CF.colunas[j]] = [CF.colunas[j], CF.colunas[i]]; RENDER.configuracoes(); };
  pg.querySelectorAll('[data-exup]').forEach(b => b.onclick = () => mover(b.dataset.exup, -1));
  pg.querySelectorAll('[data-exdn]').forEach(b => b.onclick = () => mover(b.dataset.exdn, 1));
  if ($('exSalvar')) $('exSalvar').onclick = () => { const m = S.cfg.modelosExportacao.find(x => x.id === CF.modelo); if (!m) return; m.colunas = [...CF.colunas]; m.alteradoEm = agoraISO(); m.alteradoPor = S.operador; salvarCfg(`Modelo «${m.nome}» salvo.`, 'parametros'); RENDER.configuracoes(); };
  if ($('exExcluir')) $('exExcluir').onclick = async () => { const m = S.cfg.modelosExportacao.find(x => x.id === CF.modelo); if (!m || !await confirmar('Excluir modelo?', `«${esc(m.nome)}» deixa de existir para os dois. Quem usava volta ao Padrão.`, 'Excluir')) return; S.cfg.modelosExportacao = S.cfg.modelosExportacao.filter(x => x !== m); CF.modelo = 'padrao'; CF.colunas = null; salvarCfg('Modelo excluído.', 'parametros'); RENDER.configuracoes(); };
  $('exSalvarComo').onclick = async () => {
    const r = await dialogo('Novo modelo de exportação', `<label class="campo">Nome do modelo<input type="text" name="nome" autofocus></label><label class="small"><input type="checkbox" name="usar" checked> Usar este modelo nas minhas exportações</label>`, [['', 'Cancelar', 'sec'], ['ok', 'Salvar']]);
    const nome = (r.campos.nome || '').trim(); if (r.botao !== 'ok' || !nome) return;
    const m = { id: novoId('mx'), nome, alvo: 'conferencia', colunas: [...CF.colunas], criadoEm: agoraISO(), criadoPor: S.operador };
    S.cfg.modelosExportacao.push(m); CF.modelo = m.id; CF.colunasDe = m.id;
    if (r.campos.usar) { const p = lerLocal(CHAVES.exportModelo) || {}; p.conferencia = m.id; gravarLocal(CHAVES.exportModelo, p); }
    salvarCfg(`Modelo «${nome}» criado.`, 'parametros'); RENDER.configuracoes();
  };
}

/* ---------- Backup e dados ---------- */
const prefBackup = () => ({ auto: true, manter: 30, incluirNC: true, ...(lerLocal(CHAVES.bkPasta) || {}) });
function partesAtuaisBackup({ nc = false, rodadas = null, preferencias = true } = {}) {
  return {
    configuracao: S.cfg, equivalencias: S.eq, fluxo: S.fluxo, competencias: S.compReg, controleUnidades: lerLocal(CHAVES.controleUn) || {},
    preferencias: preferencias ? Object.fromEntries(['tema', 'acento', 'menu', 'exportModelo'].map(k => [k, lerLocal(CHAVES[k])]).filter(([, v]) => v !== null)) : undefined,
    nc: nc ? S.nc : undefined, rodadas: rodadas || undefined
  };
}
const VALIDADORES_BACKUP = { configuracao: validarConfig, equivalencias: validarEq, fluxo: validarFluxo, competencias: validarRegistroCompetencias, nc: validarNC };
function cfgBackup() {
  const pb = prefBackup(), est = KV.estimativa, mb = n => (n / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `<div class="card"><h2>Backup</h2>
    <p class="lead">O backup leva a configuração (Bases, regras, parâmetros, pastas e modelos de exportação), as equivalências e regras compostas, o fluxo mensal, as competências, o controle de prestadores por unidade e as preferências de quem exportou. Cada parte tem a sua impressão digital: arquivo incompleto ou alterado é recusado antes de restaurar.</p>
    <div class="acoes"><button id="bkExp">Baixar backup (.json)</button><label class="small"><input type="checkbox" id="bkRod" checked> incluir rodadas</label><label class="small"><input type="checkbox" id="bkNC"> incluir não conformidades (contém nomes de pacientes)</label></div>
    ${SY.handle && !SY.legado ? `<h3>Na pasta da rede (${esc(PASTAS_RAIZ.backups.nome)})</h3>
    <div class="acoes"><button id="bkPastaAgora">Gravar backup na pasta agora</button><label class="small"><input type="checkbox" id="bkAuto"${pb.auto ? ' checked' : ''}> backup automático uma vez por dia, ao abrir</label><label class="small">manter os últimos <input type="number" id="bkManter" min="3" max="365" value="${pb.manter}" style="width:64px"> automáticos</label><label class="small"><input type="checkbox" id="bkPastaNC"${pb.incluirNC ? ' checked' : ''}> incluir NCs (a pasta da rede já guarda os PDFs com dados de pacientes)</label><button class="sec mini" id="bkPrefSalvar">Salvar</button></div>
    <div id="bkLista" class="small muted">Lendo os backups da pasta…</div>` : '<p class="small muted">Conecte a pasta raiz (Pastas e sincronização) para gravar backups automáticos na rede.</p>'}</div>
  <div class="card"><h2>Restaurar</h2><p class="lead">Antes de restaurar, a ferramenta mostra o que tem no arquivo, confere a integridade, e você escolhe as partes. O estado atual vira uma cópia de segurança. Com a pasta conectada, a próxima sincronização compara a versão restaurada com a da pasta <b>sem</b> sobrescrever as decisões mais novas: o que divergir vira escolha sua.</p>
    <div class="acoes"><button id="bkImp" class="sec">Restaurar de um arquivo…</button><input type="file" id="bkArq" accept=".json" hidden><button id="bkDesfazerEq" class="sec">Desfazer última substituição de equivalências</button></div></div>
  <div class="card"><h2>Dados neste navegador</h2>
    <dl class="kv"><dt>Configuração</dt><dd>revisão ${S.cfg.revisao} · ${S.cfg.unidades.length} unidades · ${S.cfg.prestadores.length} prestadores · ${S.cfg.classificacao.length} regras</dd>
      <dt>Equivalências</dt><dd>revisão ${S.eq.revisao} · ${S.eq.itens.length} relações · ${(S.eq.compostas || []).length} regras compostas</dd><dt>Fluxo mensal</dt><dd>modelo rev. ${S.fluxo.modelo.revisao} · ${Object.keys(S.fluxo.competencias).length} competência(s)</dd><dt>Não conformidades</dt><dd>${S.nc.itens.length} NC(s) · retenção de ${retencaoNC()} dias para dados de pacientes</dd><dt>Rodadas</dt><dd>${S.rodadas.length} ${DB.ok ? '(IndexedDB)' : '(só nesta sessão)'}</dd>
      <dt>Armazenamento</dt><dd>${KV.db ? 'IndexedDB + localStorage' : 'só localStorage (IndexedDB indisponível)'}${est?.usage ? ` · ${mb(est.usage)} MB em uso de ${mb(est.quota)} MB` : ''} · ${KV.persistente === true ? '<span class="badge ok">persistente</span>' : KV.persistente === false ? '<span class="badge warn">o navegador pode apagar se faltar espaço — mantenha backups</span>' : ''}${KV.erros ? ` · <span class="badge err">${KV.erros} falha(s) de gravação (${esc(KV.ultimoErro)})</span>` : ''}</dd></dl>
    <div class="acoes"><button id="bkApagar" class="perigo">Apagar todos os dados locais</button></div></div>`;
}
async function restaurarBackup(b, origem) {
  const v = validarBackup(b, VALIDADORES_BACKUP);
  if (v.erros.length) return avisar(`Backup não restaurado: ${v.erros.join('; ')}`, 'err');
  const r = await dialogo('Restaurar backup', `<p class="small">Arquivo: <b>${esc(origem)}</b> · gerado em ${b.exportadoEm ? new Date(b.exportadoEm).toLocaleString('pt-BR') : '—'}${b.operador ? ` por ${esc(b.operador)}` : ''} · versão ${esc(b.motor || '—')}</p>
    ${v.avisos.map(a => `<p class="small"><span class="badge warn">atenção</span> ${esc(a)}</p>`).join('')}
    <p class="small">Marque o que restaurar (o resto continua como está):</p>
    ${v.partes.map(p => `<label class="small" style="display:block;margin:4px 0"><input type="checkbox" name="p_${p.k}"${p.ok && p.k !== 'preferencias' ? ' checked' : ''}${p.ok ? '' : ' disabled'}> <b>${esc(p.nome)}</b> — ${esc(p.resumo)}${p.ok ? '' : ` <span class="badge err">${esc(p.erros.join('; '))}</span>`}</label>`).join('')}
    <p class="small muted">O estado atual de cada parte marcada fica guardado como cópia de segurança antes de ser substituído.</p>`, [['', 'Cancelar', 'sec'], ['ok', 'Restaurar']]);
  if (r.botao !== 'ok') return;
  const quer = k => r.campos[`p_${k}`] === true && v.partes.find(p => p.k === k)?.ok;
  if (!v.partes.some(p => quer(p.k))) return avisar('Nada marcado para restaurar.', 'warn');
  // Cópia de segurança completa do estado atual (na pasta, se conectada; senão no navegador).
  const atual = montarBackup(partesAtuaisBackup({ nc: true, rodadas: await dbTodas() }), { operador: S.operador, motivo: `antes de restaurar ${origem}` });
  if (!(await gravarBackupPasta(atual, { auto: false, silencioso: true }))) gravarLocal(CHAVES.bkAntes, atual);
  const feito = [];
  if (quer('configuracao')) { backupAntesDeSubstituir(CHAVES.cfgAnterior, S.cfg); S.cfg = clone(b.configuracao); migrarConfig(S.cfg); aplicarPastasConfig(); salvarCfgSemSync(); feito.push('configuração'); }
  if (quer('equivalencias')) { backupAntesDeSubstituir(CHAVES.eqAnterior, S.eq); S.eq = clone(b.equivalencias); salvarEq(); feito.push('equivalências'); }
  if (quer('fluxo')) { backupAntesDeSubstituir(CHAVES.fluxoAnterior, S.fluxo); S.fluxo = clone(b.fluxo); salvarFluxo(); feito.push('fluxo'); }
  if (quer('competencias')) { S.compReg = clone(b.competencias); salvarCompReg(); feito.push('competências'); }
  if (quer('controleUnidades')) { gravarLocal(CHAVES.controleUn, b.controleUnidades); feito.push('controle por unidade'); }
  if (quer('preferencias')) { for (const [k, x] of Object.entries(b.preferencias || {})) if (CHAVES[k] && CHAVES_INDIVIDUAIS.includes(k)) gravarLocal(CHAVES[k], x); aplicarTema(); feito.push('preferências'); }
  if (quer('nc')) { backupAntesDeSubstituir(CHAVES.ncAnterior, S.nc); S.nc = clone(b.nc); aplicarRetencaoNC(S.nc, retencaoNC()); S.nc.candidatos = S.nc.candidatos || []; S.ncCand = S.nc.candidatos; S.ncDispensados = new Set((S.nc.dispensados || []).map(d => d.chave)); salvarNC(); feito.push('NCs'); }
  if (quer('rodadas')) { for (const x of b.rodadas) await guardarRodada(x); feito.push(`${b.rodadas.length} rodada(s)`); }
  avisar(`Backup restaurado: ${feito.join(', ')}.${SY.handle && !SY.legado ? ' Na próxima sincronização, o que divergir da pasta vira escolha sua.' : ''}`, 'ok');
  RENDER.configuracoes();
  if (SY.handle && !SY.legado) { sincronizarCfg({ interativo: true }).then(() => sincronizarEq({ interativo: true })); }
}
// Grava um backup na pasta da rede, confere o que ficou gravado e apaga os automáticos mais antigos.
async function gravarBackupPasta(b, { auto = false, silencioso = false } = {}) {
  if (!SY.handle || SY.legado || !(await temPermissaoPasta(!silencioso))) return false;
  try {
    const d = await caminho([PASTAS_RAIZ.backups], true), nome = nomeArquivoBackup(S.operador, auto), texto = JSON.stringify(b);
    const fh = await d.getFileHandle(nome, { create: true }), w = await fh.createWritable(); await w.write(texto); await w.close();
    const lido = JSON.parse(await (await fh.getFile()).text()), v = validarBackup(lido, VALIDADORES_BACKUP);
    if (v.erros.length || v.partes.some(p => !p.ok)) throw new Error('o arquivo gravado não passou na conferência');
    if (auto) {
      const pb = prefBackup(), meus = [];
      for await (const h of d.values()) if (h.kind === 'file' && h.name.endsWith(`_${nomeSeguroBackup(S.operador || 'sem-operador')}_auto.json`)) meus.push(h.name);
      meus.sort(); for (const n of meus.slice(0, Math.max(0, meus.length - Math.max(3, +pb.manter || 30)))) await d.removeEntry(n).catch(() => {});
    }
    if (!silencioso) avisar(`Backup gravado e conferido: ${PASTAS_RAIZ.backups.nome} › ${nome}`, 'ok');
    return nome;
  } catch (e) { if (!silencioso) avisar(`Backup na pasta não gravado (${e.message}). Baixe um backup pelo botão.`, 'err'); return false; }
}
async function backupAutomaticoDiario() {
  const pb = prefBackup(), hoje = new Date().toISOString().slice(0, 10);
  if (!pb.auto || pb.ultimoAuto === hoje || !SY.handle || SY.legado || SY.status === 'permissao') return;
  const b = montarBackup(partesAtuaisBackup({ nc: pb.incluirNC, rodadas: await dbTodas() }), { operador: S.operador, motivo: 'automático diário' });
  if (await gravarBackupPasta(b, { auto: true, silencioso: true })) gravarLocal(CHAVES.bkPasta, { ...pb, ultimoAuto: hoje });
}
const _restaurarPastaSyncBk = restaurarPastaSync;
restaurarPastaSync = async function () { await _restaurarPastaSyncBk(); setTimeout(() => backupAutomaticoDiario().catch(() => {}), 3000); };
async function listarBackupsPasta() {
  const d = await caminho([PASTAS_RAIZ.backups]); if (!d) return [];
  const l = []; for await (const h of d.values()) if (h.kind === 'file' && /\.json$/i.test(h.name)) { const f = await h.getFile(); l.push({ h, nome: h.name, em: f.lastModified, tam: f.size }); }
  return l.sort((a, b) => b.em - a.em);
}
function ligarBackup() {
  $('bkExp').onclick = async () => baixarJSON(montarBackup(partesAtuaisBackup({ nc: $('bkNC').checked, rodadas: $('bkRod').checked ? await dbTodas() : null }), { operador: S.operador }), `backup_repasse_medico_${carimbo()}.json`);
  $('bkImp').onclick = () => $('bkArq').click();
  $('bkArq').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; let b; try { b = JSON.parse(await f.text()); } catch (err) { return avisar('Backup não restaurado: o arquivo não é um JSON válido (incompleto?).', 'err'); } restaurarBackup(b, f.name); };
  $('bkDesfazerEq').onclick = async () => {
    const ant = lerLocal(CHAVES.eqAnterior); if (!ant) return avisar('Não há cópia anterior da base de equivalências.', 'warn');
    if (!await confirmar('Voltar à base anterior?', `Cópia de ${new Date(ant.em).toLocaleString('pt-BR')}, revisão ${ant.valor.revisao}, ${ant.valor.itens.length} relações.`, 'Voltar')) return;
    const atual = S.eq; S.eq = ant.valor; backupAntesDeSubstituir(CHAVES.eqAnterior, atual); salvarEq('Base anterior restaurada.'); RENDER.configuracoes();
  };
  $('bkApagar').onclick = async () => {
    if (!await confirmar('Apagar todos os dados locais?', 'Configuração, equivalências, fluxo mensal, não conformidades, operador e rodadas deste navegador serão apagados. A pasta da rede não é apagada. Exporte um backup antes.', 'Apagar tudo')) return;
    for (const k of Object.values(CHAVES)) apagarLocal(k);
    await dbApagar(null); location.reload();
  };
  if ($('bkPastaAgora')) {
    $('bkPastaAgora').onclick = async () => { const pb = prefBackup(); await gravarBackupPasta(montarBackup(partesAtuaisBackup({ nc: pb.incluirNC, rodadas: await dbTodas() }), { operador: S.operador, motivo: 'manual' })); RENDER.configuracoes(); };
    $('bkPrefSalvar').onclick = () => { gravarLocal(CHAVES.bkPasta, { ...prefBackup(), auto: $('bkAuto').checked, manter: Math.min(365, Math.max(3, +$('bkManter').value || 30)), incluirNC: $('bkPastaNC').checked }); avisar('Preferências de backup salvas.', 'ok'); };
    listarBackupsPasta().then(l => {
      const el = $('bkLista'); if (!el) return;
      el.innerHTML = l.length ? `<table><thead><tr><th>Arquivo</th><th>Gravado em</th><th>Tamanho</th><th></th></tr></thead><tbody>${l.slice(0, 15).map((x, i) => `<tr><td>${esc(x.nome)}</td><td>${new Date(x.em).toLocaleString('pt-BR')}</td><td>${(x.tam / 1024).toFixed(0)} KB</td><td><button class="sec mini" data-bkr="${i}">Restaurar…</button></td></tr>`).join('')}</tbody></table>${l.length > 15 ? `<p>… e mais ${l.length - 15} arquivo(s).</p>` : ''}` : 'Nenhum backup na pasta ainda.';
      el.querySelectorAll('[data-bkr]').forEach(bt => bt.onclick = async () => { const x = l[+bt.dataset.bkr]; let b; try { b = JSON.parse(await (await x.h.getFile()).text()); } catch (e) { return avisar('Arquivo de backup ilegível (incompleto?).', 'err'); } restaurarBackup(b, x.nome); });
    }).catch(e => { const el = $('bkLista'); if (el) el.textContent = `Não foi possível ler a pasta de backups (${e.message}).`; });
  }
}

/* ---------- Sobre ---------- */
function cfgSobre() {
  return `<div class="card"><h2>Sobre</h2><dl class="kv"><dt>Versão</dt><dd>${MOTOR_VERSAO}</dd><dt>Atualização</dt><dd id="sbAtual">${esc(textoAtualizacao())}</dd><dt>Instalação</dt><dd>No Edge, abra o site e use <b>…</b> → <b>Aplicativos</b> → <b>Instalar este site como aplicativo</b>: a ferramenta abre em janela própria. Os dados e a pasta conectada continuam os mesmos do site.</dd><dt>Especificação</dt><dd>Documentação v1.6 — RN-178 a RN-215; auditoria da v3.0 em docs/v3.0-auditoria.md</dd><dt>Bibliotecas</dt><dd>pdf.js (Apache-2.0) e JSZip (MIT/GPLv3), embutidas</dd><dt>Privacidade</dt><dd>Os arquivos são lidos só no navegador; nada é enviado à internet. A pasta da rede é a única cópia compartilhada.</dd></dl>
    <div class="acoes"><button class="sec" id="sbVerificar">Verificar atualização agora</button></div></div>`;
}
function ligarSobre() { $('sbVerificar').onclick = async () => { await verificarAtualizacao(true); const e = $('sbAtual'); if (e) e.textContent = textoAtualizacao(); }; }
