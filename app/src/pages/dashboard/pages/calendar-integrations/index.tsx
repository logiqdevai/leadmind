import { useEffect, useRef, useState, type FC } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Spinner } from "@heroui/react";
import { useDashboardNavbarTitle } from "@/components/providers/dashboard-navbar-provider";
import { useCalendarConnections, useVerifyCalendarConnection } from "@/features/bookings/hooks/use-availability";
import { useOrganisationMembers } from "@/features/organisations/hooks/use-organisations";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import { Routes } from "@/routes/routes";
import { useAuthStore } from "@/stores/auth";
import { MyCalendarCard } from "./components/my-calendar-card";
import { TeamConnectionsTable } from "./components/team-connections-table";

/** Query params Composio appends when it sends the browser back after Google consent. */
const CALLBACK_PARAMS = {
    connection: "connection",
    connectedAccountId: "connected_account_id",
    status: "status",
} as const;

const CalendarIntegrationsPage: FC = () => {
    useDashboardNavbarTitle("Calendar integrations");
    const [searchParams, setSearchParams] = useSearchParams();
    const isAdmin = useOrganisationPermission("org_manage_bookings");
    const organisationUuid = useAuthStore((s) => s.organisation_uuid) ?? "";
    const currentUserUuid = useAuthStore((s) => s.user_uuid) ?? "";

    const { data, isLoading, isError, error } = useCalendarConnections();
    const { data: members = [] } = useOrganisationMembers(isAdmin ? organisationUuid : "");
    const verify = useVerifyCalendarConnection();
    const verifyStarted = useRef(false);
    // Read once on arrival: the params are removed from the URL right after.
    const [callbackFailed] = useState(() => {
        const status = searchParams.get(CALLBACK_PARAMS.status);
        return !!status && status.toLowerCase() !== "success";
    });

    // Finish the OAuth round trip once, then clean the URL.
    useEffect(() => {
        const connectionUuid = searchParams.get(CALLBACK_PARAMS.connection);
        const connectedAccountId = searchParams.get(CALLBACK_PARAMS.connectedAccountId);
        const status = searchParams.get(CALLBACK_PARAMS.status);
        if (!connectionUuid && !connectedAccountId && !status) return;
        if (verifyStarted.current) return;
        verifyStarted.current = true;

        const failed = !!status && status.toLowerCase() !== "success";
        if (!failed && connectionUuid && connectedAccountId) {
            verify.mutate({ uuid: connectionUuid, connectedAccountId });
        }

        const next = new URLSearchParams(searchParams);
        Object.values(CALLBACK_PARAMS).forEach((key) => next.delete(key));
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams, verify]);

    const configured = data?.configured ?? true;
    const connections = data?.connections ?? [];
    const mine = connections.find((c) => c.user_uuid === currentUserUuid) ?? null;

    return (
        <div className="max-w-4xl space-y-6">
            <header className="space-y-1">
                <h1 className="text-xl font-semibold text-foreground">Calendar integrations</h1>
                <p className="max-w-2xl text-sm text-muted">
                    Each member connects their own Google account. Bookings are added to the assigned member&apos;s calendar, with a
                    Google Meet link when the booking page&apos;s location is Google Meet, and busy events in that calendar block booking
                    times. Working hours are set in{" "}
                    <Link to={Routes.dashboard.availability} className="font-medium text-link hover:underline">
                        Availability
                    </Link>
                    .
                </p>
            </header>

            {callbackFailed ? (
                <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>Google Calendar wasn&apos;t connected</Alert.Title>
                        <Alert.Description>Google sign-in was cancelled or failed. Try connecting again.</Alert.Description>
                    </Alert.Content>
                </Alert>
            ) : null}

            {verify.isPending ? (
                <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-surface px-4 py-3 text-sm text-muted">
                    <Spinner size="sm" /> Finishing the Google Calendar connection…
                </div>
            ) : null}

            {!isLoading && !configured ? (
                <Alert status="accent">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>Google Calendar isn&apos;t configured for this workspace yet</Alert.Title>
                        <Alert.Description>
                            The calendar integration credentials are missing on the server, so members can&apos;t connect yet. Bookings still
                            work without it.
                        </Alert.Description>
                    </Alert.Content>
                </Alert>
            ) : null}

            {isLoading ? (
                <div className="h-40 rounded-2xl border border-border bg-surface animate-pulse" />
            ) : isError ? (
                <p className="text-sm text-danger">{error instanceof Error ? error.message : "Could not load calendar connections."}</p>
            ) : (
                <>
                    <MyCalendarCard connection={mine} configured={configured} />
                    {isAdmin ? (
                        <TeamConnectionsTable members={members} connections={connections} currentUserUuid={currentUserUuid} />
                    ) : null}
                </>
            )}
        </div>
    );
};

export default CalendarIntegrationsPage;
