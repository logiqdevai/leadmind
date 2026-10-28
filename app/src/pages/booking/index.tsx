import { useMemo, type FC } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { usePublicBookingPage } from "@/features/bookings/hooks/use-public-booking";
import type { PublicPageRef } from "@/features/bookings/interfaces/bookings.interfaces";
import { isNotFoundError } from "@/pages/booking/utils/booking-errors";
import { BookingFlow } from "@/pages/booking/components/booking-flow";
import { BookingPageSkeleton } from "@/pages/booking/components/booking-page-skeleton";
import { BookingStateCard } from "@/pages/booking/components/booking-state-card";

const PublicBookingPage: FC = () => {
    const { t } = useTranslation();
    // `/book/<code>` (contact links and older links) or the page's own `/book/<organisation>/<page>`.
    const { code = "", organisation = "", slug = "" } = useParams<{ code: string; organisation: string; slug: string }>();
    const pageRef = useMemo<PublicPageRef | undefined>(() => {
        if (organisation && slug) return { organisation, slug };
        return code ? { code } : undefined;
    }, [code, organisation, slug]);
    const { data, isLoading, isError, error, refetch } = usePublicBookingPage(pageRef);

    if (isLoading) return <BookingPageSkeleton />;

    if (!pageRef || (isError && isNotFoundError(error))) {
        return (
            <BookingStateCard
                title={t("booking.notAvailable.title")}
                description={t("booking.notAvailable.description")}
            />
        );
    }

    if (isError || !data) {
        return (
            <BookingStateCard
                title={t("booking.loadFailed.title")}
                description={t("booking.loadFailed.description")}
                action={
                    <Button variant="secondary" onPress={() => void refetch()}>
                        {t("common.tryAgain")}
                    </Button>
                }
            />
        );
    }

    // Keyed by the URL ref so a different link starts a fresh flow.
    return <BookingFlow key={JSON.stringify(pageRef)} pageRef={pageRef} data={data} />;
};

export default PublicBookingPage;
