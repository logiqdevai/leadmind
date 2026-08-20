import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Input, Label, TextArea, TextField } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { ChevronLeft, Plus } from "lucide-react";
import {
    useActivateSequence,
    useArchiveSequence,
    useAddSequenceStep,
    useDeleteSequenceStep,
    useReorderSequenceSteps,
    useSequence,
    useUpdateSequence,
    useUpdateSequenceStep,
} from "@/features/sequences/hooks/use-sequences";
import { SequenceStatus, type SequenceStep } from "@/features/sequences/interfaces/sequence.interface";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Routes } from "@/routes/routes";
import { SequenceStatusBadge } from "../../components/sequence-status-badge";
import { StepList } from "../../components/step-list";
import { StepEditorModal } from "../../components/step-editor-modal";

export default function EditSequencePage() {
    const { uuid } = useParams<{ uuid: string }>();
    const { data: sequence, isLoading, isError, error } = useSequence(uuid);
    const updateSequenceMut = useUpdateSequence();
    const activateMut = useActivateSequence();
    const archiveMut = useArchiveSequence();
    const addStepMut = useAddSequenceStep();
    const updateStepMut = useUpdateSequenceStep();
    const deleteStepMut = useDeleteSequenceStep();
    const reorderMut = useReorderSequenceSteps();

    const [name, setName] = useState<string | null>(null);
    const [description, setDescription] = useState<string | null>(null);
    const [stepModalOpen, setStepModalOpen] = useState(false);
    const [editingStep, setEditingStep] = useState<SequenceStep | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<SequenceStep | null>(null);

    if (isLoading) {
        return <div className="h-64 rounded-xl bg-surface-secondary animate-pulse" />;
    }
    if (isError || !sequence) {
        return (
            <div className="space-y-4">
                <Link to={Routes.dashboard.sequences} className="inline-flex items-center text-sm text-muted hover:text-foreground">
                    <ChevronLeft className="size-4" /> Back to sequences
                </Link>
                <div className="rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error">
                    {error instanceof Error ? error.message : "Sequence not found."}
                </div>
            </div>
        );
    }

    const currentName = name ?? sequence.name;
    const currentDescription = description ?? sequence.description ?? "";
    const nameDirty = name !== null && name !== sequence.name;
    const descriptionDirty = description !== null && description !== (sequence.description ?? "");
    const isDraft = sequence.status === SequenceStatus.DRAFT;
    const enabledStepCount = sequence.steps.filter((s) => s.enabled).length;

    const saveBasics = async () => {
        if (!nameDirty && !descriptionDirty) return;
        await updateSequenceMut.mutateAsync({
            uuid: sequence.uuid,
            payload: {
                ...(nameDirty ? { name: currentName.trim() } : {}),
                ...(descriptionDirty ? { description: currentDescription.trim() } : {}),
            },
        });
        setName(null);
        setDescription(null);
    };

    return (
        <div className="space-y-6">
            <Link to={Routes.dashboard.sequences} className="inline-flex items-center text-sm text-muted hover:text-foreground">
                <ChevronLeft className="size-4" /> Back to sequences
            </Link>

            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold text-foreground">{sequence.name || "Untitled sequence"}</h1>
                    <SequenceStatusBadge status={sequence.status} />
                </div>
                <div className="flex items-center gap-2">
                    {sequence.status === SequenceStatus.DRAFT && (
                        <span
                            title={enabledStepCount === 0 ? "Add at least one enabled step first" : undefined}
                        >
                            <ActionButtonWithPending
                                size="sm"
                                isPending={activateMut.isPending}
                                isDisabled={enabledStepCount === 0}
                                onPress={() => activateMut.mutate(sequence.uuid)}
                            >
                                Activate
                            </ActionButtonWithPending>
                        </span>
                    )}
                    {sequence.status !== SequenceStatus.ARCHIVED && (
                        <ActionButtonWithPending
                            size="sm"
                            variant="secondary"
                            isPending={archiveMut.isPending}
                            onPress={() => archiveMut.mutate(sequence.uuid)}
                        >
                            Archive
                        </ActionButtonWithPending>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4 max-w-2xl">
                <TextField name="name">
                    <Label>Name</Label>
                    <Input value={currentName} onChange={(e) => setName(e.target.value)} maxLength={120} />
                </TextField>
                <TextField name="description">
                    <Label>Description (optional)</Label>
                    <TextArea
                        rows={2}
                        value={currentDescription}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={1000}
                    />
                </TextField>
                {(nameDirty || descriptionDirty) && (
                    <div>
                        <ActionButtonWithPending
                            size="sm"
                            isPending={updateSequenceMut.isPending}
                            onPress={() => void saveBasics()}
                        >
                            Save changes
                        </ActionButtonWithPending>
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-foreground">Steps</h2>
                    <Button
                        size="sm"
                        onPress={() => {
                            setEditingStep(null);
                            setStepModalOpen(true);
                        }}
                    >
                        <Plus className="size-3.5" />
                        Add step
                    </Button>
                </div>
                <StepList
                    steps={sequence.steps}
                    canDeleteSteps={isDraft}
                    onReorder={(step_uuids) => reorderMut.mutate({ uuid: sequence.uuid, step_uuids })}
                    onEdit={(step) => {
                        setEditingStep(step);
                        setStepModalOpen(true);
                    }}
                    onDelete={setDeleteTarget}
                    onToggleEnabled={(step, enabled) =>
                        updateStepMut.mutate({ uuid: sequence.uuid, stepUuid: step.uuid, payload: { enabled } })
                    }
                />
            </div>

            <StepEditorModal
                isOpen={stepModalOpen}
                onOpenChange={(open) => {
                    setStepModalOpen(open);
                    if (!open) setEditingStep(null);
                }}
                initial={editingStep}
                isSaving={addStepMut.isPending || updateStepMut.isPending}
                onSave={async (payload) => {
                    if (editingStep) {
                        await updateStepMut.mutateAsync({ uuid: sequence.uuid, stepUuid: editingStep.uuid, payload });
                    } else {
                        await addStepMut.mutateAsync({ uuid: sequence.uuid, payload });
                    }
                    setStepModalOpen(false);
                    setEditingStep(null);
                }}
            />

            <ConfirmDialog
                isOpen={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Delete step?"
                description="This cannot be undone."
                confirmLabel="Delete"
                variant="danger"
                isPending={deleteStepMut.isPending}
                onConfirm={async () => {
                    if (!deleteTarget) return;
                    await deleteStepMut.mutateAsync({ uuid: sequence.uuid, stepUuid: deleteTarget.uuid });
                    setDeleteTarget(null);
                }}
            />
        </div>
    );
}
