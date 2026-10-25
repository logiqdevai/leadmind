import { useMemo, type FC } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Checkbox, Description, FieldError, Form, Input, Label, ListBox, Select, TextArea } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import {
    BookingQuestionTypes,
    type PublicBookingPage,
} from "@/features/bookings/interfaces/bookings.interfaces";
import {
    createBookingDetailsSchema,
    type BookingDetailsFormValues,
} from "@/pages/booking/validation-schemas/booking.schema";
import { buildDefaultDetails } from "@/pages/booking/utils/booking-details";

interface BookingDetailsFormProps {
    data: PublicBookingPage;
    defaultValues: BookingDetailsFormValues | null;
    onSubmit: (values: BookingDetailsFormValues) => void;
    onBack: () => void;
}

const RequiredMark: FC = () => (
    <span className="text-danger" aria-hidden>
        {" "}
        *
    </span>
);

export const BookingDetailsForm: FC<BookingDetailsFormProps> = ({ data, defaultValues, onSubmit, onBack }) => {
    const { page, invitee } = data;
    const emailOptional = !!invitee;
    const schema = useMemo(
        () =>
            createBookingDetailsSchema({
                emailOptional,
                requirePhone: page.require_phone,
                questions: page.questions,
            }),
        [emailOptional, page.require_phone, page.questions],
    );

    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<BookingDetailsFormValues>({
        resolver: zodResolver(schema),
        defaultValues: defaultValues ?? buildDefaultDetails(data),
    });

    const answerError = (id: string) => errors.answers?.[id]?.message;

    return (
        <Form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" validationBehavior="aria">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="booking-name">
                        Full name
                        <RequiredMark />
                    </Label>
                    <Input
                        id="booking-name"
                        {...register("name")}
                        autoComplete="name"
                        placeholder="Jane Doe"
                        aria-invalid={!!errors.name}
                        fullWidth
                    />
                    {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="booking-email">
                        Email
                        {emailOptional ? null : <RequiredMark />}
                    </Label>
                    <Input
                        id="booking-email"
                        type="email"
                        {...register("email")}
                        autoComplete="email"
                        placeholder="name@example.com"
                        aria-invalid={!!errors.email}
                        aria-describedby={emailOptional ? "booking-email-hint" : undefined}
                        fullWidth
                    />
                    {emailOptional ? (
                        <Description id="booking-email-hint">
                            {invitee?.email_hint
                                ? `Leave empty to use ${invitee.email_hint}`
                                : "Leave empty to use the email we already have"}
                        </Description>
                    ) : null}
                    {errors.email ? <FieldError>{errors.email.message}</FieldError> : null}
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="booking-phone">
                        Phone
                        {page.require_phone ? <RequiredMark /> : null}
                    </Label>
                    <Input
                        id="booking-phone"
                        type="tel"
                        {...register("phone")}
                        autoComplete="tel"
                        placeholder="+30 690 000 0000"
                        aria-invalid={!!errors.phone}
                        fullWidth
                    />
                    {errors.phone ? <FieldError>{errors.phone.message}</FieldError> : null}
                </div>

                {page.questions.map((question) => {
                    const fieldId = `booking-q-${question.id}`;
                    const error = answerError(question.id);

                    if (question.type === BookingQuestionTypes.CHECKBOX) {
                        return (
                            <div key={question.id} className="flex flex-col gap-1.5 sm:col-span-2">
                                <Controller
                                    control={control}
                                    name={`answers.${question.id}`}
                                    render={({ field }) => (
                                        <Checkbox
                                            isSelected={field.value === true}
                                            onChange={(checked: boolean) => field.onChange(checked)}
                                            onBlur={field.onBlur}
                                            isInvalid={!!error}
                                        >
                                            <Checkbox.Control>
                                                <Checkbox.Indicator />
                                            </Checkbox.Control>
                                            <span className="text-sm text-foreground">
                                                {question.label}
                                                {question.required ? <RequiredMark /> : null}
                                            </span>
                                        </Checkbox>
                                    )}
                                />
                                {error ? <FieldError>{error}</FieldError> : null}
                            </div>
                        );
                    }

                    if (question.type === BookingQuestionTypes.SELECT) {
                        return (
                            <div key={question.id} className="flex flex-col gap-1.5 sm:col-span-2">
                                <Label id={`${fieldId}-label`}>
                                    {question.label}
                                    {question.required ? <RequiredMark /> : null}
                                </Label>
                                <Controller
                                    control={control}
                                    name={`answers.${question.id}`}
                                    render={({ field }) => (
                                        <Select
                                            aria-labelledby={`${fieldId}-label`}
                                            placeholder="Choose an option"
                                            value={typeof field.value === "string" && field.value ? field.value : null}
                                            onChange={(key) => field.onChange(key == null ? "" : String(key))}
                                            onBlur={field.onBlur}
                                            isInvalid={!!error}
                                            fullWidth
                                        >
                                            <Select.Trigger>
                                                <Select.Value />
                                                <Select.Indicator />
                                            </Select.Trigger>
                                            <Select.Popover>
                                                <ListBox>
                                                    {(question.options ?? []).map((option) => (
                                                        <ListBox.Item key={option} id={option} textValue={option}>
                                                            {option}
                                                            <ListBox.ItemIndicator />
                                                        </ListBox.Item>
                                                    ))}
                                                </ListBox>
                                            </Select.Popover>
                                        </Select>
                                    )}
                                />
                                {error ? <FieldError>{error}</FieldError> : null}
                            </div>
                        );
                    }

                    return (
                        <div key={question.id} className="flex flex-col gap-1.5 sm:col-span-2">
                            <Label htmlFor={fieldId}>
                                {question.label}
                                {question.required ? <RequiredMark /> : null}
                            </Label>
                            {question.type === BookingQuestionTypes.TEXTAREA ? (
                                <TextArea
                                    id={fieldId}
                                    rows={3}
                                    {...register(`answers.${question.id}`)}
                                    aria-invalid={!!error}
                                    fullWidth
                                />
                            ) : (
                                <Input
                                    id={fieldId}
                                    {...register(`answers.${question.id}`)}
                                    aria-invalid={!!error}
                                    fullWidth
                                />
                            )}
                            {error ? <FieldError>{error}</FieldError> : null}
                        </div>
                    );
                })}

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="booking-notes">Anything you would like to share?</Label>
                    <TextArea
                        id="booking-notes"
                        rows={4}
                        {...register("notes")}
                        placeholder="Optional notes for the meeting"
                        aria-invalid={!!errors.notes}
                        fullWidth
                    />
                    {errors.notes ? <FieldError>{errors.notes.message}</FieldError> : null}
                </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="tertiary" onPress={onBack}>
                    <ArrowLeft className="size-4" aria-hidden />
                    Back
                </Button>
                <Button type="submit" variant="primary">
                    Review booking
                </Button>
            </div>
        </Form>
    );
};
