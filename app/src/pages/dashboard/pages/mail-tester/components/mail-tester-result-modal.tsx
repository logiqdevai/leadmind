import type { ReactNode } from "react";
import { Chip, Modal } from "@heroui/react";
import { Sparkles } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useRunMailTesterAiAudit } from "@/features/mail-tester/hooks/use-mail-tester";
import type {
    MailTesterCheck,
    MailTesterTest,
} from "@/features/mail-tester/interfaces/mail-tester.interface";
import {
    formatMailTesterDate,
    scoreColor,
    severityColor,
    statusCheckColor,
    stripHtml,
} from "../utils/mail-tester.utils";

interface MailTesterResultModalProps {
    test: MailTesterTest | null;
    onOpenChange: (open: boolean) => void;
}

const SIGNATURE_LABELS: Record<string, string> = {
    spf: "SPF",
    dkim: "DKIM",
    rDns: "rDNS",
    dmarc: "DMARC",
    aRecord: "A record",
    mxRecord: "MX record",
    senderId: "Sender ID",
};

const BODY_CHECK_LABELS: Record<string, string> = {
    textToHtmlRatio: "Text/HTML ratio",
    altAttributes: "Image alt attributes",
    forbiddenTags: "Forbidden tags",
    listUnsubscribe: "List-Unsubscribe header",
    shorturl: "URL shorteners",
};

