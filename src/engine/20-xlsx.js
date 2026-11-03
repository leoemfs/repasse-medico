/* ============================================================
 * Leitura e escrita de .xlsx sobre JSZip (sem bibliotecas de Excel)
 * ============================================================ */
const decEnt = s => s.indexOf('&') < 0 ? s : s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const colIdx = L => { let n = 0; for (const c of L) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };
const colLetra = i => { let s = '', n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

// Lista as abas (nome → caminho interno) de um .xlsx já aberto.
async function abasXlsx(zip) {
  const wb = await zip.file('xl/workbook.xml')?.async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  if (!wb) throw new Error('Arquivo .xlsx inválido (sem xl/workbook.xml).');
  const alvo = new Map();
  for (const m of (rels || '').matchAll(/<Relationship\b[^>]*>/g)) {
    const id = (m[0].match(/\bId="([^"]+)"/) || [])[1], t = (m[0].match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && t) alvo.set(id, t.replace(/^\/?(xl\/)?/, 'xl/'));
  }
  const abas = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const nome = decEnt((m[0].match(/\bname="([^"]*)"/) || [])[1] || '');
    const rid = (m[0].match(/\br:id="([^"]+)"/) || [])[1];
    abas.push({ nome, caminho: alvo.get(rid) || '' });
  }
  return abas;
}

/* Lê uma aba em streaming: planilhas reais chegam com ~1 milhão de linhas vazias formatadas.
 * Para depois de 3.000 linhas vazias seguidas (com dados já lidos) e informa a última linha com dados. */
async function lerXlsx(bytes, { aba = null, onProgresso = null } = {}) {
  const zip = await JSZip.loadAsync(bytes);
  const abas = await abasXlsx(zip);
  if (!abas.length) throw new Error('Arquivo .xlsx sem planilhas.');
  const escolhida = aba ? abas.find(a => a.nome === aba) : abas[0];
  if (!escolhida) throw new Error(`Aba «${aba}» não encontrada. Abas do arquivo: ${abas.map(a => a.nome).join(', ')}`);
  let ss = [];
  const fSS = zip.file('xl/sharedStrings.xml');
  if (fSS) {
    const xml = await fSS.async('string');
    ss = [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t => decEnt(t[1])).join(''));
  }
  const entry = zip.file(escolhida.caminho);
  if (!entry) throw new Error(`Conteúdo da aba «${escolhida.nome}» não encontrado.`);
  const rows = []; rows.ultima = 0; rows.aba = escolhida.nome; rows.abas = abas.map(a => a.nome);
  return new Promise((resolve, reject) => {
    const dec = new TextDecoder('utf-8');
    let buf = '', vazias = 0, done = false, lidos = 0;
    const RE_ROW = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
    const RE_C = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    const stream = entry.internalStream('uint8array');
    const fim = () => { if (done) return; done = true; rows.varridas = lidos; try { stream.pause(); } catch (e) { } resolve(rows); };
    const linha = inner => {
      const arr = []; let m; RE_C.lastIndex = 0;
      while ((m = RE_C.exec(inner))) {
        const attrs = m[1], body = m[2] || '';
        const ref = attrs.match(/\br="([A-Z]+)\d+"/); if (!ref) continue;
        const tp = (attrs.match(/\bt="(\w+)"/) || [])[1];
        let val = null;
        if (tp === 'inlineStr') val = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => decEnt(x[1])).join('');
        else {
          const v = body.match(/<v>([\s\S]*?)<\/v>/);
          if (v) val = tp === 's' ? ss[+v[1]] : (tp === 'str' || tp === 'e') ? decEnt(v[1]) : tp === 'b' ? v[1] === '1' : parseFloat(v[1]);
        }
        if (val !== null && val !== undefined && val !== '') arr[colIdx(ref[1])] = val;
      }
      return arr;
    };
    stream.on('data', chunk => {
      if (done) return;
      try {
        buf += dec.decode(chunk, { stream: true });
        RE_ROW.lastIndex = 0; let m, last = 0;
        while (!done && (m = RE_ROW.exec(buf))) {
          last = RE_ROW.lastIndex; lidos++;
          const inner = m[2] || '';
          if (inner.indexOf('<v>') >= 0 || inner.indexOf('<is>') >= 0) {
            const a = linha(inner);
            if (a.length) { rows.push(a); vazias = 0; const rn = (m[1].match(/\br="(\d+)"/) || [])[1]; if (rn) rows.ultima = +rn; }
          } else if (rows.length && ++vazias >= 3000) fim();
        }
        buf = buf.slice(last);
        if (onProgresso && lidos % 20000 < 40) onProgresso(lidos);
      } catch (e) { done = true; reject(e); }
    });
    stream.on('end', fim);
    stream.on('error', e => { if (!done) { done = true; reject(e); } });
    stream.resume();
  });
}

// Localiza colunas pelo cabeçalho normalizado; aceita nomes alternativos.
function mapearColunas(cabecalho, campos) {
  const cab = (cabecalho || []).map(h => norm(h || ''));
  const out = {};
  for (const [campo, nomes] of Object.entries(campos)) {
    out[campo] = -1;
    for (const n of nomes) { const k = cab.indexOf(norm(n)); if (k >= 0) { out[campo] = k; break; } }
  }
  return out;
}

const limpaXml = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const escXml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Gera .xlsx. sheets: [{nome, larguras, linhas:[[célula]], filtro, congelar, semFiltroUltimas, mesclar:['A1:M1'], alturas:{linha: pt}, zoom}]
 * célula: valor simples | {v, f, st:{b,fc,fill,fmt:'date'|'money'|'acct'|'pct'|'pct2'|'num2'|'int'|'text',al,va,wrap,bt,bd:'tudo'}}
 * Textos são gravados como string em linha: códigos TUSS e zeros à esquerda não viram número. */
