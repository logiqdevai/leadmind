import { Injectable } from '@nestjs/common';
import { ComposioService } from './composio.service';
import { ComposioRequestError } from '../interfaces/composio.interface';
import {
    GoogleBusyInterval,
    GoogleCalendarEventInput,
    GoogleCalendarEventResult,
    GoogleCalendarListItem,
} from '../interfaces/google-calendar.interface';

interface GoogleEvent {
    id: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
}

/**
 * Google Calendar v3 REST calls, executed through Composio's proxy as a member's connected account.
 * Endpoints are relative to https://www.googleapis.com/calendar/v3.
 */
@Injectable()
export class GoogleCalendarService {
    constructor(private readonly composio: ComposioService) {}

    async getPrimaryCalendar(connected_account_id: string): Promise<{ id: string; summary: string }> {
        const { data } = await this.composio.proxy<{ id: string; summary: string }>({
            connected_account_id,
            endpoint: '/calendars/primary',
            method: 'GET',
        });
        return data;
    }

    async listCalendars(connected_account_id: string): Promise<GoogleCalendarListItem[]> {
        const { data } = await this.composio.proxy<{
            items?: { id: string; summary: string; primary?: boolean; accessRole: string; timeZone?: string }[];
        }>({
            connected_account_id,
            endpoint: '/users/me/calendarList',
            method: 'GET',
            query: { maxResults: 250, minAccessRole: 'writer' },
        });
        return (data.items ?? []).map((item) => ({
            id: item.id,
            summary: item.summary,
            primary: !!item.primary,
            access_role: item.accessRole,
            time_zone: item.timeZone ?? null,
        }));
    }

    /**
     * Creates the event under a caller-chosen id (Google accepts base32hex ids), so a retried job can't
     * create a duplicate: a second insert returns 409 and we update the existing event instead.
     */
    async upsertEvent(
        connected_account_id: string,
        calendar_id: string,
        event_id: string,
        input: GoogleCalendarEventInput,
    ): Promise<GoogleCalendarEventResult> {
        const body = this.toGoogleEvent(input, event_id);
        try {
            const { data } = await this.composio.proxy<GoogleEvent>({
                connected_account_id,
                endpoint: `/calendars/${encodeURIComponent(calendar_id)}/events`,
                method: 'POST',
                query: { conferenceDataVersion: 1, sendUpdates: 'all' },
                body: { id: event_id, ...body },
            });
            return this.toResult(data);
        } catch (error) {
            if (error instanceof ComposioRequestError && error.status === 409) {
                return this.updateEvent(connected_account_id, calendar_id, event_id, input);
            }
            throw error;
        }
    }

    async updateEvent(
        connected_account_id: string,
        calendar_id: string,
        event_id: string,
        input: GoogleCalendarEventInput,
    ): Promise<GoogleCalendarEventResult> {
        const { data } = await this.composio.proxy<GoogleEvent>({
            connected_account_id,
            endpoint: `/calendars/${encodeURIComponent(calendar_id)}/events/${encodeURIComponent(event_id)}`,
            method: 'PATCH',
            query: { conferenceDataVersion: 1, sendUpdates: 'all' },
            body: { ...this.toGoogleEvent(input, event_id), status: 'confirmed' },
        });
        return this.toResult(data);
    }

    /** Idempotent: an event that is already gone counts as deleted. */
    async deleteEvent(connected_account_id: string, calendar_id: string, event_id: string): Promise<void> {
        try {
            await this.composio.proxy({
                connected_account_id,
                endpoint: `/calendars/${encodeURIComponent(calendar_id)}/events/${encodeURIComponent(event_id)}`,
                method: 'DELETE',
                query: { sendUpdates: 'all' },
            });
        } catch (error) {
            if (error instanceof ComposioRequestError && (error.status === 404 || error.status === 410)) return;
            throw error;
        }
    }

    async getBusyIntervals(
        connected_account_id: string,
        calendar_id: string,
        from: Date,
        to: Date,
    ): Promise<GoogleBusyInterval[]> {
        const { data } = await this.composio.proxy<{
            calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
        }>({
            connected_account_id,
            endpoint: '/freeBusy',
            method: 'POST',
            body: { timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: calendar_id }] },
        });
        const busy = data.calendars?.[calendar_id]?.busy ?? Object.values(data.calendars ?? {})[0]?.busy ?? [];
        return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
    }

    private toGoogleEvent(input: GoogleCalendarEventInput, event_id: string) {
        return {
            summary: input.summary,
            description: input.description,
            location: input.location ?? undefined,
            start: { dateTime: input.start.toISOString(), timeZone: input.time_zone },
            end: { dateTime: input.end.toISOString(), timeZone: input.time_zone },
            attendees: input.attendees.map((a) => ({ email: a.email, displayName: a.display_name ?? undefined })),
            ...(input.with_meet
                ? {
                      conferenceData: {
                          // Same request id on retries => Google reuses the same Meet room.
                          createRequest: { requestId: event_id, conferenceSolutionKey: { type: 'hangoutsMeet' } },
                      },
                  }
                : {}),
        };
    }

    private toResult(event: GoogleEvent): GoogleCalendarEventResult {
        const videoEntry = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video');
        return {
            event_id: event.id,
            html_link: event.htmlLink ?? null,
            meet_url: event.hangoutLink ?? videoEntry?.uri ?? null,
        };
    }
}
