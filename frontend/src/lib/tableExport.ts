import * as XLSX from 'xlsx';

export function extractTableRows(table: HTMLTableElement | null): string[][] {
  if (!table) return [];
  const rows: string[][] = [];
  table.querySelectorAll('tr').forEach((tr) => {
    const cells: string[] = [];
    tr.querySelectorAll('th, td').forEach((cell) => {
      cells.push(cell.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    });
    if (cells.length) rows.push(cells);
  });
  return rows;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function tableRowsToCsv(rows: string[][]): string {
  const body = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  return `\uFEFF${body}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadTableCsv(rows: string[][], filename = 'таблица.csv') {
  const blob = new Blob([tableRowsToCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function downloadTableXlsx(rows: string[][], filename = 'таблица.xlsx') {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Таблица');
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function downloadTableFromElement(
  table: HTMLTableElement | null,
  format: 'csv' | 'xlsx',
  filenameBase = 'таблица'
) {
  const rows = extractTableRows(table);
  if (!rows.length) return;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const name = `${filenameBase}-${stamp}`;
  if (format === 'csv') downloadTableCsv(rows, `${name}.csv`);
  else downloadTableXlsx(rows, `${name}.xlsx`);
}
