import { useMemo, type FC } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Button } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";
import { BookingAssignmentModes } from "@/features/bookings/interfaces/bookings.interfaces";
import type { OrganisationMember } from "@/features/organisations/interfaces/organisation.interfaces";
import { DashboardAvatar } from "@/pages/dashboard/components/dashboard-shared";
import type { BookingPageFormValues } from "@/pages/dashboard/pages/booking-pages/pages/detail/validation-schemas/booking-page.schema";
import { Field, NumberInput, SettingSwitch, SettingsSection } from "./form-fields";

const ASSIGNMENT_MODES: { id: BookingPageFormValues["assignment_mode"]; label: string; description: string }[] = [
    {
        id: BookingAssignmentModes.ROUND_ROBIN,
        label: "Round robin",
        description:
            "Bookings rotate between free members: whoever was assigned least recently gets the next one. Priority breaks ties.",
    },
    {
        id: BookingAssignmentModes.LEAST_BUSY,
        label: "Least busy",
        description:
            "The free member with the fewest bookings that day gets it. Priority, then rotation, break ties.",
    },
];

interface TeamTabProps {
    readOnly: boolean;
    members: OrganisationMember[];
}

export const TeamTab: FC<TeamTabProps> = ({ readOnly, members }) => {
    const { control, formState } = useFormContext<BookingPageFormValues>();
    const membersError = formState.errors.members;

    const memberByUuid = useMemo(() => new Map(members.map((m) => [m.user_uuid, m])), [members]);
    const memberOptions = useMemo(
        () => members.map((m) => ({ value: m.user_uuid, label: m.full_name?.trim() ? `${m.full_name} (${m.email})` : m.email })),
        [members],
    );

    return (
        <div className="space-y-4">
            <SettingsSection
                title="Team members"
                description="Who can take bookings from this page. Slots are offered when at least one of them is free, based on their own availability, blocked time and Google Calendar."
            >
                <Controller
                    control={control}
                    name="members"
                    render={({ field }) => {
                        const value = field.value;
                        const setUuids = (uuids: string[]) =>
                            field.onChange(
                                uuids.map((uuid) => value.find((m) => m.user_uuid === uuid) ?? { user_uuid: uuid, priority: 0 }),
                            );
                        return (
                            <div className="space-y-3">
                                {!readOnly ? (
                                    <Field label="Eligible members" required>
                                        <MultiSelect
                                            aria-label="Eligible members"
                                            options={memberOptions}
                                            value={value.map((m) => m.user_uuid)}
                                            onChange={setUuids}
                                            placeholder="Select members…"
                                            searchPlaceholder="Search members…"
                                        />
                                    </Field>
                                ) : null}
                                {value.length === 0 ? (
                                    <p className="text-sm text-muted">No members yet.</p>
                                ) : (
                                    <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
                                        {value.map((row, index) => {
                                            const member = memberByUuid.get(row.user_uuid);
                                            const name = member?.full_name?.trim() || member?.email || "Former member";
                                            return (
                                                <li key={row.user_uuid} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                                                    <DashboardAvatar name={name} />
                                                    <div className="min-w-0 flex-1">
                                                        <p className={cn("text-sm truncate", member ? "text-foreground" : "text-muted")}>{name}</p>
                                                        {member?.full_name ? <p className="text-xs text-muted truncate">{member.email}</p> : null}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-muted">Priority</span>
                                                        <NumberInput
                                                            aria-label={`Priority of ${name}`}
                                                            value={row.priority}
                                                            onChange={(p) => {
                                                                const next = [...value];
                                                                next[index] = { ...row, priority: p ?? 0 };
                                                                field.onChange(next);
                                                            }}
                                                            minValue={0}
                                                            maxValue={100}
                                                            isDisabled={readOnly}
                                                        />
                                                    </div>
                                                    {!readOnly ? (
                                                        <Button
                                                            size="sm"
                                                            variant="tertiary"
                                                            aria-label={`Remove ${name}`}
                                                            onPress={() => field.onChange(value.filter((m) => m.user_uuid !== row.user_uuid))}
                                                        >
                                                            <Trash2 className="size-4 text-danger" />
                                                        </Button>
                                                    ) : null}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                <p className="text-xs text-muted">
                                    Priority 0 to 100. When several members are equally suitable, the higher number gets the booking.
                                </p>
                                {membersError ? (
                                    <p className="text-xs text-danger">
                                        {membersError.message ?? membersError.root?.message ?? "Check the member list"}
                                    </p>
                                ) : null}
                            </div>
                        );
                    }}
                />
            </SettingsSection>

            <SettingsSection title="Assignment" description="How a booking is given to one member when several are free at the chosen time.">
                <Controller
                    control={control}
                    name="assignment_mode"
                    render={({ field }) => (
                        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Assignment mode">
                            {ASSIGNMENT_MODES.map((mode) => {
                                const selected = field.value === mode.id;
                                return (
                                    <button
                                        key={mode.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        disabled={readOnly}
                                        onClick={() => field.onChange(mode.id)}
                                        className={cn(
                                            "rounded-xl border p-3 text-left transition-colors duration-200",
                                            selected ? "border-accent/60 bg-accent/10" : "border-border bg-surface-secondary/20",
                                            !readOnly && !selected && "hover:bg-surface-secondary cursor-pointer",
                                        )}
                                    >
                                        <p className="text-sm font-semibold text-foreground">{mode.label}</p>
                                        <p className="mt-1 text-xs text-muted">{mode.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                />
                <Controller
                    control={control}
                    name="allow_invitee_member_choice"
                    render={({ field }) => (
                        <SettingSwitch
                            label="Let invitees pick a team member"
                            description={
                                field.value
                                    ? "Invitees see the member list and can choose who they meet. Picking no one falls back to automatic assignment."
                                    : "Off: assignment is internal only. Invitees just pick a time and the booking goes to a free member automatically."
                            }
                            isSelected={field.value}
                            onChange={field.onChange}
                            isDisabled={readOnly}
                        />
                    )}
                />
            </SettingsSection>
        </div>
    );
};
