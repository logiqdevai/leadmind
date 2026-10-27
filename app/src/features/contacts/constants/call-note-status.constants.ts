export const CallNoteStatus = {
    NOT_AVAILABLE: "NOT_AVAILABLE",
    NOT_INTERESTED: "NOT_INTERESTED",
    CALL_LATER: "CALL_LATER",
    SEND_INFO: "SEND_INFO",
    WRONG_NUMBER: "WRONG_NUMBER",
    DO_NOT_CALL: "DO_NOT_CALL",
    INTERESTED: "INTERESTED",
    MEETING_BOOKED: "MEETING_BOOKED",
    ALREADY_CUSTOMER: "ALREADY_CUSTOMER",
    USING_COMPETITOR: "USING_COMPETITOR",
    NO_BUDGET: "NO_BUDGET",
    NOT_DECISION_MAKER: "NOT_DECISION_MAKER",
    GATEKEEPER: "GATEKEEPER",
} as const;

export type CallNoteStatus = (typeof CallNoteStatus)[keyof typeof CallNoteStatus];

/** Label shown in the Quick note list; it is also the text dropped into the call's notes. */
export const CALL_NOTE_STATUS_LABELS: Record<CallNoteStatus, string> = {
    NOT_AVAILABLE: "Not available",
    NOT_INTERESTED: "Not interested",
    CALL_LATER: "Call later",
    SEND_INFO: "Asked to send more info",
    WRONG_NUMBER: "Wrong number",
    DO_NOT_CALL: "Don't call me again",
    INTERESTED: "Interested",
    MEETING_BOOKED: "Meeting booked",
    ALREADY_CUSTOMER: "Already a customer",
    USING_COMPETITOR: "Uses a competitor",
    NO_BUDGET: "No budget",
    NOT_DECISION_MAKER: "Not the decision maker",
    GATEKEEPER: "Spoke to gatekeeper",
};

export const CALL_NOTE_STATUS_OPTIONS = (Object.keys(CALL_NOTE_STATUS_LABELS) as CallNoteStatus[]).map((id) => ({
    id,
    label: CALL_NOTE_STATUS_LABELS[id],
}));

export const CALL_NOTE_STATUS_COLORS: Record<CallNoteStatus, "default" | "success" | "warning" | "danger"> = {
    NOT_AVAILABLE: "default",
    NOT_INTERESTED: "danger",
    CALL_LATER: "warning",
    SEND_INFO: "warning",
    WRONG_NUMBER: "danger",
    DO_NOT_CALL: "danger",
    INTERESTED: "success",
    MEETING_BOOKED: "success",
    ALREADY_CUSTOMER: "success",
    USING_COMPETITOR: "default",
    NO_BUDGET: "default",
    NOT_DECISION_MAKER: "warning",
    GATEKEEPER: "default",
};

export const isCallNoteStatus = (value: unknown): value is CallNoteStatus =>
    typeof value === "string" && value in CallNoteStatus;
