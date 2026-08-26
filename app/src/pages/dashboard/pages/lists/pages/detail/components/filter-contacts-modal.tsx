import { useEffect, useState, type FC } from "react";
import { Label, Modal, Slider } from "@heroui/react";
import { FolderInput, ListPlus, UserMinus, type LucideIcon } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import {
    useMoveListContactsBelowScore,
    useRemoveListContactsBelowScore,
} from "@/features/contact-lists/hooks/use-contact-lists";
import { cn } from "@/lib/utils";
import { ParentListSelect } from "../../../components/parent-list-select";

const DEFAULT_MIN_SCORE = 6;

const FilterActions = {
    REMOVE: "remove",
    MOVE: "move",
    ADD_NEW_LIST: "add-new-list",
} as const;

type FilterAction = (typeof FilterActions)[keyof typeof FilterActions];

interface FilterContactsModalProps {
    listUuid: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete?: () => void;
}

interface ActionOption {
    id: FilterAction;
    title: string;
    summary: string;
    icon: LucideIcon;
    available: boolean;
}

const ACTION_OPTIONS: ActionOption[] = [
    {
        id: FilterActions.REMOVE,
        title: "Remove",
        summary: "Drop low-score contacts from this list only.",
        icon: UserMinus,
        available: true,
    },
    {
        id: FilterActions.MOVE,
        title: "Move",
        summary: "Send low-score contacts to another list.",
        icon: FolderInput,
        available: true,
    },
    {
        id: FilterActions.ADD_NEW_LIST,
        title: "Add on a New List",
        summary: "Copy them into a new list (coming soon).",
        icon: ListPlus,
        available: false,
    },
];

