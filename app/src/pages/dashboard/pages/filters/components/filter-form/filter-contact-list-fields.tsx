import { useMemo, useState, type FC } from "react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { FieldError, Input, Label, ListBox, Select } from "@heroui/react";
import { Search } from "lucide-react";
import { useContactLists } from "@/features/contact-lists/hooks/use-contact-lists";
import type { ContactList } from "@/features/contact-lists/interfaces/contact-list.interface";
import { ContactListFormModal } from "@/pages/dashboard/pages/lists/components/contact-list-form-modal";
import type { FilterFormValues } from "../../validation-schemas/filter";

const NO_SUBLIST = "__no_sublist__";

interface FilterContactListFieldsProps {
    control: Control<FilterFormValues>;
    errors: FieldErrors<FilterFormValues>;
    isPending?: boolean;
}

function resolveSelection(
    lists: ContactList[],
    contactListUuid: string,
): { parentUuid: string; sublistUuid: string } {
    if (!contactListUuid) return { parentUuid: "", sublistUuid: NO_SUBLIST };
    const selected = lists.find((list) => list.uuid === contactListUuid);
    if (!selected) return { parentUuid: "", sublistUuid: NO_SUBLIST };
    if (selected.parent_list_uuid) {
        return { parentUuid: selected.parent_list_uuid, sublistUuid: selected.uuid };
    }
    return { parentUuid: selected.uuid, sublistUuid: NO_SUBLIST };
}

