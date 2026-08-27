import { useMemo, useState, type FC } from "react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { FieldError, Label, ListBox, Select } from "@heroui/react";
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
                                    isDisabled={isPending || isLoading}
                                >
                                    <Select.Trigger>
                                        <Select.Value />
                                        <Select.Indicator />
                                    </Select.Trigger>
                                    <Select.Popover>
                                        <ListBox>
                                            {rootLists.map((list) => (
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
                                    isDisabled={
                                        isPending || isLoading || !parentUuid || sublists.length === 0
                                    }
                                >
                                    <Select.Trigger>
                                        <Select.Value />
                                        <Select.Indicator />
                                    </Select.Trigger>
                                    <Select.Popover>
                                        <ListBox>
                                            <ListBox.Item
                                                id={NO_SUBLIST}
                                                textValue="Use parent list"
                                            >
                                                Use parent list
                                                <ListBox.ItemIndicator />
                                            </ListBox.Item>
                                            {sublists.map((list) => (
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
