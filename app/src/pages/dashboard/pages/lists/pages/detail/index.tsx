import { useMemo, useState, type Key } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button, Tabs } from "@heroui/react";
import { ScrollableTabs, ScrollableTabsList, tabTriggerClassName } from "@/components/ui/scrollable-tabs";
import { Plus } from "lucide-react";
import { Routes, ListDetailTabIds } from "@/routes/routes";
import {
    useContactList,
    useContactListMembers,
    useContactLists,
    useRemoveListContactsBulk,
} from "@/features/contact-lists/hooks/use-contact-lists";
import {
    useBulkScrapeContactEmails,
    useDeleteContactsBulk,
} from "@/features/contacts/hooks/use-contacts";
import { useDashboardNavbarTitle } from "@/components/providers/dashboard-navbar-provider";
import { ContactListFormModal } from "../../components/contact-list-form-modal";
import { MoveContactListModal } from "../../components/move-contact-list-modal";
import { ContactListsTable } from "../../components/contact-lists-table";
import { ListMembersTable } from "./components/list-members-table";
import { AddContactsModal } from "./components/add-contacts-modal";
import { ListActionsDropdown } from "./components/list-actions-dropdown";
import { ListDetailToolbar } from "./components/list-detail-toolbar";
import {
    ListMemberDeleteModes,
    ListMembersDeleteDialog,
    type ListMemberDeleteMode,
} from "./components/list-members-delete-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BulkSendMessageModal } from "@/pages/dashboard/components/bulk-send-message-modal";
import { BulkEnrollInSequenceModal } from "@/pages/dashboard/components/bulk-enroll-in-sequence-modal";
import {
    BulkOutreachChooserModal,
    OutreachActionTypes,
    type OutreachActionType,
} from "@/pages/dashboard/components/bulk-outreach-chooser-modal";
import { ContactAudienceAnalyticsPanel } from "@/pages/dashboard/components/audience-analytics/contact-audience-analytics-panel";
import { ContactStackViewerScope } from "@/pages/dashboard/components/contact-stack-viewer";
import { ListDetailSkeleton } from "./components/list-detail-skeleton";

const MEMBERS_PAGE_SIZE = 20;
const SUBLISTS_PAGE_SIZE = 20;

const TABS = [
    { id: ListDetailTabIds.SUBLISTS, label: "Sublists" },
    { id: ListDetailTabIds.CONTACTS, label: "Contacts" },
    { id: ListDetailTabIds.ANALYTICS, label: "Analytics" },
] as const;

