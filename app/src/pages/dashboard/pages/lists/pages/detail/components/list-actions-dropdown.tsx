import type { FC } from "react";
import { Button, Dropdown } from "@heroui/react";
import { ChevronDown, ChevronsUpDown, FolderInput, Gauge, Globe, Pencil, Send, Sparkles, Trash2, UserMinus, UserPlus } from "lucide-react";

interface ListActionsDropdownProps {
    showContactsActions?: boolean;
    onQuickBrowse?: () => void;
    quickBrowseDisabled?: boolean;
    onAddContacts?: () => void;
    onEditList: () => void;
    onMoveList?: () => void;
    onScoreSelected?: () => void;
    scoreDisabled?: boolean;
    onEnrichSelected?: () => void;
    enrichDisabled?: boolean;
    onScrapeEmails?: () => void;
    scrapeEmailsDisabled?: boolean;
    scrapeEmailsPending?: boolean;
    onRemoveBelowScore?: () => void;
    removeBelowScoreDisabled?: boolean;
    removeBelowScorePending?: boolean;
    onSendToSelected?: () => void;
    sendToSelectedDisabled?: boolean;
    onDeleteSelected?: () => void;
    deleteDisabled?: boolean;
    deletePending?: boolean;
}

export const ListActionsDropdown: FC<ListActionsDropdownProps> = ({
    showContactsActions = false,
    onQuickBrowse,
    quickBrowseDisabled = false,
    onAddContacts,
    onEditList,
    onMoveList,
    onScoreSelected,
    scoreDisabled = false,
    onEnrichSelected,
    enrichDisabled = false,
    onScrapeEmails,
    scrapeEmailsDisabled = false,
    scrapeEmailsPending = false,
    onRemoveBelowScore,
    removeBelowScoreDisabled = false,
    removeBelowScorePending = false,
    onSendToSelected,
    sendToSelectedDisabled = false,
    onDeleteSelected,
    deleteDisabled = false,
    deletePending = false,
}) => (
    <Dropdown>
        <Dropdown.Trigger>
            <Button size="sm" variant="secondary">
                Actions
                <ChevronDown className="size-4" />
            </Button>
        </Dropdown.Trigger>
        <Dropdown.Popover
            placement="bottom end"
            className="rounded-xl border border-border bg-surface p-1 shadow-xl outline-none backdrop-blur-none [backdrop-filter:none]"
        >
            <Dropdown.Menu
                className="min-w-[11rem] bg-transparent p-0 outline-none backdrop-blur-none [backdrop-filter:none]"
                onAction={(key) => {
                    if (key === "quick-browse") onQuickBrowse?.();
                    if (key === "add-contacts") onAddContacts?.();
                    if (key === "edit-list") onEditList();
                    if (key === "move-list") onMoveList?.();
                    if (key === "score-selected") onScoreSelected?.();
                    if (key === "enrich-selected") onEnrichSelected?.();
                    if (key === "scrape-emails") onScrapeEmails?.();
                    if (key === "remove-below-score") onRemoveBelowScore?.();
                    if (key === "send-to-selected") onSendToSelected?.();
                    if (key === "delete-selected") onDeleteSelected?.();
                }}
            >
                {showContactsActions && onQuickBrowse ? (
                    <Dropdown.Item
                        id="quick-browse"
                        textValue="Quick browse"
                        isDisabled={quickBrowseDisabled}
                    >
                        <span className="flex items-center gap-2.5 antialiased">
                            <ChevronsUpDown className="size-4 shrink-0 text-muted" strokeWidth={2} />
                            <span className="font-medium text-foreground">Quick browse</span>
                        </span>
                    </Dropdown.Item>
                ) : null}
                {showContactsActions && onAddContacts ? (
                    <Dropdown.Item id="add-contacts" textValue="Add contacts">
                        <span className="flex items-center gap-2.5 antialiased">
                            <UserPlus className="size-4 shrink-0 text-accent" strokeWidth={2} />
                            <span className="font-medium text-foreground">Add contacts</span>
                        </span>
                    </Dropdown.Item>
                ) : null}
                {showContactsActions && onScoreSelected ? (
                    <Dropdown.Item
                        id="score-selected"
                        textValue="Score selected"
                        isDisabled={scoreDisabled}
                    >
                        <span className="flex items-center gap-2.5 antialiased">
                            <Gauge className="size-4 shrink-0 text-muted" strokeWidth={2} />
                            <span className="font-medium text-foreground">Score selected</span>
                        </span>
                    </Dropdown.Item>
                ) : null}
                {showContactsActions && onEnrichSelected ? (
                    <Dropdown.Item
                        id="enrich-selected"
                        textValue="Enrich selected"
                        isDisabled={enrichDisabled}
                    >
                        <span className="flex items-center gap-2.5 antialiased">
                            <Sparkles className="size-4 shrink-0 text-violet-500" strokeWidth={2} />
                            <span className="font-medium text-violet-400">Enrich selected</span>
                        </span>
                    </Dropdown.Item>
                ) : null}
                {showContactsActions && onSendToSelected ? (
                    <Dropdown.Item
                        id="send-to-selected"
                        textValue="Send to selected"
                        isDisabled={sendToSelectedDisabled}
                    >
                        <span className="flex items-center gap-2.5 antialiased">
                            <Send className="size-4 shrink-0 text-muted" strokeWidth={2} />
                            <span className="font-medium text-foreground">Send to selected</span>
                        </span>
                    </Dropdown.Item>
                ) : null}
                {showContactsActions && onScrapeEmails ? (
                    <Dropdown.Item
                        id="scrape-emails"
                        textValue="Find emails from websites"
                        isDisabled={scrapeEmailsDisabled || scrapeEmailsPending}
                    >
                        <span className="flex items-center gap-2.5 antialiased">
                            <Globe className="size-4 shrink-0 text-muted" strokeWidth={2} />
                            <span className="font-medium text-foreground">Find emails from websites</span>
                        </span>
                    </Dropdown.Item>
                ) : null}
                {showContactsActions && onRemoveBelowScore ? (
                    <Dropdown.Item
                        id="remove-below-score"
                        textValue="Remove score under 6"
                        isDisabled={removeBelowScoreDisabled || removeBelowScorePending}
                    >
                        <span className="flex items-center gap-2.5 antialiased">
                            <UserMinus className="size-4 shrink-0 text-danger" strokeWidth={2} />
                            <span className="font-medium text-danger">Remove score under 6</span>
                        </span>
                    </Dropdown.Item>
                ) : null}
                {showContactsActions && onDeleteSelected ? (
                    <Dropdown.Item
                        id="delete-selected"
                        textValue="Delete selected"
                        isDisabled={deleteDisabled || deletePending}
                    >
                        <span className="flex items-center gap-2.5 antialiased">
                            <Trash2 className="size-4 shrink-0 text-danger" strokeWidth={2} />
                            <span className="font-medium text-danger">Delete selected</span>
                        </span>
                    </Dropdown.Item>
                ) : null}
                <Dropdown.Item id="edit-list" textValue="Edit list">
                    <span className="flex items-center gap-2.5 antialiased">
                        <Pencil className="size-4 shrink-0 text-muted" strokeWidth={2} />
                        <span className="font-medium text-foreground">Edit list</span>
                    </span>
                </Dropdown.Item>
                {onMoveList ? (
                    <Dropdown.Item id="move-list" textValue="Move to list">
                        <span className="flex items-center gap-2.5 antialiased">
                            <FolderInput className="size-4 shrink-0 text-muted" strokeWidth={2} />
                            <span className="font-medium text-foreground">Move to list</span>
                        </span>
                    </Dropdown.Item>
                ) : null}
            </Dropdown.Menu>
        </Dropdown.Popover>
    </Dropdown>
);
