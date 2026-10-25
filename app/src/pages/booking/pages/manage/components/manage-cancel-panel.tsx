import { useMemo, type FC } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FieldError, Form, Label, TextArea } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useCancelManagedBooking } from "@/features/bookings/hooks/use-public-booking";
import {
    createCancelBookingSchema,
    type CancelBookingFormValues,
} from "@/pages/booking/validation-schemas/booking.schema";

interface ManageCancelPanelProps {
    token: string;
    reasonRequired: boolean;
    onDone: () => void;
    onClose: () => void;
}

export const ManageCancelPanel: FC<ManageCancelPanelProps> = ({ token, reasonRequired, onDone, onClose }) => {
    const cancelBooking = useCancelManagedBooking(token);
    const schema = useMemo(() => createCancelBookingSchema(reasonRequired), [reasonRequired]);
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<CancelBookingFormValues>({ resolver: zodResolver(schema), defaultValues: { reason: "" } });

    const onSubmit = (values: CancelBookingFormValues) =>
        cancelBooking.mutate(values.reason.trim() || undefined, { onSuccess: onDone });

    return (
        <Form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" validationBehavior="aria">
            <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-foreground">Cancel this booking?</h2>
                <p className="text-sm text-muted">The time will be released and the organiser will be notified.</p>
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="cancel-reason">
                    Reason {reasonRequired ? <span className="text-danger">*</span> : <span className="text-muted">(optional)</span>}
                </Label>
                <TextArea
                    id="cancel-reason"
                    rows={3}
                    {...register("reason")}
                    placeholder="Let them know why you are cancelling"
                    aria-invalid={!!errors.reason}
                    fullWidth
                />
                {errors.reason ? <FieldError>{errors.reason.message}</FieldError> : null}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onPress={onClose} isDisabled={cancelBooking.isPending}>
                    Keep booking
                </Button>
                <ActionButtonWithPending
                    type="submit"
                    variant="danger"
                    isPending={cancelBooking.isPending}
                    isDisabled={cancelBooking.isPending}
                >
                    Cancel booking
                </ActionButtonWithPending>
            </div>
        </Form>
    );
};
