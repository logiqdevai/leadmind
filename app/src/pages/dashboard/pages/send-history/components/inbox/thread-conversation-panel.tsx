import { Button, Chip } from "@heroui/react";
import { ArrowLeft, UserRound } from "lucide-react";
import { ThreadConversation, ORIGIN_COLOR, ORIGIN_LABEL } from "@/features/messaging/components/thread-conversation";
import { useThreadDetail } from "@/features/outreach/hooks/use-outreach";

interface ThreadConversationPanelProps {
    threadUuid: string;
    contactUuid: string;
    onBack: () => void;
    onViewContact: () => void;
}

export function ThreadConversationPanel({
    threadUuid,
    contactUuid,
    onBack,
    onViewContact,
}: ThreadConversationPanelProps) {
    const { data } = useThreadDetail(threadUuid);

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border p-3">
                <Button
                    size="sm"
                    variant="ghost"
                    className="min-w-7 h-7 shrink-0 px-1 md:hidden"
                    onPress={onBack}
                    aria-label="Back to conversations"
                >
                    <ArrowLeft className="size-4" />
                </Button>
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-medium text-foreground">
                        {data?.thread.subject || "Conversation"}
                    </h2>
                    {data ? (
                        <Chip size="sm" variant="soft" color={ORIGIN_COLOR[data.thread.origin]} className="mt-1">
                            <Chip.Label>{ORIGIN_LABEL[data.thread.origin]}</Chip.Label>
                        </Chip>
                    ) : null}
                </div>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 shrink-0 px-2 text-[12px]"
                    onPress={onViewContact}
                >
                    <UserRound className="size-3.5" />
                    <span className="hidden sm:inline">View contact</span>
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
                <ThreadConversation threadUuid={threadUuid} contactUuid={contactUuid} />
            </div>
        </div>
    );
}
