/** Saves a Blob to the user's machine under the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

/** `<base>-YYYY-MM-DD.xlsx`, with characters that filesystems reject stripped from `base`. */
export function xlsxFilename(base: string): string {
    const safeBase = base.replace(/[\\:*?"<>|/]+/g, "").trim().replace(/\s+/g, "-") || "contacts";
    const date = new Date().toISOString().slice(0, 10);
    return `${safeBase}-${date}.xlsx`;
}

/** Axios error bodies for `responseType: "blob"` requests arrive as a Blob; pull the API message out. */
export async function readBlobErrorMessage(error: unknown, fallback: string): Promise<string> {
    const data = (error as { response?: { data?: unknown } })?.response?.data;
    if (data instanceof Blob) {
        try {
            const parsed = JSON.parse(await data.text());
            if (parsed?.message) return Array.isArray(parsed.message) ? parsed.message.join(", ") : parsed.message;
        } catch {
            /* not JSON */
        }
    }
    return (data as { message?: string } | undefined)?.message || fallback;
}
