import { z } from "zod";
import { periodsError, timeToMinutes } from "@/pages/dashboard/pages/availability/utils/time-ranges";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const timeRangeSchema = z.object({
    start: z.string().regex(TIME, "Invalid time"),
    end: z.string().regex(TIME, "Invalid time"),
});

const dayHoursSchema = z
    .object({
        day: z.number().int().min(1).max(7),
        enabled: z.boolean(),
        periods: z.array(timeRangeSchema),
    })
    .superRefine((d, ctx) => {
        if (!d.enabled) return;
        if (d.periods.length === 0) {
            ctx.addIssue({ code: "custom", path: ["periods"], message: "Add a period or mark the day unavailable" });
            return;
        }
        const error = periodsError(d.periods);
        if (error) ctx.addIssue({ code: "custom", path: ["periods"], message: error });
    });

export const weeklyScheduleSchema = z.object({
    timezone: z.string().min(1, "Select a timezone"),
    days: z.array(dayHoursSchema).length(7),
});

export type WeeklyScheduleFormValues = z.infer<typeof weeklyScheduleSchema>;

export const dateOverrideSchema = z
    .object({
        date: z.string().regex(DATE, "Pick a date"),
        unavailable: z.boolean(),
        intervals: z.array(timeRangeSchema),
        reason: z.string().max(200),
    })
    .superRefine((v, ctx) => {
        if (v.unavailable) return;
        if (v.intervals.length === 0) {
            ctx.addIssue({ code: "custom", path: ["intervals"], message: "Add at least one period" });
            return;
        }
        const error = periodsError(v.intervals);
        if (error) ctx.addIssue({ code: "custom", path: ["intervals"], message: error });
    });

export type DateOverrideFormValues = z.infer<typeof dateOverrideSchema>;

export const bookingBlockSchema = z
    .object({
        /** Member uuid, or "" for everyone (admins only). */
        user_uuid: z.string(),
        all_day: z.boolean(),
        start_date: z.string().regex(DATE, "Pick a start date"),
        start_time: z.string().regex(TIME, "Invalid time"),
        end_date: z.string().regex(DATE, "Pick an end date"),
        end_time: z.string().regex(TIME, "Invalid time"),
        reason: z.string().max(200),
    })
    .superRefine((v, ctx) => {
        if (!DATE.test(v.start_date) || !DATE.test(v.end_date)) return;
        const startKey = v.all_day ? `${v.start_date} 00:00` : `${v.start_date} ${v.start_time}`;
        const endKey = v.all_day ? `${v.end_date} 24:00` : `${v.end_date} ${v.end_time}`;
        const sameDay = v.start_date === v.end_date;
        const invalid =
            v.end_date < v.start_date ||
            (sameDay && !v.all_day && timeToMinutes(v.end_time) <= timeToMinutes(v.start_time)) ||
            startKey >= endKey;
        if (invalid) ctx.addIssue({ code: "custom", path: ["end_date"], message: "The end must be after the start" });
    });

export type BookingBlockFormValues = z.infer<typeof bookingBlockSchema>;
