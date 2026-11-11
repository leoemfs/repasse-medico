/* ============================================================
 * Utilidades compartilhadas pelo motor (sem acesso à interface)
 * ============================================================ */
const MOTOR_VERSAO = '3.0.0-alpha.4';

const CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };

// Texto UTF-8 lido como Windows-1252 (ex.: «RESSONÃ‚NCIA»): desfaz até 2 camadas.
// Se a reinterpretação falhar, devolve o texto original sem alteração.
function fixMojibake(s) {
  s = String(s ?? '');
  for (let k = 0; k < 2 && /[ÃÂ]/.test(s); k++) {
    try {
      const b = [];
      for (const ch of s) {
        const c = ch.codePointAt(0);
        if (c < 256) b.push(c); else if (CP1252[c] !== undefined) b.push(CP1252[c]); else return s;
      }
      s = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(b));
    } catch (e) { return s; }
  }
  return s;
}

// Forma de comparação: sem acento, maiúsculas, só letras/dígitos e espaços simples.
const norm = s => fixMojibake(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  .replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const PARTICULAS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E']);
// Tokens e semelhança entre tokens ficam em cache (os mesmos nomes e sobrenomes se repetem milhares de vezes
// numa conferência). Os arrays devolvidos são só para leitura.
const _cacheTokens = new Map(), _cacheSimToken = new Map();
const tokensNome = n => {
  let t = _cacheTokens.get(n); if (t) return t;
  if (_cacheTokens.size > 200000) _cacheTokens.clear();
  t = n.split(' ').filter(x => x && !PARTICULAS.has(x)); _cacheTokens.set(n, t); return t;
};

function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const c = [i];
    for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c;
  }
  return p[n];
}
const simToken = (a, b) => {
  if (a === b) return 1;
  const k = a < b ? a + '|' + b : b + '|' + a; let v = _cacheSimToken.get(k); if (v !== undefined) return v;
  if (_cacheSimToken.size > 500000) _cacheSimToken.clear();
  v = 1 - lev(a, b) / Math.max(a.length, b.length); _cacheSimToken.set(k, v); return v;
};

// Semelhança aproximada (0..1). Serve só para mostrar evidência: nunca confirma sozinha.
function nomeSemelhanca(a, b) {
  const A = tokensNome(a), B = tokensNome(b);
  if (!A.length || !B.length) return 0;
  const [curto, longo] = A.length <= B.length ? [A, B] : [B, A];
  if (curto.length < 2 || simToken(A[0], B[0]) < 0.8) return 0;
  const usados = new Set(); let ok = 0;
  for (const t of curto) {
    let bi = -1, bs = 0;
    longo.forEach((u, i) => { if (usados.has(i)) return; const s = simToken(t, u); if (s > bs) { bs = s; bi = i; } });
    if (bs >= 0.8) { ok++; usados.add(bi); }
  }
  return ok / curto.length;
}

/* Nível de nome entre o MV (a, pode vir truncado) e o Apolo (b, também pode vir truncado):
 *  3 = idêntico · 2 = um é prefixo do outro (truncamento) · 1 = apenas semelhante · 0 = diferente.
 * Prefixo no meio de palavra só vale quando o nome mais curto tem pelo menos `minTrunc` caracteres,
 * que é o caso de truncamento por largura de coluna. */
function nivelNome(a, b, minTrunc = 20) {
  if (!a || !b) return 0;
  if (a === b) return 3;
  const [c, l] = a.length <= b.length ? [a, b] : [b, a];
  if (l.startsWith(c) && (l[c.length] === ' ' || c.length >= minTrunc) && tokensNome(c).length >= 2) return 2;
  // Mesmo nome sem as partículas (ex.: MV «DAMARIS VIEIRA DE MATTOS» × Apolo «DAMARIS VIEIRA MATTOS»): mesma pessoa,
  // trata como truncamento compatível. Também quando o mais curto, sem partículas, é prefixo do outro.
  const tc = tokensNome(c).join(' '), tl = tokensNome(l).join(' ');
  if (tokensNome(c).length >= 2 && (tc === tl || tl.startsWith(tc + ' '))) return 2;
  return nomeSemelhanca(a, b) >= 0.66 ? 1 : 0;
}

