// Regras de Curitiba (V3, SOL-F46) com os arquivos reais de 11/2026 (produção 10/2026), na pasta
// dados/comp_11-2026_curitiba/ (fora do Git): relatórios do MV de 10490 (Ian, V3 percentual), 11467 (Gilson), 6703 (Alexandre) e
// 8016 (Elen) e 17771 (Matheus) — V3 por valor fixo, com o cadastro padrão da V3 —,
// 7 e 14 (médicos de Londrina que laudam na V3 por produção) e a planilha de laudos (laudos.xlsx).
// Sem equivalências validadas: a conferência fica «pendente» nos procedimentos; aqui o que se mede é o que é próprio da V3.
import { createRequire } from 'module'; import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname, D = raiz + 'dados/comp_11-2026_curitiba/';
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b64 = f => fs.readFileSync(D + f).toString('base64');
const br = await chromium.launch(), page = await br.newPage(), erros = [];
page.on('pageerror', e => erros.push(e.message));
await page.goto('file://' + raiz + 'dist/harness.html'); await page.waitForFunction(() => window.PRONTO, null, { timeout: 30000 });
const arqs = Object.fromEntries(['7.pdf', '14.pdf', '10490.pdf', '11467.pdf', '6703.pdf', '8016.pdf', '17771.pdf', '10490_v2.pdf', 'laudos.xlsx'].map(f => [f, b64(f)]));
const o = await page.evaluate(async (arqs) => {
  const H = window.H, u8 = s => { const b = atob(s); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
  const cfg = H.configPadrao(), eq = H.eqVazia(), o = { rel: {}, conf: {} }, rels = {};
  const ap = await H.lerApolo(u8(arqs['laudos.xlsx']), 'laudos');
  for (const f of ['7.pdf', '14.pdf', '10490.pdf', '11467.pdf', '6703.pdf', '8016.pdf', '17771.pdf', '10490_v2.pdf']) {
    const { linhas } = await H.lerLinhasPdf(H.pdfjs, u8(arqs[f])); const rel = rels[f] = H.interpretarMV(linhas, f);
    H.registrarPrestadorDoMV(cfg, rel.cab.prestadorCod, rel.cab.prestadorNome);
    o.rel[f] = { ok: rel.ok, ext: rel.totExtraido, pdf: rel.totalGeral, cod: rel.cab.prestadorCod };
  }
  const P = c => cfg.prestadores.find(p => String(p.cod) === c);
  // Cadastro padrão da V3 (migração da configuração): Ian, Gilson, Alexandre e Elen com as regras de 11/2026.
  o.cadastro = { mudou: H.migrarConfig(cfg), deNovo: H.aplicarCadastroV3Padrao(cfg), v3: cfg.prestadores.filter(p => p.regras?.v3).map(p => p.cod).sort().join() };
  H.aplicarRegrasConfig(cfg);
  for (const [f, rel] of Object.entries(rels)) {
    const res = H.conferirCruzado(rel, ap, cfg, eq, { unidadeCod: '5', tol: 0, medicos: [H.norm(rel.cab.prestadorNome)] });
    const mv = res.linhas.filter(x => x.r), procs = mv.filter(x => x.tipo === 'procedimento'), hm = mv.filter(x => x.tipo === 'hm');
    const av = H.avisosConferenciaV3(res), cl = x => H.classeDaLinhaConf(x);
    // «Tudo aceito»: procedimentos pendentes entram (simulação), HM segue a regra da V3.
    const lin = mv.filter(x => !['excluido', 'nc'].includes(cl(x))).map(x => ({ grupo: x.r.grupoNome, desc: x.r.procDesc, convenio: x.r.convenio, quant: x.r.quant, vlTotal: x.r.vlTotal, vlRepasse: x.r.vlRepasse, tipoItem: x.tipo }));
    const p = P(rel.cab.prestadorCod), c = p?.regras?.v3regra ? H.calcularV3(p.regras.v3regra, lin) : null;
    o.conf[f] = { procs: procs.length, pareadas: procs.filter(x => x.l).length, hmDevido: hm.filter(x => cl(x) === 'devido').length, hmDevidoValor: Math.round(hm.filter(x => cl(x) === 'devido').reduce((s, x) => s + x.r.vlRepasse, 0) * 100) / 100,
      hmSemBase: av.hmSemBase.n, pacotes: av.pacotes.n, subst: av.substituidos.n, substValor: av.substituidos.valor, email: c ? H.textoEmailV3(c) : '', usgOutroMedico: procs.filter(x => /ULTRASS/.test(x.r.grupoNome) && x.marcadores.has('outro-medico')).length, usg: procs.filter(x => /ULTRASS/.test(x.r.grupoNome)).length, hmExcluir: av.hmExcluir.n, hmExcluirValor: av.hmExcluir.valor, grupos: av.hmExcluir.grupos.map(g => `${g.grupo}:${g.n}`).sort(), fora: av.foraEscopo.n,
      hmExcluirChaves: av.hmExcluir.grupos.flatMap(g => g.linhas.map(x => `${x.r.atendimento}|${x.r.codigo}|${x.r.vlTotal}`)).sort(),
      chaves: mv.map(x => `${x.r.atendimento}|${x.r.codigo}|${x.r.vlTotal}`),
      calc: c ? { pac: c.pacotes?.valor, liquido: c.liquido, base: c.base, total: c.total, exames: c.exames, bruto: c.brutoUSG, hm: c.hm.valor, pct: c.pct, valorMV: c.valorMV } : null };
  }
  const cur = H.laudosDaUnidade(ap, cfg, '5');
  o.apolo = { curitiba: cur.length, trocadas: cur.filter(l => l.modalidadeApolo).length, semTitulo: cur.filter(l => !H.modalidadeDoTituloV3(l.titulo)).length };
  const ctl = H.controlePrestadoresUnidade({ laudos: ap.laudos, cfg, rodadas: [], chave: '11-2026' }), u5 = ctl.unidades.find(u => u.cod === '5');
  o.ctl = Object.fromEntries(u5.grupos.flatMap(g => g.itens).filter(x => x.cod).map(x => [x.cod, { laudos: x.laudos, producao: x.producao, fora: x.foraRegra.map(f => `${f.n}:${f.q}`).join() }]));
  return o;
}, arqs);
for (const [f, r] of Object.entries(o.rel)) ok(r.ok && r.ext.join() === r.pdf.join(), `${f}: relatório lido, totais iguais ao PDF (${r.ext.join(' / ')})`);
ok(o.apolo.curitiba === 4118 && o.apolo.trocadas === 0 && o.apolo.semTitulo <= 12, `planilha: 4.118 laudos de Curitiba; TITLE e MODALITY concordam (${o.apolo.trocadas} trocadas; ${o.apolo.semTitulo} títulos sem modalidade ficam com a MODALITY)`);
const I = o.conf['10490.pdf'], G = o.conf['11467.pdf'], M = o.conf['7.pdf'], Pa = o.conf['14.pdf'];
ok(I.pareadas >= 1728 && G.pareadas >= 169 && M.pareadas >= 226 && Pa.pareadas === 26, `pareamento pelo TITLE: Ian ${I.pareadas}/${I.procs}, Gilson ${G.pareadas}/${G.procs}, 7 ${M.pareadas}/${M.procs}, 14 ${Pa.pareadas}/${Pa.procs}`);
ok(I.hmDevido === 544 && I.hmDevidoValor === 27890.68 && I.hmSemBase === 0, `Ian: 544 HM de USG Unimed (78 PF) devidos, todos com o exame base, R$ ${I.hmDevidoValor}`);
ok(I.hmExcluir === 6 && I.hmExcluirValor === 287.4 && I.grupos.join() === 'HONORARIO MEDICO DENSITOMETRIA:1,HONORARIO MEDICO MAMOGRAFIA:2,HONORARIOS MEDICOS PF:3', `Ian: 6 HM a excluir (R$ 287,40): ${I.grupos.join(' · ')} (no PF, os 3 particulares)`);
ok(I.calc.exames === 1741 && I.calc.pct === 70 && I.calc.total === 81943.96, `Ian (tudo aceito): 1.741 USG · R$ ${I.calc.bruto} + HM ${I.calc.hm} − 9,15% × ${I.calc.pct}% = R$ ${I.calc.total}`);
ok(G.hmDevido === 18 && G.hmExcluir === 3 && G.hmExcluirValor === 90, `Gilson: 18 HM de USG Unimed devidos; 3 HM de RMN no 78 PF a excluir (R$ ${G.hmExcluirValor}, o MV pagou R$ 30 cada)`);
ok(G.calc.total === 7635 && G.calc.valorMV === 7635, `Gilson (tudo aceito): 37 USG × 30 + 18 HM × 30 + 133 RM × 45 = R$ ${G.calc.total} (MV R$ 7.725,00 − R$ 90,00 de HM de RMN)`);
ok(M.hmExcluir === 8 && M.hmExcluirValor === 779.52, `7 (Londrina, produção): 8 HM de ressonância a excluir (R$ ${M.hmExcluirValor}): ${M.grupos.join(' · ')}`);
ok(o.cadastro.mudou && !o.cadastro.deNovo && o.cadastro.v3 === '10490,11467,17771,6703,8016', `cadastro padrão da V3 aplicado uma vez: ${o.cadastro.v3}`);
const A = o.conf['6703.pdf'], E = o.conf['8016.pdf'];
ok(A.pareadas >= 300 && A.hmDevido === 30 && A.hmSemBase === 0 && A.hmExcluir === 5 && A.hmExcluirValor === 95 && A.grupos.join() === 'HONORARIO MEDICO RAIO X:5', `Alexandre: ${A.pareadas}/${A.procs} com laudo; 30 HM de USG Unimed devidos; 5 HM de raio-X a excluir (R$ ${A.hmExcluirValor}, o MV pagou a 100%)`);
ok(A.calc.total === 11964, `Alexandre (tudo aceito): 122 USG × 33 + 30 HM × 33 + 48 RX × 6 + 148 RM × 45 = R$ ${A.calc.total} (MV R$ 12.059,00 − R$ 95,00 de HM de raio-X)`);
ok(E.pacotes === 3 && E.subst === 0 && E.calc.pac === 45, `Elen: 3 pacotes de mamografia Bradesco considerados (R$ ${E.calc.pac}), sem exame base a 100% para substituir`);
ok(E.calc.total === 3905 && /220 × R\$ 15,00 \+ 56 × R\$ 10,00 \(HOSPITAL UNIVERSITARIO\)/.test(E.email), `Elen (tudo aceito): 220 × 15 + 56 × 10 (HOSPITAL UNIVERSITARIO) + pacotes 45 = R$ ${E.calc.total} (igual ao MV)`);
const Mt = o.conf['17771.pdf'];
ok(Mt.hmDevido === 9 && Mt.hmSemBase === 0 && Mt.hmExcluir === 85 && Mt.hmExcluirValor === 5168, `Matheus: 9 HM de USG Unimed devidos; 85 HM de mamografia a 100% a excluir (R$ ${Mt.hmExcluirValor})`);
ok(Mt.pacotes === 5 && Mt.subst === 4 && Mt.substValor === 694.16, `Matheus: 5 pacotes de mamografia Bradesco considerados; 4 mamografias Bradesco lançadas a 100% substituídas (R$ ${Mt.substValor}, fora do fechamento)`);
ok(Mt.calc.total === 9225, `Matheus (tudo aceito): 383 × 15 + 134 × 10 (HU) + 50 USG × 35 + 9 HM × 35 + 5 pacotes × 15 = R$ ${Mt.calc.total} (MV R$ 15.087,16 − R$ 5.168,00 de HM − R$ 694,16 de bases a 100%)`);
// Nova extração do Dr. Ian (24/11/2026), depois das correções no MV.
const I2 = o.conf['10490_v2.pdf'];
ok(o.rel['10490_v2.pdf'].pdf.join() === '128877.91,128877.91' && I2.pareadas >= 1725, `Ian (nova extração): relatório lido (R$ 128.877,91), ${I2.pareadas}/${I2.procs} USG com laudo`);
ok(I2.hmExcluir === 0 && I.hmExcluirChaves.every(k => !I2.chaves.includes(k)), `os 6 HM que a ferramenta mandou excluir saíram do MV na nova extração (restam ${I2.hmExcluir})`);
ok(I2.hmDevido === 538 && I2.hmSemBase === 0 && I2.calc.exames === 1738 && I2.calc.bruto === 101265.79 && I2.calc.hm === 27612.12, `Ian: 1.738 exames · USG R$ ${I2.calc.bruto} · HM Unimed R$ ${I2.calc.hm} (538, todos com o exame base)`);
ok(I2.calc.liquido === 117085.58 && I2.calc.pct === 70 && I2.calc.total === 81959.91 && /R\$ 128\.877,91 menos os impostos \(9,15%\) = R\$ 117\.085,58 \* 70% = R\$ 81\.959,91/.test(I2.email), `Ian: R$ 128.877,91 − 9,15% = R$ 117.085,58 × 70% = NF R$ ${I2.calc.total}`);
ok([I, G, M, Pa, A, E, Mt, I2].every(x => x.fora === 0), 'nenhuma tomografia nos relatórios');
ok(o.ctl['7']?.producao && o.ctl['7'].laudos === 236 && o.ctl['14']?.producao && o.ctl['14'].laudos === 26, `Prestadores por unidade (5): 7 = ${o.ctl['7']?.laudos} e 14 = ${o.ctl['14']?.laudos} laudos por produção (só ressonância)`);
ok(Pa.usg === 1 && Pa.usgOutroMedico === 1, `14: a USG que o MV lançou para ele tem laudo de outro médico — candidato a correção de prestador (${Pa.usgOutroMedico} de ${Pa.usg})`);
ok(o.ctl['10490']?.laudos > 0 && o.ctl['11467']?.laudos > 0, `médicos V3 contam pela regra: Ian ${o.ctl['10490']?.laudos}, Gilson ${o.ctl['11467']?.laudos} (${o.ctl['11467']?.fora || 'nada fora da regra'})`);
ok(!erros.length, 'sem erros' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await br.close();
