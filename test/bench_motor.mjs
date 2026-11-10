// Benchmark do motor com volume sintético próximo do real (27 mil laudos no Apolo, relatórios de 300 a 2.000 linhas).
// Não usa dados de pacientes: nomes, títulos e códigos são gerados aqui. Uso: node tools/build.mjs --harness && node test/bench_motor.mjs
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.error('[erro]', e.message));
await page.goto('file://' + raiz + 'dist/harness.html');
await page.waitForFunction(() => window.PRONTO, null, { timeout: 30000 });
const res = await page.evaluate(() => {
  const H = window.H;
  let semente = 42; const rnd = () => (semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const NOMES = ['MARIA', 'ANA', 'JOSE', 'JOAO', 'ANTONIO', 'FRANCISCO', 'CARLOS', 'PAULO', 'PEDRO', 'LUCAS', 'LUIZ', 'MARCOS', 'LUIS', 'GABRIEL', 'RAFAEL', 'DANIEL', 'MARCELO', 'BRUNO', 'EDUARDO', 'FELIPE', 'JULIANA', 'MARCIA', 'FERNANDA', 'PATRICIA', 'ALINE', 'SANDRA', 'CAMILA', 'AMANDA', 'BRUNA', 'JESSICA', 'LETICIA', 'JULIA', 'LUCIANA', 'VANESSA', 'MARIANA', 'GABRIELA', 'VERA', 'VITORIA', 'LARISSA', 'CLAUDIA', 'BEATRIZ', 'RITA', 'SONIA', 'RENATA', 'ELIANE', 'JOSEFA', 'SIMONE', 'NATALIA', 'CRISTIANE', 'CARLA'];
  const SOBRE = ['SILVA', 'SANTOS', 'OLIVEIRA', 'SOUZA', 'RODRIGUES', 'FERREIRA', 'ALVES', 'PEREIRA', 'LIMA', 'GOMES', 'COSTA', 'RIBEIRO', 'MARTINS', 'CARVALHO', 'ALMEIDA', 'LOPES', 'SOARES', 'FERNANDES', 'VIEIRA', 'BARBOSA', 'ROCHA', 'DIAS', 'NASCIMENTO', 'ANDRADE', 'MOREIRA', 'NUNES', 'MARQUES', 'MACHADO', 'MENDES', 'FREITAS', 'CARDOSO', 'RAMOS', 'GONCALVES', 'SANTANA', 'TEIXEIRA'];
  const nome = () => `${pick(NOMES)} ${pick(SOBRE)} ${pick(SOBRE)}${rnd() < .5 ? ' ' + pick(SOBRE) : ''}`;
  const TIT = Array.from({ length: 400 }, (_, i) => ({ titulo: `ULTRASSONOGRAFIA TIPO ${i} ${pick(['ABDOME', 'MAMAS', 'TIREOIDE', 'OMBRO', 'JOELHO', 'PELVICA', 'TRANSVAGINAL', 'PROSTATA'])}${i % 7 === 0 ? ' COM DOPPLER' : ''}`, codigo: String(40901000 + i) }));
  const MEDICOS = Array.from({ length: 40 }, () => nome());
  const cfg = H.configPadrao();
  const laudos = [];
  const dia0 = Date.UTC(2026, 8, 1);
  const unidades = ['AlphaSonic Palhano', 'GrupoSRA HPA', 'Ultramed Cambe', 'AlphaSonic Curitiba', 'AlphaSonic Apucarana'];
  for (let k = 0; k < 27000; k++) {
    const t = pick(TIT), data = new Date(dia0 + Math.floor(rnd() * 30) * 86400000), paciente = nome(), medico = pick(MEDICOS);
    laudos.push({ i: k, linhaPlanilha: k + 2, idLaudo: String(k), unidade: pick(unidades), paciente, pn: H.norm(paciente), idPac: String(k), titulo: t.titulo, tn: H.norm(t.titulo), data, dia: Math.round(data.getTime() / 86400000), convenio: pick(['UNIMED', 'PARTICULAR', 'SUS']), modalidade: 'US', medico, mn: H.norm(medico), _cod: t.codigo });
  }
  const apolo = { laudos };
  const eq = H.eqVazia();
  for (const t of TIT.slice(0, 300)) eq.itens.push({ id: 'eq' + t.codigo, codigo: t.codigo, titulo: t.titulo, status: 'validada', escopo: { unidade: '*', modalidade: '*' }, historico: [], responsavel: 'B' });
  for (let c = 0; c < 10; c++) eq.compostas.push({ id: 'c' + c, nome: 'r' + c, titulos: [], palavras: { todas: ['DOPPLER'], umaDe: ['TIPO ' + (c * 7)] }, itens: [{ codigos: [TIT[c * 7].codigo], qtd: 1 }, { codigos: ['40901386'], qtd: 1 }], escopo: { unidade: '*', modalidade: '*' }, status: 'validada', historico: [] });
  eq.revisao = 1;
  const unidadeCod = '17', nomesUn = new Set(['ALPHASONIC PALHANO']);
  const doUn = laudos.filter(l => nomesUn.has(H.norm(l.unidade)));
  const relatorio = n => {
    const regs = [];
    for (let s = 0; s < n; s++) {
      const l = pick(doUn), r = rnd();
      const paciente = r < .03 ? nome() : r < .08 ? l.paciente.slice(0, 22) : r < .11 ? l.paciente.slice(0, 6) + 'X' + l.paciente.slice(7) : l.paciente;   // 3% sem laudo, 5% truncados, 3% com erro de digitação
      const dia = l.dia + (rnd() < .05 ? 1 : 0);
      regs.push({ seq: s + 1, codigo: l._cod, procDesc: l.titulo, grupoNome: 'ULTRASSONOGRAFIA', conta: String(1000 + s), atendimento: String(5000 + s), paciente, convenio: l.convenio, data: new Date(dia * 86400000), vlRepasse: 50, vlTotal: 100, prestadorCod: '15' });
    }
    return { regs, cab: { prestadorCod: '15', prestadorNome: 'MEDICO', repasse: 'USG' } };
  };
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const out = { laudos: laudos.length, laudosUnidade: doUn.length };
  for (const n of [300, 1000, 2000]) {
    const rel = relatorio(n);
    let t = performance.now();
    const c = H.conferirCruzado(rel, apolo, cfg, eq, { unidadeCod, tol: 7 });
    const tc = performance.now() - t;
    t = performance.now();
    const p = H.corrigirPrestador(rel, apolo, cfg, eq, { unidadeCod, tol: 0 });
    const tp = performance.now() - t;
    out['mv' + n] = { conferenciaMs: Math.round(tc), correcaoMs: Math.round(tp), conferidos: c.porStatus.conferido.n, ressalva: c.porStatus.ressalva.n, soFat: c.porStatus['so-faturamento'].n, soLaudo: c.porStatus['so-laudo'].n, identificados: p.porEstado.identificado.n, assinaturaConf: fnv(JSON.stringify(c.linhas.map(x => [x.status, x.l?.i ?? null, [...x.marcadores].sort().join(','), x.motivos.join('|')]))), assinaturaCorr: fnv(JSON.stringify(p.linhas.map(o => [o.estado, o.motivo, o.detalhe, o.medico, o.laudo?.i ?? null, o.alertas.join('|'), o.evidencias.map(e => e.idLaudo).join(',')]))) };
  }
  // Gargalo isolado: comparação de nomes.
  const a = doUn.slice(0, 1500).map(l => l.pn), b = doUn.slice(0, 2000).map(l => l.pn);
  let t = performance.now(), z = 0; for (const x of a) for (const y of b) z += H.nivelNome(x, y, 20); out.nivelNome3M = Math.round(performance.now() - t);
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
