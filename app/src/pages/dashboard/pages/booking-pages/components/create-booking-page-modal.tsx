import { useEffect, type FC } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Button, Input, Label, Modal } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { BOOKING_DURATION_PRESETS } from "@/features/bookings/constants/booking-labels";
import { useCreateBookingPage } from "@/features/bookings/hooks/use-booking-pages";
import { formatDuration } from "@/features/bookings/utils/booking-time";
import { PresetSinglePicker } from "@/pages/dashboard/pages/booking-pages/pages/detail/components/preset-pickers";
import {
    createBookingPageSchema,
    type CreateBookingPageFormData,
} from "@/pages/dashboard/pages/booking-pages/validation-schemas/create-booking-page.schema";
import { Routes } from "@/routes/routes";

const DURATION_PRESETS = BOOKING_DURATION_PRESETS.map((m) => ({ value: m, label: formatDuration(m) }));

interface CreateBookingPageModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export const CreateBookingPageModal: FC<CreateBookingPageModalProps> = ({ isOpen, onOpenChange }) => {
    const navigate = useNavigate();
    const createPage = useCreateBookingPage();
    const form = useForm<CreateBookingPageFormData>({
        resolver: zodResolver(createBookingPageSchema),
        defaultValues: { name: "", duration_minutes: 30 },
    });

    useEffect(() => {
        if (isOpen) form.reset({ name: "", duration_minutes: 30 });
    }, [isOpen, form]);

    const onSubmit = form.handleSubmit((data) => {
        createPage.mutate(
            { name: data.name.trim(), duration_minutes: data.duration_minutes },
            {
                onSuccess: (page) => {
                    onOpenChange(false);
                    navigate(Routes.dashboard.booking_pages_detail.replace(":uuid", page.uuid));
                },
            },
        );
    });

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-lg">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>New booking page</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                        <form id="create-booking-page-form" onSubmit={onSubmit} className="space-y-4" noValidate>
                            <p className="text-xs text-muted">
                                A booking page is one appointment type, e.g. &quot;Intro call&quot;. You can set the team, rules and branding
                                after creating it. You are added as the first team member.
                            </p>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="new-bp-name">
                                    Name <span className="text-danger">*</span>
                                </Label>
                                <Input id="new-bp-name" {...form.register("name")} placeholder="e.g. 30 minute intro call" autoFocus />
                                {form.formState.errors.name ? (
                                    <p className="text-xs text-danger">{form.formState.errors.name.message}</p>
                                ) : null}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Duration</Label>
                                <Controller
                                    control={form.control}
                                    name="duration_minutes"
                                    render={({ field }) => (
                                        <PresetSinglePicker
                                            aria-label="Duration"
                                            presets={DURATION_PRESETS}
                                            value={field.value}
                                            onChange={field.onChange}
                                            minValue={5}
                                            maxValue={720}
                                            suffix="minutes"
                                        />
                                    )}
                                />
                                {form.formState.errors.duration_minutes ? (
                                    <p className="text-xs text-danger">{form.formState.errors.duration_minutes.message}</p>
                                ) : null}
                            </div>
                        </form>
                    </Modal.Body>
                    <Modal.Footer className="gap-2 justify-end">
                        <Button variant="tertiary" onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            type="submit"
                            form="create-booking-page-form"
                            isPending={createPage.isPending}
                            isDisabled={createPage.isPending}
                        >
                            Create
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
