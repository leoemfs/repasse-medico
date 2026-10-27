// Teste do motor no Chromium com os arquivos reais (pasta dados/, fora do Git).
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const raiz = new URL('..', import.meta.url).pathname;
const b64 = f => fs.readFileSync(raiz + 'dados/' + f).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => console.error('[browser]', m.text()));
page.on('pageerror', e => console.error('[erro]', e.message));
await page.goto('file://' + raiz + 'dist/harness.html');
await page.waitForFunction(() => window.PRONTO, null, { timeout: 30000 });
const arquivos = Object.fromEntries(['mv_usg_medico15_unidade1.pdf', 'mv_correcao_unidade2.pdf', 'apolo_09-2026.xlsx', 'powerbi_09-2026.xlsx', 'equivalencias_tuss.xlsx'].map(f => [f, b64(f)]));
const validarAlta = process.argv.includes('--validar-alta');
const saida = await page.evaluate(async ({ arquivos, validarAlta }) => {
  const H = window.H;
  const u8 = s => { const b = atob(s); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
  const out = {};
  const t0 = performance.now();
  const rel = {};
  for (const f of ['mv_usg_medico15_unidade1.pdf', 'mv_correcao_unidade2.pdf']) {
    const { linhas } = await H.lerLinhasPdf(H.pdfjs, u8(arquivos[f]));
    rel[f] = H.interpretarMV(linhas, f);
    out[f] = { cab: rel[f].cab, linhas: rel[f].regs.length, ok: rel[f].ok, avisos: rel[f].avisos.slice(0, 8), notas: rel[f].notas, total: rel[f].totExtraido, totalPdf: rel[f].totalGeral, conferencias: rel[f].conferencias.length };
  }
  const apolo = await H.lerApolo(u8(arquivos['apolo_09-2026.xlsx']), 'apolo');
  out.apolo = { laudos: apolo.laudos.length, ignoradas: apolo.ignoradas, semNome: apolo.semNome, semData: apolo.semData, semMedico: apolo.semMedico, idsDuplos: apolo.idsDuplos, ultima: apolo.ultimaLinha, s: apolo.segundos };
  const pbi = await H.lerPowerBI(u8(arquivos['powerbi_09-2026.xlsx']), 'pbi');
  out.pbi = { linhas: pbi.linhas.length, ignoradas: pbi.ignoradas, unidades: pbi.unidades.length, procedimentos: pbi.procedimentos.length };
  const imp = await H.importarPlanilhaEquivalencias(u8(arquivos['equivalencias_tuss.xlsx']), 'equivalencias_tuss.xlsx');
  const eq = H.eqVazia(); const m = H.mesclarEquivalencias(eq, imp.itens, imp);
  out.eq = { relacoes: eq.itens.length, mescla: m, titulos: eq.catalogoTitulos.length, tuss: eq.catalogoTUSS.length, ambiguas: eq.itens.filter(e => e.ambiguo).length };
  if (validarAlta) {
    const ids = eq.itens.filter(e => e.confianca === 'Alta' && !e.ambiguo).map(e => e.id);
    out.eq.validadasTeste = H.alterarStatusEq(eq, ids, 'validada', 'TESTE AUTOMATIZADO', 'simulação: validar candidatos de confiança Alta');
    out.eq.conflitos = H.conflitosEquivalencias(eq).length;
  }
  const cfg = H.configPadrao();
  for (const r of Object.values(rel)) H.registrarPrestadorDoMV(cfg, r.cab.prestadorCod, r.cab.prestadorNome);
  const relUSG = rel['mv_usg_medico15_unidade1.pdf'];
  const conf = H.conferirCruzado(relUSG, apolo, cfg, eq, { unidadeCod: '1', tol: 7, medicos: [H.norm(relUSG.cab.prestadorNome)] });
  out.conf = { porStatus: Object.fromEntries(Object.entries(conf.porStatus).map(([k, v]) => [k, v.n])), porMarcador: Object.fromEntries(Object.entries(conf.porMarcador).filter(([, n]) => n)), porTipo: conf.porTipo, nLaudosEscopo: conf.nLaudosEscopo, nPares: conf.nPares, periodo: conf.periodo, mods: conf.modalidades, porCodigo: conf.porCodigo,
    amostra: conf.linhas.filter(x => x.r).slice(0, 60).map(x => `${x.r.seq} ${x.r.codigo} ${x.r.paciente.slice(0, 14)} → ${x.status} [${[...x.marcadores].join(',')}] ${x.l ? '«' + x.l.titulo + '»' : ''} ${x.motivos[0] || ''}`.slice(0, 230)) };
  const relC = rel['mv_correcao_unidade2.pdf'];
  const corr = H.corrigirPrestador(relC, apolo, cfg, eq, { unidadeCod: '2', tol: 0 });
  out.corr = { porEstado: Object.fromEntries(Object.entries(corr.porEstado).map(([k, v]) => [k, v.n])), porMotivo: corr.porMotivo, porTipo: corr.porTipo, porMedico: corr.porMedico.slice(0, 12), ocorrencias: corr.ocorrencias.length,
    amostra: corr.linhas.slice(0, 25).map(o => `${o.r.seq} ${o.r.codigo} ${o.r.paciente.slice(0, 14)} → ${o.estado} ${o.motivo} ${o.medico} ${o.detalhe}`.slice(0, 230)) };
  const zipC = H.xlsxConferencia(conf, { relatorio: relUSG, apoloNome: 'apolo', unidadeNome: 'HPA', parametros: { tol: 7 }, operador: 'teste' });
  const zipP = H.xlsxCorrecao(corr, { relatorio: relC, apoloNome: 'apolo', unidadeNome: 'Jacarezinho', parametros: { tol: 0 }, operador: 'teste', em: new Date().toLocaleString('pt-BR') });
  const zipE = H.xlsxExtracao(relUSG);
  const toB64 = async z => { const a = await z.generateAsync({ type: 'uint8array' }); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };
  out.arquivos = { conf: await toB64(zipC), corr: await toB64(zipP), extr: await toB64(zipE) };
  out.ms = Math.round(performance.now() - t0);
  return out;
}, { arquivos, validarAlta });
const sufixo = validarAlta ? '_alta' : '';
for (const [k, v] of Object.entries(saida.arquivos)) fs.writeFileSync(`${raiz}test/saida/${k}${sufixo}.xlsx`, Buffer.from(v, 'base64'));
delete saida.arquivos;
console.log(JSON.stringify(saida, null, 1));
await browser.close();
