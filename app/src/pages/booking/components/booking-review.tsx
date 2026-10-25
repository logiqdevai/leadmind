import type { FC } from "react";
import { Alert, Button } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
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
    const { page, invitee } = data;
    const email = details.email.trim() || invitee?.email_hint || null;

    return (
        <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3 rounded-xl bg-surface-secondary/50 p-4">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">When</h3>
                    <Button size="sm" variant="tertiary" onPress={onEditTime} isDisabled={isSubmitting}>
                        Change
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

            <section className="flex flex-col gap-3 rounded-xl bg-surface-secondary/50 p-4">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Your details</h3>
                    <Button size="sm" variant="tertiary" onPress={onBack} isDisabled={isSubmitting}>
                        Edit
                    </Button>
                </div>
                <dl className="flex flex-col gap-2 text-sm">
                    <DetailRow label="Name" value={details.name} />
                    {email ? <DetailRow label="Email" value={email} /> : null}
                    {details.phone.trim() ? <DetailRow label="Phone" value={details.phone} /> : null}
                    {page.questions.map((question) => {
                        const value = details.answers[question.id];
                        if (question.type === BookingQuestionTypes.CHECKBOX) {
                            return <DetailRow key={question.id} label={question.label} value={value ? "Yes" : "No"} />;
                        }
                        return typeof value === "string" && value.trim() ? (
                            <DetailRow key={question.id} label={question.label} value={value} />
                        ) : null;
                    })}
                    {details.notes.trim() ? <DetailRow label="Notes" value={details.notes} /> : null}
                </dl>
            </section>

            {page.requires_confirmation ? (
                <p className="text-sm text-muted">
                    This booking needs to be approved. You will get an email once it is confirmed.
                </p>
            ) : null}

            {errorMessage ? (
                <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>Booking not completed</Alert.Title>
                        <Alert.Description>{errorMessage}</Alert.Description>
                    </Alert.Content>
                </Alert>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="tertiary" onPress={onBack} isDisabled={isSubmitting}>
                    <ArrowLeft className="size-4" aria-hidden />
                    Back
                </Button>
                <ActionButtonWithPending
                    variant="primary"
                    isPending={isSubmitting}
                    isDisabled={isSubmitting}
                    onPress={onConfirm}
                >
                    {page.requires_confirmation ? "Request booking" : "Confirm booking"}
                </ActionButtonWithPending>
            </div>
        </div>
    );
};
