import type { ReactNode } from "react";
import { Chip, Modal } from "@heroui/react";
import { Sparkles } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useRunMxToolboxAiAudit } from "@/features/mxtoolbox/hooks/use-mxtoolbox";
import {
    MXTOOLBOX_COMMAND_LABELS,
    type MxToolboxCheck,
    type MxToolboxCommand,
    type MxToolboxCommandResult,
} from "@/features/mxtoolbox/interfaces/mxtoolbox.interface";
import { MXTOOLBOX_STATUS_COLOR, formatMxToolboxDate, severityColor } from "../utils/mxtoolbox.utils";

interface MxToolboxResultModalProps {
    check: MxToolboxCheck | null;
    onOpenChange: (open: boolean) => void;
}

export function MxToolboxResultModal({ check, onOpenChange }: MxToolboxResultModalProps) {
    const runAiAudit = useRunMxToolboxAiAudit();
    const commandEntries = check
        ? (Object.entries(check.results) as [MxToolboxCommand, MxToolboxCommandResult][])
        : [];

    return (
        <Modal.Backdrop isOpen={check !== null} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-2xl">
                    <Modal.CloseTrigger />
                    {check ? (
                        <>
                            <Modal.Header>
                                <Modal.Heading>{check.label || "Domain health check"}</Modal.Heading>
                                <p className="text-xs text-muted font-mono">{check.domain}</p>
                            </Modal.Header>
                            <Modal.Body className="space-y-5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Chip size="sm" variant="soft" color={MXTOOLBOX_STATUS_COLOR[check.status]}>
                                        <Chip.Label>{check.status}</Chip.Label>
                                    </Chip>
                                    <Chip size="sm" variant="soft" color="default">
                                        <Chip.Label>{check.commands.length} checks</Chip.Label>
                                    </Chip>
                                    <span className="text-xs text-muted">
                                        {formatMxToolboxDate(check.updated_at)}
                                    </span>
                                </div>

                                <Section title="AI audit">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs text-muted">
                                            {check.ai_audit
                                                ? `Generated ${formatMxToolboxDate(check.ai_audit_generated_at)}`
                                                : "Ask AI to summarize this result and suggest fixes."}
                                        </p>
                                        <ActionButtonWithPending
                                            size="sm"
                                            variant="secondary"
                                            isPending={runAiAudit.isPending}
                                            onPress={() => runAiAudit.mutate(check.uuid)}
                                        >
                                            <Sparkles className="size-4" />
                                            {check.ai_audit ? "Re-run audit" : "Run AI audit"}
                                        </ActionButtonWithPending>
                                    </div>

                                    {check.ai_audit ? (
                                        <div className="space-y-2">
                                            <p className="text-sm text-foreground/90">
                                                {check.ai_audit.summary}
                                            </p>
                                            {check.ai_audit.issues.length > 0 ? (
                                                <ul className="space-y-1.5">
                                                    {check.ai_audit.issues.map((issue, index) => (
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

                                <Section title="Checks">
                                    <div className="space-y-2">
                                        {commandEntries.map(([command, result]) => (
                                            <CommandRow key={command} command={command} result={result} />
                                        ))}
                                    </div>
                                </Section>
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

function CommandRow({
    command,
    result,
}: {
    command: MxToolboxCommand;
    result: MxToolboxCommandResult;
}) {
    if (!result.ok) {
        return (
            <div className="rounded-lg border border-border p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground/90">
                        {MXTOOLBOX_COMMAND_LABELS[command]}
                    </span>
                    <Chip size="sm" variant="soft" color="default">
                        <Chip.Label>Unavailable</Chip.Label>
                    </Chip>
                </div>
                <p className="mt-1 text-muted">{result.error ?? "Lookup failed."}</p>
            </div>
        );
    }

    const color = result.failed.length > 0 ? "danger" : result.warnings.length > 0 ? "warning" : "success";
    const items = [...result.failed, ...result.warnings];

    return (
        <div className="rounded-lg border border-border p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground/90">
                    {MXTOOLBOX_COMMAND_LABELS[command]}
                </span>
                <Chip size="sm" variant="soft" color={color}>
                    <Chip.Label>
                        {result.failed.length > 0
                            ? `${result.failed.length} failed`
                            : result.warnings.length > 0
                              ? `${result.warnings.length} warnings`
                              : "Passed"}
                    </Chip.Label>
                </Chip>
            </div>
            {items.length > 0 ? (
                <ul className="mt-1 space-y-1">
                    {items.map((item, index) => (
                        <li key={`${item.Name ?? index}`} className="text-muted">
                            <span className="font-medium text-foreground/80">{item.Name ?? "Issue"}</span>
                            {item.Info ? <span className="block">{item.Info}</span> : null}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-1 text-muted">
                    {result.passed.length} check{result.passed.length === 1 ? "" : "s"} passed.
                </p>
            )}
        </div>
    );
}
