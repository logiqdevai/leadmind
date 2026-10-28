import { useMemo, type FC } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@heroui/react";
import { usePublicBookingPage } from "@/features/bookings/hooks/use-public-booking";
import type { PublicPageRef } from "@/features/bookings/interfaces/bookings.interfaces";
import { isNotFoundError } from "@/pages/booking/utils/booking-errors";
import { BookingFlow } from "@/pages/booking/components/booking-flow";
import { BookingPageSkeleton } from "@/pages/booking/components/booking-page-skeleton";
import { BookingStateCard } from "@/pages/booking/components/booking-state-card";

const PublicBookingPage: FC = () => {
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
                title="This booking link is not available"
                description="The link may have expired or been turned off. Please ask the person who shared it for a new one."
            />
        );
    }

    if (isError || !data) {
        return (
            <BookingStateCard
                title="Something went wrong"
                description="We could not load this booking page. Please check your connection and try again."
                action={
                    <Button variant="secondary" onPress={() => void refetch()}>
                        Try again
                    </Button>
                }
            />
        );
    }

    // Keyed by the URL ref so a different link starts a fresh flow.
    return <BookingFlow key={JSON.stringify(pageRef)} pageRef={pageRef} data={data} />;
};

export default PublicBookingPage;
