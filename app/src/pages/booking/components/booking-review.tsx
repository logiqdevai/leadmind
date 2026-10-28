import type { FC } from "react";
import { Alert, Button } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
    BookingQuestionTypes,
    type BookingSlot,
    type PublicBookingPage,
} from "@/features/bookings/interfaces/bookings.interfaces";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import type { BookingDetailsFormValues } from "@/pages/booking/validation-schemas/booking.schema";
import { BookingSummaryList } from "@/pages/booking/components/booking-summary-list";

interface BookingReviewProps {
    data: PublicBookingPage;
    slot: BookingSlot;
    timezone: string;
    duration: number;
    memberName: string | null;
    details: BookingDetailsFormValues;
    isSubmitting: boolean;
    errorMessage: string | null;
    onBack: () => void;
    onEditTime: () => void;
    onConfirm: () => void;
}

const DetailRow: FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
        <dt className="shrink-0 text-muted sm:w-40">{label}</dt>
        <dd className="min-w-0 whitespace-pre-line break-words text-foreground">{value}</dd>
    </div>
);

export const BookingReview: FC<BookingReviewProps> = ({
    data,
    slot,
    timezone,
    duration,
    memberName,
    details,
    isSubmitting,
    errorMessage,
    onBack,
    onEditTime,
    onConfirm,
}) => {
    const { t } = useTranslation();
    const { page, invitee } = data;
    const email = details.email.trim() || invitee?.email_hint || null;

    return (
        <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3 rounded-xl bg-surface-secondary/80 p-4">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t("booking.review.when")}</h3>
                    <Button size="sm" variant="tertiary" onPress={onEditTime} isDisabled={isSubmitting}>
                        {t("common.change")}
                    </Button>
                </div>
                <BookingSummaryList
                    data={{
                        start_at: slot.start,
                        end_at: slot.end,
                        timezone,
                        duration_minutes: duration,
                        location_type: page.location_type,
                        location_details: page.location_details,
                        team_member: memberName,
                    }}
                />
            </section>

            <section className="flex flex-col gap-3 rounded-xl bg-surface-secondary/80 p-4">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t("booking.review.yourDetails")}</h3>
                    <Button size="sm" variant="tertiary" onPress={onBack} isDisabled={isSubmitting}>
                        {t("common.edit")}
                    </Button>
                </div>
                <dl className="flex flex-col gap-2 text-sm">
                    <DetailRow label={t("booking.review.name")} value={details.name} />
                    {email ? <DetailRow label={t("booking.review.email")} value={email} /> : null}
                    {details.phone.trim() ? <DetailRow label={t("booking.review.phone")} value={details.phone} /> : null}
                    {details.company.trim() ? <DetailRow label={t("booking.form.company")} value={details.company} /> : null}
                    {page.questions.map((question) => {
                        const value = details.answers[question.id];
                        if (question.type === BookingQuestionTypes.CHECKBOX) {
                            return <DetailRow key={question.id} label={question.label} value={value ? t("common.yes") : t("common.no")} />;
                        }
                        return typeof value === "string" && value.trim() ? (
                            <DetailRow key={question.id} label={question.label} value={value} />
                        ) : null;
                    })}
                    {details.notes.trim() ? <DetailRow label={t("booking.review.notes")} value={details.notes} /> : null}
                </dl>
            </section>

            {page.requires_confirmation ? (
                <p className="text-sm text-muted">
                    {t("booking.review.needsApproval")}
                </p>
            ) : null}

            {errorMessage ? (
                <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>{t("booking.review.errorTitle")}</Alert.Title>
                        <Alert.Description>{errorMessage}</Alert.Description>
                    </Alert.Content>
                </Alert>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="tertiary" onPress={onBack} isDisabled={isSubmitting}>
                    <ArrowLeft className="size-4" aria-hidden />
                    {t("common.back")}
                </Button>
                <ActionButtonWithPending
                    variant="primary"
                    isPending={isSubmitting}
                    isDisabled={isSubmitting}
                    onPress={onConfirm}
                >
                    {page.requires_confirmation ? t("booking.review.requestBooking") : t("booking.review.confirmBooking")}
                </ActionButtonWithPending>
            </div>
        </div>
    );
};
