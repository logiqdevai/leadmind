import { useState, type FC } from "react";
import { Button } from "@heroui/react";
import { Plus, Workflow } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDeleteSequence, useSequences } from "@/features/sequences/hooks/use-sequences";
import type { OutreachSequence } from "@/features/sequences/interfaces/sequence.interface";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Routes } from "@/routes/routes";
import { SequencesTable } from "./components/sequences-table";

const SequencesPage: FC = () => {
    const navigate = useNavigate();
    const { data: sequences = [], isLoading } = useSequences();
    const deleteMut = useDeleteSequence();
    const [deleteTarget, setDeleteTarget] = useState<OutreachSequence | null>(null);

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Workflow className="size-5 text-muted" />
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">Sequences</h1>
                        <p className="text-sm text-muted">
                            Multi-step Email/SMS drips with configurable delays between messages.
                        </p>
                    </div>
                </div>
                <Button size="sm" onPress={() => navigate(Routes.dashboard.sequences_new)}>
                    <Plus className="size-3.5" />
                    New sequence
                </Button>
            </div>

            {isLoading ? (
                <div className="h-48 rounded-xl bg-surface-secondary animate-pulse" />
            ) : (
                <SequencesTable sequences={sequences} onDelete={setDeleteTarget} />
            )}

            <ConfirmDialog
                isOpen={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Delete sequence?"
                description="This cannot be undone. Sequences with active enrollments or in-use campaigns cannot be deleted."
                confirmLabel="Delete"
                variant="danger"
                isPending={deleteMut.isPending}
                onConfirm={async () => {
                    if (!deleteTarget) return;
                    await deleteMut.mutateAsync(deleteTarget.uuid);
                    setDeleteTarget(null);
                }}
            />
        </div>
    );
};

export default SequencesPage;