export function MailTesterResultModal({ test, onOpenChange }: MailTesterResultModalProps) {
    const runAiAudit = useRunMailTesterAiAudit();
    const result = test?.result;
    const signatureChecks = Object.entries(result?.signature?.subtests ?? {});
    const bodyChecks = Object.entries(result?.body?.subtests ?? {});
    const spamRules = Object.values(result?.spamAssassin?.rules ?? {}).sort(
        (a, b) => (a.score ?? 0) - (b.score ?? 0),
    );
    const blacklistHits = result?.blacklists?.hits ?? 0;
    const blacklistTotal = Object.keys(result?.blacklists?.blacklists ?? {}).length;
    const brokenLinks = result?.links?.brokenLinks ?? 0;

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

                                <Section title="AI audit">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs text-muted">
                                            {test.ai_audit
                                                ? `Generated ${formatMailTesterDate(test.ai_audit_generated_at)}`
                                                : "Ask AI to summarize this result and suggest fixes."}
                                        </p>
                                        <ActionButtonWithPending
                                            size="sm"
                                            variant="secondary"
                                            isPending={runAiAudit.isPending}
                                            isDisabled={!result}
                                            onPress={() => runAiAudit.mutate(test.uuid)}
                                        >
                                            <Sparkles className="size-4" />
                                            {test.ai_audit ? "Re-run audit" : "Run AI audit"}
                                        </ActionButtonWithPending>
                                    </div>

                                    {test.ai_audit ? (
                                        <div className="space-y-2">
                                            <p className="text-sm text-foreground/90">
                                                {test.ai_audit.summary}
                                            </p>
                                            {test.ai_audit.issues.length > 0 ? (
                                                <ul className="space-y-1.5">
                                                    {test.ai_audit.issues.map((issue, index) => (
                                                        <li
                                                            key={`${issue.title}-${index}`}
                                                            className="rounded-lg border border-border p-2 text-xs"
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="font-medium text-foreground/90">
                                                                    {issue.title}
                                                                </span>
                                                                <Chip
                                                                    size="sm"
                                                                    variant="soft"
                                                                    color={severityColor(issue.severity)}
                                                                >
                                                                    <Chip.Label>{issue.severity}</Chip.Label>
                                                                </Chip>
                                                            </div>
                                                            <p className="mt-1 text-muted">{issue.fix}</p>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-xs text-muted">No issues found.</p>
                                            )}
                                        </div>
                                    ) : null}
                                </Section>

                                {!result ? (
                                    <p className="text-sm text-muted">
                                        {test.error_message ??
                                            "No result yet — check results once Mail-Tester has processed the email."}
                                    </p>
                                ) : (
                                    <>
                                        {result.title ? (
                                            <p className="text-sm font-medium text-foreground/90">
                                                {result.title}
                                            </p>
                                        ) : null}

                                        {signatureChecks.length > 0 ? (
                                            <Section title="Authentication">
                                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                    {signatureChecks.map(([key, check]) => (
                                                        <CheckTile
                                                            key={key}
                                                            label={SIGNATURE_LABELS[key] ?? key}
                                                            check={check}
                                                        />
                                                    ))}
                                                </div>
                                            </Section>
                                        ) : null}

                                        {spamRules.length > 0 ? (
                                            <Section
                                                title={`SpamAssassin${
                                                    result.spamAssassin?.score != null
                                                        ? ` (${result.spamAssassin.score})`
                                                        : ""
                                                }`}
                                            >
                                                <ul className="space-y-1.5">
                                                    {spamRules.map((rule, index) => (
                                                        <li
                                                            key={`${rule.code ?? index}`}
                                                            className="flex items-start justify-between gap-3 rounded-lg border border-border p-2 text-xs"
                                                        >
                                                            <span className="text-foreground/90">
                                                                <span className="font-medium">
                                                                    {rule.code ?? `Rule ${index + 1}`}
                                                                </span>
                                                                {rule.description ? (
                                                                    <span className="block text-muted mt-0.5">
                                                                        {stripHtml(rule.description)}
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
                                            </Section>
                                        ) : null}

                                        {bodyChecks.length > 0 ? (
                                            <Section title="Content">
                                                <ul className="space-y-1.5">
                                                    {bodyChecks.map(([key, check]) => (
                                                        <li
                                                            key={key}
                                                            className="flex items-start justify-between gap-3 rounded-lg border border-border p-2 text-xs"
                                                        >
                                                            <span className="text-foreground/90">
                                                                <span className="font-medium">
                                                                    {BODY_CHECK_LABELS[key] ?? key}
                                                                </span>
                                                                <span className="block text-muted mt-0.5">
                                                                    {stripHtml(check.title)}
                                                                </span>
                                                            </span>
                                                            <Chip
                                                                size="sm"
                                                                variant="soft"
                                                                color={statusCheckColor(check.statusClass)}
                                                                className="shrink-0"
                                                            >
                                                                <Chip.Label>
                                                                    {check.statusClass?.split(" ")[0] ?? "—"}
                                                                </Chip.Label>
                                                            </Chip>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </Section>
                                        ) : null}

                                        <Section title="Blacklists">
                                            <p className="text-xs text-foreground/90">
                                                {blacklistHits > 0
                                                    ? `Listed on ${blacklistHits} of ${blacklistTotal} blocklists checked.`
                                                    : `Not listed on any of the ${blacklistTotal} blocklists checked.`}
                                            </p>
                                        </Section>

                                        <Section title="Links">
                                            <p className="text-xs text-foreground/90">
                                                {brokenLinks > 0
                                                    ? `${brokenLinks} broken link${brokenLinks === 1 ? "" : "s"} found.`
                                                    : `No broken links found (${result.links?.urls?.length ?? 0} checked).`}
                                            </p>
                                        </Section>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
            {children}
        </section>
    );
}

function CheckTile({ label, check }: { label: string; check: MailTesterCheck }) {
    return (
        <div className="rounded-lg border border-border p-2 text-center">
            <div className="text-xs text-muted">{label}</div>
            <Chip size="sm" variant="soft" color={statusCheckColor(check.statusClass)} className="mt-1">
                <Chip.Label>{check.status || check.statusClass?.split(" ")[0] || "—"}</Chip.Label>
            </Chip>
            {check.statusClass && !check.statusClass.startsWith("success") && check.title ? (
                <p className="mt-1 text-[11px] text-muted line-clamp-2">{stripHtml(check.title)}</p>
            ) : null}
        </div>
    );
}
