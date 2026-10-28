import type { FC } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Button, Checkbox, Input, TextArea } from "@heroui/react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { BookingQuestionTypes } from "@/features/bookings/interfaces/bookings.interfaces";
import type { BookingPageFormValues, BookingQuestionFormValues } from "@/pages/dashboard/pages/booking-pages/pages/detail/validation-schemas/booking-page.schema";
import { questionIdFromLabel } from "@/pages/dashboard/pages/booking-pages/pages/detail/utils/booking-page-form";
import { Field, SimpleSelect } from "./form-fields";

const QUESTION_TYPE_OPTIONS = [
    { id: BookingQuestionTypes.TEXT, label: "Short text" },
    { id: BookingQuestionTypes.TEXTAREA, label: "Long text" },
    { id: BookingQuestionTypes.SELECT, label: "Dropdown" },
    { id: BookingQuestionTypes.CHECKBOX, label: "Checkbox" },
];

/** Unique id derived from the label, suffixed when another question already uses it. */
function uniqueQuestionId(label: string, others: BookingQuestionFormValues[]): string {
    const base = questionIdFromLabel(label);
    const taken = new Set(others.map((q) => q.id));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}_${n}`)) n += 1;
    return `${base}_${n}`;
}

interface QuestionsEditorProps {
    readOnly: boolean;
}

export const QuestionsEditor: FC<QuestionsEditorProps> = ({ readOnly }) => {
    const { control, getValues, setValue, watch, formState } = useFormContext<BookingPageFormValues>();
    const questions = watch("questions");
    // Questions carry their own `id`, so the array row key must use another attribute.
    const { fields, append, remove, move } = useFieldArray({ control, name: "questions", keyName: "row_key" });
    const errors = formState.errors.questions;

    const addQuestion = () => {
        const id = uniqueQuestionId("question", getValues("questions"));
        append({ id, label: "", type: BookingQuestionTypes.TEXT, required: false, options: [] });
    };

    return (
        <div className="space-y-3">
            {fields.length === 0 ? (
                <p className="text-sm text-muted">No extra questions. Invitees only leave their name, email and an optional note.</p>
            ) : null}
            {fields.map((row, index) => {
                const rowErrors = errors?.[index];
                return (
                    <div key={row.row_key} className="space-y-3 rounded-xl border border-border/80 bg-surface-secondary/20 p-3">
                        <div className="flex items-start gap-2">
                            <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                                <Field label={`Question ${index + 1}`} required error={rowErrors?.label?.message ?? rowErrors?.id?.message}>
                                    <Controller
                                        control={control}
                                        name={`questions.${index}.label`}
                                        render={({ field }) => (
                                            <Input
                                                aria-label={`Question ${index + 1} label`}
                                                value={field.value}
                                                onChange={(e) => {
                                                    field.onChange(e.target.value);
                                                    const others = getValues("questions").filter((_, i) => i !== index);
                                                    setValue(`questions.${index}.id`, uniqueQuestionId(e.target.value, others), {
                                                        shouldDirty: true,
                                                    });
                                                }}
                                                onBlur={field.onBlur}
                                                disabled={readOnly}
                                                placeholder="e.g. What would you like to discuss?"
                                                fullWidth
                                            />
                                        )}
                                    />
                                </Field>
                                <Field label="Type">
                                    <Controller
                                        control={control}
                                        name={`questions.${index}.type`}
                                        render={({ field }) => (
                                            <SimpleSelect
                                                aria-label={`Question ${index + 1} type`}
                                                options={QUESTION_TYPE_OPTIONS}
                                                value={field.value}
                                                onChange={(v) => field.onChange(v as BookingQuestionFormValues["type"])}
                                                isDisabled={readOnly}
                                                className="sm:max-w-none"
                                            />
                                        )}
                                    />
                                </Field>
                            </div>
                            {!readOnly ? (
                                <div className="flex shrink-0 flex-col gap-1 pt-6 sm:flex-row">
                                    <Button size="sm" variant="tertiary" aria-label="Move up" isDisabled={index === 0} onPress={() => move(index, index - 1)}>
                                        <ArrowUp className="size-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="tertiary"
                                        aria-label="Move down"
                                        isDisabled={index === fields.length - 1}
                                        onPress={() => move(index, index + 1)}
                                    >
                                        <ArrowDown className="size-4" />
                                    </Button>
                                    <Button size="sm" variant="tertiary" aria-label="Remove question" onPress={() => remove(index)}>
                                        <Trash2 className="size-4 text-danger" />
                                    </Button>
                                </div>
                            ) : null}
                        </div>

                        {questions[index]?.type === BookingQuestionTypes.SELECT ? (
                            <Controller
                                control={control}
                                name={`questions.${index}.options`}
                                render={({ field }) => (
                                    <Field label="Options" required error={rowErrors?.options?.message} description="One option per line.">
                                        <TextArea
                                            aria-label={`Question ${index + 1} options`}
                                            rows={3}
                                            value={field.value.join("\n")}
                                            onChange={(e) => field.onChange(e.target.value.split("\n"))}
                                            placeholder={"Option one\nOption two"}
                                            disabled={readOnly}
                                            fullWidth
                                        />
                                    </Field>
                                )}
                            />
                        ) : null}

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Controller
                                control={control}
                                name={`questions.${index}.required`}
                                render={({ field }) => (
                                    <Checkbox isSelected={field.value} onChange={(checked: boolean) => field.onChange(checked)} isDisabled={readOnly}>
                                        <Checkbox.Control>
                                            <Checkbox.Indicator />
                                        </Checkbox.Control>
                                        <span className="text-sm text-foreground">Required</span>
                                    </Checkbox>
                                )}
                            />
                            <Controller
                                control={control}
                                name={`questions.${index}.id`}
                                render={({ field }) => (
                                    <span className="text-[11px] text-muted">
                                        Answer key <span className="font-mono">{field.value}</span>
                                    </span>
                                )}
                            />
                        </div>
                    </div>
                );
            })}
            {!readOnly ? (
                <Button size="sm" variant="secondary" onPress={addQuestion}>
                    <Plus className="size-3.5" />
                    Add question
                </Button>
            ) : null}
        </div>
    );
};
