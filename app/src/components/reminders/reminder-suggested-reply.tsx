import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@heroui/react";
import type { Reminder } from "@/features/reminders/interfaces/reminder.interface";
import { toast } from "@/hooks/use-toast";
import { Routes } from "@/routes/routes";

interface ReminderSuggestedReplyProps {
    reminder: Reminder;
}

export function ReminderSuggestedReply({ reminder }: ReminderSuggestedReplyProps) {
    const draft = reminder.metadata?.ai_draft;
    const [copied, setCopied] = useState(false);

    if (!draft) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(draft.body);
            setCopied(true);
            toast({ title: "Copied suggested reply", duration: 1500 });
            window.setTimeout(() => setCopied(false), 1200);
        } catch {
            toast({ title: "Could not copy to clipboard", duration: 2000, variant: "error" });
        }
    };

    return (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
            <p className="mb-1 text-xs font-medium text-amber-800">Suggested reply</p>
            <p className="mb-1 text-xs font-medium text-amber-900">{draft.subject}</p>
            <p className="whitespace-pre-line text-xs text-amber-900/90">{draft.body}</p>
            <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="tertiary" onPress={handleCopy}>
                    <Copy className="size-3.5" />
                    {copied ? "Copied" : "Copy"}
                </Button>
                <Link
                    to={Routes.dashboard.contacts_detail.replace(":uuid", reminder.contact_uuid)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                    <ExternalLink className="size-3" />
                    Go to conversation
                </Link>
            </div>
        </div>
    );
}
