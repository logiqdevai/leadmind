import { useMemo, type FC } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FieldError, Form, Label, TextArea } from "@heroui/react";
import { useTranslation } from "react-i18next";
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
    const { t, i18n } = useTranslation();
    const cancelBooking = useCancelManagedBooking(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild messages when the language changes
    const schema = useMemo(() => createCancelBookingSchema(reasonRequired), [reasonRequired, i18n.language]);
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
                <h2 className="text-lg font-semibold text-foreground">{t("booking.manage.cancelTitle")}</h2>
                <p className="text-sm text-muted">{t("booking.manage.cancelDescription")}</p>
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="cancel-reason">
                    {t("booking.manage.reason")}{" "}
                    {reasonRequired ? (
                        <span className="text-danger">*</span>
                    ) : (
                        <span className="text-muted">({t("common.optional")})</span>
                    )}
                </Label>
                <TextArea
                    id="cancel-reason"
                    rows={3}
                    {...register("reason")}
                    placeholder={t("booking.manage.reasonPlaceholder")}
                    aria-invalid={!!errors.reason}
                    fullWidth
                />
                {errors.reason ? <FieldError>{errors.reason.message}</FieldError> : null}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onPress={onClose} isDisabled={cancelBooking.isPending}>
                    {t("booking.manage.keepBooking")}
                </Button>
                <ActionButtonWithPending
                    type="submit"
                    variant="danger"
                    isPending={cancelBooking.isPending}
                    isDisabled={cancelBooking.isPending}
                >
                    {t("booking.manage.cancel")}
                </ActionButtonWithPending>
            </div>
        </Form>
    );
};
