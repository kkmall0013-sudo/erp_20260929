import { triggerBlobDownload } from './fileIO';

export interface CsvExportOptions {
  filename: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
}

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export function downloadCsvString(filename: string, csvContent: string): void {
  const contentWithBom = csvContent.startsWith('\uFEFF') ? csvContent : `\uFEFF${csvContent}`;
  const blob = new Blob([contentWithBom], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function exportCsvFile({ filename, headers, rows }: CsvExportOptions): void {
  const headerLine = headers.map(h => escapeCsvCell(h)).join(',');
  const rowLines = rows.map(row => row.map(cell => escapeCsvCell(cell)).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
  downloadCsvString(filename, csvContent);
}