/* Índice de nomes por dia (v3.0): nivelNome(a, b) > 0 exige que o primeiro token significativo dos dois nomes
 * tenha semelhança ≥ 0,8 (idêntico e truncado começam pelo mesmo token; «apenas semelhante» exige isso em
 * nomeSemelhanca). Então basta visitar, em cada dia, os grupos de primeiro nome compatível, em vez de todos os
 * registros de ±tol dias. O resultado é idêntico ao da varredura completa, na mesma ordem (dia, posição na lista).
 * Medido com 27 mil laudos e relatório de 2.000 linhas: de ~9 s para menos de 1 s (test/bench_motor.mjs). */
const primeiroTokenNome = n => { for (const t of String(n || '').split(' ')) if (t && !PARTICULAS.has(t)) return t; return ''; };
function indiceNomes(itens, diaDe, pnDe) {
  const porDia = new Map(), toks = new Set(), compat = new Map(), ord = new Map();
  let n = 0;
  for (const x of itens) {
    const d = diaDe(x); if (d === null || d === undefined) continue;
    const t = primeiroTokenNome(pnDe(x)); if (!t) continue;   // sem nome: nivelNome daria 0
    toks.add(t); ord.set(x, n++);
    let m = porDia.get(d); if (!m) porDia.set(d, m = new Map());
    let a = m.get(t); if (!a) m.set(t, a = []); a.push(x);
  }
  const compativeis = a => {
    let c = compat.get(a); if (c) return c; c = [];
    for (const b of toks) { const mx = Math.max(a.length, b.length); if (Math.abs(a.length - b.length) * 5 > mx) continue; if (simToken(a, b) >= 0.8) c.push(b); }
    compat.set(a, c); return c;
  };
  // Registros de [dia − tol, dia + tol] que podem ter nivelNome > 0 com pn, na ordem da varredura completa.
  function candidatos(pn, dia, tol = 0) {
    const t = primeiroTokenNome(pn), out = []; if (!t || dia === null || dia === undefined) return out;
    const cs = compativeis(t);
    for (let d = dia - tol; d <= dia + tol; d++) {
      const m = porDia.get(d); if (!m) continue;
      const k = out.length; for (const b of cs) { const a = m.get(b); if (a) for (const x of a) out.push(x); }
      if (cs.length > 1 && out.length - k > 1) { const parte = out.splice(k).sort((x, y) => ord.get(x) - ord.get(y)); for (const x of parte) out.push(x); }
    }
    return out;
  }
  return { candidatos, tamanho: n };
}

// Convênio: o MV costuma truncar; compatível se um for prefixo do outro.
function convenioCompativel(a, b) {
  const x = norm(a).replace(/\s*$/, ''), y = norm(b);
  if (!x || !y) return null;
  return x === y || y.startsWith(x) || x.startsWith(y);
}

/* ---------- Datas (sempre UTC, dia inteiro) ---------- */
function dataBR(s) {
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) return null;
  const ano = +m[3] < 100 ? 2000 + +m[3] : +m[3];
  return new Date(Date.UTC(ano, +m[2] - 1, +m[1]));
}
function paraData(v) {
  if (v instanceof Date) return isNaN(v) ? null : new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === 'number' && isFinite(v)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
  if (typeof v === 'string') {
    const br = dataBR(v.trim()); if (br) return br;
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  }
  return null;
}
const diaSerial = d => d ? Math.round(d.getTime() / 86400000) : null;
const isoDia = d => d ? d.toISOString().slice(0, 10) : '';
const fmtData = d => d ? isoDia(d).split('-').reverse().join('/') : '';
const fmtPct = n => (Math.round((+n || 0) * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const fmtBR = n => (+n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numBR = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
const r2 = x => Math.round(x * 100) / 100;
const agoraISO = () => new Date().toISOString();

// Impressão digital simples (FNV-1a 32 bits) para identificar arquivos e conteúdos nas rodadas.
function hashTexto(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
function hashBytes(u8) {
  let h = 0x811c9dc5;
  for (let i = 0; i < u8.length; i++) { h ^= u8[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const novoId = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o));
const contar = (lista, f) => { const m = new Map(); for (const x of lista) { const k = f(x); m.set(k, (m.get(k) || 0) + 1); } return m; };
