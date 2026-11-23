/* ============================================================
 * Pasta raiz do aplicativo na rede (SOL-F36, F37 e F38) — estrutura padronizada (v3.0.0-alpha.14, pedido de 17/11/2026)
 *   App repasse médico (raiz escolhida no Edge)
 *   ├─ 01 - Sistema/            Backups · Configurações compartilhadas · Equivalências TUSS · Fluxo mensal
 *   │                            · Bases compartilhadas · Outros arquivos permanentes do sistema
 *   ├─ 02 - Repasse 2026/       2026-01 - Janeiro … 2026-12 - Dezembro
 *   └─ 03 - Repasse 2027/       (mesma estrutura, um ano por pasta)
 *  Cada competência: 01 - Correção de prestador · 02 - Não conformidades · 03 - NFS para pagamento (Pagamento 15 | 30)
 *   · 04 - Planilhas de conferência · 05 - Relatórios de repasse MV (USG | IMG › unidade; Curitiba › Prestadores
 *   Unidade | Prestadores SRA) · 06 - Relatórios de prestadores conferidos · 07 - Mutirão unidades · 08 - Repasse final
 *   · 09 - Planilhas de repasse conferidos (USG | IMG › unidade; Curitiba): planilha única da unidade × grupo (SOL-F45).
 * Compatibilidade: a estrutura antiga (Fluxo mensal, Equivalência TUSS (sincronização), Configuração compartilhada e
 * backups na raiz; Competências › Comp_MM-AAAA; Bases de dados › Comp_MM-AAAA) continua sendo lida. Nada é apagado,
 * renomeado ou movido pela ferramenta: a mudança dos arquivos é manual (guia em docs/como-usar-pastas.md).
 * ============================================================ */
