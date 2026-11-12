// frontend/lib/import/sheet.ts
// SheetJS is loaded only on the import page (dynamic import), so other pages stay small.
import type { ImportFieldDef } from './fields';

export interface SheetData {
    headers: string[];
    rows: { rowNumber: number; cells: string[] }[]; // rowNumber = line number in the sheet (1-based)
}

const cellText = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

// First sheet, first non-empty line as headers; empty lines skipped. Dates stay Excel serials
// (numbers) and CSV is read raw (no date guessing): the backend parses both.
export async function readSheet(file: File): Promise<SheetData> {
    const XLSX = await import('xlsx');
    const csv = file.name.toLowerCase().endsWith('.csv');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: csv });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error('Le fichier ne contient aucune feuille.');
    const lines = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true });

    const headerIndex = lines.findIndex((line) => line.some((cell) => cellText(cell) !== ''));
    if (headerIndex === -1) throw new Error('Le fichier est vide.');
    const headers = lines[headerIndex].map(cellText);

    const rows = lines
        .slice(headerIndex + 1)
        .map((line, offset) => ({ rowNumber: headerIndex + offset + 2, cells: headers.map((_, i) => cellText(line[i])) }))
        .filter((row) => row.cells.some((cell) => cell !== ''));
    return { headers, rows };
}

const download = async (aoa: string[][], filename: string, widths?: number[]) => {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    if (widths) sheet['!cols'] = widths.map((wch) => ({ wch }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Élèves');
    XLSX.writeFile(workbook, filename);
};

export const downloadTemplate = (fields: ImportFieldDef[]) =>
    download(
        [fields.map((field) => `${field.label} (${field.hint})`), fields.map((field) => field.example)],
        'modele-import-eleves.xlsx',
        fields.map(() => 22)
    );

export const downloadErrorRows = (headers: string[], rows: { cells: string[]; errors: string[] }[]) =>
    download([[...headers, 'Erreur'], ...rows.map((row) => [...row.cells, row.errors.join(' ; ')])], 'lignes-en-erreur.xlsx');
