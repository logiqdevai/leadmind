import { Chip, Modal } from "@heroui/react";
import type {
    MailTesterCommonCheck,
    MailTesterTest,
} from "@/features/mail-tester/interfaces/mail-tester.interface";
import { formatMailTesterDate, scoreColor, statusCheckColor } from "../utils/mail-tester.utils";

interface MailTesterResultModalProps {
    test: MailTesterTest | null;
    onOpenChange: (open: boolean) => void;
}

const SIGNATURE_LABELS: Record<string, string> = {
    spf: "SPF",
    senderId: "Sender ID",
    dkim: "DKIM",
    rdns: "rDNS",
};

export function MailTesterResultModal({ test, onOpenChange }: MailTesterResultModalProps) {
    const result = test?.result;

    return (
        <Modal.Backdrop isOpen={test !== null} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-2xl">
                    <Modal.CloseTrigger />
                    {test ? (
                        <>
                            <Modal.Header>
                                <Modal.Heading>{test.label || "Deliverability test"}</Modal.Heading>
                                <p className="text-xs text-muted font-mono">{test.test_address}</p>
                            </Modal.Header>
                            <Modal.Body className="space-y-5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Chip size="sm" variant="soft" color={scoreColor(test.score)}>
                                        <Chip.Label>
                                            {test.score != null ? `${test.score}/10` : test.status}
                                        </Chip.Label>
                                    </Chip>
                                    <Chip size="sm" variant="soft" color="default">
                                        <Chip.Label>
                                            {test.from_provider} · {test.from_account}
                                        </Chip.Label>
                                    </Chip>
                                    <span className="text-xs text-muted">
                                        {formatMailTesterDate(test.updated_at)}
                                    </span>
                                </div>

                                {!result ? (
                                    <p className="text-sm text-muted">
                                        {test.error_message ??
                                            "No result yet — check results once Mail-Tester has processed the email."}
                                    </p>
                                ) : (
                                    <>
                                        {result.comment ? (
                                            <p className="text-sm text-foreground/90">{result.comment}</p>
                                        ) : null}

                                        {result.signature ? (
                                            <section className="space-y-2">
                                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                                                    Authentication
                                                </h3>
                                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                    {Object.entries(result.signature)
                                                        .filter(
                                                            (entry): entry is [string, MailTesterCommonCheck] =>
                                                                typeof entry[1] === "object" && entry[1] !== null,
                                                        )
                                                        .map(([key, check]) => (
                                                            <div
                                                                key={key}
                                                                className="rounded-lg border border-border p-2 text-center"
                                                            >
                                                                <div className="text-xs text-muted">
                                                                    {SIGNATURE_LABELS[key] ?? key}
                                                                </div>
                                                                <Chip
                                                                    size="sm"
                                                                    variant="soft"
                                                                    color={statusCheckColor(check.statusClass)}
                                                                    className="mt-1"
                                                                >
                                                                    <Chip.Label>
                                                                        {check.status ?? check.statusClass ?? "—"}
                                                                    </Chip.Label>
                                                                </Chip>
                                                            </div>
                                                        ))}
                                                </div>
                                            </section>
                                        ) : null}

                                        {result.spamAssassin?.rule?.length ? (
                                            <section className="space-y-2">
                                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                                                    SpamAssassin rules
                                                </h3>
                                                <ul className="space-y-1.5">
                                                    {result.spamAssassin.rule.map((rule, index) => (
                                                        <li
                                                            key={`${rule.code ?? index}`}
                                                            className="flex items-start justify-between gap-3 rounded-lg border border-border p-2 text-xs"
                                                        >
                                                            <span className="text-foreground/90">
                                                                {rule.code ?? `Rule ${index + 1}`}
                                                                {rule.suggestion ? (
                                                                    <span className="block text-muted mt-0.5">
                                                                        {rule.suggestion}
                                                                    </span>
                                                                ) : null}
                                                            </span>
                                                            {rule.score != null ? (
                                                                <span className="shrink-0 text-muted tabular-nums">
                                                                    {rule.score}
                                                                </span>
                                                            ) : null}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </section>
                                        ) : null}

                                        {result.blacklists?.length ? (
                                            <section className="space-y-2">
                                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                                                    Blacklists ({result.blacklists.length})
                                                </h3>
                                                <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-surface-secondary/30 p-2 text-xs text-foreground/90">
                                                    {JSON.stringify(result.blacklists, null, 2)}
                                                </pre>
                                            </section>
                                        ) : null}

                                        {result.links?.length ? (
                                            <section className="space-y-2">
                                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                                                    Broken links ({result.links.length})
                                                </h3>
                                                <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-surface-secondary/30 p-2 text-xs text-foreground/90">
                                                    {JSON.stringify(result.links, null, 2)}
                                                </pre>
                                            </section>
                                        ) : null}
                                    </>
                                )}
                            </Modal.Body>
                        </>
                    ) : null}
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
