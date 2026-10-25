interface CsvBooking {
    uuid: string;
    start_at: Date;
    end_at: Date;
    duration_minutes: number;
    invitee_timezone: string | null;
    status: string;
    source: string;
    invitee_name: string;
    invitee_email: string;
    invitee_phone: string | null;
    invitee_notes: string | null;
    internal_notes: string | null;
    location_type: string;
    location_value: string | null;
    meeting_url: string | null;
    calendar_sync_status: string;
    cancellation_reason: string | null;
    created_at: Date;
    booking_page: { name: string } | null;
    assigned_user: { full_name: string | null; email: string } | null;
    contact: { uuid: string } | null;
}

const COLUMNS: [string, (b: CsvBooking) => string | number | null | undefined][] = [
    ['Booking ID', (b) => b.uuid],
    ['Start (UTC)', (b) => b.start_at.toISOString()],
    ['End (UTC)', (b) => b.end_at.toISOString()],
    ['Duration (min)', (b) => b.duration_minutes],
    ['Invitee timezone', (b) => b.invitee_timezone],
    ['Status', (b) => b.status],
    ['Source', (b) => b.source],
    ['Booking page', (b) => b.booking_page?.name],
    ['Team member', (b) => b.assigned_user?.full_name || b.assigned_user?.email],
    ['Name', (b) => b.invitee_name],
    ['Email', (b) => b.invitee_email],
    ['Phone', (b) => b.invitee_phone],
    ['Contact ID', (b) => b.contact?.uuid],
    ['Location', (b) => b.location_type],
    ['Location details', (b) => b.location_value],
    ['Meeting URL', (b) => b.meeting_url],
    ['Calendar sync', (b) => b.calendar_sync_status],
    ['Notes', (b) => b.invitee_notes],
    ['Internal notes', (b) => b.internal_notes],
    ['Cancellation reason', (b) => b.cancellation_reason],
    ['Created at (UTC)', (b) => b.created_at.toISOString()],
];

function cell(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    let text = String(value);
    // Neutralise spreadsheet formula injection from invitee-typed fields.
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function bookingsToCsv(bookings: CsvBooking[]): string {
    const header = COLUMNS.map(([name]) => cell(name)).join(',');
    const rows = bookings.map((b) => COLUMNS.map(([, get]) => cell(get(b))).join(','));
    return [header, ...rows].join('\r\n');
}
