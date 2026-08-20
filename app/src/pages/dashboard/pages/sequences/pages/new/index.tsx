import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input, Label, TextArea, TextField } from "@heroui/react";
import { Button } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { ChevronLeft, Save } from "lucide-react";
import { useCreateSequence } from "@/features/sequences/hooks/use-sequences";
import { Routes } from "@/routes/routes";

export default function NewSequencePage() {
    const navigate = useNavigate();
    const createMutation = useCreateSequence();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const canSave = name.trim().length > 0;

    const handleSave = async () => {
        if (!canSave) return;
        try {
            const sequence = await createMutation.mutateAsync({
                name: name.trim(),
                description: description.trim() || undefined,
            });
            navigate(Routes.dashboard.sequences_edit.replace(":uuid", sequence.uuid));
        } catch {
            // toast surfaced
        }
    };

    return (
        <div className="space-y-6">
            <Link
                to={Routes.dashboard.sequences}
                className="inline-flex items-center text-sm text-muted hover:text-foreground"
            >
                <ChevronLeft className="size-4" /> Back to sequences
            </Link>
            <header>
                <h1 className="text-xl font-semibold text-foreground">New sequence</h1>
                <p className="text-sm text-muted">
                    Name your sequence. You&apos;ll add steps and configure delays next.
                </p>
            </header>

            <div className="flex flex-col gap-5 max-w-2xl">
                <TextField name="name">
                    <Label>Name</Label>
                    <Input
                        placeholder="e.g. New lead nurture"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={120}
                    />
                </TextField>
                <TextField name="description">
                    <Label>Description (optional)</Label>
                    <TextArea
                        rows={3}
                        placeholder="Internal context for this sequence"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={1000}
                    />
                </TextField>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <Link to={Routes.dashboard.sequences}>
                    <Button variant="secondary">Cancel</Button>
                </Link>
                <ActionButtonWithPending
                    onPress={handleSave}
                    isDisabled={!canSave}
                    isPending={createMutation.isPending}
                    idleLeading={<Save className="size-4" />}
                >
                    Save & continue
                </ActionButtonWithPending>
            </div>
        </div>
    );
}
