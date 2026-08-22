import { useEffect, useMemo, useState, type FC, type ReactNode } from "react";
import { Dropdown, Tabs } from "@heroui/react";
import { ScrollableTabs, ScrollableTabsList, tabTriggerClassName } from "@/components/ui/scrollable-tabs";
import { cn } from "@/lib/utils";
import { MoreVertical, Sparkles, Trash2 } from "lucide-react";
import {
    defaultEnrichmentSourcesForLead,
    enrichmentSourceOptionsForLead,
} from "@/features/enrichment/constants/enrichment-sources";
import { useContact, useDeleteContact, useEnrichContact } from "@/features/contacts/hooks/use-contacts";
import { SourceType } from "@/features/leads/interfaces/lead.interface";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EnrichmentRunModal } from "@/components/ui/enrichment-action-popover";
import { CONTACT_DETAIL_TABS } from "../constants/detail-tabs";
import { ContactDetailHeader, ContactEnrichmentTab, CrmTab, FormsTab, OverviewTab, OutreachTab, RemindersTab } from "./index";

interface ContactDetailViewProps {
    contactUuid: string;
    onBack?: () => void;
    onDeleted?: () => void;
    showDelete?: boolean;
    headerActions?: ReactNode;
    onNavigationLockChange?: (locked: boolean) => void;
}

