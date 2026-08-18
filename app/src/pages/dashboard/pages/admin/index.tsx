import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Button, Modal } from "@heroui/react";
import { ShieldCheck } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useRunEmailValidationBackfill } from "@/features/admin-email-validation/hooks/use-email-validation-backfill";
import type {
    EmailBackfillCounters,
    EmailValidationBackfillResult,
} from "@/features/admin-email-validation/interfaces/email-validation-backfill.interface";
import { toast } from "@/hooks/use-toast";

function AdminActionCard({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: ComponentType<{ className?: string }>;
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <div className="rounded-xl border border-border bg-surface p-5 max-w-xl space-y-3">
            <div className="flex items-center gap-2.5">
                <Icon className="size-4 text-muted shrink-0" />
                <h2 className="text-sm font-medium text-foreground">{title}</h2>
            </div>
            <p className="text-sm text-muted">{description}</p>
            <div>{children}</div>
        </div>
    );
}

function CounterRow({ label, counters }: { label: string; counters: EmailBackfillCounters }) {
    return (
        <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-surface-secondary px-3 py-2">
                    <p className="text-xs text-muted">Checked</p>
                    <p className="font-semibold text-foreground tabular-nums">{counters.checked}</p>
                </div>
                <div className="rounded-lg bg-surface-secondary px-3 py-2">
                    <p className="text-xs text-muted">Status refreshed</p>
                    <p className="font-semibold text-foreground tabular-nums">{counters.statusUpdated}</p>
                </div>
                <div className="rounded-lg bg-danger-soft px-3 py-2">
                    <p className="text-xs text-danger-soft-foreground">Cleared (invalid)</p>
                    <p className="font-semibold text-danger-soft-foreground tabular-nums">{counters.invalidated}</p>
                </div>
                <div className="rounded-lg bg-surface-secondary px-3 py-2">
                    <p className="text-xs text-muted">Errors</p>
                    <p className="font-semibold text-foreground tabular-nums">{counters.errors}</p>
                </div>
            </div>
        </div>
    );
}

function EmailValidationResultModal({
    result,
    isOpen,
    onOpenChange,
}: {
    result: EmailValidationBackfillResult | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Email validation complete</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="space-y-4">
                        {result ? (
                            <>
                                <CounterRow label="Leads" counters={result.leads} />
                                <CounterRow label="Contacts" counters={result.contacts} />
                                <p className="text-xs text-muted">
                                    Invalid emails were cleared, not overwritten — each cleared contact also got an
                                    audit note recording what was removed and why, so nothing is lost silently.
                                </p>
                            </>
                        ) : null}
                    </Modal.Body>
                    <Modal.Footer className="justify-end">
                        <Button size="sm" variant="secondary" slot="close">
                            Close
                        </Button>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}

export default function AdminControlsPage() {
    const [modalOpen, setModalOpen] = useState(false);
    const [result, setResult] = useState<EmailValidationBackfillResult | null>(null);
    const runBackfill = useRunEmailValidationBackfill();

    const handleRun = () => {
        runBackfill.mutate(undefined, {
            onSuccess: (data) => {
                setResult(data);
                setModalOpen(true);
            },
            onError: (error) => {
                toast({
                    title: "Backfill failed",
                    description: error instanceof Error ? error.message : "Something went wrong.",
                    duration: 4000,
                    variant: "error",
                });
            },
        });
    };

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-lg font-semibold text-foreground leading-tight">Admin Controls</h1>
                <p className="text-xs text-muted mt-0.5">One-off data maintenance and admin-only actions</p>
            </div>

            <AdminActionCard
                icon={ShieldCheck}
                title="Validate lead & contact emails"
                description="Re-checks every lead and contact email (syntax, disposable domains, mail server records). Invalid ones are cleared, not overwritten — contact clears get an audit note so nothing is lost silently. This can take a few minutes on a large database."
            >
                <ActionButtonWithPending
                    size="sm"
                    variant="secondary"
                    isPending={runBackfill.isPending}
                    onPress={handleRun}
                >
                    Run validation
                </ActionButtonWithPending>
            </AdminActionCard>

            <EmailValidationResultModal result={result} isOpen={modalOpen} onOpenChange={setModalOpen} />
        </div>
    );
}
