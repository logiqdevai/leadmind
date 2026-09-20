import { CallOutcome, MeetingOutcome } from "@/features/contacts/interfaces/contact.interface";
import type { ContactAudienceStats } from "../interfaces/contact-audience-stats.interface";
import { formatAudienceRate } from "./audience-stats.utils";

export interface StatTile {
    label: string;
    value: number;
    sublabel?: string;
    accent?: "neutral" | "primary" | "success" | "warning" | "error";
}

export interface StatSection {
    title: string;
    tiles: StatTile[];
}

export const MEETING_OUTCOME_LABELS: Record<MeetingOutcome, string> = {
    [MeetingOutcome.SCHEDULED]: "Scheduled",
    [MeetingOutcome.COMPLETED]: "Completed",
    [MeetingOutcome.NO_SHOW]: "No show",
    [MeetingOutcome.CANCELLED]: "Cancelled",
    [MeetingOutcome.CLOSED_WON]: "Closed won",
    [MeetingOutcome.CLOSED_LOST]: "Closed lost",
};

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
    [CallOutcome.CONNECTED]: "Connected",
    [CallOutcome.NO_ANSWER]: "No answer",
    [CallOutcome.VOICEMAIL]: "Voicemail",
    [CallOutcome.BUSY]: "Busy",
};

/** Stat tiles shown on the analytics pages and exported to the PDF report. */
export function buildAudienceStatSections(stats: ContactAudienceStats): StatSection[] {
    const { pipeline, meetings, calls, engagement, activity } = stats;

    return [
        {
            title: "Pipeline",
            tiles: [
                { label: "Total contacts", value: pipeline.total_contacts, accent: "neutral" },
                { label: "Active pipeline", value: pipeline.active_pipeline, accent: "primary" },
                {
                    label: "Conversion rate",
                    value: pipeline.conversion_rate,
                    sublabel: formatAudienceRate(pipeline.conversion_rate),
                    accent: "success",
                },
                {
                    label: "Close rate",
                    value: pipeline.close_rate,
                    sublabel: formatAudienceRate(pipeline.close_rate),
                    accent: "success",
                },
                {
                    label: "Loss rate",
                    value: pipeline.loss_rate,
                    sublabel: formatAudienceRate(pipeline.loss_rate),
                    accent: "error",
                },
                {
                    label: "Converted",
                    value: pipeline.by_status.CONVERTED ?? 0,
                    accent: "success",
                },
                {
                    label: "Lost",
                    value: pipeline.by_status.LOST ?? 0,
                    accent: "error",
                },
            ],
        },
        {
            title: "Meetings",
            tiles: [
                { label: "Total meetings", value: meetings.total, accent: "primary" },
                {
                    label: "Contacts with meetings",
                    value: meetings.contacts_with_meetings,
                    accent: "neutral",
                },
                {
                    label: "No-show rate",
                    value: meetings.no_show_rate ?? 0,
                    sublabel: formatAudienceRate(meetings.no_show_rate),
                    accent: "warning",
                },
                {
                    label: "Meeting close rate",
                    value: meetings.meeting_close_rate ?? 0,
                    sublabel: formatAudienceRate(meetings.meeting_close_rate),
                    accent: "success",
                },
                ...Object.values(MeetingOutcome).map((outcome) => ({
                    label: MEETING_OUTCOME_LABELS[outcome],
                    value: meetings.by_outcome[outcome] ?? 0,
                    accent: "neutral" as const,
                })),
            ],
        },
        {
            title: "Calls",
            tiles: [
                { label: "Total calls", value: calls.total, accent: "primary" },
                {
                    label: "Connect rate",
                    value: calls.connect_rate ?? 0,
                    sublabel: formatAudienceRate(calls.connect_rate),
                    accent: "success",
                },
                ...Object.values(CallOutcome).map((outcome) => ({
                    label: CALL_OUTCOME_LABELS[outcome],
                    value: calls.by_outcome[outcome] ?? 0,
                    accent: "neutral" as const,
                })),
            ],
        },
        {
            title: "Engagement",
            tiles: [
                { label: "With email", value: engagement.with_email, accent: "neutral" },
                { label: "With phone", value: engagement.with_phone, accent: "neutral" },
                { label: "Never contacted", value: engagement.never_contacted, accent: "warning" },
                { label: "Emails opened", value: engagement.emails_opened, accent: "success" },
                { label: "Links clicked", value: engagement.links_clicked, accent: "success" },
                { label: "Replies", value: engagement.replies_received, accent: "success" },
                { label: "Website visits", value: engagement.website_visits, accent: "primary" },
                { label: "Booking visits", value: engagement.booking_visits, accent: "primary" },
            ],
        },
        {
            title: "Activity",
            tiles: [
                { label: "Total interactions", value: activity.total_interactions, accent: "neutral" },
                { label: "Notes", value: activity.notes, accent: "neutral" },
                { label: "Status changes", value: activity.status_changes, accent: "primary" },
            ],
        },
    ];
}
