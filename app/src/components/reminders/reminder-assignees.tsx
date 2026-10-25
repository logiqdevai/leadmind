import type { FC } from "react";
import { Users } from "lucide-react";
import type { ReminderAssignee } from "@/features/reminders/interfaces/reminder.interface";
import { cn } from "@/lib/utils";

interface ReminderAssigneesProps {
    assignees: ReminderAssignee[] | undefined;
    className?: string;
}

const MAX_NAMES = 2;

const nameOf = (a: ReminderAssignee) => a.full_name?.trim() || a.email;

/** Who gets a reminder: the assigned members, or "Everyone" when none are assigned. */
export const ReminderAssignees: FC<ReminderAssigneesProps> = ({ assignees = [], className }) => {
    const names = assignees.map(nameOf);
    const label =
        names.length === 0
            ? "Everyone"
            : names.length <= MAX_NAMES
              ? names.join(", ")
              : `${names.slice(0, MAX_NAMES).join(", ")} +${names.length - MAX_NAMES}`;

    return (
        <span
            className={cn("inline-flex min-w-0 items-center gap-1 text-xs text-muted", className)}
            title={names.length ? names.join(", ") : "Every member of the organisation"}
        >
            <Users className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
        </span>
    );
};
