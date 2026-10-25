export interface GoogleCalendarListItem {
    id: string;
    summary: string;
    primary: boolean;
    access_role: string;
    time_zone: string | null;
}

export interface GoogleCalendarEventInput {
    summary: string;
    description: string;
    start: Date;
    end: Date;
    time_zone: string;
    location?: string | null;
    attendees: { email: string; display_name?: string | null }[];
    /** Ask Google to attach a Meet conference to the event. */
    with_meet: boolean;
}

export interface GoogleCalendarEventResult {
    event_id: string;
    html_link: string | null;
    meet_url: string | null;
}

export interface GoogleBusyInterval {
    start: Date;
    end: Date;
}
