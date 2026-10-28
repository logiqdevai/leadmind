import { z } from "zod";
import i18n from "@/lib/i18n";
import {
    BookingQuestionTypes,
    type BookingQuestion,
} from "@/features/bookings/interfaces/bookings.interfaces";

export interface BookingDetailsSchemaOptions {
    /** Contact-specific links already know the email, so it may be left empty. */
    emailOptional: boolean;
    requirePhone: boolean;
    questions: BookingQuestion[];
}

type AnswerSchema = z.ZodType<string | boolean, string | boolean>;

const answerSchema = (question: BookingQuestion): AnswerSchema => {
    const required = !!question.required;
    switch (question.type) {
        case BookingQuestionTypes.CHECKBOX:
            return z.boolean().refine((v) => !required || v, { message: i18n.t("booking.validation.checkBox") });
        case BookingQuestionTypes.SELECT: {
            const options = question.options ?? [];
            return z.string().refine((v) => (v === "" ? !required : options.includes(v)), {
                message: required ? i18n.t("booking.validation.chooseOption") : i18n.t("booking.validation.chooseListed"),
            });
        }
        default:
            return z
                .string()
                .trim()
                .max(5000, i18n.t("booking.validation.maxAnswer"))
                .refine((v) => !required || v.length > 0, { message: i18n.t("booking.validation.required") });
    }
};

export const createBookingDetailsSchema = ({ emailOptional, requirePhone, questions }: BookingDetailsSchemaOptions) => {
    const answers: Record<string, AnswerSchema> = {};
    for (const question of questions) answers[question.id] = answerSchema(question);

    return z.object({
        name: z.string().trim().min(1, i18n.t("booking.validation.nameRequired")).max(200, i18n.t("booking.validation.nameMax")),
        email: z
            .string()
            .trim()
            .max(320, i18n.t("booking.validation.emailMax"))
            .superRefine((value, ctx) => {
                if (!value) {
                    if (!emailOptional) ctx.addIssue({ code: "custom", message: i18n.t("booking.validation.emailRequired") });
                    return;
                }
                if (!z.email().safeParse(value).success) {
                    ctx.addIssue({ code: "custom", message: i18n.t("booking.validation.emailInvalid") });
                }
            }),
        phone: z
            .string()
            .trim()
            .max(50, i18n.t("booking.validation.phoneMax"))
            .refine((v) => !requirePhone || v.length > 0, { message: i18n.t("booking.validation.phoneRequired") }),
        company: z.string().trim().max(200, i18n.t("booking.validation.companyMax")),
        notes: z.string().trim().max(5000, i18n.t("booking.validation.notesMax")),
        answers: z.object(answers),
    });
};

export type BookingDetailsFormValues = z.infer<ReturnType<typeof createBookingDetailsSchema>>;

export const createCancelBookingSchema = (reasonRequired: boolean) =>
    z.object({
        reason: z
            .string()
            .trim()
            .max(2000, i18n.t("booking.validation.reasonMax"))
            .refine((v) => !reasonRequired || v.length > 0, { message: i18n.t("booking.validation.reasonRequired") }),
    });

export type CancelBookingFormValues = z.infer<ReturnType<typeof createCancelBookingSchema>>;
