import { Sparkles } from "lucide-react";

export function ReminderAiBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
            <Sparkles className="size-3" />
            AI
        </span>
    );
}
