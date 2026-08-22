import { type FC } from "react";
import { useParams } from "react-router-dom";
import {
    useConfirmUnsubscribe,
    useResubscribeByToken,
    useUnsubscribePreview,
} from "@/features/unsubscribe/hooks/use-unsubscribe";

const UnsubscribePage: FC = () => {
    const { token = "" } = useParams<{ token: string }>();
    const { data, isLoading, isError } = useUnsubscribePreview(token);
    const confirm = useConfirmUnsubscribe(token);
    const restore = useResubscribeByToken(token);
    const unsubscribed = Boolean(data?.already);
    const email = data?.email || "this address";
    const busy = confirm.isPending || restore.isPending;

    if (isLoading) {
        return (
            <article className="unsub-card" aria-busy="true">
                <div className="unsub-skel" aria-label="Loading" />
            </article>
        );
    }

    if (isError) {
        return (
            <article className="unsub-card">
                <h1 className="unsub-title">Link not valid</h1>
                <p className="unsub-copy">This unsubscribe link is missing or expired.</p>
            </article>
        );
    }

    if (unsubscribed) {
        return (
            <article className="unsub-card">
                <h1 className="unsub-title">You are unsubscribed</h1>
                <p className="unsub-copy">
                    We will not send marketing email to <strong>{email}</strong>.
                </p>
                <button
                    type="button"
                    className="unsub-btn"
                    disabled={busy}
                    onClick={() => restore.mutate()}
                >
                    {restore.isPending ? "Updating…" : "Subscribe again"}
                </button>
            </article>
        );
    }

    return (
        <article className="unsub-card">
            <h1 className="unsub-title">Unsubscribe</h1>
            <p className="unsub-copy">
                Stop marketing email to <strong>{email}</strong>?
            </p>
            <button
                type="button"
                className="unsub-btn"
                disabled={busy}
                onClick={() => confirm.mutate()}
            >
                {confirm.isPending ? "Updating…" : "Unsubscribe"}
            </button>
        </article>
    );
};

export default UnsubscribePage;
