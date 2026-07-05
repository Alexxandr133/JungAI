import { buildTableHtml } from './projectSpaceAgentTypes';

/** Текст вкладки для агента: таблицы помечены явно, чтобы их можно было редактировать */
export function formatTabHtmlForAgent(html: string): string {
  if (!html?.trim()) return '(пусто)';

  let tableIndex = 0;
  const tableBlocks: string[] = [];

  const withoutTables = html.replace(
    /<div class="wa-table-wrap">\s*<table[\s\S]*?<\/table>\s*<\/div>|<table[\s\S]*?<\/table>/gi,
    () => {
      tableIndex += 1;
      return `\n[[ТАБЛИЦА_${tableIndex}]]\n`;
    }
  );

  // Re-scan for table blocks
  tableIndex = 0;
  html.replace(
    /<div class="wa-table-wrap">\s*<table[\s\S]*?<\/table>\s*<\/div>|<table[\s\S]*?<\/table>/gi,
    (match) => {
      tableIndex += 1;
      tableBlocks.push(tableHtmlToAgentBlock(match, tableIndex));
      return match;
    }
  );

  const text = htmlFragmentToPlain(withoutTables);
  let out = text.trim() || '(нет текста вне таблиц)';

  if (tableBlocks.length) {
    out += '\n\n--- Таблицы (редактировать: update_table, tableIndex с 0) ---';
    out += '\n' + tableBlocks.join('\n');
  }

  return out.slice(0, 50000);
}

function htmlFragmentToPlain(fragment: string): string {
  return fragment
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function tableHtmlToAgentBlock(tableHtml: string, index: number): string {
  const rows: string[][] = [];
  const rowMatches = tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const rowMatch of rowMatches) {
    const cells: string[] = [];
    const cellMatches = rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi);
    for (const cellMatch of cellMatches) {
      cells.push(htmlFragmentToPlain(cellMatch[1]));
    }
    if (cells.length) rows.push(cells);
  }

  const lines = [`[ТАБЛИЦА ${index} — tableIndex: ${index - 1}]`];
  for (const row of rows) {
    lines.push('| ' + row.join(' | ') + ' |');
  }
  lines.push(`[/ТАБЛИЦА ${index}]`);
  return lines.join('\n');
}

export function replaceTextInDocumentHtml(
  html: string,
  search: string,
  replace: string,
  replaceAll = true
): { html: string; replaced: number } {
  if (!search) return { html, replaced: 0 };

  const flags = replaceAll ? 'gi' : 'i';
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, flags);
  let count = 0;
  const direct = html.replace(re, () => {
    count += 1;
    return replace;
  });
  if (count > 0) return { html: direct, replaced: count };

  if (typeof DOMParser === 'undefined') return { html, replaced: 0 };

  const doc = new DOMParser().parseFromString(`<div id="__root">${html}</div>`, 'text/html');
  const root = doc.getElementById('__root');
  if (!root) return { html, replaced: 0 };

  const searchRe = new RegExp(escaped, flags);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const value = textNode.nodeValue || '';
    if (searchRe.test(value)) {
      searchRe.lastIndex = 0;
      textNode.nodeValue = value.replace(searchRe, () => {
        count += 1;
        return replace;
      });
      if (!replaceAll) break;
    }
    searchRe.lastIndex = 0;
    node = walker.nextNode();
  }

  return { html: root.innerHTML, replaced: count };
}

export function replaceTableInDocumentHtml(
  html: string,
  tableIndex: number,
  headers: string[],
  rows: string[][]
): { html: string; replaced: boolean } {
  const newTable = buildTableHtml(headers, rows);
  let idx = 0;
  let replaced = false;
  const pattern = /<div class="wa-table-wrap">\s*<table[\s\S]*?<\/table>\s*<\/div>|<table[\s\S]*?<\/table>/gi;

  const next = html.replace(pattern, (match) => {
    if (idx === tableIndex) {
      idx += 1;
      replaced = true;
      return newTable;
    }
    idx += 1;
    return match;
  });

  return { html: next, replaced };
}

export function removeTableFromDocumentHtml(html: string, tableIndex: number): { html: string; removed: boolean } {
  let idx = 0;
  let removed = false;
  const pattern = /<div class="wa-table-wrap">\s*<table[\s\S]*?<\/table>\s*<\/div>\s*|<table[\s\S]*?<\/table>\s*/gi;

  const next = html.replace(pattern, (match) => {
    if (idx === tableIndex) {
      idx += 1;
      removed = true;
      return '';
    }
    idx += 1;
    return match;
  });

  return { html: next, removed };
}
