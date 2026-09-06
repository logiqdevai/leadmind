import { MessageCircleReply } from "lucide-react";
import type { Reminder } from "@/features/reminders/interfaces/reminder.interface";

interface ReminderTypeBadgeProps {
    type: Reminder["type"];
}

export function ReminderTypeBadge({ type }: ReminderTypeBadgeProps) {
    if (type !== "FOLLOW_UP") return null;

    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            <MessageCircleReply className="size-3" />
            Follow up
        </span>
    );
}
