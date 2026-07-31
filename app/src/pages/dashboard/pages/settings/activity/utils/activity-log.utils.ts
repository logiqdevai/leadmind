const ENTITY_LABELS: Record<string, string> = {
    contact: "Contact",
    contact_info: "Contact info",
    lead: "Lead",
    filter: "Filter",
    marketing_campaign: "Campaign",
    outreach_message: "Message",
    outreach_sequence: "Sequence",
    organisation: "Organisation",
    organisation_member: "Member",
    organisation_invitation: "Invitation",
    form: "Form",
    form_field: "Form field",
    form_completion: "Form completion",
    reminder: "Reminder",
    integration: "Integration",
    sender_profile: "Sender profile",
    message_template: "Template",
    contact_list: "List",
    scoring_instruction: "Scoring rule",
    audience_analysis: "Audience analysis",
};

const ACTION_LABELS: Record<string, string> = {
    created: "Created",
    updated: "Updated",
    deleted: "Deleted",
    duplicated: "Duplicated",
    converted_from_lead: "Converted from lead",
    status_updated: "Status updated",
    tags_updated: "Tags updated",
    bulk_deleted: "Bulk deleted",
    enriched: "Enriched",
    bulk_enriched: "Bulk enriched",
    scored: "Scored",
    bulk_scored: "Bulk scored",
    email_scraped: "Email scraped",
    draft_generated: "Draft generated",
    bulk_draft_generated: "Bulk drafts generated",
    note_added: "Note added",
    call_logged: "Call logged",
    meeting_logged: "Meeting logged",
    email_logged: "Email logged",
    sms_logged: "SMS logged",
    started: "Started",
    scheduled: "Scheduled",
    cancelled: "Cancelled",
    rerun: "Rerun",
    drafts_sent: "Drafts sent",
    draft_message_sent: "Draft sent",
    draft_message_deleted: "Draft deleted",
    ai_generated: "AI generated",
    message_created: "Message created",
    message_drafted: "Message drafted",
    message_updated: "Message updated",
    message_sent: "Message sent",
    message_deleted: "Message deleted",
    sequence_created: "Sequence created",
    sequence_assigned: "Sequence assigned",
    run_started: "Run started",
    run_stopped: "Run stopped",
    analysis_created: "Analysis created",
    analysis_deleted: "Analysis deleted",
    switched: "Switched",
    member_role_updated: "Role updated",
    member_removed: "Member removed",
    invitation_created: "Invitation created",
    invitation_resent: "Invitation resent",
    invitation_revoked: "Invitation revoked",
    invitation_accepted: "Invitation accepted",
    contacts_added: "Contacts added",
    contacts_removed: "Contacts removed",
    contacts_bulk_added: "Contacts bulk added",
    key_created: "Key created",
    key_updated: "Key updated",
    key_deleted: "Key deleted",
    smtp_account_created: "SMTP account created",
    default_account_set: "Default account set",
    account_title_updated: "Account title updated",
    completed: "Completed",
    reordered: "Reordered",
    created_from_campaign: "Created from campaign",
    created_from_message: "Created from message",
};

export function formatActivityEntityType(entityType: string): string {
    return ENTITY_LABELS[entityType] ?? entityType.replaceAll("_", " ");
}

export function formatActivityAction(action: string): string {
    return ACTION_LABELS[action] ?? action.replaceAll("_", " ");
}

export function formatActivityActor(actor: {
    full_name: string | null;
    email: string;
} | null): string {
    if (!actor) return "System";
    return actor.full_name?.trim() || actor.email;
}

export function formatActivityDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatActivityDescription(log: {
    summary: string | null;
    entity_type: string;
    action: string;
}): string {
    if (log.summary?.trim()) return log.summary.trim();
    return `${formatActivityAction(log.action)} · ${formatActivityEntityType(log.entity_type)}`;
}

export const ACTIVITY_ENTITY_FILTER_OPTIONS = [
    { id: "", label: "All entities" },
    ...Object.entries(ENTITY_LABELS).map(([id, label]) => ({ id, label })),
];
