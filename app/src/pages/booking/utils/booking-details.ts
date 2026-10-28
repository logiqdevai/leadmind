import {
    BookingQuestionTypes,
    type PublicBookingPage,
    type PublicCreateBookingDto,
} from "@/features/bookings/interfaces/bookings.interfaces";
import type { BookingDetailsFormValues } from "@/pages/booking/validation-schemas/booking.schema";

export const buildDefaultDetails = (data: PublicBookingPage): BookingDetailsFormValues => ({
    name: data.invitee?.name ?? "",
    email: "",
    phone: "",
    company: "",
    notes: "",
    answers: Object.fromEntries(
        data.page.questions.map((q) => [q.id, q.type === BookingQuestionTypes.CHECKBOX ? false : ""]),
    ),
});

/** Form values -> API payload fields (empty optional values are omitted). */
export const toBookingPayloadDetails = (
    data: PublicBookingPage,
    values: BookingDetailsFormValues,
): Pick<PublicCreateBookingDto, "name" | "email" | "phone" | "company" | "notes" | "answers"> => {
    const answers: Record<string, string | boolean> = {};
    for (const question of data.page.questions) {
        const value = values.answers[question.id];
        if (typeof value === "boolean") answers[question.id] = value;
        else if (typeof value === "string" && value.trim()) answers[question.id] = value.trim();
    }
    return {
        name: values.name.trim(),
        email: values.email.trim() || undefined,
        phone: values.phone.trim() || undefined,
        company: values.company.trim() || undefined,
        notes: values.notes.trim() || undefined,
        answers: Object.keys(answers).length > 0 ? answers : undefined,
    };
};
