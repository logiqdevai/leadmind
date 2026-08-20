import { useLayoutEffect, useRef, useState, type FC } from "react";
import { Button, FieldError, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { Channel } from "@/features/contacts/interfaces/contact.interface";
import {
    MessageComposer,
    type MessageComposerValue,
} from "@/features/messaging/components/message-composer";
import { MessageTemplateSelect } from "@/features/messaging/components/message-template-select";
import { DEFAULT_CAMPAIGN_ACTIONS } from "@/features/messaging/constants/ai-actions";
import {
    EMPTY_MESSAGE_COMPOSER_VALUE,
    isComposerContentEmpty,
} from "@/features/messaging/utils/compose-message";
import type { MessageTemplate } from "@/features/message-templates/interfaces/message-template.interface";
import { mergeTemplateIntoComposer } from "@/features/message-templates/utils/message-template-composer.utils";
import {
    SequenceDelayReference,
    SequenceDelayUnit,
    type CreateSequenceStepPayload,
    type SequenceStep,
} from "@/features/sequences/interfaces/sequence.interface";

const STEP_CHANNELS = [Channel.EMAIL, Channel.SMS] as const;

const DELAY_UNIT_OPTIONS: { id: SequenceDelayUnit; label: string }[] = [
    { id: SequenceDelayUnit.HOURS, label: "Hours" },
    { id: SequenceDelayUnit.DAYS, label: "Days" },
    { id: SequenceDelayUnit.WEEKS, label: "Weeks" },
    { id: SequenceDelayUnit.MONTHS, label: "Months" },
];

const DELAY_REFERENCE_OPTIONS: { id: SequenceDelayReference; label: string }[] = [
    { id: SequenceDelayReference.PREVIOUS_STEP, label: "The previous message" },
    { id: SequenceDelayReference.FIRST_STEP, label: "The first message" },
];

function stepToComposerValue(step?: SequenceStep | null): MessageComposerValue {
    if (!step) return EMPTY_MESSAGE_COMPOSER_VALUE;
    return {
        emailSubject: step.email_subject ?? "",
        emailContent: step.email_content ?? "",
        smsContent: step.sms_content ?? "",
        callContent: "",
        linkedinContent: "",
    };
}

interface StepEditorModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    initial?: SequenceStep | null;
    isSaving: boolean;
    onSave: (payload: CreateSequenceStepPayload) => Promise<void>;
}