export const FilterContactListFields: FC<FilterContactListFieldsProps> = ({
    control,
    errors,
    isPending,
}) => {
    const { data: listsPage, isLoading } = useContactLists({ limit: 100 });
    const allLists = listsPage?.data ?? [];
    const rootLists = useMemo(
        () =>
            allLists
                .filter((list) => !list.parent_list_uuid)
                .toSorted((a, b) => a.title.localeCompare(b.title)),
        [allLists],
    );

    const [createListOpen, setCreateListOpen] = useState(false);
    const [createSublistOpen, setCreateSublistOpen] = useState(false);

    const [listQuery, setListQuery] = useState("");
    const [sublistQuery, setSublistQuery] = useState("");

    const filteredRootLists = useMemo(() => {
        const q = listQuery.trim().toLowerCase();
        return q ? rootLists.filter((list) => list.title.toLowerCase().includes(q)) : rootLists;
    }, [rootLists, listQuery]);

    return (
        <Controller
            control={control}
            name="contact_list_uuid"
            render={({ field }) => {
                const { parentUuid, sublistUuid } = resolveSelection(allLists, field.value);
                const sublists = parentUuid
                    ? allLists
                          .filter((list) => list.parent_list_uuid === parentUuid)
                          .toSorted((a, b) => a.title.localeCompare(b.title))
                    : [];
                const sublistQ = sublistQuery.trim().toLowerCase();
                const filteredSublists = sublistQ
                    ? sublists.filter((list) => list.title.toLowerCase().includes(sublistQ))
                    : sublists;
                const showUseParentOption =
                    !sublistQ || "use parent list".includes(sublistQ);

                const setParent = (nextParentUuid: string) => {
                    if (!nextParentUuid) {
                        field.onChange("");
                        return;
                    }
                    field.onChange(nextParentUuid);
                };

                const setSublist = (nextSublistUuid: string) => {
                    if (!parentUuid) return;
                    field.onChange(
                        nextSublistUuid === NO_SUBLIST ? parentUuid : nextSublistUuid,
                    );
                };

                return (
                    <div className="flex flex-col gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <Label>List</Label>
                                <Select
                                    aria-label="List"
                                    className="w-full"
                                    placeholder="Select a list"
                                    value={parentUuid || undefined}
                                    onChange={(v) => setParent(String(v))}
                                    onOpenChange={(open) => {
                                        if (!open) setListQuery("");
                                    }}
                                    isDisabled={isPending || isLoading}
                                >
                                    <Select.Trigger>
                                        <Select.Value />
                                        <Select.Indicator />
                                    </Select.Trigger>
                                    <Select.Popover className="w-[var(--trigger-width)] overflow-hidden p-0">
                                        <div className="relative shrink-0 border-b border-border px-1 pt-1">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                                            <Input
                                                aria-label="Search lists"
                                                placeholder="Search lists…"
                                                value={listQuery}
                                                onChange={(e) => setListQuery(e.target.value)}
                                                onKeyDown={(e) => e.stopPropagation()}
                                                className="rounded-md border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                                            />
                                        </div>
                                        <ListBox className="max-h-52 overflow-y-auto overscroll-contain p-1">
                                            {filteredRootLists.length === 0 ? (
                                                <ListBox.Item id="__empty" textValue="No matches" isDisabled>
                                                    <span className="text-sm text-muted">No matching lists.</span>
                                                </ListBox.Item>
                                            ) : (
                                                filteredRootLists.map((list) => (
                                                    <ListBox.Item
                                                        key={list.uuid}
                                                        id={list.uuid}
                                                        textValue={list.title}
                                                    >
                                                        {list.title}
                                                        <ListBox.ItemIndicator />
                                                    </ListBox.Item>
                                                ))
                                            )}
                                        </ListBox>
                                    </Select.Popover>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label>Sublist</Label>
                                <Select
                                    aria-label="Sublist"
                                    className="w-full"
                                    placeholder={
                                        parentUuid ? "Use parent list" : "Select a list first"
                                    }
                                    value={sublistUuid}
                                    onChange={(v) => setSublist(String(v))}
                                    onOpenChange={(open) => {
                                        if (!open) setSublistQuery("");
                                    }}
                                    isDisabled={
                                        isPending || isLoading || !parentUuid || sublists.length === 0
                                    }
                                >
                                    <Select.Trigger>
                                        <Select.Value />
                                        <Select.Indicator />
                                    </Select.Trigger>
                                    <Select.Popover className="w-[var(--trigger-width)] overflow-hidden p-0">
                                        <div className="relative shrink-0 border-b border-border px-1 pt-1">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                                            <Input
                                                aria-label="Search sublists"
                                                placeholder="Search sublists…"
                                                value={sublistQuery}
                                                onChange={(e) => setSublistQuery(e.target.value)}
                                                onKeyDown={(e) => e.stopPropagation()}
                                                className="rounded-md border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                                            />
                                        </div>
                                        <ListBox className="max-h-52 overflow-y-auto overscroll-contain p-1">
                                            {showUseParentOption ? (
                                                <ListBox.Item
                                                    id={NO_SUBLIST}
                                                    textValue="Use parent list"
                                                >
                                                    Use parent list
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                            ) : null}
                                            {filteredSublists.length === 0 && !showUseParentOption ? (
                                                <ListBox.Item id="__empty" textValue="No matches" isDisabled>
                                                    <span className="text-sm text-muted">No matching sublists.</span>
                                                </ListBox.Item>
                                            ) : null}
                                            {filteredSublists.map((list) => (
                                                <ListBox.Item
                                                    key={list.uuid}
                                                    id={list.uuid}
                                                    textValue={list.title}
                                                >
                                                    {list.title}
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                            ))}
                                        </ListBox>
                                    </Select.Popover>
                                </Select>
                            </div>
                        </div>

                        <p className="text-xs text-muted">
                            Contacts from this filter are added to the selected list.{" "}
                            <button
                                type="button"
                                className="text-accent underline-offset-2 hover:underline font-medium"
                                onClick={() => setCreateListOpen(true)}
                            >
                                + New list
                            </button>
                            {parentUuid ? (
                                <>
                                    {" · "}
                                    <button
                                        type="button"
                                        className="text-accent underline-offset-2 hover:underline font-medium"
                                        onClick={() => setCreateSublistOpen(true)}
                                    >
                                        + New sublist
                                    </button>
                                </>
                            ) : null}
                        </p>

                        {errors.contact_list_uuid ? (
                            <FieldError>{errors.contact_list_uuid.message}</FieldError>
                        ) : null}

                        <ContactListFormModal
                            isOpen={createListOpen}
                            onOpenChange={setCreateListOpen}
                            onCreated={(list) => field.onChange(list.uuid)}
                        />

                        <ContactListFormModal
                            isOpen={createSublistOpen}
                            onOpenChange={setCreateSublistOpen}
                            parentListUuid={parentUuid || undefined}
                            onCreated={(list) => field.onChange(list.uuid)}
                        />
                    </div>
                );
            }}
        />
    );
};
