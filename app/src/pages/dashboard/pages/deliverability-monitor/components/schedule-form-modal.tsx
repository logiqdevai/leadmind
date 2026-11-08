import { useState } from "react";
import { Button, Checkbox, Input, Label, Modal } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { SearchSelect } from "@/components/ui/search-select";
import { useCurrentOrganisation } from "@/features/organisations/hooks/use-organisations";
import { OptionSelect, SwitchRow } from "@/components/bookings/booking-shared";
import { EmailAccountCombobox } from "@/features/messaging/components/email-account-combobox";
import type { EmailProviderTarget } from "@/features/integrations/interfaces/integrations.interface";
import type { SendableEmailAccount } from "@/features/integrations/utils/email-provider-utils";
import {
    useCreateDeliverabilitySchedules,
    useUpdateDeliverabilitySchedule,
} from "@/features/deliverability/hooks/use-deliverability";
import { allocationKey } from "@/features/integrations/utils/email-provider-utils";
import { X } from "lucide-react";
import type {
    DeliverabilityActionMode,
    DeliverabilityCheckType,
    DeliverabilityFrequency,
    DeliverabilitySchedule,
    DeliverabilitySchedulePayload,
} from "@/features/deliverability/interfaces/deliverability.interface";
import { cn } from "@/lib/utils";
import {
    ACTION_MODE_OPTIONS,
    CHECK_OPTIONS,
    DAY_OF_MONTH_OPTIONS,
    DEFAULT_CHECKS,
    FREQUENCY_OPTIONS,
    WEEKDAY_OPTIONS,
    timezoneOptionsFor,
} from "../utils/deliverability.utils";

interface ScheduleFormModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    accounts: SendableEmailAccount[];
    defaultTarget: EmailProviderTarget | null;
    /** When set, the modal edits this schedule instead of creating one. */
    schedule?: DeliverabilitySchedule | null;
}

type TargetMode = "integration" | "custom";

const DEFAULT_WARN = 70;
const DEFAULT_CRITICAL = 40;

const choiceClass = (active: boolean, disabled = false) =>
    cn(
        "rounded-md border px-3 py-2 text-left text-sm transition-colors",
        active
            ? "border-accent bg-accent/10 text-accent"
            : "border-border bg-surface text-foreground hover:bg-surface-secondary",
        disabled && "cursor-not-allowed opacity-50 hover:bg-surface",
    );

function scheduleTarget(schedule: DeliverabilitySchedule): EmailProviderTarget | null {
    if (!schedule.from_provider || !schedule.from_account) return null;
    return {
        provider: schedule.from_provider,
        account: schedule.from_account,
        ...(schedule.integration_account_domain_uuid
            ? { domain_uuid: schedule.integration_account_domain_uuid }
            : {}),
    };
}

