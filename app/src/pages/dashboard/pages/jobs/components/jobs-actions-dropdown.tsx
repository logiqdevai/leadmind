import type { FC } from "react";
import { Button, Dropdown } from "@heroui/react";
import { ChevronDown, RotateCcw, Square } from "lucide-react";

interface JobsActionsDropdownProps {
    onCancelSelected: () => void;
    cancelDisabled?: boolean;
    cancelPending?: boolean;
    onRetrySelected: () => void;
    retryDisabled?: boolean;
    retryPending?: boolean;
}

export const JobsActionsDropdown: FC<JobsActionsDropdownProps> = ({
    onCancelSelected,
    cancelDisabled = false,
    cancelPending = false,
    onRetrySelected,
    retryDisabled = false,
    retryPending = false,
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
                    if (key === "cancel-selected") onCancelSelected();
                    if (key === "retry-selected") onRetrySelected();
                }}
            >
                <Dropdown.Item
                    id="cancel-selected"
                    textValue="Cancel"
                    isDisabled={cancelDisabled || cancelPending}
                >
                    <span className="flex items-center gap-2.5 antialiased">
                        <Square className="size-4 shrink-0 text-danger" strokeWidth={2} />
                        <span className="font-medium text-danger">Cancel</span>
                    </span>
                </Dropdown.Item>
                <Dropdown.Item
                    id="retry-selected"
                    textValue="Retry"
                    isDisabled={retryDisabled || retryPending}
                >
                    <span className="flex items-center gap-2.5 antialiased">
                        <RotateCcw className="size-4 shrink-0 text-muted" strokeWidth={2} />
                        <span className="font-medium text-foreground">Retry</span>
                    </span>
                </Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown.Popover>
    </Dropdown>
);
