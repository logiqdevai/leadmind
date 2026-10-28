import { Injectable } from '@nestjs/common';
import { ComposioService } from './composio.service';
import { ComposioRequestError } from '../interfaces/composio.interface';
import {
    GoogleBusyInterval,
    GoogleCalendarEventInput,
    GoogleCalendarEventResult,
    GoogleCalendarListItem,
    GoogleChangedEvent,
} from '../interfaces/google-calendar.interface';

interface GoogleEventsPage {
    items?: {
        id: string;
        status?: string;
        updated?: string;
        location?: string;
        start?: { dateTime?: string };
        end?: { dateTime?: string };
        attendees?: { email: string; displayName?: string; responseStatus?: string; organizer?: boolean }[];
    }[];
    nextPageToken?: string;
    nextSyncToken?: string;
}

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
                query: { conferenceDataVersion: 1, sendUpdates: input.silent ? 'none' : 'all' },
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
            query: { conferenceDataVersion: 1, sendUpdates: input.silent ? 'none' : 'all' },
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

    /**
     * Incremental listing. With a `sync_token` Google returns exactly what changed since the last call, so an
     * outage never loses edits. Without one (first run, or after the token expired) it lists events from
     * `since` onwards and hands back a fresh token. `token_expired` means Google answered 410 and the
     * caller must start over without a token.
     */
    async listChangedEvents(
        connected_account_id: string,
        calendar_id: string,
        options: { sync_token?: string | null; since: Date },
    ): Promise<{ events: GoogleChangedEvent[]; next_sync_token: string | null; token_expired: boolean }> {
        const events: GoogleChangedEvent[] = [];
        let pageToken: string | undefined;
        let nextSyncToken: string | null = null;
        for (let page = 0; page < 20; page++) {
            let data: GoogleEventsPage;
            try {
                ({ data } = await this.composio.proxy<GoogleEventsPage>({
                    connected_account_id,
                    endpoint: `/calendars/${encodeURIComponent(calendar_id)}/events`,
                    method: 'GET',
                    query: {
                        showDeleted: true,
                        singleEvents: true,
                        maxResults: 250,
                        pageToken,
                        // Google rejects timeMin together with syncToken.
                        ...(options.sync_token ? { syncToken: options.sync_token } : { timeMin: options.since.toISOString() }),
                    },
                }));
            } catch (error) {
                if (options.sync_token && error instanceof ComposioRequestError && error.status === 410) {
                    return { events: [], next_sync_token: null, token_expired: true };
                }
                throw error;
            }
            for (const item of data.items ?? []) {
                events.push({
                    id: item.id,
                    cancelled: item.status === 'cancelled',
                    updated: item.updated ? new Date(item.updated) : null,
                    start: item.start?.dateTime ? new Date(item.start.dateTime) : null,
                    end: item.end?.dateTime ? new Date(item.end.dateTime) : null,
                    location: item.location ?? null,
                    attendees: (item.attendees ?? []).map((a) => ({
                        email: a.email.toLowerCase(),
                        display_name: a.displayName ?? null,
                        response_status: a.responseStatus ?? null,
                        is_organizer: !!a.organizer,
                    })),
                });
            }
            pageToken = data.nextPageToken;
            if (!pageToken) {
                nextSyncToken = data.nextSyncToken ?? null;
                break;
            }
        }
        return { events, next_sync_token: nextSyncToken, token_expired: false };
    }

    /** Asks Google to POST to `address` whenever the calendar changes. Channels expire (max ~7 days) and must be renewed. */
    async watchEvents(
        connected_account_id: string,
        calendar_id: string,
        channel: { id: string; token: string; address: string },
    ): Promise<{ resource_id: string; expires_at: Date }> {
        const { data } = await this.composio.proxy<{ resourceId: string; expiration?: string }>({
            connected_account_id,
            endpoint: `/calendars/${encodeURIComponent(calendar_id)}/events/watch`,
            method: 'POST',
            body: { id: channel.id, type: 'web_hook', address: channel.address, token: channel.token },
        });
        return {
            resource_id: data.resourceId,
            expires_at: data.expiration ? new Date(Number(data.expiration)) : new Date(Date.now() + 6 * 86_400_000),
        };
    }

    async stopWatch(connected_account_id: string, channel_id: string, resource_id: string): Promise<void> {
        try {
            await this.composio.proxy({
                connected_account_id,
                endpoint: '/channels/stop',
                method: 'POST',
                body: { id: channel_id, resourceId: resource_id },
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
            transparency: input.free ? 'transparent' : 'opaque',
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
