import { type FC } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@heroui/react";
import { useConfirmUnsubscribe } from "@/features/unsubscribe/hooks/use-unsubscribe";

const UnsubscribePage: FC = () => {
    const { token = "" } = useParams<{ token: string }>();
    const { data, isLoading, isError } = useConfirmUnsubscribe(token);

    return (
        <Card className="w-full max-w-md mx-auto p-8">
            <div className="flex flex-col gap-1 text-left mb-6">
                <p className="text-2xl font-semibold">Unsubscribe</p>
                <p className="text-sm text-muted">Stop marketing emails from this workspace</p>
            </div>
            {isLoading ? (
                <p className="text-sm text-muted">Confirming your request…</p>
            ) : isError ? (
                <p className="text-sm text-danger">This unsubscribe link is invalid or has expired.</p>
            ) : (
                <p className="text-sm text-foreground">
                    We won&apos;t send marketing emails to{" "}
                    <span className="font-medium">{data?.email || "this address"}</span> anymore.
                </p>
            )}
        </Card>
    );
};

export default UnsubscribePage;
