import { Injectable } from '@nestjs/common';
import { Workbook, type Column } from 'exceljs';
import { LeadStatus, Prisma } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ContactsService } from '../contacts.service';
import { ListContactsDto } from '../dto/list-contacts.dto';

const EXPORT_BATCH_SIZE = 1000;
/** Excel rejects cell text longer than this. */
const EXCEL_MAX_CELL_LENGTH = 32767;

export const CONTACT_EXPORT_INCLUDE = {
    tags: true,
} satisfies Prisma.ContactInclude;

export type ContactExportRecord = Prisma.ContactGetPayload<{
    include: typeof CONTACT_EXPORT_INCLUDE;
}>;

export interface ContactExportRow {
    contact: ContactExportRecord;
    /** Present only when exporting the members of a list. */
    membership?: { added_at: Date; status: LeadStatus };
}

@Injectable()
export class ContactsExportService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly contactsService: ContactsService,
    ) { }

    /** Every contact matching the contacts-page filters, as an .xlsx buffer. */
    async exportContacts(organisation_uuid: string, query: ListContactsDto): Promise<Buffer> {
        const where = await this.contactsService.buildFindAllWhere(organisation_uuid, query);
        const orderBy = this.contactsService.buildContactOrderBy(query.sort_by, query.sort_order);

        const rows: ContactExportRow[] = [];
        for (let skip = 0; ; skip += EXPORT_BATCH_SIZE) {
            const batch = await this.prisma.contact.findMany({
                where,
                include: CONTACT_EXPORT_INCLUDE,
                orderBy: [orderBy, { id: 'asc' }],
                skip,
                take: EXPORT_BATCH_SIZE,
            });
            rows.push(...batch.map((contact) => ({ contact })));
            if (batch.length < EXPORT_BATCH_SIZE) break;
        }

        return this.buildWorkbook(rows, { includeListColumns: false });
    }

    async buildWorkbook(
        rows: ContactExportRow[],
        options: { includeListColumns: boolean },
    ): Promise<Buffer> {
        const workbook = new Workbook();
        workbook.created = new Date();
        const sheet = workbook.addWorksheet('Contacts', {
            views: [{ state: 'frozen', ySplit: 1 }],
        });

        const dateStyle = { numFmt: 'yyyy-mm-dd hh:mm' };
        const columns: Partial<Column>[] = [
            { header: 'Name', key: 'name', width: 28 },
            { header: 'Email', key: 'email', width: 32 },
            { header: 'Phone', key: 'phone', width: 18 },
            { header: 'Company', key: 'company', width: 28 },
            { header: 'Title', key: 'title', width: 22 },
            { header: 'Website', key: 'website', width: 30 },
            { header: 'LinkedIn URL', key: 'linkedin_url', width: 30 },
            { header: 'Google Maps URL', key: 'google_maps_url', width: 30 },
            { header: 'Location', key: 'location', width: 24 },
            { header: 'Industry', key: 'industry', width: 22 },
            { header: 'Description', key: 'description', width: 40 },
            { header: 'Status', key: 'status', width: 14 },
            ...(options.includeListColumns
                ? [
                    { header: 'List status', key: 'list_status', width: 14 },
                    { header: 'Added to list', key: 'added_at', width: 20, style: dateStyle },
                ]
                : []),
            { header: 'Tags', key: 'tags', width: 24 },
            { header: 'Created at', key: 'created_at', width: 20, style: dateStyle },
        ];
        sheet.columns = columns;

        const header = sheet.getRow(1);
        header.font = { bold: true };
        header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };

        for (const { contact: c, membership } of rows) {
            const row: Record<string, unknown> = {
                name: c.name,
                email: c.email,
                phone: c.phone,
                company: c.company,
                title: c.title,
                website: c.website,
                linkedin_url: c.linkedin_url,
                google_maps_url: c.google_maps_url,
                location: c.location,
                industry: c.industry,
                description: c.description,
                status: c.status,
                list_status: membership?.status,
                added_at: membership?.added_at,
                tags: c.tags.map((t) => t.tag).join(', '),
                created_at: c.created_at,
            };

            for (const [key, value] of Object.entries(row)) {
                if (value == null || value === '') delete row[key];
                else if (typeof value === 'string' && value.length > EXCEL_MAX_CELL_LENGTH) {
                    row[key] = value.slice(0, EXCEL_MAX_CELL_LENGTH);
                }
            }
            sheet.addRow(row);
        }

        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: columns.length },
        };

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
}
