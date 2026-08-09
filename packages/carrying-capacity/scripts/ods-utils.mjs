import {execFileSync} from 'node:child_process';

export function unzipText(file, member) {
  return execFileSync('unzip', ['-p', file, member], {encoding: 'utf8'});
}

export function xmlUnescape(value = '') {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)));
}

function attributes(tag) {
  const attrs = {};
  const body = tag.replace(/^<[^\s>]+|\/? >?$/g, '');
  const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = re.exec(body))) attrs[match[1]] = xmlUnescape(match[2]);
  return attrs;
}

function localName(name) {
  return name.includes(':') ? name.split(':').at(-1) : name;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Small dependency-free ODS table reader. ODS is a ZIP/XML format; unzip is
 * used only for the archive boundary, while all table parsing is performed in
 * Node so formulas and displayed values can be retained together.
 */
export function parseOds(file) {
  const xml = unzipText(file, 'content.xml');
  const tables = [];
  const tokenRe = /<[^>]+>|[^<]+/g;
  let token;
  let currentTable = null;
  let currentRow = null;
  let currentCell = null;
  let paragraph = null;
  let tableDepth = 0;

  while ((token = tokenRe.exec(xml))) {
    if (!token[0].startsWith('<')) {
      if (paragraph !== null) paragraph += xmlUnescape(token[0]);
      continue;
    }
    if (/^<\?/.test(token[0]) || /^<!/.test(token[0])) continue;
    const closing = /^<\//.test(token[0]);
    const selfClosing = /\/\s*>$/.test(token[0]);
    const rawName = token[0].match(/^<\/?\s*([^\s/>]+)/)?.[1];
    if (!rawName) continue;
    const name = localName(rawName);

    if (!closing && name === 'table') {
      const a = attributes(token[0]);
      if (currentTable) tableDepth += 1;
      else currentTable = {name: a['table:name'] || '', rows: []};
      continue;
    }
    if (closing && name === 'table') {
      if (tableDepth) tableDepth -= 1;
      else if (currentTable) { tables.push(currentTable); currentTable = null; }
      continue;
    }
    if (!currentTable || tableDepth) continue;

    if (!closing && name === 'table-row') {
      currentRow = {index: currentTable.rows.length + 1, cells: []};
      const a = attributes(token[0]);
      currentRow.repeat = Number(a['table:number-rows-repeated'] || 1);
      if (selfClosing) {
        for (let i = 0; i < currentRow.repeat; i++) currentTable.rows.push({index: currentTable.rows.length + 1, cells: []});
        currentRow = null;
      }
      continue;
    }
    if (closing && name === 'table-row') {
      if (!currentRow) continue;
      for (let i = 0; i < currentRow.repeat; i++) {
        currentTable.rows.push({index: currentTable.rows.length + 1, cells: currentRow.cells.map(cell => ({...cell}))});
      }
      currentRow = null;
      continue;
    }
    if (!currentRow) continue;

    if (!closing && name === 'table-cell') {
      const a = attributes(token[0]);
      currentCell = {
        column: currentRow.cells.length + 1,
        formula: a['table:formula'] || null,
        valueType: a['office:value-type'] || null,
        value: a['office:value'] ?? a['office:date-value'] ?? a['office:time-value'] ?? null,
        stringValue: a['office:string-value'] || null,
        text: '',
        repeat: Number(a['table:number-columns-repeated'] || 1)
      };
      if (selfClosing) {
        for (let i = 0; i < currentCell.repeat; i++) currentRow.cells.push({...currentCell, column: currentRow.cells.length + 1});
        currentCell = null;
      }
      continue;
    }
    if (closing && name === 'table-cell') {
      if (!currentCell) continue;
      currentCell.text = currentCell.text.replace(/\s+/g, ' ').trim();
      for (let i = 0; i < currentCell.repeat; i++) {
        currentRow.cells.push({
          ...currentCell,
          column: currentRow.cells.length + 1,
          number: parseNumber(currentCell.value)
        });
      }
      currentCell = null;
      continue;
    }
    if (!closing && name === 'p') { paragraph = ''; continue; }
    if (closing && name === 'p') {
      if (currentCell && paragraph !== null) currentCell.text += (currentCell.text ? ' ' : '') + paragraph;
      paragraph = null;
    }
  }
  return tables;
}

export function cellAddress(row, column) {
  let n = column;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return `${letters}${row}`;
}

export function tableToMatrix(table) {
  const width = Math.max(0, ...table.rows.map(row => row.cells.length));
  return table.rows.map(row => Array.from({length: width}, (_, i) => row.cells[i] || {
    column: i + 1, formula: null, valueType: null, value: null, stringValue: null, text: '', number: null
  }));
}

export function displayCell(cell) {
  if (!cell) return '';
  if (cell.text !== '') return cell.text;
  if (cell.stringValue !== null) return cell.stringValue;
  if (cell.value !== null) return cell.value;
  return '';
}
