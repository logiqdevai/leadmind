import { useState } from "react";
import { Button, Label, ListBox, Select } from "@heroui/react";
import { Pencil, Save, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    useDeleteSavedContactFilter,
    useSavedContactFilters,
    useUpdateSavedContactFilter,
} from "@/features/saved-contact-filters/hooks/use-saved-contact-filters";
import type { SavedContactFilter } from "@/features/saved-contact-filters/interfaces/saved-contact-filter.interface";
import {
    hasActiveContactFilters,
    serializeContactFiltersToSearchParams,
} from "@/lib/contact-filter-params";
import type { ContactFilters } from "@/interfaces/contact-filters.interface";
import {
    SaveContactFilterModal,
    type SaveContactFilterModalMode,
} from "@/pages/dashboard/pages/contacts/components/save-contact-filter-modal";

const FILTER_KEYS: (keyof ContactFilters)[] = [
    "search",
    "filter_uuid",
    "source_type",
    "status",
    "tags",
    "score_rules",
    "profile_field",
    "has_profile_field",
    "last_interaction_after",
    "last_interaction_before",
    "never_contacted",
    "include_unsubscribed",
    "has_email",
    "has_phone",
];

function serialize(filters: ContactFilters): string {
    return JSON.stringify(serializeContactFiltersToSearchParams(filters));
}

function toFullPatch(filters: ContactFilters): Partial<ContactFilters> {
    const patch: Partial<ContactFilters> = {};
    for (const key of FILTER_KEYS) {
        (patch as Record<string, unknown>)[key] = filters[key] ?? undefined;
    }
    return patch;
}

interface SavedContactFiltersBarProps {
    value: ContactFilters;
    onChange: (patch: Partial<ContactFilters>) => void;
    disabled?: boolean;
}

export function SavedContactFiltersBar({
    value,
    onChange,
    disabled,
}: SavedContactFiltersBarProps) {
    const { data: savedFilters, isLoading, isError } = useSavedContactFilters();
    const updateFilter = useUpdateSavedContactFilter();
    const deleteFilter = useDeleteSavedContactFilter();

    const [appliedUuid, setAppliedUuid] = useState<string | null>(null);
    const [modalMode, setModalMode] = useState<SaveContactFilterModalMode | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<SavedContactFilter | null>(null);

    const filters = savedFilters ?? [];
    const applied = appliedUuid ? (filters.find((f) => f.uuid === appliedUuid) ?? null) : null;

    const isDirty = !!applied && serialize(value) !== serialize(applied.filters);
    const hasCriteria = hasActiveContactFilters(value);

    const handleSelect = (uuid: string) => {
        if (!uuid) {
            onChange(toFullPatch({}));
            setAppliedUuid(null);
            return;
        }
        const target = filters.find((f) => f.uuid === uuid);
        if (!target) return;
        onChange(toFullPatch(target.filters));
        setAppliedUuid(uuid);
    };

    const handleUpdate = () => {
        if (!applied) return;
        updateFilter.mutate({ uuid: applied.uuid, payload: { filters: value } });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        await deleteFilter.mutateAsync(deleteTarget.uuid);
        if (deleteTarget.uuid === appliedUuid) setAppliedUuid(null);
        setDeleteTarget(null);
    };

    return (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3">
            <div className="min-w-56">
                <Label className="sr-only">Saved filters</Label>
                <Select
                    aria-label="Saved filters"
                    value={appliedUuid ?? ""}
                    onChange={(v) => {
                        if (typeof v !== "string") return;
                        handleSelect(v);
                    }}
                    isDisabled={disabled || isLoading}
                >
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover className="max-h-72">
                        <ListBox>
                            <ListBox.Item id="" textValue="No saved filter">
                                No saved filter
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                            {filters.map((f) => (
                                <ListBox.Item key={f.uuid} id={f.uuid} textValue={f.name}>
                                    {f.name}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
                {isError ? (
                    <p className="text-xs text-danger mt-1">Couldn't load saved filters.</p>
                ) : null}
            </div>

            {isDirty ? (
                <span className="text-xs font-medium text-warning">Unsaved changes</span>
            ) : null}

            <div className="flex items-center gap-2 ml-auto">
                {!applied && hasCriteria ? (
                    <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => setModalMode("create")}
                        isDisabled={disabled}
                    >
                        <Save className="size-4" />
                        Save filter
                    </Button>
                ) : null}

                {applied ? (
                    <>
                        {isDirty ? (
                            <Button
                                size="sm"
                                variant="primary"
                                onPress={handleUpdate}
                                isDisabled={disabled || updateFilter.isPending}
                            >
                                Update
                            </Button>
                        ) : null}
                        <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => setModalMode("duplicate")}
                            isDisabled={disabled}
                        >
                            Save as new
                        </Button>
                        <Button
                            size="sm"
                            variant="tertiary"
                            aria-label="Rename saved filter"
                            onPress={() => setModalMode("rename")}
                            isDisabled={disabled}
                        >
                            <Pencil className="size-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="tertiary"
                            aria-label="Delete saved filter"
                            onPress={() => setDeleteTarget(applied)}
                            isDisabled={disabled}
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </>
                ) : null}
            </div>

            {modalMode ? (
                <SaveContactFilterModal
                    isOpen={!!modalMode}
                    onOpenChange={(open) => {
                        if (!open) setModalMode(null);
                    }}
                    mode={modalMode}
                    filters={value}
                    currentUuid={applied?.uuid}
                    currentName={applied?.name}
                    onSaved={(uuid) => setAppliedUuid(uuid)}
                />
            ) : null}

            <ConfirmDialog
                isOpen={!!deleteTarget}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
                title="Delete saved filter"
                description={
                    deleteTarget ? (
                        <>
                            Delete{" "}
                            <span className="font-medium text-foreground">
                                {deleteTarget.name}
                            </span>
                            ? This can't be undone.
                        </>
                    ) : null
                }
                variant="danger"
                isPending={deleteFilter.isPending}
                onConfirm={handleDeleteConfirm}
            />
        </div>
    );
}
