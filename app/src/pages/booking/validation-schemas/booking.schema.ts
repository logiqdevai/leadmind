import { z } from "zod";
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
            return z.boolean().refine((v) => !required || v, { message: "Please check this box to continue" });
        case BookingQuestionTypes.SELECT: {
            const options = question.options ?? [];
            return z.string().refine((v) => (v === "" ? !required : options.includes(v)), {
                message: required ? "Please choose an option" : "Please choose one of the listed options",
            });
        }
        default:
            return z
                .string()
                .trim()
                .max(5000, "Please keep this under 5000 characters")
                .refine((v) => !required || v.length > 0, { message: "This field is required" });
    }
};

export const createBookingDetailsSchema = ({ emailOptional, requirePhone, questions }: BookingDetailsSchemaOptions) => {
    const answers: Record<string, AnswerSchema> = {};
    for (const question of questions) answers[question.id] = answerSchema(question);

    return z.object({
        name: z.string().trim().min(1, "Please enter your name").max(200, "Please keep your name under 200 characters"),
        email: z
            .string()
            .trim()
            .max(320, "Please keep your email under 320 characters")
            .superRefine((value, ctx) => {
                if (!value) {
                    if (!emailOptional) ctx.addIssue({ code: "custom", message: "Please enter your email" });
                    return;
                }
                if (!z.email().safeParse(value).success) {
                    ctx.addIssue({ code: "custom", message: "Please enter a valid email address" });
                }
            }),
        phone: z
            .string()
            .trim()
            .max(50, "Please keep your phone number under 50 characters")
            .refine((v) => !requirePhone || v.length > 0, { message: "Please enter your phone number" }),
        notes: z.string().trim().max(5000, "Please keep your notes under 5000 characters"),
        answers: z.object(answers),
    });
};

export type BookingDetailsFormValues = z.infer<ReturnType<typeof createBookingDetailsSchema>>;

export const createCancelBookingSchema = (reasonRequired: boolean) =>
    z.object({
        reason: z
            .string()
            .trim()
            .max(2000, "Please keep the reason under 2000 characters")
            .refine((v) => !reasonRequired || v.length > 0, { message: "Please tell us why you are cancelling" }),
    });

export type CancelBookingFormValues = z.infer<ReturnType<typeof createCancelBookingSchema>>;