export default function ListDetailPage() {
    const { uuid = "" } = useParams<{ uuid: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [editOpen, setEditOpen] = useState(false);
    const [moveOpen, setMoveOpen] = useState(false);
    const [createSublistOpen, setCreateSublistOpen] = useState(false);
    const [addContactsOpen, setAddContactsOpen] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [scrapeConfirmOpen, setScrapeConfirmOpen] = useState(false);
    const [outreachChooserOpen, setOutreachChooserOpen] = useState(false);
    const [composeOpen, setComposeOpen] = useState(false);
    const [enrollOpen, setEnrollOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [pendingDeleteUuids, setPendingDeleteUuids] = useState<string[]>([]);

    const scrapeEmailsBulk = useBulkScrapeContactEmails();
    const removeListContactsBulk = useRemoveListContactsBulk();
    const deleteContactsBulk = useDeleteContactsBulk();

    const allowedTabIds = new Set<string>(TABS.map((t) => t.id));
    const rawTab = searchParams.get(Routes.dashboard.lists_detail_tab_query);

    const membersPage = Math.max(1, Number(searchParams.get("page") ?? 1));
    const sublistsPage = Math.max(1, Number(searchParams.get("sublists_page") ?? 1));

    const { data: list, isLoading: listLoading } = useContactList(uuid);
    const {
        data: membersData,
        isLoading: membersLoading,
        isFetching: membersFetching,
    } = useContactListMembers(uuid, {
        page: membersPage,
        limit: MEMBERS_PAGE_SIZE,
    });

    const {
        data: childrenPage,
        isLoading: childrenLoading,
        isFetching: childrenFetching,
    } = useContactLists(
        {
            page: sublistsPage,
            limit: SUBLISTS_PAGE_SIZE,
            parent_list_uuid: uuid,
        },
        !!uuid,
    );

    useDashboardNavbarTitle("Lists");

    const defaultTab =
        (list?.child_count ?? 0) > 0
            ? ListDetailTabIds.SUBLISTS
            : ListDetailTabIds.CONTACTS;
    const currentTab =
        rawTab && allowedTabIds.has(rawTab) ? rawTab : defaultTab;

    const members = membersData?.data ?? [];
    const selectedMembers = useMemo(
        () => members.filter((m) => selectedKeys.has(m.uuid)),
        [members, selectedKeys],
    );
    const total = membersData?.total ?? 0;
    const totalPages = membersData?.totalPages ?? 1;
    const memberUuids = members.map((member) => member.uuid);
    const deletePending = removeListContactsBulk.isPending || deleteContactsBulk.isPending;
    const contactCount = list?.contact_count ?? total;
    const childCount = list?.child_count ?? 0;
    const contactMeta = `${childCount} sublist${childCount === 1 ? "" : "s"} · ${contactCount} contact${contactCount === 1 ? "" : "s"}`;

    const children = childrenPage?.data ?? [];
    const childrenTotal = childrenPage?.total ?? 0;
    const childrenTotalPages = childrenPage?.totalPages ?? 1;

    const backHref = list?.parent_list_uuid
        ? Routes.dashboard.lists_detail.replace(":uuid", list.parent_list_uuid)
        : Routes.dashboard.lists;
    const backLabel = list?.parent_list_uuid ? "Back to parent list" : "Back to lists";

    const handleMembersPageChange = (p: number) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", String(p));
        setSearchParams(params, { replace: true });
    };

    const handleSublistsPageChange = (p: number) => {
        const params = new URLSearchParams(searchParams);
        params.set("sublists_page", String(p));
        setSearchParams(params, { replace: true });
    };

    const handleTabChange = (key: Key) => {
        if (!uuid) return;
        const next = new URLSearchParams();
        next.set(Routes.dashboard.lists_detail_tab_query, String(key));
        setSearchParams(next, { replace: true });
    };

    const handleScrapeEmails = async () => {
        if (!uuid) return;
        if (selectedKeys.size > 0) {
            await scrapeEmailsBulk.mutateAsync({
                contact_uuids: [...selectedKeys],
                list_uuid: uuid,
            });
            setSelectedKeys(new Set());
            setScrapeConfirmOpen(false);
            return;
        }
        await scrapeEmailsBulk.mutateAsync({ list_uuid: uuid });
        setScrapeConfirmOpen(false);
    };

    const openDeleteDialog = (uuids: string[]) => {
        if (uuids.length === 0) return;
        setPendingDeleteUuids(uuids);
        setDeleteConfirmOpen(true);
    };

    const handleDeleteConfirm = async (mode: ListMemberDeleteMode) => {
        if (!uuid || pendingDeleteUuids.length === 0) return;

        if (mode === ListMemberDeleteModes.FROM_LIST) {
            await removeListContactsBulk.mutateAsync({
                listUuid: uuid,
                contactUuids: pendingDeleteUuids,
            });
        } else {
            await deleteContactsBulk.mutateAsync(pendingDeleteUuids);
        }

        setSelectedKeys((prev) => {
            const next = new Set(prev);
            for (const id of pendingDeleteUuids) next.delete(id);
            return next;
        });
        setPendingDeleteUuids([]);
        setDeleteConfirmOpen(false);
    };

    const scrapeConfirmDescription =
        selectedKeys.size > 0
            ? `We'll visit each selected contact's website to look for an email. Only contacts without an email but with a website are processed. Target: ${selectedKeys.size} selected contact${selectedKeys.size === 1 ? "" : "s"} in this list.`
            : `We'll visit each contact's website in this list to look for an email. Only contacts without an email but with a website are processed. Target: all contacts in this list.`;

    const canScrapeEmails =
        currentTab === ListDetailTabIds.CONTACTS &&
        (selectedKeys.size > 0 || total > 0);

    if (listLoading) {
        return <ListDetailSkeleton />;
    }

    if (!list) {
        return (
            <div className="text-center py-24 text-muted">
                <p>List not found.</p>
                <Link to={Routes.dashboard.lists} className="text-accent text-sm mt-2 inline-block">
                    Back to lists
                </Link>
            </div>
        );
    }

    return (
        <ContactStackViewerScope
            contactUuids={memberUuids}
            page={membersPage}
            totalPages={totalPages}
            pageSize={MEMBERS_PAGE_SIZE}
            totalCount={total}
            onPageChange={handleMembersPageChange}
        >
            {(quickBrowse) => (
                <div className="flex flex-col gap-6">
                    <ListDetailToolbar
                        title={list.title}
                        meta={contactMeta}
                        backHref={backHref}
                        backLabel={backLabel}
                        actions={
                            <ListActionsDropdown
                                showContactsActions={currentTab === ListDetailTabIds.CONTACTS}
                                onQuickBrowse={
                                    currentTab === ListDetailTabIds.CONTACTS
                                        ? quickBrowse.openFirst
                                        : undefined
                                }
                                quickBrowseDisabled={!quickBrowse.hasContacts}
                                onAddContacts={
                                    currentTab === ListDetailTabIds.CONTACTS
                                        ? () => setAddContactsOpen(true)
                                        : undefined
                                }
                                onEditList={() => setEditOpen(true)}
                                onMoveList={() => setMoveOpen(true)}
                                onScrapeEmails={
                                    currentTab === ListDetailTabIds.CONTACTS
                                        ? () => setScrapeConfirmOpen(true)
                                        : undefined
                                }
                                scrapeEmailsDisabled={!canScrapeEmails}
                                scrapeEmailsPending={scrapeEmailsBulk.isPending}
                                onSendToSelected={
                                    currentTab === ListDetailTabIds.CONTACTS
                                        ? () => setOutreachChooserOpen(true)
                                        : undefined
                                }
                                sendToSelectedDisabled={selectedKeys.size === 0}
                                onDeleteSelected={
                                    currentTab === ListDetailTabIds.CONTACTS
                                        ? () => openDeleteDialog([...selectedKeys])
                                        : undefined
                                }
                                deleteDisabled={selectedKeys.size === 0}
                                deletePending={deletePending}
                            />
                        }
                    />

                    {list.description ? (
                        <p className="text-sm text-muted leading-relaxed max-w-3xl -mt-2">
                            {list.description}
                        </p>
                    ) : null}

                    <ScrollableTabs selectedKey={currentTab} onSelectionChange={handleTabChange}>
                        <ScrollableTabsList>
                            {TABS.map((t) => (
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

                    {currentTab === ListDetailTabIds.SUBLISTS && (
                        <section className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <p className="text-xs text-muted">
                                    Nested lists under this list. Click a row to open it.
                                </p>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onPress={() => setCreateSublistOpen(true)}
                                >
                                    <Plus className="size-4" />
                                    New sublist
                                </Button>
                            </div>
                            <ContactListsTable
                                lists={children}
                                isLoading={childrenLoading}
                                isFetching={childrenFetching}
                                page={sublistsPage}
                                pageSize={SUBLISTS_PAGE_SIZE}
                                total={childrenTotal}
                                totalPages={childrenTotalPages}
                                onPageChange={handleSublistsPageChange}
                                emptyTitle="No sublists yet."
                                emptyDescription="Create a sublist to nest lists under this one."
                                paginationLabel="sublists"
                            />
                        </section>
                    )}
                    {currentTab === ListDetailTabIds.CONTACTS && (
                        <section className="flex flex-col gap-4">
                            <p className="text-xs text-muted">
                                Click a name or use the up/down icon to open quick browse. Use arrow keys to move between contacts.
                            </p>
                            <ListMembersTable
                                contacts={members}
                                isLoading={membersLoading}
                                isFetching={membersFetching}
                                page={membersPage}
                                pageSize={MEMBERS_PAGE_SIZE}
                                total={total}
                                totalPages={totalPages}
                                onPageChange={handleMembersPageChange}
                                onContactOpen={quickBrowse.openAt}
                                selectedKeys={selectedKeys}
                                onSelectionChange={setSelectedKeys}
                                onDeleteContact={(contactUuid) => openDeleteDialog([contactUuid])}
                                deletePending={deletePending}
                            />
                        </section>
                    )}
                    {currentTab === ListDetailTabIds.ANALYTICS && (
                        <ContactAudienceAnalyticsPanel scope={{ type: "list", uuid }} />
                    )}

                    <ContactListFormModal isOpen={editOpen} onOpenChange={setEditOpen} editing={list} />
                    <MoveContactListModal isOpen={moveOpen} onOpenChange={setMoveOpen} list={list} />
                    <ContactListFormModal
                        isOpen={createSublistOpen}
                        onOpenChange={setCreateSublistOpen}
                        parentListUuid={uuid}
                    />
                    <AddContactsModal
                        listUuid={uuid}
                        isOpen={addContactsOpen}
                        onOpenChange={setAddContactsOpen}
                    />
                    <ConfirmDialog
                        isOpen={scrapeConfirmOpen}
                        onOpenChange={setScrapeConfirmOpen}
                        title="Find emails from websites?"
                        description={scrapeConfirmDescription}
                        confirmLabel="Start lookup"
                        isPending={scrapeEmailsBulk.isPending}
                        onConfirm={handleScrapeEmails}
                    />
                    <ListMembersDeleteDialog
                        isOpen={deleteConfirmOpen}
                        onOpenChange={(open) => {
                            setDeleteConfirmOpen(open);
                            if (!open) setPendingDeleteUuids([]);
                        }}
                        count={pendingDeleteUuids.length}
                        isPending={deletePending}
                        onConfirm={handleDeleteConfirm}
                    />
                    <BulkOutreachChooserModal
                        isOpen={outreachChooserOpen}
                        onOpenChange={setOutreachChooserOpen}
                        contactCount={selectedKeys.size}
                        onSelect={(action: OutreachActionType) => {
                            if (action === OutreachActionTypes.MESSAGE) setComposeOpen(true);
                            if (action === OutreachActionTypes.SEQUENCE) setEnrollOpen(true);
                        }}
                    />
                    <BulkSendMessageModal
                        isOpen={composeOpen}
                        onOpenChange={setComposeOpen}
                        contacts={selectedMembers}
                        onComplete={() => setSelectedKeys(new Set())}
                    />
                    <BulkEnrollInSequenceModal
                        isOpen={enrollOpen}
                        onOpenChange={setEnrollOpen}
                        contacts={selectedMembers}
                        onComplete={() => setSelectedKeys(new Set())}
                    />
                </div>
            )}
        </ContactStackViewerScope>
    );
}
