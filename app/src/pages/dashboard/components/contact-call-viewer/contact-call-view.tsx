import { useState, type FC } from "react";
import { Button, Dropdown, ListBox, Select, Tabs, TextArea } from "@heroui/react";
import { CalendarDays, ChevronDown, Mail, MessageSquare, Phone } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { ScrollableTabs, ScrollableTabsList, tabTriggerClassName } from "@/components/ui/scrollable-tabs";
import { STATUS_OPTIONS } from "@/features/contacts/constants/contacts.constants";
import {
    useContact,
    useUpdateContactNotes,
    useUpdateContactStatus,
} from "@/features/contacts/hooks/use-contacts";
import type { Contact, LeadStatus } from "@/features/contacts/interfaces/contact.interface";
import { InteractionTimeline } from "@/pages/dashboard/pages/contacts/components/interaction-timeline";
import { LogCallModal } from "@/pages/dashboard/pages/contacts/pages/detail/components/log-call-modal";
import { LogEmailModal } from "@/pages/dashboard/pages/contacts/pages/detail/components/log-email-modal";
import { LogMeetingModal } from "@/pages/dashboard/pages/contacts/pages/detail/components/log-meeting-modal";
import { LogSmsModal } from "@/pages/dashboard/pages/contacts/pages/detail/components/log-sms-modal";
import { BookingsTab, OutreachTab, RemindersTab } from "@/pages/dashboard/pages/contacts/pages/detail/components";
import { ContactCallInfo } from "./contact-call-info";

const CALL_TABS = [
    { id: "activity", label: "Notes & Activity" },
    { id: "email", label: "Email" },
    { id: "reminders", label: "Reminders" },
    { id: "bookings", label: "Bookings" },
] as const;

const NotesAndActivity: FC<{ contact: Contact }> = ({ contact }) => {
    const updateNotes = useUpdateContactNotes();
    const [notes, setNotes] = useState(contact.notes ?? "");
    const [logCallOpen, setLogCallOpen] = useState(false);
    const [logMeetingOpen, setLogMeetingOpen] = useState(false);
    const [logEmailOpen, setLogEmailOpen] = useState(false);
    const [logSmsOpen, setLogSmsOpen] = useState(false);

    const notesDirty = (contact.notes ?? "") !== notes;
    const saveNotes = () => {
        if (!notesDirty || updateNotes.isPending) return;
        updateNotes.mutate({ uuid: contact.uuid, notes });
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
                <TextArea
                    aria-label="Call notes"
                    placeholder="Call notes — outcome, objections, next steps…"
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={saveNotes}
                    className="resize-none"
                />
                <div className="flex items-center justify-between gap-2">
                    <span
                        className="text-xs text-muted/60 transition-opacity duration-150"
                        style={{ opacity: notesDirty ? 1 : 0 }}
                    >
                        Unsaved changes
                    </span>
                    <ActionButtonWithPending
                        size="sm"
                        variant="secondary"
                        isDisabled={!notesDirty || updateNotes.isPending}
                        isPending={updateNotes.isPending}
                        onPress={saveNotes}
                    >
                        Save notes
                    </ActionButtonWithPending>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Activity</h3>
                    <Dropdown>
                        <Dropdown.Trigger>
                            <Button size="sm" variant="secondary">
                                Log activity
                                <ChevronDown className="size-3.5" />
                            </Button>
                        </Dropdown.Trigger>
                        <Dropdown.Popover placement="bottom end">
                            <Dropdown.Menu
                                onAction={(key) => {
                                    if (key === "call") setLogCallOpen(true);
                                    if (key === "meeting") setLogMeetingOpen(true);
                                    if (key === "email") setLogEmailOpen(true);
                                    if (key === "sms") setLogSmsOpen(true);
                                }}
                            >
                                <Dropdown.Item id="call" textValue="Log call">
                                    <Phone className="size-4" />
                                    Log call
                                </Dropdown.Item>
                                <Dropdown.Item id="meeting" textValue="Log meeting">
                                    <CalendarDays className="size-4" />
                                    Log meeting
                                </Dropdown.Item>
                                <Dropdown.Item id="email" textValue="Log email">
                                    <Mail className="size-4" />
                                    Log email
                                </Dropdown.Item>
                                <Dropdown.Item id="sms" textValue="Log SMS">
                                    <MessageSquare className="size-4" />
                                    Log SMS
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
                <InteractionTimeline contactUuid={contact.uuid} />
            </div>

            <LogCallModal contactUuid={contact.uuid} isOpen={logCallOpen} onOpenChange={setLogCallOpen} />
            <LogMeetingModal contactUuid={contact.uuid} isOpen={logMeetingOpen} onOpenChange={setLogMeetingOpen} />
            <LogEmailModal contactUuid={contact.uuid} isOpen={logEmailOpen} onOpenChange={setLogEmailOpen} />
            <LogSmsModal contactUuid={contact.uuid} isOpen={logSmsOpen} onOpenChange={setLogSmsOpen} />
        </div>
    );
};

interface ContactCallViewProps {
    contactUuid: string;
}

export const ContactCallView: FC<ContactCallViewProps> = ({ contactUuid }) => {
    const { data: contact, isLoading } = useContact(contactUuid);
    const updateStatus = useUpdateContactStatus();
    const [activeTab, setActiveTab] = useState<string>(CALL_TABS[0].id);

    if (!contact) {
        return (
            <div className="space-y-3">
                {Array.from({ length: isLoading ? 5 : 1 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-surface-secondary animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-0.5">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground leading-snug break-words">
                        {contact.name?.trim() || "Unnamed contact"}
                    </h2>
                    {contact.company?.trim() ? (
                        <p className="text-sm text-muted break-words">{contact.company.trim()}</p>
                    ) : null}
                </div>
                <Select
                    aria-label="CRM status"
                    className="w-full sm:w-48 shrink-0"
                    value={contact.status}
                    isDisabled={updateStatus.isPending}
                    onChange={(value) => {
                        const next = value as LeadStatus;
                        if (next === contact.status) return;
                        updateStatus.mutate({ uuid: contact.uuid, status: next });
                    }}
                >
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {STATUS_OPTIONS.map((opt) => (
                                <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                                    {opt.label}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
            </div>

            <ContactCallInfo contact={contact} />

            <ScrollableTabs
                className="w-full"
                selectedKey={activeTab}
                onSelectionChange={(key) => setActiveTab(String(key))}
            >
                <ScrollableTabsList>
                    {CALL_TABS.map((t) => (
                        <Tabs.Tab
                            key={t.id}
                            id={t.id}
                            className={tabTriggerClassName}
                        >
                            {t.label}
                        </Tabs.Tab>
                    ))}
                </ScrollableTabsList>
            </ScrollableTabs>

            <div>
                {activeTab === "email" ? (
                    <OutreachTab contact={contact} />
                ) : activeTab === "reminders" ? (
                    <RemindersTab contactUuid={contact.uuid} />
                ) : activeTab === "bookings" ? (
                    <BookingsTab contact={contact} />
                ) : (
                    <NotesAndActivity key={contact.uuid} contact={contact} />
                )}
            </div>
        </div>
    );
};
