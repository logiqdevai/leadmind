import { useMemo, type FC, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Button,
    Checkbox,
    Description,
    FieldError,
    Form,
    Input,
    Label,
    ListBox,
    Select,
    TextArea,
} from "@heroui/react";
import { ArrowLeft, ArrowRight, Building2, FileText, Mail, Phone, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BookingQuestionTypes, type PublicBookingPage } from "@/features/bookings/interfaces/bookings.interfaces";
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
    /** Chosen date and time, shown at the top of the form panel. */
    summary?: ReactNode;
}

/** Input with a leading icon, as in the booking page design. */
const WithIcon: FC<{
    icon: ReactNode;
    className?: string;
    children: ReactNode;
}> = ({ icon, className, children }) => (
    <div className={`relative ${className ?? ""}`}>
        <span className="pointer-events-none absolute left-3.5 top-3 z-10 text-muted [&>svg]:size-5">{icon}</span>
        {children}
    </div>
);

const ICON_INPUT = "pl-11";

const RequiredMark: FC = () => (
    <span className="text-danger" aria-hidden>
        {" "}
        *
    </span>
);

export const BookingDetailsForm: FC<BookingDetailsFormProps> = ({ data, defaultValues, onSubmit, onBack, summary }) => {
    const { t, i18n } = useTranslation();
    const { page, invitee } = data;
    const emailOptional = !!invitee;
    const schema = useMemo(
        () =>
            createBookingDetailsSchema({
                emailOptional,
                requirePhone: page.require_phone,
                questions: page.questions,
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild messages when the language changes
        [emailOptional, page.require_phone, page.questions, i18n.language],
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
            <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface-secondary/70 p-4 sm:p-5">
                {summary}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <Label htmlFor="booking-name">
                            {t("booking.form.name")}
                            <RequiredMark />
                        </Label>
                        <WithIcon icon={<User aria-hidden />}>
                            <Input
                                id="booking-name"
                                className={ICON_INPUT}
                                {...register("name")}
                                autoComplete="name"
                                placeholder={t("booking.form.namePlaceholder")}
                                aria-invalid={!!errors.name}
                                fullWidth
                            />
                        </WithIcon>
                        {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="booking-email">
                            {t("booking.form.email")}
                            {emailOptional ? null : <RequiredMark />}
                        </Label>
                        <WithIcon icon={<Mail aria-hidden />}>
                            <Input
                                id="booking-email"
                                className={ICON_INPUT}
                                type="email"
                                {...register("email")}
                                autoComplete="email"
                                placeholder="name@example.com"
                                aria-invalid={!!errors.email}
                                aria-describedby={emailOptional ? "booking-email-hint" : undefined}
                                fullWidth
                            />
                        </WithIcon>
                        {emailOptional ? (
                            <Description id="booking-email-hint">
                                {invitee?.email_hint
                                    ? t("booking.form.emailHintWith", {
                                          email: invitee.email_hint,
                                      })
                                    : t("booking.form.emailHint")}
                            </Description>
                        ) : null}
                        {errors.email ? <FieldError>{errors.email.message}</FieldError> : null}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="booking-phone">
                            {t("booking.form.phone")}
                            {page.require_phone ? <RequiredMark /> : null}
                        </Label>
                        <WithIcon icon={<Phone aria-hidden />}>
                            <Input
                                id="booking-phone"
                                className={ICON_INPUT}
                                type="tel"
                                {...register("phone")}
                                autoComplete="tel"
                                placeholder={t("booking.form.phonePlaceholder")}
                                aria-invalid={!!errors.phone}
                                fullWidth
                            />
                        </WithIcon>
                        {errors.phone ? <FieldError>{errors.phone.message}</FieldError> : null}
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <Label htmlFor="booking-company">{t("booking.form.company")}</Label>
                        <WithIcon icon={<Building2 aria-hidden />}>
                            <Input
                                id="booking-company"
                                className={ICON_INPUT}
                                {...register("company")}
                                autoComplete="organization"
                                placeholder={t("booking.form.companyPlaceholder")}
                                aria-invalid={!!errors.company}
                                fullWidth
                            />
                        </WithIcon>
                        {errors.company ? <FieldError>{errors.company.message}</FieldError> : null}
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
                                                placeholder={t("booking.form.chooseOption")}
                                                value={
                                                    typeof field.value === "string" && field.value ? field.value : null
                                                }
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
                        <Label htmlFor="booking-notes">{t("booking.form.notes")}</Label>
                        <WithIcon icon={<FileText aria-hidden />}>
                            <TextArea
                                id="booking-notes"
                                className={ICON_INPUT}
                                rows={4}
                                {...register("notes")}
                                placeholder={t("booking.form.notesPlaceholder")}
                                aria-invalid={!!errors.notes}
                                fullWidth
                            />
                        </WithIcon>
                        {errors.notes ? <FieldError>{errors.notes.message}</FieldError> : null}
                    </div>
                </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="secondary" size="lg" className="rounded-full" onPress={onBack}>
                    <ArrowLeft className="size-4" aria-hidden />
                    {t("common.back")}
                </Button>
                <Button type="submit" variant="primary" size="lg" className="rounded-full">
                    {t("booking.form.reviewBooking")}
                    <ArrowRight className="size-4" aria-hidden />
                </Button>
            </div>
        </Form>
    );
};
