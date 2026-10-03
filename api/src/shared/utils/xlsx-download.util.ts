import type { Response } from 'express';

export const XLSX_CONTENT_TYPE =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Sets the headers for an .xlsx attachment named `<baseName>-YYYY-MM-DD.xlsx`. */
export function setXlsxDownloadHeaders(res: Response, baseName: string): void {
    const safeBase =
        baseName
            .normalize('NFKD')
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .toLowerCase() || 'contacts';
    const date = new Date().toISOString().slice(0, 10);
    res.set({
        'Content-Type': XLSX_CONTENT_TYPE,
        'Content-Disposition': `attachment; filename="${safeBase}-${date}.xlsx"`,
        'Access-Control-Expose-Headers': 'Content-Disposition',
    });
}