const PASTAS_RAIZ = {
  fluxo: { nome: 'Fluxo mensal', re: /^FLUXO MENSAL/ },
  eq: { nome: 'Equivalência TUSS (sincronização)', re: /^EQUIVALENCIAS? TUSS/ },
  bases: { nome: 'Bases de dados', re: /^BASES? DE DADOS/ },
  backups: { nome: 'backups', re: /^BACKUPS?$/ },
  comps: { nome: 'Competências', re: /^COMPETENCIAS$/ }
};
// Estrutura nova: «01 - Sistema» com os arquivos permanentes; um ano por pasta («02 - Repasse 2026»); uma pasta por mês.
const MESES_PASTA = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const PASTA_SISTEMA = { nome: '01 - Sistema', re: /^(\d+ )?SISTEMA$/ };
const SISTEMA = {
  backups: { nome: 'Backups', re: /^BACKUPS?$/ }, cfg: { nome: 'Configurações compartilhadas', re: /^CONFIGURACO(ES|AO) COMPARTILHADAS?$/ },
  eq: { nome: 'Equivalências TUSS', re: /^EQUIVALENCIAS? TUSS$/ }, fluxo: { nome: 'Fluxo mensal', re: /^FLUXO MENSAL$/ },
  bases: { nome: 'Bases compartilhadas', re: /^BASES COMPARTILHADAS$/ }, outros: { nome: 'Outros arquivos permanentes do sistema', re: /^OUTROS ARQUIVOS/ }
};
const pastaAno = ano => ({ nome: `${String(Math.max(2, ano - 2024)).padStart(2, '0')} - Repasse ${ano}`, re: new RegExp(`^(\\d+ )?REPASSE ${ano}$`) });
const nomePastaMes = chave => `${chave} - ${MESES_PASTA[+chave.slice(5) - 1]}`;
const pastaMes = chave => ({ nome: nomePastaMes(chave), re: new RegExp(`^${chave.slice(0, 4)} ${chave.slice(5)}( |$)`) });
// Pastas do mês (os nomes antigos continuam reconhecidos na leitura: «Correção de prestador», «Relatórios para conferência»…).
const PASTA_CORR = { nome: '01 - Correção de prestador', re: /^(\d+ )?CORRECAO DE PREST/ };
const PASTA_NC = { nome: '02 - Não conformidades', re: /^(\d+ )?NAO CONFORMIDADES/ };
const PASTA_NFS = { nome: '03 - NFS para pagamento', re: /^(\d+ )?NFS? (PARA )?PAGAMENTO/ };
// «09 - Planilhas de repasse conferidos» também começa com «Planilhas»: fica fora da 04 (senão o Excel da 09 seria lido como laudos).
const PASTA_PLAN = { nome: '04 - Planilhas de conferência', re: /^(\d+ )?PLANILHAS(?! DE REPASSE CONFERIDOS)/ };
const PASTA_REL = { nome: '05 - Relatórios de repasse MV', re: /^(\d+ )?RELATORIOS? (DE REPASSE MV|(MV )?(PARA )?CONFERENCIA)/ };
const PASTA_CONFERIDOS = { nome: '06 - Relatórios de prestadores conferidos', re: /^(\d+ )?RELATORIOS? DE PRESTADORES CONFERIDOS/ };
const PASTA_MUTIRAO = { nome: '07 - Mutirão unidades', re: /^(\d+ )?MUTIRAO/ };
const PASTA_FINAL = { nome: '08 - Repasse final', re: /^(\d+ )?REPASSE FINAL$/ };
// SOL-F45: planilha única de cada unidade × grupo (IMG | USG › unidade; Curitiba), gravada pela ferramenta.
const PASTA_PLAN_CONF = { nome: '09 - Planilhas de repasse conferidos', re: /^(\d+ )?PLANILHAS DE REPASSE CONFERIDOS/ };
const PASTA_CONF = { nome: 'Conferência cruzada', re: /^CONFERENCIA CRUZADA/ };   // só da estrutura antiga
const GRUPOS_REL = { usg: { nome: 'USG', re: /^(USG|ULTRA)/ }, img: { nome: 'IMG', re: /^(IMG|IMAGEM)/ }, curitiba: { nome: 'Curitiba', re: /^(CURITIBA|V3)/ } };
const SUB_CURITIBA = ['Prestadores Unidade', 'Prestadores SRA'];
const SUB_CONFERIDOS = ['Repasse Ecodoppler', 'Repasse Sedação', 'Repasse IMG', 'Repasse Curitiba', 'Repasse USG'];
// Nome da pasta da unidade em USG e IMG: o nome cadastrado, sem o complemento entre parênteses (ex.: «Alphasonic Londrina»).
const PALAVRAS_MINUSC = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const nomePastaUnidadeRel = u => limparNomePasta(String(u.nome || `Unidade ${u.cod}`).replace(/\([^)]*\)/g, '').trim().toLowerCase().split(/\s+/)
  .map((w, i) => i && PALAVRAS_MINUSC.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
// Unidade de uma pasta de USG/IMG: «Unidade N - …» (antiga) ou o nome da unidade (nova).
function unidadeDaPastaRel(nome) {
  const cod = unidadeDoNomePasta(nome); if (cod) return cod;
  const n = norm(nome), achou = S.cfg.unidades.filter(u => { const k = norm(nomePastaUnidadeRel(u)); return k && (k === n || n.includes(k) || k.includes(n)); });
  return achou.length === 1 ? String(achou[0].cod) : '';
}
const grupoDaPasta = n => { const t = norm(n); return /^(USG|ULTRA)/.test(t) ? 'usg' : /^(IMG|IMAGEM)/.test(t) ? 'img' : /^(CURITIBA|V3)/.test(t) ? 'curitiba' : ''; };
const nomeCompPasta = chave => `Comp_${chave.slice(5)}-${chave.slice(0, 4)}`;
const pastaComp = chave => ({ nome: nomeCompPasta(chave), re: new RegExp(`^COMP(ETENCIA)? ${chave.slice(5)} ${chave.slice(0, 4)}$`) });
const ehSubpastaConhecida = nome => Object.values(PASTAS_RAIZ).some(p => p.re.test(norm(nome))) || /^COMP(ETENCIA)? \d{2} \d{4}$/.test(norm(nome))
  || PASTA_SISTEMA.re.test(norm(nome)) || /^(\d+ )?REPASSE \d{4}$/.test(norm(nome)) || /^\d{4} \d{2}( |$)/.test(norm(nome));
const ehPastaLegadaFluxo = h => !!h && PASTAS_RAIZ.fluxo.re.test(norm(h.name));
const limparNomePasta = s => String(s).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
const nomePastaUnidade = u => limparNomePasta(`Unidade ${u.cod} - ${u.nome}`);

// Subpasta pelo nome (sem diferença de maiúsculas, acentos ou espaços); cria com o nome padrão se faltar.
async function subpasta(dir, alvo, criar = false) {
  const re = typeof alvo === 'string' ? new RegExp('^' + norm(alvo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') : alvo.re, nome = typeof alvo === 'string' ? alvo : alvo.nome;
  // v3.0: o nome configurado vale primeiro; nomes padrão/antigos só são aceitos na leitura, ou ao criar quando o
  // nome não foi personalizado (assim, trocar o nome da pasta de backups grava na pasta nova, e nada se perde ao ler).
  let parecida = null;
  for await (const h of dir.values()) if (h.kind === 'directory') { if (norm(h.name) === norm(nome)) return h; if (!parecida && re.test(norm(h.name))) parecida = h; }
  if (parecida && !(criar && alvo.personalizado)) return parecida;
  return criar ? dir.getDirectoryHandle(nome, { create: true }) : null;
}
async function caminho(partes, criar = false) {
  let d = SY.handle; if (!d || SY.legado) return null;
  for (const p of partes) { d = await subpasta(d, p, criar); if (!d) return null; }
  return d;
}
/* Arquivos permanentes: «01 - Sistema › …» quando existe; senão a pasta antiga da raiz (enquanto os arquivos não forem
 * movidos à mão); senão cria a nova. Assim os dois navegadores continuam se encontrando durante a mudança. */
const LOC_SISTEMA = {};   // tipo → caminho em uso (para mostrar na tela)
async function dirSistema(k, criar = true) {
  const novo = await caminho([PASTA_SISTEMA, SISTEMA[k]]); if (novo) { LOC_SISTEMA[k] = `${PASTA_SISTEMA.nome}\\${novo.name}`; return novo; }
  const antigo = PASTAS_RAIZ[k] ? await caminho([PASTAS_RAIZ[k]]) : null; if (antigo) { LOC_SISTEMA[k] = antigo.name; return antigo; }
  if (!criar) return null;
  const d = await caminho([PASTA_SISTEMA, SISTEMA[k]], true); LOC_SISTEMA[k] = `${PASTA_SISTEMA.nome}\\${d.name}`; return d;
}
const localSistema = k => LOC_SISTEMA[k] || `${PASTA_SISTEMA.nome}\\${SISTEMA[k].nome}`;
async function dirFluxo() {
  if (SY.legado) return SY.handle;
  const d = await dirSistema('fluxo'); SY.nomeFluxo = localSistema('fluxo'); return d;
}
const dirEq = () => dirSistema('eq');

/* ---------- Criar as pastas (estrutura padronizada) ---------- */
// Caminhos da competência na estrutura nova, a partir da raiz. As pastas de 20%, 25% e anestesistas são da equipe: não entram.
function estruturaCompetencia(chave) {
  const uns = S.cfg.unidades.filter(u => (u.apolo || []).length).sort((a, b) => +a.cod - +b.cod);
  const normais = uns.filter(u => !ehUnidadeV3(S.cfg, u.cod)), base = [pastaAno(+chave.slice(0, 4)), pastaMes(chave)], cam = [];
  cam.push([...base, PASTA_CORR], [...base, PASTA_NC]);
  for (const s of ['Pagamento 15', 'Pagamento 30']) cam.push([...base, PASTA_NFS, s]);
  cam.push([...base, PASTA_PLAN]);
  for (const g of ['usg', 'img']) for (const u of normais) cam.push([...base, PASTA_REL, GRUPOS_REL[g], nomePastaUnidadeRel(u)]);
  for (const s of SUB_CURITIBA) cam.push([...base, PASTA_REL, GRUPOS_REL.curitiba, s]);
  for (const s of SUB_CONFERIDOS) cam.push([...base, PASTA_CONFERIDOS, s]);
  cam.push([...base, PASTA_MUTIRAO], [...base, PASTA_FINAL]);
  for (const g of ['usg', 'img']) for (const u of normais) cam.push([...base, PASTA_PLAN_CONF, GRUPOS_REL[g], nomePastaUnidadeRel(u)]);
  if (uns.some(u => ehUnidadeV3(S.cfg, u.cod))) cam.push([...base, PASTA_PLAN_CONF, GRUPOS_REL.curitiba]);
  return cam;
}
// «01 - Sistema»: só as pastas que ainda não existem nem na estrutura antiga (as antigas são movidas à mão, pelo guia).
async function estruturaSistema() {
  const cam = [];
  for (const k of Object.keys(SISTEMA)) if (!(PASTAS_RAIZ[k] && await caminho([PASTAS_RAIZ[k]]))) cam.push([PASTA_SISTEMA, SISTEMA[k]]);
  return cam;
}
const textoCaminho = c => c.map(p => typeof p === 'string' ? p : p.nome).join(' › ');
// Pasta do mês: a nova (Repasse AAAA › AAAA-MM - Mês) e, se ainda existir, a antiga (Competências › Comp_MM-AAAA ou
// Comp_MM-AAAA na raiz). Grava na nova quando ela existe (ou ao criar); lê das duas.
const dirCompetenciaNova = (chave, criar = false) => caminho([pastaAno(+chave.slice(0, 4)), pastaMes(chave)], criar);
const dirCompetenciaAntiga = async chave => (await caminho([PASTAS_RAIZ.comps, pastaComp(chave)])) || (await caminho([pastaComp(chave)]));
async function dirCompetencia(chave, criar = false) {
  return (await dirCompetenciaNova(chave)) || (await dirCompetenciaAntiga(chave)) || (criar ? dirCompetenciaNova(chave, true) : null);
}
async function dirsCompetencia(chave) { return [await dirCompetenciaNova(chave), await dirCompetenciaAntiga(chave)].filter(Boolean); }
async function verificarEstrutura(chave = S.comp) {
  const cam = [...await estruturaSistema(), ...estruturaCompetencia(chave)], faltam = [];
  for (const c of cam) if (!(await caminho(c, false))) faltam.push(textoCaminho(c));
  return { total: cam.length, faltam, antiga: !!(await dirCompetenciaAntiga(chave)), sistemaAntigo: await sistemaAntigo() };
}
// Pastas permanentes que ainda estão na raiz, no lugar antigo (para o guia de mudança).
async function sistemaAntigo() { const out = []; for (const k of Object.keys(SISTEMA)) { const d = PASTAS_RAIZ[k] && await caminho([PASTAS_RAIZ[k]]); if (d && !(await caminho([PASTA_SISTEMA, SISTEMA[k]]))) out.push({ k, de: d.name, para: `${PASTA_SISTEMA.nome} › ${SISTEMA[k].nome}` }); } return out; }
// Cria o que falta (nunca apaga nem renomeia). chaves: competências (ex.: as 12 de um ano).
async function criarEstrutura(chave = S.comp, { chaves = null } = {}) {
  if (!SY.handle || SY.legado) return avisar('Conecte primeiro a pasta raiz do aplicativo.', 'warn');
  if (!(await temPermissaoPasta(true))) return avisar('O acesso à pasta não foi liberado.', 'warn');
  const lista = chaves || [chave], cam = [...await estruturaSistema(), ...lista.flatMap(estruturaCompetencia)], faltam = [];
  for (const c of cam) if (!(await caminho(c, false))) faltam.push(c);
  const rot = chaves ? `do ano ${lista[0].slice(0, 4)}` : `da competência ${rotuloCompetencia(chave)}`;
  if (!faltam.length) { avisar(`As pastas ${rot} já existem.`, 'ok'); PRI.verifComp = ''; return RENDER.inicio(); }
  if (!await confirmar(`Criar ${faltam.length} pasta(s)?`, `Dentro de «${esc(SY.handle.name)}», na estrutura padronizada. Nada é apagado, renomeado ou movido.<ul class="small">${faltam.slice(0, 14).map(f => `<li>${esc(textoCaminho(f))}</li>`).join('')}${faltam.length > 14 ? `<li>… e mais ${faltam.length - 14}</li>` : ''}</ul>`, 'Criar')) return;
  try { for (const c of faltam) await caminho(c, true); avisar(`Pastas ${rot} criadas (${faltam.length}).`, 'ok'); }
  catch (e) { avisar(`Não foi possível criar as pastas (${e.message}).`, 'err'); }
  PRI.verifComp = ''; RENDER.inicio();
}
const competenciasDoAno = ano => Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`);
const criarEstruturaAno = ano => criarEstrutura(`${ano}-01`, { chaves: competenciasDoAno(ano) });

/* ---------- Ler PDFs e planilhas da pasta do mês (SOL-F38) ---------- */
const PR = { lidos: new Map(), ultima: null, lendo: false };   // caminho → «tamanho|data» do que já foi lido nesta sessão
async function* arquivosEm(dir, rel = '') {
  for await (const h of dir.values()) {
    if (h.name.startsWith('_') || h.name.startsWith('~$')) continue;   // _antigos e arquivos temporários do Office
    if (h.kind === 'directory') yield* arquivosEm(h, `${rel}${h.name}/`); else yield { h, caminho: rel + h.name };
  }
}
const unidadeDoNomePasta = n => (norm(n).match(/^(?:UNIDADE |UN )?(\d+)\b/) || [])[1] || '';
/* Unidade de um PDF da Correção de prestador pelo nome do arquivo «nome_unidade»: o que vem depois do último «_» é o código
 * da unidade (17, «Unidade 17», «un17») ou parte do nome dela (Cambé, Arapongas…). Sem isso, vale «unidade N» em qualquer
 * parte do nome e, por fim, a subpasta (organização antiga). */
function unidadeDoArquivoCorrecao(nomeArq, pastaPai = '') {
  const base = String(nomeArq).replace(/\.pdf$/i, ''), fim = norm(base.includes('_') ? base.slice(base.lastIndexOf('_') + 1) : '');
  if (fim) {
    const cod = (fim.match(/^(?:UNIDADE ?|UN ?)?(\d+)$/) || [])[1];
    if (cod && unidadePorCod(S.cfg, cod)) return cod;
    const porNome = S.cfg.unidades.filter(u => [u.nome, ...(u.apolo || [])].some(n => { const k = norm(n); return k && (k.includes(fim) || fim.includes(k)); }));
    if (porNome.length === 1) return String(porNome[0].cod);
  }
  return unidadeSugeridaPeloArquivo(nomeArq) || unidadeDoNomePasta(pastaPai);
}
// so: 'conferencia' ou 'correcao' lê só aquela pasta de PDFs (botão «Sincronizar pasta» de cada aba), sem a outra pasta.
// As planilhas do mês (04) entram também: as duas abas precisam da planilha de laudos do Apolo, e a planilha só é relida se mudou.
async function atualizarDaPasta({ silencioso = false, so = null } = {}) {
  if (!SY.handle || SY.legado) { if (!silencioso) avisar('Conecte a pasta raiz do aplicativo no Início.', 'warn'); return null; }
  if (PR.lendo) return null;
  if (!(await temPermissaoPasta(!silencioso))) { if (!silencioso) avisar('O acesso à pasta não foi liberado.', 'warn'); return null; }
  PR.lendo = true; const r = { pdfs: 0, novos: 0, mudaram: 0, planilhas: 0, avisos: [] };
  try {
    const comp = nomePastaMes(S.comp), dCs = await dirsCompetencia(S.comp);   // estrutura nova e, se ainda existir, a antiga
    // Planilhas do mês: «04 - Planilhas de conferência» (nova) ou, na antiga, Bases de dados › Comp_MM-AAAA e PLANILHAS-… do mês
    // (vale a mais recente de cada tipo). Na pasta só ficam as planilhas de entrada: o Excel da conferência vai para a 05.
    const dirsPl = [...await Promise.all(dCs.map(d => subpasta(d, PASTA_PLAN))), await caminho([PASTAS_RAIZ.bases, pastaComp(S.comp)])].filter(Boolean);
    if (dirsPl.length) {
      // Vale a mais recente de cada tipo que de fato for a planilha certa: um .xlsx a mais na pasta (que não é a de laudos)
      // não pode tomar o lugar da planilha do Apolo. Se a mais recente não abrir como Apolo/Power BI, tenta a seguinte.
      const pl = { apolo: [], pbi: [] };
      for (const dB of dirsPl) for await (const { h, caminho: c } of arquivosEm(dB)) {
        if (!/\.xlsx$/i.test(h.name)) continue;
        const f = await h.getFile(), tipo = /POWER ?BI|PBI|FATURAMENTO/.test(norm(h.name)) ? 'pbi' : 'apolo';
        pl[tipo].push({ f, c: dB.name + '/' + c });
      }
      if (!pl.apolo.length && !S.apolo) r.avisos.push(`nenhuma planilha .xlsx de laudos do Apolo em ${PASTA_PLAN.nome}`);
      for (const [tipo, lista] of Object.entries(pl)) {
        lista.sort((x, y) => y.f.lastModified - x.f.lastModified);
        const ignoradas = [];
        for (const x of lista) {
          const sig = `${x.f.size}|${x.f.lastModified}`, k = `${S.comp}|${x.c}`, atual = () => (tipo === 'apolo' ? S.apolo : S.pbi)?.nome === x.f.name;
          if (PR.lidos.get(k) === 'X' + sig) { ignoradas.push(x.f.name); continue; }   // já vista: não é desse tipo
          if (PR.lidos.get(k) === sig && atual()) break;
          await (tipo === 'apolo' ? carregarApolo(x.f) : carregarPBI(x.f));
          if (atual()) { PR.lidos.set(k, sig); r.planilhas++; break; }
          PR.lidos.set(k, 'X' + sig); ignoradas.push(x.f.name);
        }
        if (ignoradas.length) r.avisos.push(`${ignoradas.length} planilha(s) ignorada(s) por não serem ${tipo === 'apolo' ? 'de laudos do Apolo' : 'do Power BI'}: ${ignoradas.join(', ')}`);
      }
    } else if (dCs.length) r.avisos.push(`sem a pasta ${PASTA_PLAN.nome} em ${nomePastaMes(S.comp)}`);
    // Relatórios: pasta do mês › 05 - Relatórios de repasse MV (USG | IMG › unidade; Curitiba) | 01 - Correção de prestador.
    // Na 05, só USG, IMG e Curitiba são da ferramenta: outras pastas (ex.: Repasse 20%) são da equipe e não são lidas.
    if (!dCs.length) r.avisos.push(`sem a pasta ${pastaAno(+S.comp.slice(0, 4)).nome} › ${comp}`);
    else for (const dC of dCs) for (const [pasta, finalidade] of [[PASTA_REL, 'conferencia'], [PASTA_CORR, 'correcao']].filter(([, f]) => !so || f === so)) {
      const d = await subpasta(dC, pasta); if (!d) continue;
      for await (const { h, caminho: c } of arquivosEm(d)) {
        if (!/\.pdf$/i.test(h.name)) continue;
        const partes = c.split('/');
        const grupo = finalidade === 'correcao' ? '' : grupoDaPasta(partes[0]);
        if (finalidade === 'conferencia' && partes.length > 1 && !grupo) continue;   // pasta que não é USG, IMG ou Curitiba
        r.pdfs++;
        const pai = partes.length > 1 ? partes[partes.length - 2] : '';
        const un = grupo === 'curitiba' ? String(S.cfg.unidades.find(u => ehUnidadeV3(S.cfg, u.cod))?.cod || '5') : finalidade === 'correcao' ? unidadeDoArquivoCorrecao(h.name, pai) : unidadeDaPastaRel(pai);
        const f = await h.getFile(), sig = `${f.size}|${f.lastModified}`, k = `${S.comp}|${d.name}/${c}`;
        // PDF que a pessoa mandou ignorar (ex.: de outra produção): não pergunta de novo enquanto o arquivo não mudar.
        if (pdfIgnorado(k, sig)) { r.ignorados = (r.ignorados || 0) + 1; continue; }
        const atual = S.relatorios.find(x => x.caminhoPasta === k);
        if (atual && PR.lidos.get(k) === sig) continue;
        if (atual) S.relatorios = S.relatorios.filter(x => x !== atual);
        const n0 = S.relatorios.length; await carregarPDFs([f], { caminho: `${dC.name} › ${d.name} › ${c.split('/').join(' › ')}`, chave: k, sig });
        if (S.relatorios.length > n0) {
          const it = S.relatorios.at(-1); it.caminhoPasta = k; it.unidadePasta = un; it.grupoPasta = grupo; if (finalidade === 'correcao') it.finalidade = 'correcao';
          // Mesmo prestador × unidade lido de outro arquivo: fica o mais recente.
          const dup = S.relatorios.filter(x => x !== it && x.unidadePasta === un && x.grupoPasta === grupo && String(x.rel.cab.prestadorCod) === String(it.rel.cab.prestadorCod) && x.caminhoPasta);
          if (dup.length) { S.relatorios = S.relatorios.filter(x => !dup.includes(x)); r.avisos.push(`${it.rel.cab.prestadorCod} na unidade ${un}: mais de um PDF; ficou ${h.name}`); }
          atual ? r.mudaram++ : r.novos++;
        }
        PR.lidos.set(k, sig);
      }
    }
    PR.ultima = { em: Date.now(), ...r };
  } catch (e) { r.avisos.push(e.message); if (!silencioso) avisar(`Erro ao ler a pasta (${e.message}).`, 'err'); }
  finally { PR.lendo = false; }
  const ondeSo = so ? ` (${so === 'correcao' ? PASTA_CORR.nome : PASTA_REL.nome})` : '';   // nomes da estrutura nova
  if (!silencioso || r.novos || r.mudaram || r.planilhas) avisar(`Pasta da competência ${rotuloCompetencia(S.comp)}${ondeSo}: ${r.novos} PDF(s) novo(s), ${r.mudaram} atualizado(s)${r.planilhas ? `, ${r.planilhas} planilha(s)` : ''}${r.pdfs ? ` (${r.pdfs} na pasta)` : ''}${r.ignorados ? ` · ${r.ignorados} ignorado(s)` : ''}${r.avisos.length ? ' · ' + r.avisos.join(' · ') : ''}.`, r.avisos.length ? 'warn' : 'ok');
  if (r.mudaram) avisar(`${r.mudaram} relatório(s) mudaram desde a última leitura: rode a conferência deles de novo.`, 'warn');
  if (location.hash === '#inicio' || !location.hash) RENDER.inicio();
  return r;
}

/* ---------- Equivalências sincronizadas (SOL-F37) ---------- */
const SYQ = { status: 'off', erro: '', lm: 0, meta: null, ocupado: false, pendente: false, conferidoEm: 0, conflitos: 0 };
const CHAVE_SYNC_EQ = CHAVES.eqSyncBase, ARQ_EQ = 'equivalencias.json';
async function sincronizarEq({ interativo = false } = {}) {
  if (!SY.handle || SY.legado) return;
  if (SYQ.ocupado) { SYQ.pendente = true; return; }
  if (!(await temPermissaoPasta(interativo))) { SYQ.status = 'permissao'; atualizarBarraEq(); return; }
  SYQ.ocupado = true;
  try {
    for (let t = 0; t < 3; t++) {
      const dir = await dirEq(); let remoto = null, lm = 0;
      try { const f = await (await dir.getFileHandle(ARQ_EQ)).getFile(); lm = f.lastModified; const d = JSON.parse(await f.text()); if (d.schema !== SCHEMA_EQ_SYNC) throw new Error(`${ARQ_EQ} não é a base de equivalências`); remoto = d; }
      catch (e) { if (e.name !== 'NotFoundError') throw e; }
      const base = lerLocal(CHAVE_SYNC_EQ), antes = S.eq;
      // Primeira vez com as duas bases: mostra o resultado antes de juntar (e guarda cópia da sua).
      let { eq, conflitos } = mesclarEq(S.eq, remoto?.eq || null, base);
      if (!base && remoto && JSON.stringify(eq.itens) !== JSON.stringify(S.eq.itens)) {
        if (!interativo) { SYQ.status = 'juntar'; return; }
        const c = b => `${b.itens.filter(e => e.status === 'validada').length} validadas · ${b.itens.filter(e => e.status === 'pendente').length} pendentes · ${(b.compostas || []).length} regras compostas`;
        const r = await dialogo('Juntar a sua base de equivalências com a da pasta', `<div class="grid2"><div class="linha-ini"><b>Sua base (este navegador)</b><br><span class="small muted">${c(S.eq)}</span></div><div class="linha-ini"><b>Base da pasta${remoto.atualizadoPor ? ` (${esc(remoto.atualizadoPor)})` : ''}</b><br><span class="small muted">${c(remoto.eq)}</span></div></div>
          <p><b>Resultado:</b> ${c(eq)}${conflitos.length ? ` · <b>${conflitos.length} divergência(s) para escolher</b>` : ''}</p><p class="small muted">Validada por um e pendente para o outro fica validada (com quem validou); o que só um tem entra. Antes de juntar, a sua base fica guardada para «Desfazer última substituição de equivalências» em Configurações.</p>`, [['', 'Agora não', 'sec'], ['ok', 'Juntar e conectar']]);
        if (r.botao !== 'ok') { SYQ.status = 'juntar'; return; }
        backupAntesDeSubstituir(CHAVES.eqAnterior, S.eq);
      }
      if (conflitos.length) {
        if (!interativo && location.hash !== '#equivalencias') { SYQ.status = 'conflito'; SYQ.conflitos = conflitos.length; return; }
        const r = await dialogo(`${conflitos.length} decisão(ões) diferentes nas equivalências`, `<p class="small">Você e ${esc(remoto?.atualizadoPor || 'outra pessoa')} decidiram diferente sobre os mesmos itens. Escolha qual fica; o histórico das duas é guardado.</p>
          ${conflitos.map((x, i) => `<div class="sy-conf"><b>${esc(x.rotulo)}</b><label class="small"><input type="radio" name="c${i}" value="local" checked> A minha: ${esc(resumoValorEq(x.local))}</label><label class="small"><input type="radio" name="c${i}" value="remoto"> A da pasta: ${esc(resumoValorEq(x.remoto))}</label></div>`).join('')}`, [['', 'Decidir depois', 'sec'], ['ok', 'Aplicar escolhas']]);
        if (r.botao !== 'ok') { SYQ.status = 'conflito'; SYQ.conflitos = conflitos.length; return; }
        eq = aplicarEscolhasEq(eq, conflitos, conflitos.map((x, i) => r.campos[`c${i}`] === 'remoto' ? 'remoto' : 'local'));
      }
      aplicarCobertas(eq, S.operador, S.comp);
      const mudouLocal = JSON.stringify(eq.itens) !== JSON.stringify(S.eq.itens) || JSON.stringify(eq.compostas || []) !== JSON.stringify(S.eq.compostas || []);
      if (mudouLocal) {
        const novas = novasValidadasEq(antes, eq); S.eq = eq; gravarEqLocal();
        if (novas.length && remoto) avisar(`${novas.length} relação(ões) validada(s) chegaram pela pasta (${remoto.atualizadoPor || 'outra pessoa'}). Rode de novo as conferências afetadas («O que mais destrava» ou a própria Conferência).`, 'ok');
        if (location.hash === '#equivalencias') RENDER.equivalencias();
      }
      const remEq = remoto ? JSON.stringify([remoto.eq.itens, remoto.eq.compostas || []]) : '';
      if (remEq !== JSON.stringify([S.eq.itens, S.eq.compostas || []])) {
        const fh = await dir.getFileHandle(ARQ_EQ, { create: true });
        if (lm && (await fh.getFile()).lastModified !== lm) continue;
        const meta = { atualizadoEm: agoraISO(), atualizadoPor: S.operador || '' };
        const texto = JSON.stringify({ schema: SCHEMA_EQ_SYNC, versaoSchema: 1, motor: MOTOR_VERSAO, ...meta, eq: S.eq });
        const w = await fh.createWritable(); await w.write(texto); await w.close();
        const gravado = await fh.getFile(); if (await gravado.text() !== texto) continue;   // gravação simultânea: mescla de novo
        SYQ.lm = gravado.lastModified; SYQ.meta = meta;
      } else { SYQ.lm = lm; SYQ.meta = remoto ? { atualizadoEm: remoto.atualizadoEm, atualizadoPor: remoto.atualizadoPor } : SYQ.meta; }
      gravarLocal(CHAVE_SYNC_EQ, S.eq);
      SYQ.status = 'ok'; SYQ.erro = ''; SYQ.conflitos = 0; SYQ.conferidoEm = Date.now();
      return;
    }
    SYQ.status = 'erro'; SYQ.erro = 'o arquivo da pasta mudou durante a gravação; tente de novo';
  } catch (e) { SYQ.status = 'erro'; SYQ.erro = e.message || String(e); }
  finally { SYQ.ocupado = false; atualizarBarraEq(); if (SYQ.pendente) { SYQ.pendente = false; setTimeout(() => sincronizarEq(), 50); } }
}
async function checarEqPasta() {
  if (!SY.handle || SY.legado || SYQ.ocupado || SYQ.status === 'permissao') return;
  try { const f = await (await (await dirEq()).getFileHandle(ARQ_EQ)).getFile(); if (f.lastModified !== SYQ.lm) sincronizarEq(); } catch (e) { if (e.name === 'NotFoundError') sincronizarEq(); }
}
// Gravação usada pela própria sincronização (não agenda outra). As da tela usam salvarEq (00-base.js).
const gravarEqLocal = () => { if (!gravarLocal(CHAVES.eq, S.eq)) avisar('Não foi possível gravar a base de equivalências neste navegador.', 'err'); };
function barraEq() {
  if (!SY.handle || SY.legado) return `<div class="sy-barra off" id="eqSync"><span class="sy-dot"></span><b>Equivalências só neste navegador.</b><span class="muted">Conecte a pasta raiz do aplicativo no Início para dividir as validações com a outra pessoa.</span></div>`;
  const ult = SYQ.meta?.atualizadoEm ? ` · última mudança de <b>${esc(SYQ.meta.atualizadoPor || '—')}</b> em ${new Date(SYQ.meta.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '';
  const cls = SYQ.status === 'ok' ? 'ok' : 'warn', txt = { ok: SYQ.ocupado ? 'Sincronizando…' : 'Sincronizado', permissao: 'Acesso à pasta precisa ser liberado', erro: `Sem acesso à pasta — mudanças guardadas neste navegador (${esc(SYQ.erro)})`, conflito: `${SYQ.conflitos} decisão(ões) diferentes para escolher`, juntar: 'Falta juntar a sua base com a da pasta', off: 'Conectando…' }[SYQ.status] || SYQ.status;
  return `<div class="sy-barra ${cls}" id="eqSync"><span class="sy-dot"></span><b>${txt}</b> <code>${esc(SY.handle.name)}\\${esc(localSistema('eq'))}\\${ARQ_EQ}</code><span class="muted">${ult}</span><span class="sy-esp"></span><button class="${cls === 'ok' ? 'sec ' : ''}mini" data-syq="agora">${SYQ.status === 'juntar' ? 'Juntar agora…' : SYQ.status === 'conflito' ? 'Resolver' : SYQ.status === 'permissao' ? 'Liberar acesso' : 'Atualizar agora'}</button></div>`;
}
function atualizarBarraEq() { const b = $('eqSync'); if (!b) return; b.outerHTML = barraEq(); ligarBarraEq(); }
function ligarBarraEq() { document.querySelectorAll('#eqSync [data-syq]').forEach(b => b.onclick = () => sincronizarEq({ interativo: true })); }
window.addEventListener('hashchange', () => { if (location.hash === '#equivalencias' && SY.handle && !SY.legado && SYQ.status !== 'permissao') sincronizarEq({ interativo: true }); });

/* ---------- Início: pasta raiz ---------- */
const PRI = { verif: null, verifComp: '' };
function cartaoPastaRaiz() {
  if (!suportaPasta()) return '';
  if (!SY.handle) return `<div class="card pr-card off"><div class="fx-topo"><h2 style="margin:0">Pasta raiz do aplicativo</h2><button id="prConectar">Conectar a pasta raiz…</button></div>
    <p class="small"><b>Lembrete:</b> conecte a pasta raiz na rede (a que contém Fluxo mensal, Equivalência TUSS, Bases de dados…). Com ela, a ferramenta lê os PDFs do MV e as planilhas do mês com um clique, sincroniza o Fluxo e as equivalências com a outra pessoa e cria as pastas com os nomes certos.</p></div>`;
  if (SY.legado) return `<div class="card pr-card warn"><div class="fx-topo"><h2 style="margin:0">Pasta raiz do aplicativo</h2><button id="prConectar">Conectar a pasta raiz…</button></div>
    <p class="small">Hoje está conectada só a pasta do Fluxo («${esc(SY.handle.name)}»). Conecte a pasta raiz (a de cima) para ler os relatórios e sincronizar as equivalências também.</p></div>`;
  const perm = SY.status === 'permissao', v = PRI.verifComp === S.comp ? PRI.verif : null, u = PR.ultima;
  return `<div class="card pr-card ${perm || (v && v.faltam.length) ? 'warn' : 'ok'}"><div class="fx-topo"><h2 style="margin:0">Pasta raiz: ${esc(SY.handle.name)}</h2>
    <div class="acoes" style="margin:0">${perm ? '<button id="prLiberar">Liberar acesso</button>' : `<button id="prAtualizar"${PR.lendo ? ' disabled' : ''}>${PR.lendo ? 'Lendo a pasta…' : 'Atualizar da pasta'}</button><button class="sec" id="prCriar">Criar pastas da competência ${rotuloCompetencia(S.comp)}</button><button class="sec" id="prCriarAno" data-ano="${+S.comp.slice(0, 4) + 1}">Criar pastas de ${+S.comp.slice(0, 4) + 1}</button>`}<button class="sec" id="prConectar">Trocar pasta raiz…</button></div></div>
    ${perm ? '<p class="small"><b>O Edge pede para liberar o acesso à pasta</b> a cada sessão (ou marque «permitir sempre»). Clique em «Liberar acesso».</p>' : `
    <p class="small muted">Lê de <code>${esc(pastaAno(+S.comp.slice(0, 4)).nome)} › ${esc(nomePastaMes(S.comp))}</code>: <code>${PASTA_REL.nome}</code> (USG e IMG por unidade, Curitiba), <code>${PASTA_CORR.nome}</code> e <code>${PASTA_PLAN.nome}</code> (laudos e Power BI). Só lê o que é novo ou mudou; pastas que começam com «_» (ex.: _antigos) ficam de fora.</p>
    ${v && (v.antiga || v.sistemaAntigo.length) ? `<div class="aviso-fixo warn small"><b>Estrutura antiga ainda em uso</b> — continua funcionando, e nada se perde. Quando puder, mova à mão (guia em Configurações → Pastas e sincronização):
      <ul style="margin:4px 0 0">${v.sistemaAntigo.map(x => `<li><code>${esc(x.de)}</code> → <code>${esc(x.para)}</code></li>`).join('')}${v.antiga ? `<li><code>Competências › ${esc(nomeCompPasta(S.comp))}</code> → <code>${esc(pastaAno(+S.comp.slice(0, 4)).nome)} › ${esc(nomePastaMes(S.comp))}</code> (a ferramenta lê as duas enquanto isso)</li>` : ''}</ul></div>` : ''}
    <div class="pr-st"><span>${v ? (v.faltam.length ? `<span class="badge warn">${v.faltam.length} pasta(s) faltando</span> <span class="small muted">${esc(v.faltam.slice(0, 3).join(' · '))}${v.faltam.length > 3 ? ' …' : ''}</span>` : '<span class="badge ok">pastas da competência em ordem</span>') : '<span class="small muted">conferindo as pastas…</span>'}</span>
      <span class="small muted">${u ? `última leitura ${new Date(u.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}: ${u.pdfs} PDF(s) na pasta · ${u.novos} novo(s) · ${u.mudaram} atualizado(s)` : 'ainda não lida nesta sessão'}</span>${(() => { const ig = Object.values(pdfsIgnorados()).filter(x => x.comp === S.comp); return ig.length ? ` <button class="sec mini" id="prIgnorados">PDFs ignorados (${ig.length})</button>` : ''; })()}
      <span class="small muted">Fluxo: ${esc({ ok: 'sincronizado', erro: 'sem acesso', conflito: 'conflito', permissao: 'liberar acesso' }[SY.status] || SY.status)} · Equivalências: ${esc({ ok: 'sincronizadas', erro: 'sem acesso', conflito: 'conflito', juntar: 'falta juntar', permissao: 'liberar acesso', off: '—' }[SYQ.status] || SYQ.status)}</span></div>`}</div>`;
}
function ligarPastaRaiz() {
  if ($('prConectar')) $('prConectar').onclick = () => escolherPastaSync();
  if ($('prLiberar')) $('prLiberar').onclick = async () => { if (await liberarPastaSync()) await atualizarDaPasta(); };
  if ($('prAtualizar')) $('prAtualizar').onclick = () => atualizarDaPasta();
  if ($('prCriar')) $('prCriar').onclick = () => criarEstrutura(S.comp);
  if ($('prCriarAno')) $('prCriarAno').onclick = () => criarEstruturaAno(+$('prCriarAno').dataset.ano);
  if ($('prIgnorados')) $('prIgnorados').onclick = async () => {
    const m = pdfsIgnorados(), ks = Object.keys(m).filter(k => m[k].comp === S.comp);
    const r = await dialogo('PDFs ignorados nesta competência', `<p class="small muted">Estes arquivos da pasta não são lidos enquanto não mudarem. Marque os que devem voltar a ser lidos.</p>${ks.map((k, i) => `<label class="small" style="display:block;margin:4px 0"><input type="checkbox" name="v${i}"> <b>${esc(m[k].nome)}</b> — <code>${esc(m[k].caminho)}</code> <span class="muted">(${esc(m[k].por || '—')}, ${new Date(m[k].em).toLocaleDateString('pt-BR')})</span></label>`).join('')}`, [['', 'Fechar', 'sec'], ['ok', 'Voltar a ler os marcados']]);
    if (r.botao !== 'ok') return;
    let n = 0; ks.forEach((k, i) => { if (r.campos[`v${i}`]) { delete m[k]; PR.lidos.delete(k); n++; } });
    gravarLocal(CHAVES.pdfsIgnorados, m); if (n) { avisar(`${n} PDF(s) voltam a ser lidos.`, 'ok'); await atualizarDaPasta(); } else RENDER.inicio();
  };
  if (SY.handle && !SY.legado && SY.status !== 'permissao' && PRI.verifComp !== S.comp) {
    PRI.verifComp = S.comp; verificarEstrutura(S.comp).then(v => { PRI.verif = v; if (location.hash === '#inicio' || !location.hash) RENDER.inicio(); }).catch(() => {});
  }
}
// Chamado por RENDER.inicio (10-inicio.js), depois do resto do Início.
function complementoInicioPastaRaiz() {
  const pg = $('pag-inicio'); if (!pg) return;
  const alvo = pg.querySelector('.painel-comp'); const html = cartaoPastaRaiz();
  if (html) { alvo ? alvo.insertAdjacentHTML('afterend', html) : pg.insertAdjacentHTML('afterbegin', html); ligarPastaRaiz(); }
}