export const ContactDetailView: FC<ContactDetailViewProps> = ({
    contactUuid,
    onBack,
    onDeleted,
    showDelete = true,
    headerActions,
    onNavigationLockChange,
}) => {
    const { data: contact, isLoading } = useContact(contactUuid);
    const deleteContact = useDeleteContact();
    const enrichContact = useEnrichContact();

    const [activeTab, setActiveTab] = useState("overview");
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [enrichModalOpen, setEnrichModalOpen] = useState(false);
    const [highlightOutreachUuid, setHighlightOutreachUuid] = useState<string | null>(null);
    const [childNavLocked, setChildNavLocked] = useState(false);

    const enrichmentSourceOptions = useMemo(
        () => enrichmentSourceOptionsForLead(contact?.lead.source_type),
        [contact?.lead.source_type],
    );

    const defaultEnrichmentSources = useMemo(() => {
        if (contact?.filter?.enrichment_sources?.length) {
            return contact.filter.enrichment_sources;
        }
        return defaultEnrichmentSourcesForLead(contact?.lead.source_type);
    }, [contact?.filter?.enrichment_sources, contact?.lead.source_type]);

    const handleConfirmDelete = async () => {
        if (!contact) return;
        await deleteContact.mutateAsync(contact.uuid);
        setConfirmDeleteOpen(false);
        onDeleted?.();
    };

    const navigateToOutreach = (outreachUuid: string) => {
        setHighlightOutreachUuid(outreachUuid);
        setActiveTab("outreach");
    };

    const navigationLocked = confirmDeleteOpen || enrichModalOpen || childNavLocked;

    useEffect(() => {
        onNavigationLockChange?.(navigationLocked);
    }, [navigationLocked, onNavigationLockChange]);

    return (
        <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5">
            <div className="flex items-start gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                    <ContactDetailHeader
                        isLoading={isLoading}
                        contact={contact}
                        onBack={onBack}
                        showBack={Boolean(onBack)}
                    />
                </div>
                {headerActions ? <div className="shrink-0 flex items-center gap-1">{headerActions}</div> : null}
                {contact ? (
                    <>
                        <Dropdown>
                            <Dropdown.Trigger
                                aria-label="Contact actions"
                                className="inline-flex items-center justify-center size-9 rounded-lg border border-border bg-surface hover:bg-surface-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0"
                            >
                                <MoreVertical className="size-4" />
                            </Dropdown.Trigger>
                            <Dropdown.Popover
                                placement="bottom end"
                                className="rounded-xl border border-border bg-surface p-1 shadow-xl outline-none backdrop-blur-none [backdrop-filter:none]"
                            >
                                <Dropdown.Menu
                                    className="min-w-[11rem] bg-transparent p-0 outline-none backdrop-blur-none [backdrop-filter:none]"
                                    onAction={(key) => {
                                        if (key === "enrich") setEnrichModalOpen(true);
                                        if (key === "delete") setConfirmDeleteOpen(true);
                                    }}
                                >
                                    <Dropdown.Item id="enrich" textValue="Run enrichment" isDisabled={enrichContact.isPending}>
                                        <span className="flex items-center gap-2.5 antialiased">
                                            <Sparkles className="size-4 shrink-0 text-violet-500" strokeWidth={2} />
                                            <span className="font-medium text-violet-400">Run enrichment</span>
                                        </span>
                                    </Dropdown.Item>
                                    {showDelete ? (
                                        <Dropdown.Item id="delete" variant="danger" textValue="Delete contact" isDisabled={deleteContact.isPending}>
                                            <span className="flex items-center gap-2.5 antialiased">
                                                <Trash2 className="size-4 shrink-0 text-red-500" strokeWidth={2} />
                                                <span className="font-medium text-red-400">Delete contact</span>
                                            </span>
                                        </Dropdown.Item>
                                    ) : null}
                                </Dropdown.Menu>
                            </Dropdown.Popover>
                        </Dropdown>
                        <EnrichmentRunModal
                            isOpen={enrichModalOpen}
                            onOpenChange={setEnrichModalOpen}
                            mode="contact"
                            sourceOptions={enrichmentSourceOptions}
                            initialSources={defaultEnrichmentSources}
                            isPending={enrichContact.isPending}
                            contextHint={
                                contact.lead.source_type === SourceType.GEMI
                                    ? "Uses registry data on file, fetches public GEMI documents, then runs with your other selected sources."
                                    : undefined
                            }
                            onEnrich={(sources) => enrichContact.mutate({ uuid: contact.uuid, sources })}
                        />
                    </>
                ) : null}
            </div>

            <ScrollableTabs
                className="w-full"
                selectedKey={activeTab}
                onSelectionChange={(key) => setActiveTab(String(key))}
            >
                <ScrollableTabsList fullWidth>
                    {CONTACT_DETAIL_TABS.map((t) => (
                        <Tabs.Tab
                            key={t.id}
                            id={t.id}
                            className={cn(tabTriggerClassName, "flex w-auto min-w-0 flex-1 shrink justify-center")}
                        >
                            {t.label}
                        </Tabs.Tab>
                    ))}
                </ScrollableTabsList>
            </ScrollableTabs>

            <div className="pt-2">
                {!contact ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-12 rounded-lg bg-surface-secondary animate-pulse" />
                        ))}
                    </div>
                ) : activeTab === "overview" ? (
                    <OverviewTab
                        key={`${contact.uuid}-${contact.updated_at}`}
                        contact={contact}
                        onNavigationLockChange={setChildNavLocked}
                    />
                ) : activeTab === "enrichment" ? (
                    <ContactEnrichmentTab contact={contact} />
                ) : activeTab === "outreach" ? (
                    <OutreachTab
                        contact={contact}
                        highlightUuid={highlightOutreachUuid}
                        onHighlightConsumed={() => setHighlightOutreachUuid(null)}
                        onNavigationLockChange={setChildNavLocked}
                    />
                ) : activeTab === "reminders" ? (
                    <RemindersTab contactUuid={contact.uuid} />
                ) : activeTab === "forms" ? (
                    <FormsTab contactUuid={contact.uuid} contactName={contact.name} />
                ) : (
                    <CrmTab contact={contact} onNavigateToOutreach={navigateToOutreach} />
                )}
            </div>

            {contact ? (
                <ConfirmDialog
                    isOpen={confirmDeleteOpen}
                    onOpenChange={setConfirmDeleteOpen}
                    title={`Delete contact "${contact.name ?? "this contact"}"?`}
                    description="This removes the contact from your CRM. The underlying lead record stays in the public directory."
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    variant="danger"
                    isPending={deleteContact.isPending}
                    onConfirm={handleConfirmDelete}
                />
            ) : null}
        </div>
    );
};