function criarXlsx(sheets) {
  const fonts = [], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const xfs = [], reg = {};
  const idx = (arr, x) => { let i = arr.indexOf(x); if (i < 0) { arr.push(x); i = arr.length - 1; } return i; };
  const FMT = { date: 164, money: 4, pct: 10, pct2: 10, num2: 4, int: 1, text: 49, acct: 165 };
  const estilo = st => {
    st = st || {};
    const key = JSON.stringify(st);
    if (reg[key] !== undefined) return reg[key];
    const f = idx(fonts, `<font>${st.b ? '<b/>' : ''}<sz val="10"/>${st.fc ? `<color rgb="FF${st.fc}"/>` : ''}<name val="Arial"/></font>`);
    const fl = st.fill ? idx(fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${st.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const fino = l => `<${l} style="thin"><color auto="1"/></${l}>`;
    const bd = st.bd === 'tudo' ? idx(borders, `<border>${fino('left')}${fino('right')}${fino('top')}${fino('bottom')}<diagonal/></border>`)
      : st.bt ? idx(borders, '<border><left/><right/><top style="medium"><color auto="1"/></top><bottom/><diagonal/></border>') : 0;
    const nf = FMT[st.fmt] || 0;
    const va = st.va || (st.wrap ? 'top' : 'center');
    const al = (st.al || st.wrap || st.va) ? `<alignment${st.al ? ` horizontal="${st.al}"` : ''} vertical="${va}"${st.wrap ? ' wrapText="1"' : ''}/>` : '';
    xfs.push(`<xf numFmtId="${nf}" fontId="${f}" fillId="${fl}" borderId="${bd}" xfId="0" applyFont="1"${fl ? ' applyFill="1"' : ''}${bd ? ' applyBorder="1"' : ''}${nf ? ' applyNumberFormat="1"' : ''}${al ? ' applyAlignment="1">' + al + '</xf>' : '/>'}`);
    reg[key] = xfs.length - 1;
    return reg[key];
  };
  estilo({});
  const serialData = d => Math.round((d.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
  const sheetsXml = sheets.map(sh => {
    let rows = '';
    sh.linhas.forEach((linha, r) => {
      const n = r + 1; let cs = '';
      (linha || []).forEach((c, i) => {
        if (c === null || c === undefined) return;
        const o = (typeof c === 'object' && !(c instanceof Date)) ? c : { v: c };
        const ref = colLetra(i) + n;
        const st = o.st ? { ...o.st } : {};
        let v = o.v;
        if (v instanceof Date) { v = serialData(v); st.fmt = st.fmt || 'date'; st.al = st.al || 'center'; }
        const s = estilo(st);
        if (o.f) cs += `<c r="${ref}" s="${s}"><f>${escXml(limpaXml(o.f))}</f>${v === '' || v === undefined || v === null ? '' : typeof v === 'number' ? `<v>${v}</v>` : ''}</c>`;
        else if (v === null || v === undefined || v === '') cs += `<c r="${ref}" s="${s}"/>`;
        else if (typeof v === 'number' && isFinite(v)) cs += `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
        else if (typeof v === 'boolean') cs += `<c r="${ref}" s="${s}" t="inlineStr"><is><t>${v ? 'SIM' : 'NÃO'}</t></is></c>`;
        else cs += `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${escXml(limpaXml(v))}</t></is></c>`;
      });
      const h = sh.alturas?.[n];
      rows += `<row r="${n}"${h ? ` ht="${h}" customHeight="1"` : ''}>${cs}</row>`;
    });
    const nCols = Math.max(1, ...sh.linhas.map(l => (l || []).length));
    const ult = Math.max(1, sh.linhas.length - (sh.semFiltroUltimas || 0));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetViews><sheetView${sh.zoom ? ` zoomScale="${sh.zoom}" zoomScaleNormal="${sh.zoom}"` : ''} workbookViewId="0">${sh.congelar === false ? '' : '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'}</sheetView></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="15"/>${(sh.larguras || []).length ? `<cols>${sh.larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : ''}` +
      `<sheetData>${rows}</sheetData>${sh.filtro && sh.linhas.length > 1 ? `<autoFilter ref="A1:${colLetra(nCols - 1)}${ult}"/>` : ''}` +
      `${(sh.mesclar || []).length ? `<mergeCells count="${sh.mesclar.length}">${sh.mesclar.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}</worksheet>`;
  });
  const nomes = sheets.map(s => escXml(s.nome.slice(0, 31)));
  const dn = sheets.map((s, i) => s.filtro && s.linhas.length > 1 ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${nomes[i]}'!$A$1:$${colLetra(Math.max(1, ...s.linhas.map(l => (l || []).length)) - 1)}$${Math.max(1, s.linhas.length - (s.semFiltroUltimas || 0))}</definedName>` : '').join('');
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="${escXml('_-"R$"\\ * #,##0.00_-;\\-"R$"\\ * #,##0.00_-;_-"R$"\\ * "-"??_-;_-@_-')}"/></numFmts><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${nomes[i]}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${dn ? `<definedNames>${dn}</definedNames>` : ''}</workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', styles);
  sheetsXml.forEach((x, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, x));
  return zip;
}
// Cabeçalho padrão (azul escuro, texto branco) para as planilhas exportadas.
const CAB = { b: true, fc: 'FFFFFF', fill: '1F4E78', al: 'center', wrap: true };
const cabecalho = (nomes, st = CAB) => nomes.map(v => ({ v, st }));