export const StepEditorModal: FC<StepEditorModalProps> = ({
    isOpen,
    onOpenChange,
    initial = null,
    isSaving,
    onSave,
}) => {
    const [channel, setChannel] = useState<Channel>(Channel.EMAIL);
    const [composerValue, setComposerValue] = useState<MessageComposerValue>(EMPTY_MESSAGE_COMPOSER_VALUE);
    const [messageTemplateUuid, setMessageTemplateUuid] = useState<string | null>(null);
    const [delayValue, setDelayValue] = useState("0");
    const [delayUnit, setDelayUnit] = useState<SequenceDelayUnit>(SequenceDelayUnit.DAYS);
    const [delayReference, setDelayReference] = useState<SequenceDelayReference>(
        SequenceDelayReference.PREVIOUS_STEP,
    );
    const [contentError, setContentError] = useState<string | null>(null);
    const [composerKey, setComposerKey] = useState(0);
    const [composerReady, setComposerReady] = useState(false);
    const wasOpenRef = useRef(false);

    useLayoutEffect(() => {
        if (!isOpen) {
            setComposerReady(false);
            wasOpenRef.current = false;
            return;
        }
        if (!wasOpenRef.current) {
            if (initial) {
                setChannel(initial.channel);
                setComposerValue(stepToComposerValue(initial));
                setMessageTemplateUuid(initial.message_template_uuid);
                setDelayValue(String(initial.delay_value));
                setDelayUnit(initial.delay_unit);
                setDelayReference(initial.delay_reference);
            } else {
                setChannel(Channel.EMAIL);
                setComposerValue(EMPTY_MESSAGE_COMPOSER_VALUE);
                setMessageTemplateUuid(null);
                setDelayValue("1");
                setDelayUnit(SequenceDelayUnit.DAYS);
                setDelayReference(SequenceDelayReference.PREVIOUS_STEP);
            }
            setComposerKey((k) => k + 1);
            setContentError(null);
            setComposerReady(true);
        }
        wasOpenRef.current = isOpen;
    }, [isOpen, initial]);

    const handleTemplateSelect = (template: MessageTemplate) => {
        setComposerValue((prev) => mergeTemplateIntoComposer(prev, template));
        setMessageTemplateUuid(template.uuid);
        setComposerKey((k) => k + 1);
    };

    const handleSave = async () => {
        if (isComposerContentEmpty(channel, composerValue)) {
            setContentError(channel === Channel.EMAIL ? "Add email content" : "Add SMS content");
            return;
        }
        setContentError(null);
        const numericDelay = Math.max(0, Number.parseInt(delayValue, 10) || 0);

        const payload: CreateSequenceStepPayload = {
            channel,
            email_subject: channel === Channel.EMAIL ? composerValue.emailSubject.trim() || undefined : undefined,
            email_content: channel === Channel.EMAIL ? composerValue.emailContent : undefined,
            sms_content: channel === Channel.SMS ? composerValue.smsContent : undefined,
            message_template_uuid: messageTemplateUuid ?? undefined,
            delay_value: numericDelay,
            delay_unit: delayUnit,
            delay_reference: delayReference,
        };
        await onSave(payload);
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container size="lg">
                <Modal.Dialog className="sm:max-w-3xl max-h-[90vh] flex flex-col">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>{initial ? "Edit step" : "Add step"}</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="space-y-5 overflow-y-auto flex-1">
                        {composerReady ? (
                            <>
                                <MessageTemplateSelect
                                    allowedChannels={[...STEP_CHANNELS]}
                                    disabled={isSaving}
                                    onSelect={handleTemplateSelect}
                                />
                                <MessageComposer
                                    key={composerKey}
                                    channels={[...STEP_CHANNELS]}
                                    activeChannel={channel}
                                    onActiveChannelChange={setChannel}
                                    value={composerValue}
                                    onChange={(patch) => setComposerValue((prev) => ({ ...prev, ...patch }))}
                                    aiActions={DEFAULT_CAMPAIGN_ACTIONS}
                                    disabled={isSaving}
                                />
                                {contentError ? <FieldError>{contentError}</FieldError> : null}

                                <div className="rounded-lg border border-border bg-surface-secondary/40 p-3 flex flex-col gap-3">
                                    <Label className="text-sm font-medium text-foreground">Timing</Label>
                                    <div className="flex flex-wrap items-end gap-3">
                                        <TextField name="delay-value" className="w-24">
                                            <Label>Send</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={delayValue}
                                                onChange={(e) => setDelayValue(e.target.value)}
                                                disabled={isSaving}
                                            />
                                        </TextField>
                                        <div className="flex flex-col gap-1.5 min-w-[140px]">
                                            <Label>Unit</Label>
                                            <Select
                                                aria-label="Delay unit"
                                                value={delayUnit}
                                                onChange={(v) => {
                                                    if (typeof v === "string") setDelayUnit(v as SequenceDelayUnit);
                                                }}
                                                isDisabled={isSaving}
                                            >
                                                <Select.Trigger>
                                                    <Select.Value />
                                                    <Select.Indicator />
                                                </Select.Trigger>
                                                <Select.Popover>
                                                    <ListBox>
                                                        {DELAY_UNIT_OPTIONS.map((opt) => (
                                                            <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                                                                {opt.label}
                                                                <ListBox.ItemIndicator />
                                                            </ListBox.Item>
                                                        ))}
                                                    </ListBox>
                                                </Select.Popover>
                                            </Select>
                                        </div>
                                        <div className="flex flex-col gap-1.5 min-w-[200px]">
                                            <Label>After</Label>
                                            <Select
                                                aria-label="Delay reference"
                                                value={delayReference}
                                                onChange={(v) => {
                                                    if (typeof v === "string")
                                                        setDelayReference(v as SequenceDelayReference);
                                                }}
                                                isDisabled={isSaving}
                                            >
                                                <Select.Trigger>
                                                    <Select.Value />
                                                    <Select.Indicator />
                                                </Select.Trigger>
                                                <Select.Popover>
                                                    <ListBox>
                                                        {DELAY_REFERENCE_OPTIONS.map((opt) => (
                                                            <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                                                                {opt.label}
                                                                <ListBox.ItemIndicator />
                                                            </ListBox.Item>
                                                        ))}
                                                    </ListBox>
                                                </Select.Popover>
                                            </Select>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted">
                                        Ignored for the first enabled step in the sequence, which always sends
                                        this long after a contact is enrolled.
                                    </p>
                                </div>
                            </>
                        ) : null}
                    </Modal.Body>
                    <Modal.Footer className="gap-2 justify-end shrink-0">
                        <Button type="button" size="sm" variant="tertiary" onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            size="sm"
                            isDisabled={isSaving}
                            isPending={isSaving}
                            onPress={() => void handleSave()}
                        >
                            {initial ? "Save" : "Add step"}
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
