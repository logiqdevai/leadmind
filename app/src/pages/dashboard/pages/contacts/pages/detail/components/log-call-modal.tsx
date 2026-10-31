import { useEffect, useState } from "react";
import { Button, Input, Label, Modal, TextArea } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { QuickNoteSelect } from "./quick-note-select";
import {
  CallDirection,
  CallOutcome,
  type LogCallPayload,
} from "@/features/contacts/interfaces/contact.interface";
import { useLogCall, useUpdateInteraction } from "@/features/contacts/hooks/use-contacts";
import { cn } from "@/lib/utils";
import {
  CALL_NOTE_STATUS_OPTIONS,
  isCallNoteStatus,
  type CallNoteStatus,
} from "@/features/contacts/constants/call-note-status.constants";
import type { Interaction } from "@/features/contacts/interfaces/contact.interface";

interface LogCallModalProps {
  contactUuid: string;
  /** When set, the modal edits this logged entry instead of creating a new one. */
  interaction?: Interaction | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const OUTCOMES: { id: CallOutcome; label: string }[] = [
  { id: CallOutcome.CONNECTED, label: "Connected" },
  { id: CallOutcome.NO_ANSWER, label: "No answer" },
  { id: CallOutcome.VOICEMAIL, label: "Voicemail" },
  { id: CallOutcome.BUSY, label: "Busy" },
];

/** Ready-made call notes; picking one stores its status and fills the Notes field, which stays editable. */
const QUICK_NOTES = CALL_NOTE_STATUS_OPTIONS;

const DIRECTIONS: { id: CallDirection; label: string }[] = [
  { id: CallDirection.OUTBOUND, label: "Outbound" },
  { id: CallDirection.INBOUND, label: "Inbound" },
];

function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LogCallModal({ contactUuid, interaction, isOpen, onOpenChange }: LogCallModalProps) {
  const updateInteraction = useUpdateInteraction();
  const isEditing = !!interaction;
  const meta = (interaction?.metadata ?? {}) as Record<string, unknown>;
  const logCall = useLogCall();
  const [outcome, setOutcome] = useState<CallOutcome>(CallOutcome.CONNECTED);
  const [direction, setDirection] = useState<CallDirection>(CallDirection.OUTBOUND);
  const [reachedOwner, setReachedOwner] = useState(false);
  const [duration, setDuration] = useState<string>("");
  const [occurredAt, setOccurredAt] = useState<string>(() => toLocalDatetimeValue(new Date()));
  const [notes, setNotes] = useState<string>("");
  const [quickNote, setQuickNote] = useState<CallNoteStatus | null>(null);

  const handleQuickNote = (id: string) => {
    const preset = QUICK_NOTES.find((n) => n.id === id);
    if (!preset) return;
    const previous = QUICK_NOTES.find((n) => n.id === quickNote);
    setQuickNote(preset.id as CallNoteStatus);
    // Replace an untouched preset; otherwise keep what the user typed and add below it.
    setNotes((current) =>
      !current.trim() || current.trim() === previous?.label
        ? preset.label
        : `${current.trimEnd()}\n${preset.label}`,
    );
  };

  useEffect(() => {
    if (isOpen) {
      setQuickNote(isCallNoteStatus(interaction?.call_note_status) ? interaction.call_note_status : null);
      setOutcome((meta.outcome as CallOutcome) ?? CallOutcome.CONNECTED);
      setDirection((meta.direction as CallDirection) ?? CallDirection.OUTBOUND);
      setReachedOwner(meta.reached_owner === true);
      setDuration(typeof meta.duration_minutes === "number" ? String(meta.duration_minutes) : "");
      setOccurredAt(toLocalDatetimeValue(new Date((meta.occurred_at as string) ?? interaction?.created_at ?? Date.now())));
      setNotes(interaction?.content ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, interaction?.uuid]);

  const handleConfirm = () => {
    const payload: LogCallPayload = {
      outcome,
      direction,
      reached_owner: reachedOwner,
      ...(quickNote ? { note_status: quickNote } : {}),
    };
    const durNum = duration === "" ? undefined : Number(duration);
    if (durNum !== undefined && Number.isFinite(durNum) && durNum >= 0) {
      payload.duration_minutes = Math.floor(durNum);
    }
    if (occurredAt) {
      const dt = new Date(occurredAt);
      if (!isNaN(dt.getTime())) {
        payload.occurred_at = dt.toISOString();
      }
    }
    const trimmedNotes = notes.trim();
    if (trimmedNotes || isEditing) payload.content = trimmedNotes;

    if (interaction) {
      updateInteraction.mutate(
        { uuid: contactUuid, interactionUuid: interaction.uuid, payload },
        { onSuccess: () => onOpenChange(false) },
      );
      return;
    }
    logCall.mutate(
      { uuid: contactUuid, payload },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  const durationEnabled = outcome === CallOutcome.CONNECTED;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-md">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{isEditing ? "Edit call" : "Log call"}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>Outcome</Label>
              <div className="grid grid-cols-2 gap-2">
                {OUTCOMES.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOutcome(o.id)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      outcome === o.id
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface text-foreground hover:bg-surface-secondary",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Direction</Label>
              <div className="grid grid-cols-2 gap-2">
                {DIRECTIONS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDirection(d.id)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      direction === d.id
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface text-foreground hover:bg-surface-secondary",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Spoke with the owner (got past the gatekeeper)?</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: true, label: "Yes" },
                  { value: false, label: "No" },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => setReachedOwner(o.value)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      reachedOwner === o.value
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface text-foreground hover:bg-surface-secondary",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="log-call-duration">Duration (min)</Label>
                <Input
                  id="log-call-duration"
                  type="number"
                  min={0}
                  max={1440}
                  placeholder="e.g. 12"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  disabled={!durationEnabled}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="log-call-occurred-at">When</Label>
                <Input
                  id="log-call-occurred-at"
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                />
              </div>
            </div>

            <QuickNoteSelect options={QUICK_NOTES} value={quickNote} onChange={handleQuickNote} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="log-call-notes">Notes</Label>
              <TextArea
                id="log-call-notes"
                rows={4}
                placeholder="What was discussed, next steps…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </Modal.Body>
          <Modal.Footer className="gap-2 justify-end">
            <Button size="sm" variant="tertiary" onPress={() => onOpenChange(false)}>
              Cancel
            </Button>
            <ActionButtonWithPending
              size="sm"
              variant="secondary"
              isDisabled={logCall.isPending || updateInteraction.isPending}
              isPending={logCall.isPending || updateInteraction.isPending}
              onPress={handleConfirm}
            >
              {isEditing ? "Save changes" : "Save call"}
            </ActionButtonWithPending>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
