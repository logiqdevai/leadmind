import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
    LEAD_STATUS_VALUES,
    STATUS_LABEL,
} from "@/features/contacts/constants/contacts.constants";
import type { ContactAudienceStats } from "../interfaces/contact-audience-stats.interface";
import type { ContactAudienceAnalysisContent } from "../interfaces/contact-audience-analysis.interface";
import { buildAudienceStatSections } from "./audience-stat-sections";

const MARGIN = 14;
const TEXT = "#1f2937";
const MUTED = "#6b7280";

export interface AudienceReportInput {
    /** Name of the list, campaign, filter, or the whole CRM. */
    audienceName: string;
    /** What the audience is, e.g. "List", "Campaign". */
    audienceType: string;
    /** Activity period the stats cover, e.g. "Last 30 days". */
    periodLabel: string;
    /** Active contact filters, already formatted for display. */
    filterSummary?: string[];
    stats: ContactAudienceStats;
    analysis?: {
        content: ContactAudienceAnalysisContent;
        createdAt: string;
    } | null;
}

function formatFileName(audienceName: string): string {
    const slug = audienceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);
    const date = new Date().toISOString().slice(0, 10);
    return `analytics-${slug || "report"}-${date}.pdf`;
}

function pct(count: number, total: number): string {
    if (total <= 0) return "0%";
    return `${((count / total) * 100).toFixed(1)}%`;
}

/** Where the next block starts, adding a page first if the remaining space is too small. */
function cursorAfter(doc: jsPDF, y: number, needed = 30): number {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + needed > pageHeight - MARGIN) {
        doc.addPage();
        return MARGIN;
    }
    return y;
}

function heading(doc: jsPDF, text: string, y: number): number {
    const next = cursorAfter(doc, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(TEXT);
    doc.text(text, MARGIN, next);
    return next + 6;
}

function bulletList(doc: jsPDF, title: string, items: string[], y: number): number {
    if (items.length === 0) return y;
    let next = heading(doc, title, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(TEXT);
    const width = doc.internal.pageSize.getWidth() - MARGIN * 2 - 4;

    for (const item of items) {
        const lines = doc.splitTextToSize(item, width);
        next = cursorAfter(doc, next, lines.length * 5 + 4);
        doc.text("•", MARGIN, next);
        doc.text(lines, MARGIN + 4, next);
        next += lines.length * 5 + 2;
    }
    return next + 4;
}

export function buildAudienceReportPdf(input: AudienceReportInput): jsPDF {
    const { audienceName, audienceType, periodLabel, filterSummary = [], stats, analysis } = input;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(TEXT);
    doc.text("Analytics report", MARGIN, 20);

    doc.setFontSize(12);
    doc.text(audienceName, MARGIN, 28);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(MUTED);
    doc.text(`${audienceType} · ${periodLabel}`, MARGIN, 34);
    doc.text(`Generated ${new Date().toLocaleString()}`, MARGIN, 39);
    if (filterSummary.length > 0) {
        const lines = doc.splitTextToSize(`Filters: ${filterSummary.join(", ")}`, pageWidth - MARGIN * 2);
        doc.text(lines, MARGIN, 44);
    }

    let y = filterSummary.length > 0 ? 54 : 48;

    // Pipeline distribution
    y = heading(doc, "Pipeline distribution", y);
    const total = stats.pipeline.total_contacts;
    autoTable(doc, {
        startY: y,
        head: [["Status", "Contacts", "Share"]],
        body: LEAD_STATUS_VALUES.map((status) => [
            STATUS_LABEL[status],
            (stats.pipeline.by_status[status] ?? 0).toLocaleString(),
            pct(stats.pipeline.by_status[status] ?? 0, total),
        ]),
        foot: [["Total", total.toLocaleString(), "100%"]],
        margin: { left: MARGIN, right: MARGIN },
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255 },
        footStyles: { fillColor: [243, 244, 246], textColor: TEXT, fontStyle: "bold" },
        theme: "grid",
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Stat sections
    for (const section of buildAudienceStatSections(stats)) {
        y = cursorAfter(doc, y, 40);
        y = heading(doc, section.title, y);
        autoTable(doc, {
            startY: y,
            head: [["Metric", "Value"]],
            body: section.tiles.map((tile) => [
                tile.label,
                tile.sublabel ?? tile.value.toLocaleString(),
            ]),
            margin: { left: MARGIN, right: MARGIN },
            styles: { fontSize: 9, cellPadding: 2 },
            headStyles: { fillColor: [31, 41, 55], textColor: 255 },
            theme: "grid",
        });
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }

    // AI analysis
    if (analysis) {
        doc.addPage();
        y = MARGIN + 6;
        y = heading(doc, "AI analysis", y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(MUTED);
        doc.text(`Generated ${new Date(analysis.createdAt).toLocaleString()}`, MARGIN, y);
        y += 8;

        doc.setFontSize(10);
        doc.setTextColor(TEXT);
        const summary = doc.splitTextToSize(analysis.content.summary, pageWidth - MARGIN * 2);
        doc.text(summary, MARGIN, y);
        y += summary.length * 5 + 6;

        y = bulletList(doc, "Strengths", analysis.content.strengths, y);
        y = bulletList(doc, "Weaknesses", analysis.content.weaknesses, y);
        y = bulletList(doc, "Recommendations", analysis.content.recommendations, y);
        y = bulletList(doc, "Risks", analysis.content.risks, y);
        if (analysis.content.comparison) {
            y = heading(doc, "Since the previous analysis", y);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(TEXT);
            const lines = doc.splitTextToSize(
                analysis.content.comparison.summary,
                pageWidth - MARGIN * 2,
            );
            doc.text(lines, MARGIN, y);
            y += lines.length * 5 + 4;
            y = bulletList(doc, "Changed", analysis.content.comparison.changed, y);
            bulletList(doc, "Unchanged", analysis.content.comparison.unchanged, y);
        }
    }

    // Page numbers
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(MUTED);
        doc.text(
            `Page ${page} of ${pages}`,
            pageWidth - MARGIN,
            doc.internal.pageSize.getHeight() - 8,
            { align: "right" },
        );
    }

    return doc;
}

export function downloadAudienceReportPdf(input: AudienceReportInput): void {
    buildAudienceReportPdf(input).save(formatFileName(input.audienceName));
}
