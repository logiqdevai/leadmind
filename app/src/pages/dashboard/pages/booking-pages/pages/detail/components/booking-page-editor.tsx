import { useEffect, type FC } from "react";
import { FormProvider, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useUpdateBookingPage } from "@/features/bookings/hooks/use-booking-pages";
import type { BookingPage } from "@/features/bookings/interfaces/bookings.interfaces";
import type { OrganisationMember } from "@/features/organisations/interfaces/organisation.interfaces";
import { toast } from "@/hooks/use-toast";
import { BookingPageTabIds } from "@/routes/routes";
import {
    firstErrorMessage,
    firstErrorTab,
    toBookingPageFormValues,
    toBookingPagePayload,
} from "@/pages/dashboard/pages/booking-pages/pages/detail/utils/booking-page-form";
import { bookingPageFormSchema, type BookingPageFormValues } from "@/pages/dashboard/pages/booking-pages/pages/detail/validation-schemas/booking-page.schema";
import { BrandingTab } from "./branding-tab";
import { GeneralTab } from "./general-tab";
import { LinksTab } from "./links-tab";
import { NotificationsTab } from "./notifications-tab";
import { PreviewTab } from "./preview-tab";
import { SchedulingTab } from "./scheduling-tab";
import { TeamTab } from "./team-tab";

type BookingPageTabId = (typeof BookingPageTabIds)[keyof typeof BookingPageTabIds];

/** Tabs that edit the page form (Links / Preview act on their own). */
const FORM_TABS = new Set<string>([
    BookingPageTabIds.GENERAL,
    BookingPageTabIds.SCHEDULING,
    BookingPageTabIds.TEAM,
    BookingPageTabIds.NOTIFICATIONS,
    BookingPageTabIds.BRANDING,
]);

interface BookingPageEditorProps {
    page: BookingPage;
    currentTab: string;
    onTabChange: (tab: BookingPageTabId) => void;
    canManage: boolean;
    members: OrganisationMember[];
}

export const BookingPageEditor: FC<BookingPageEditorProps> = ({ page, currentTab, onTabChange, canManage, members }) => {
    const updatePage = useUpdateBookingPage();
    const form = useForm<BookingPageFormValues>({
        resolver: zodResolver(bookingPageFormSchema),
        defaultValues: toBookingPageFormValues(page),
        mode: "onBlur",
    });
    const { reset, formState, handleSubmit } = form;
    const readOnly = !canManage;

    // Refetches (e.g. after a link change) update untouched fields without wiping edits in progress.
    useEffect(() => {
        reset(toBookingPageFormValues(page), { keepDirtyValues: true });
    }, [page, reset]);

    const onSave = handleSubmit(
        (values) => {
            updatePage.mutate(
                { uuid: page.uuid, payload: toBookingPagePayload(values) },
                { onSuccess: (saved) => reset(toBookingPageFormValues(saved)) },
            );
        },
        (errors: FieldErrors<BookingPageFormValues>) => {
            const tab = firstErrorTab(errors);
            if (tab !== currentTab) onTabChange(tab);
            toast({
                title: "Check the highlighted fields",
                description: firstErrorMessage(errors) ?? undefined,
                variant: "error",
                duration: 3000,
            });
        },
    );

    const showSaveBar = canManage && (FORM_TABS.has(currentTab) || formState.isDirty);

    return (
        <>
            <FormProvider {...form}>
                <form onSubmit={onSave} noValidate className="max-w-4xl space-y-4">
                    {currentTab === BookingPageTabIds.GENERAL ? <GeneralTab readOnly={readOnly} /> : null}
                    {currentTab === BookingPageTabIds.SCHEDULING ? <SchedulingTab readOnly={readOnly} /> : null}
                    {currentTab === BookingPageTabIds.TEAM ? <TeamTab readOnly={readOnly} members={members} /> : null}
                    {currentTab === BookingPageTabIds.NOTIFICATIONS ? <NotificationsTab readOnly={readOnly} /> : null}
                    {currentTab === BookingPageTabIds.BRANDING ? <BrandingTab readOnly={readOnly} /> : null}

                    {showSaveBar ? (
                        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface/80 px-4 py-3 backdrop-blur-sm">
                            <p className="text-xs text-muted">
                                {formState.isDirty ? "You have unsaved changes." : "All changes saved."}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="tertiary"
                                    isDisabled={!formState.isDirty || updatePage.isPending}
                                    onPress={() => reset(toBookingPageFormValues(page))}
                                >
                                    Discard
                                </Button>
                                <ActionButtonWithPending
                                    type="submit"
                                    isPending={updatePage.isPending}
                                    isDisabled={!formState.isDirty || updatePage.isPending}
                                >
                                    Save changes
                                </ActionButtonWithPending>
                            </div>
                        </div>
                    ) : null}
                </form>
            </FormProvider>

            {currentTab === BookingPageTabIds.LINKS ? (
                <div className="max-w-4xl">
                    <LinksTab bookingPageUuid={page.uuid} canManage={canManage} />
                </div>
            ) : null}
            {currentTab === BookingPageTabIds.PREVIEW ? (
                <div className="max-w-4xl space-y-2">
                    {formState.isDirty ? (
                        <p className="text-xs text-warning">Unsaved changes are not reflected in the preview. Save first.</p>
                    ) : null}
                    <PreviewTab page={page} />
                </div>
            ) : null}
        </>
    );
};