export function ScheduleFormModal({
    isOpen,
    onOpenChange,
    accounts,
    defaultTarget,
    schedule,
}: ScheduleFormModalProps) {
    const isEditing = Boolean(schedule);
    const createSchedules = useCreateDeliverabilitySchedules();
    const updateSchedule = useUpdateDeliverabilitySchedule();
    const isPending = createSchedules.isPending || updateSchedule.isPending;
    const { data: organisation } = useCurrentOrganisation();

    // Mounted fresh for every open (see the page), so state is initialised from props, not reset in an effect.
    const existingTarget = schedule ? scheduleTarget(schedule) : null;
    const [label, setLabel] = useState(schedule?.label ?? "");
    const [mode, setMode] = useState<TargetMode>(schedule && !existingTarget ? "custom" : "integration");
    const [target, setTarget] = useState<EmailProviderTarget | null>(
        schedule ? existingTarget : defaultTarget,
    );
    const [customDomain, setCustomDomain] = useState(schedule && !existingTarget ? schedule.domain : "");
    // Creating can pick several accounts: one schedule with identical settings is made for each.
    const [targets, setTargets] = useState<EmailProviderTarget[]>(defaultTarget ? [defaultTarget] : []);
    const [targetTouched, setTargetTouched] = useState(false);
    const [dkimSelector, setDkimSelector] = useState(schedule?.dkim_selector ?? "");
    const [frequency, setFrequency] = useState<DeliverabilityFrequency>(schedule?.frequency ?? "DAILY");
    const [timeOfDay, setTimeOfDay] = useState(schedule?.time_of_day ?? "12:00");
    const [weekday, setWeekday] = useState(String(schedule?.weekday ?? 1));
    const [dayOfMonth, setDayOfMonth] = useState(String(schedule?.day_of_month ?? 1));
    const [intervalDays, setIntervalDays] = useState(String(schedule?.interval_days ?? 3));
    // New schedules default to the organisation's timezone.
    const [timezone, setTimezone] = useState(schedule?.timezone ?? organisation?.timezone ?? "UTC");
    const [checks, setChecks] = useState<DeliverabilityCheckType[]>(schedule?.checks ?? DEFAULT_CHECKS);
    const [actionMode, setActionMode] = useState<DeliverabilityActionMode>(
        schedule?.action_mode ?? "RECOMMEND",
    );
    const [warn, setWarn] = useState(String(schedule?.warn_threshold ?? DEFAULT_WARN));
    const [critical, setCritical] = useState(String(schedule?.critical_threshold ?? DEFAULT_CRITICAL));
    const [isActive, setIsActive] = useState(schedule?.is_active ?? true);
    const [error, setError] = useState<string | null>(null);

    const isCustom = mode === "custom";

    const switchMode = (next: TargetMode) => {
        setMode(next);
        setTargetTouched(true);
        if (next === "custom") {
            // A custom domain has no account to send a test email from or to throttle.
            setChecks((current) => current.filter((c) => c !== "MAIL_TESTER"));
            setActionMode("RECOMMEND");
        }
    };

    const toggleCheck = (id: DeliverabilityCheckType, selected: boolean) =>
        setChecks((current) =>
            selected ? [...new Set([...current, id])] : current.filter((c) => c !== id),
        );

    const handleSubmit = () => {
        const warnNum = Number(warn);
        const criticalNum = Number(critical);
        if (checks.length === 0) return setError("Select at least one check.");
        if (isCustom && !customDomain.trim()) return setError("Enter a domain to check.");
        if (!isCustom && !isEditing && targets.length === 0) return setError("Choose a sending account.");
        if (!isCustom && isEditing && !target) return setError("Choose a sending account.");
        if (!Number.isInteger(warnNum) || !Number.isInteger(criticalNum) || criticalNum >= warnNum) {
            return setError("The critical score must be lower than the healthy score.");
        }
        setError(null);

        const payload: DeliverabilitySchedulePayload = {
            label: label.trim(),
            dkim_selector: dkimSelector.trim(),
            frequency,
            time_of_day: timeOfDay,
            timezone,
            checks,
            action_mode: actionMode,
            warn_threshold: warnNum,
            critical_threshold: criticalNum,
            is_active: isActive,
            ...(frequency === "WEEKLY" ? { weekday: Number(weekday) } : {}),
            ...(frequency === "MONTHLY" ? { day_of_month: Number(dayOfMonth) } : {}),
            ...(frequency === "EVERY_N_DAYS" ? { interval_days: Number(intervalDays) } : {}),
        };
        const close = { onSuccess: () => onOpenChange(false) };
        if (!schedule) {
            // One schedule per selected account, all sharing the settings above.
            const payloads: DeliverabilitySchedulePayload[] = isCustom
                ? [{ ...payload, custom_domain: customDomain.trim() }]
                : targets.map((from) => ({ ...payload, from }));
            createSchedules.mutate(payloads, close);
            return;
        }

        // Re-sending the target re-resolves it server-side and lifts any sending restriction,
        // so an edit only sends it when the user actually changed it.
        if (targetTouched) {
            if (isCustom) payload.custom_domain = customDomain.trim();
            else payload.from = target!;
        }
        updateSchedule.mutate({ uuid: schedule.uuid, payload }, close);
    };

    const addTarget = (next: EmailProviderTarget) => {
        setTargetTouched(true);
        setTargets((current) =>
            current.some((t) => allocationKey(t) === allocationKey(next)) ? current : [...current, next],
        );
    };

    const removeTarget = (key: string) =>
        setTargets((current) => current.filter((t) => allocationKey(t) !== key));

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container scroll="inside">
                <Modal.Dialog className="sm:max-w-xl">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>
                            {isEditing ? "Edit deliverability check" : "New deliverability check"}
                        </Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="space-y-5">
                        <section className="space-y-3">
                            <div className="flex flex-col gap-1.5">
                                <Label>What to check</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        className={choiceClass(!isCustom)}
                                        onClick={() => switchMode("integration")}
                                    >
                                        <span className="font-medium">Sending account</span>
                                        <span className="block text-xs text-muted">
                                            A connected SMTP / Resend domain
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className={choiceClass(isCustom)}
                                        onClick={() => switchMode("custom")}
                                    >
                                        <span className="font-medium">Custom domain</span>
                                        <span className="block text-xs text-muted">
                                            Any domain, DNS checks only
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {isCustom ? (
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="deliv-domain">Domain</Label>
                                    <Input
                                        id="deliv-domain"
                                        placeholder="example.com"
                                        value={customDomain}
                                        onChange={(e) => {
                                            setCustomDomain(e.target.value);
                                            setTargetTouched(true);
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1.5">
                                    <Label>{isEditing ? "Send from" : "Send from (one or more)"}</Label>
                                    {isEditing ? (
                                        <EmailAccountCombobox
                                            accounts={accounts}
                                            value={target}
                                            onChange={(next) => {
                                                setTarget(next);
                                                setTargetTouched(true);
                                            }}
                                            placeholder="Choose an account…"
                                        />
                                    ) : (
                                        <>
                                            {/* Controlled to null so it acts as an "add" picker. */}
                                            <EmailAccountCombobox
                                                accounts={accounts}
                                                value={null}
                                                onChange={addTarget}
                                                placeholder={
                                                    targets.length ? "Add another account…" : "Choose an account…"
                                                }
                                            />
                                            {targets.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {targets.map((t) => {
                                                        const key = allocationKey(t);
                                                        const account = accounts.find(
                                                            (row) => allocationKey(row) === key,
                                                        );
                                                        const text = account?.fromEmail
                                                            ? `${account.title} — ${account.fromEmail}`
                                                            : (account?.title ?? t.account);
                                                        return (
                                                            <span
                                                                key={key}
                                                                className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-surface-secondary py-1 pl-2 pr-1 text-xs"
                                                            >
                                                                <span className="truncate">{text}</span>
                                                                <button
                                                                    type="button"
                                                                    aria-label={`Remove ${text}`}
                                                                    className="rounded p-0.5 text-muted hover:text-foreground"
                                                                    onClick={() => removeTarget(key)}
                                                                >
                                                                    <X className="size-3" />
                                                                </button>
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                            {targets.length > 1 ? (
                                                <p className="text-xs text-muted">
                                                    {targets.length} separate checks will be created with these
                                                    settings.
                                                </p>
                                            ) : null}
                                        </>
                                    )}
                                    {accounts.length === 0 ? (
                                        <p className="text-xs text-muted">
                                            No sendable Resend or SMTP account is configured yet.
                                        </p>
                                    ) : null}
                                </div>
                            )}

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="deliv-label">Name (optional)</Label>
                                    <Input
                                        id="deliv-label"
                                        placeholder="Main sending domain"
                                        value={label}
                                        onChange={(e) => setLabel(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="deliv-dkim">DKIM selector (optional)</Label>
                                    <Input
                                        id="deliv-dkim"
                                        placeholder="default"
                                        value={dkimSelector}
                                        onChange={(e) => setDkimSelector(e.target.value)}
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <Label>Run</Label>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <OptionSelect
                                    aria-label="Frequency"
                                    options={FREQUENCY_OPTIONS}
                                    value={frequency}
                                    onChange={(v) => setFrequency(v as DeliverabilityFrequency)}
                                />
                                <Input
                                    type="time"
                                    aria-label="Time of day"
                                    value={timeOfDay}
                                    onChange={(e) => setTimeOfDay(e.target.value)}
                                />
                                {frequency === "WEEKLY" ? (
                                    <OptionSelect
                                        aria-label="Day of the week"
                                        options={WEEKDAY_OPTIONS}
                                        value={weekday}
                                        onChange={setWeekday}
                                    />
                                ) : null}
                                {frequency === "MONTHLY" ? (
                                    <OptionSelect
                                        aria-label="Day of the month"
                                        options={DAY_OF_MONTH_OPTIONS}
                                        value={dayOfMonth}
                                        onChange={setDayOfMonth}
                                    />
                                ) : null}
                                {frequency === "EVERY_N_DAYS" ? (
                                    <Input
                                        type="number"
                                        min={1}
                                        max={90}
                                        aria-label="Interval in days"
                                        placeholder="Days between runs"
                                        value={intervalDays}
                                        onChange={(e) => setIntervalDays(e.target.value)}
                                    />
                                ) : null}
                                <SearchSelect
                                    aria-label="Timezone"
                                    searchPlaceholder="Search timezones…"
                                    options={timezoneOptionsFor(timezone)}
                                    value={timezone}
                                    onChange={setTimezone}
                                    fullWidth
                                    className={frequency === "DAILY" ? "sm:col-span-2" : undefined}
                                />
                            </div>
                        </section>

                        <section className="space-y-2">
                            <Label>Checks</Label>
                            {CHECK_OPTIONS.map((option) => {
                                const unavailable = isCustom && option.id === "MAIL_TESTER";
                                return (
                                    <Checkbox
                                        key={option.id}
                                        isSelected={checks.includes(option.id)}
                                        onChange={(selected: boolean) => toggleCheck(option.id, selected)}
                                        isDisabled={unavailable}
                                    >
                                        <Checkbox.Control>
                                            <Checkbox.Indicator />
                                        </Checkbox.Control>
                                        <span className="text-sm text-foreground">
                                            {option.label}
                                            <span className="block text-xs text-muted">
                                                {unavailable
                                                    ? "Needs a sending account to send the test email from."
                                                    : option.description}
                                            </span>
                                        </span>
                                    </Checkbox>
                                );
                            })}
                        </section>

                        <section className="space-y-3">
                            <Label>When the score is low</Label>
                            <div className="grid gap-2">
                                {ACTION_MODE_OPTIONS.map((option) => {
                                    const unavailable = isCustom && option.id !== "RECOMMEND";
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            disabled={unavailable}
                                            className={choiceClass(actionMode === option.id, unavailable)}
                                            onClick={() => setActionMode(option.id)}
                                        >
                                            <span className="font-medium">{option.label}</span>
                                            <span className="block text-xs text-muted">
                                                {unavailable
                                                    ? "Needs a sending account, not a custom domain."
                                                    : option.description}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="deliv-warn">Healthy from score</Label>
                                    <Input
                                        id="deliv-warn"
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={warn}
                                        onChange={(e) => setWarn(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="deliv-critical">Critical below score</Label>
                                    <Input
                                        id="deliv-critical"
                                        type="number"
                                        min={0}
                                        max={99}
                                        value={critical}
                                        onChange={(e) => setCritical(e.target.value)}
                                    />
                                </div>
                            </div>
                        </section>

                        <SwitchRow
                            label="Active"
                            description="Paused checks don't run and lift any sending restriction they applied."
                            isSelected={isActive}
                            onChange={setIsActive}
                        />

                        {error ? <p className="text-xs text-danger">{error}</p> : null}
                    </Modal.Body>
                    <Modal.Footer className="gap-2 justify-end">
                        <Button size="sm" variant="tertiary" onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            size="sm"
                            variant="secondary"
                            isPending={isPending}
                            isDisabled={isPending}
                            onPress={handleSubmit}
                        >
                            {isEditing
                                ? "Save changes"
                                : targets.length > 1 && !isCustom
                                  ? `Create ${targets.length} schedules`
                                  : "Create schedule"}
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