export const FilterContactsModal: FC<FilterContactsModalProps> = ({
    listUuid,
    isOpen,
    onOpenChange,
    onComplete,
}) => {
    const removeBelowScore = useRemoveListContactsBelowScore();
    const moveBelowScore = useMoveListContactsBelowScore();
    const [action, setAction] = useState<FilterAction | null>(null);
    const [minScore, setMinScore] = useState(DEFAULT_MIN_SCORE);
    const [targetListUuid, setTargetListUuid] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setAction(null);
        setMinScore(DEFAULT_MIN_SCORE);
        setTargetListUuid(null);
    }, [isOpen, listUuid]);

    const isPending = removeBelowScore.isPending || moveBelowScore.isPending;

    const handleConfirm = async () => {
        if (action === FilterActions.REMOVE) {
            await removeBelowScore.mutateAsync({ listUuid, min_score: minScore });
            onComplete?.();
            onOpenChange(false);
            return;
        }
        if (action === FilterActions.MOVE) {
            if (!targetListUuid) return;
            await moveBelowScore.mutateAsync({
                listUuid,
                min_score: minScore,
                target_list_uuid: targetListUuid,
            });
            onComplete?.();
            onOpenChange(false);
        }
    };

    const confirmDisabled =
        isPending ||
        action == null ||
        action === FilterActions.ADD_NEW_LIST ||
        (action === FilterActions.MOVE && !targetListUuid);

    const confirmLabel =
        action === FilterActions.MOVE
            ? "Move contacts"
            : action === FilterActions.REMOVE
              ? "Remove contacts"
              : "Continue";

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <Modal.Header className="pb-3">
                        <Modal.Heading>Filter Contacts</Modal.Heading>
                        <p className="mt-1 text-sm text-muted">
                            Pick what to do with contacts below a score threshold.
                        </p>
                    </Modal.Header>
                    <Modal.Body className="gap-0 px-0 pb-0 pt-0">
                        <fieldset className="m-0 border-0 p-0">
                            <legend className="sr-only">Filter action</legend>
                            <div className="flex flex-col">
                                {ACTION_OPTIONS.map((option) => {
                                    const Icon = option.icon;
                                    const selected = action === option.id;
                                    const optionId = `filter-action-${option.id}`;

                                    return (
                                        <div
                                            key={option.id}
                                            className={cn(
                                                "border-t border-border first:border-t-0",
                                                selected && "bg-surface-secondary/35",
                                            )}
                                        >
                                            <label
                                                htmlFor={optionId}
                                                className={cn(
                                                    "flex cursor-pointer items-start gap-3 px-6 py-4 transition-colors",
                                                    option.available
                                                        ? "hover:bg-surface-secondary/50"
                                                        : "cursor-not-allowed opacity-55",
                                                    selected && "hover:bg-transparent",
                                                )}
                                            >
                                                <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
                                                    <input
                                                        id={optionId}
                                                        type="radio"
                                                        name="filter-contacts-action"
                                                        value={option.id}
                                                        checked={selected}
                                                        disabled={!option.available || isPending}
                                                        onChange={() => {
                                                            setAction(option.id);
                                                            if (option.id !== FilterActions.MOVE) {
                                                                setTargetListUuid(null);
                                                            }
                                                        }}
                                                        className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                                                    />
                                                    <span
                                                        className={cn(
                                                            "flex size-4 items-center justify-center rounded-full border-2 transition-colors",
                                                            selected
                                                                ? "border-accent"
                                                                : "border-border peer-hover:border-muted",
                                                            !option.available && "border-border",
                                                        )}
                                                    >
                                                        <span
                                                            className={cn(
                                                                "size-2 rounded-full bg-accent transition-transform",
                                                                selected ? "scale-100" : "scale-0",
                                                            )}
                                                        />
                                                    </span>
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-2">
                                                        <Icon
                                                            className={cn(
                                                                "size-4 shrink-0",
                                                                selected
                                                                    ? "text-accent"
                                                                    : "text-muted",
                                                            )}
                                                            strokeWidth={2}
                                                        />
                                                        <span className="text-sm font-semibold text-foreground">
                                                            {option.title}
                                                        </span>
                                                        {!option.available ? (
                                                            <span className="rounded-md bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                                                                Soon
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                                                        {option.summary}
                                                    </span>
                                                </span>
                                            </label>

                                            <div
                                                className={cn(
                                                    "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                                                    selected
                                                        ? "grid-rows-[1fr] opacity-100"
                                                        : "grid-rows-[0fr] opacity-0",
                                                )}
                                            >
                                                <div className="overflow-hidden">
                                                    {selected ? (
                                                        <div className="space-y-4 border-t border-border/70 px-6 pb-5 pt-4">
                                                            <Slider
                                                                className="w-full"
                                                                minValue={1}
                                                                maxValue={10}
                                                                step={1}
                                                                value={minScore}
                                                                onChange={(v) =>
                                                                    setMinScore(
                                                                        Array.isArray(v)
                                                                            ? v[0]!
                                                                            : v,
                                                                    )
                                                                }
                                                                isDisabled={
                                                                    isPending || !option.available
                                                                }
                                                            >
                                                                <div className="mb-2 flex items-end justify-between gap-3">
                                                                    <Label className="text-xs font-medium text-muted">
                                                                        Contacts with a score under
                                                                    </Label>
                                                                    <span className="font-mono text-xl font-semibold tabular-nums tracking-tight text-foreground">
                                                                        {minScore}
                                                                    </span>
                                                                </div>
                                                                <Slider.Output className="sr-only" />
                                                                <Slider.Track>
                                                                    <Slider.Fill />
                                                                    <Slider.Thumb />
                                                                </Slider.Track>
                                                            </Slider>

                                                            {option.id === FilterActions.REMOVE ? (
                                                                <p className="text-xs leading-relaxed text-muted">
                                                                    Contacts scoring under{" "}
                                                                    {minScore} leave this list.
                                                                    Unscored contacts stay. Contacts
                                                                    are not deleted from your CRM.
                                                                </p>
                                                            ) : null}

                                                            {option.id === FilterActions.MOVE ? (
                                                                <div className="space-y-3">
                                                                    <p className="text-xs leading-relaxed text-muted">
                                                                        Contacts scoring under{" "}
                                                                        {minScore} leave this list
                                                                        and join the destination
                                                                        list below.
                                                                    </p>
                                                                    <ParentListSelect
                                                                        label="Destination list"
                                                                        value={targetListUuid}
                                                                        onChange={setTargetListUuid}
                                                                        enabled={
                                                                            isOpen && selected
                                                                        }
                                                                        excludeUuid={listUuid}
                                                                        excludeDescendants={false}
                                                                        includeRoot={false}
                                                                    />
                                                                </div>
                                                            ) : null}

                                                            {option.id ===
                                                            FilterActions.ADD_NEW_LIST ? (
                                                                <p className="text-xs leading-relaxed text-muted">
                                                                    Soon you will create a new list
                                                                    and add contacts under this
                                                                    score without removing them
                                                                    from this one.
                                                                </p>
                                                            ) : null}

                                                            {option.available ? (
                                                                <ActionButtonWithPending
                                                                    variant={
                                                                        option.id ===
                                                                        FilterActions.REMOVE
                                                                            ? "danger"
                                                                            : "primary"
                                                                    }
                                                                    className="w-full justify-center"
                                                                    isPending={
                                                                        option.id ===
                                                                        FilterActions.REMOVE
                                                                            ? removeBelowScore.isPending
                                                                            : moveBelowScore.isPending
                                                                    }
                                                                    isDisabled={confirmDisabled}
                                                                    onPress={handleConfirm}
                                                                >
                                                                    {confirmLabel}
                                                                </ActionButtonWithPending>
                                                            ) : null}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </fieldset>
                    </Modal.Body>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
