/* ============================================================
 * Descontos parcelados (SOL-F31)
 * Cadastro por prestador (fica em Bases, vale para todas as competências):
 *   {id, cod, nome, motivo, valorParcela, parcelas (0 = recorrente, ex.: pensão), inicio 'AAAA-MM'
 *    (competência da 1ª parcela), tipo 'usg'|'img'|'curitiba' (em qual fechamento entra),
 *    adiadas ['AAAA-MM'] (meses em que a parcela não foi descontada e passou para o seguinte),
 *    encerradoEm 'AAAA-MM' (opcional), obs, por, em}
 * No Fechamento, a parcela do mês entra sozinha em DESCONTOS com a observação «parcela 7/10».
 * ============================================================ */
const TIPOS_DESCONTO = { usg: 'USG', img: 'IMG (último dia útil)', curitiba: 'Curitiba (V3)' };
const mesesEntre = (a, b) => { const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); };

// Parcela de um desconto numa competência: null se não houver (antes do início, adiada, quitada, encerrada).
function parcelaDoMes(d, chave) {
  if (!d.inicio || chave < d.inicio) return null;
  if (d.encerradoEm && chave >= d.encerradoEm) return null;
  if ((d.adiadas || []).includes(chave)) return null;
  const n = mesesEntre(d.inicio, chave) + 1 - (d.adiadas || []).filter(c => c < chave && c >= d.inicio).length;
  const total = +d.parcelas || 0;
  if (total && n > total) return null;
  return { n, total, recorrente: !total, ultima: !!total && n === total, valor: r2(+d.valorParcela || 0) };
}
// Situação do desconto na competência (para a lista em Bases).
function situacaoDesconto(d, chave) {
  const p = parcelaDoMes(d, chave);
  if (d.encerradoEm && chave >= d.encerradoEm) return { k: 'encerrado', nome: `encerrado em ${rotuloCompetencia(d.encerradoEm)}` };
  if (chave < d.inicio) return { k: 'futuro', nome: `começa em ${rotuloCompetencia(d.inicio)}` };
  if ((d.adiadas || []).includes(chave)) return { k: 'adiado', nome: 'adiado neste mês' };
  if (!p) return { k: 'quitado', nome: `quitado em ${rotuloCompetencia(ultimaCompetenciaDesconto(d))}` };
  if (p.recorrente) return { k: 'recorrente', nome: 'recorrente' };
  return p.ultima ? { k: 'ultima', nome: 'última parcela' } : { k: 'ativo', nome: 'ativo' };
}
// Competência da última parcela (descontos com nº de parcelas).
function ultimaCompetenciaDesconto(d) {
  if (!+d.parcelas) return '';
  let c = d.inicio, n = 0;
  for (let i = 0; i < 600; i++) { if (!(d.adiadas || []).includes(c)) { n++; if (n === +d.parcelas) return c; } c = competenciaVizinha(c, 1); }
  return '';
}
// Parcelas já descontadas até a competência (inclusive): o histórico por competência.
function historicoDesconto(d, ate) {
  const h = []; let c = d.inicio;
  for (let i = 0; i < 600 && c <= ate; i++) {
    const p = parcelaDoMes(d, c);
    if ((d.adiadas || []).includes(c)) h.push({ chave: c, adiada: true });
    else if (p) h.push({ chave: c, ...p }); else break;
    c = competenciaVizinha(c, 1);
  }
  return h;
}
const textoParcela = p => p.recorrente ? '' : `parcela ${p.n}/${p.total}`;
const obsDesconto = (d, p) => [d.motivo, textoParcela(p)].filter(Boolean).join(' · ');

function validarDesconto(d) {
  const e = [];
  if (!String(d.cod || '').trim()) e.push('escolha o prestador do cadastro');
  if (!String(d.motivo || '').trim()) e.push('informe o motivo');
  if (!(+d.valorParcela > 0)) e.push('informe o valor da parcela');
  if (!/^\d{4}-\d{2}$/.test(d.inicio || '')) e.push('informe a competência da 1ª parcela');
  if (!TIPOS_DESCONTO[d.tipo]) e.push('escolha em qual fechamento entra');
  if (d.parcelas !== '' && d.parcelas !== undefined && +d.parcelas < 0) e.push('número de parcelas inválido');
  return e;
}

/* Aplica as parcelas do mês nas linhas do fechamento (chamado pelo montarFechamento).
 * Desconto digitado à mão no mês vale por cima (fica marcado como manual). Devolve os alertas. */
function aplicarDescontosParcelados(todos, descontos, chave) {
  const alertas = [];
  for (const d of descontos || []) {
    const p = parcelaDoMes(d, chave); if (!p) continue;
    const x = todos.find(y => y.cod === String(d.cod) && y.tipo === d.tipo);
    const rotulo = `${d.nome || d.cod}: ${d.motivo}${p.recorrente ? '' : ` (${p.n}/${p.total})`}`;
    if (!x) { alertas.push({ k: 'sem-linha', id: d.id, cod: String(d.cod), tipo: d.tipo, texto: `${rotulo} — o prestador não está no fechamento de ${TIPOS_DESCONTO[d.tipo]} deste mês. Levar para o próximo mês?`, adiar: true }); continue; }
    x.parcelas = x.parcelas || [];
    x.parcelas.push({ id: d.id, motivo: d.motivo, ...p, obs: obsDesconto(d, p) });
    if (!x.temValores) { alertas.push({ k: 'sem-valores', id: d.id, cod: x.cod, tipo: x.tipo, texto: `${x.nome}: desconto ativo, mas sem valores neste mês. A ${p.recorrente ? 'parcela' : `parcela ${p.n}/${p.total}`} (R$ ${fmtBR(p.valor)}) não foi descontada. Levar para o próximo mês?`, adiar: true }); continue; }
    if (p.ultima) alertas.push({ k: 'ultima', id: d.id, cod: x.cod, tipo: x.tipo, texto: `${x.nome}: última parcela do desconto «${d.motivo}» (${p.n}/${p.total}) neste mês.` });
  }
  return alertas;
}
