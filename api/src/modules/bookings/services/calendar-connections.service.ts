import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarConnectionStatus, CalendarProvider } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ComposioService } from '@/integrations/composio/services/composio.service';
import { GoogleCalendarService } from '@/integrations/composio/services/google-calendar.service';
import { COMPOSIO_ACTIVE_STATUS, composioUserId } from '@/integrations/composio/composio.constants';
import { ComposioRequestError } from '@/integrations/composio/interfaces/composio.interface';
import { BookingActor, isOrganisationAdmin } from '../interfaces/booking.interface';
import { UpdateCalendarConnectionDto } from '../dto/calendar-connection.dto';

const CONNECTION_SELECT = {
    uuid: true,
    organisation_uuid: true,
    user_uuid: true,
    provider: true,
    status: true,
    account_email: true,
    calendar_id: true,
    calendar_name: true,
    check_conflicts: true,
    last_error: true,
    connected_at: true,
    created_at: true,
    updated_at: true,
    user: { select: { uuid: true, full_name: true, email: true } },
} as const;

/** Per-member Google Calendar connections (Composio connected accounts). */
@Injectable()
export class CalendarConnectionsService {
    private readonly logger = new Logger(CalendarConnectionsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly composio: ComposioService,
        private readonly googleCalendar: GoogleCalendarService,
    ) {}

    /** Admins see every member's connection; members see their own. */
    async list(actor: BookingActor) {
        const connections = await this.prisma.calendarConnection.findMany({
            where: {
                organisation_uuid: actor.organisation_uuid,
                ...(!isOrganisationAdmin(actor) && { user_uuid: actor.uuid }),
            },
            select: CONNECTION_SELECT,
            orderBy: { created_at: 'asc' },
        });
        return { configured: this.composio.isConfigured(), connections };
    }

    /** Starts Google OAuth for the current member; the browser is sent to `redirect_url`. */
    async connect(actor: BookingActor) {
        if (!this.composio.isConfigured()) {
            throw new ServiceUnavailableException('Google Calendar is not configured for this workspace yet.');
        }
        const connection = await this.prisma.calendarConnection.upsert({
            where: {
                organisation_uuid_user_uuid_provider: {
                    organisation_uuid: actor.organisation_uuid,
                    user_uuid: actor.uuid,
                    provider: CalendarProvider.GOOGLE,
                },
            },
            create: { organisation_uuid: actor.organisation_uuid, user_uuid: actor.uuid },
            update: {},
        });

        const callback = `${this.appUrl()}/dashboard/calendar-integrations?connection=${connection.uuid}`;
        const request = await this.composio.linkGoogleCalendar(
            composioUserId(actor.organisation_uuid, actor.uuid),
            callback,
        );
        await this.prisma.calendarConnection.update({
            where: { uuid: connection.uuid },
            data: {
                pending_connected_account_id: request.connected_account_id,
                // An existing working connection stays usable until the new one is verified.
                ...(connection.status !== CalendarConnectionStatus.ACTIVE && { status: CalendarConnectionStatus.INITIATED }),
            },
        });
        return { connection_uuid: connection.uuid, redirect_url: request.redirect_url };
    }

    /** Called by the app after Composio redirects back; activates the pending connected account. */
    async verify(actor: BookingActor, uuid: string, connected_account_id: string) {
        const connection = await this.findOwn(actor, uuid);
        if (!connection.pending_connected_account_id || connection.pending_connected_account_id !== connected_account_id) {
            throw new BadRequestException('This connection request is unknown or has expired. Please connect again.');
        }

        const account = await this.composio.getConnectedAccount(connected_account_id);
        if (account.status !== COMPOSIO_ACTIVE_STATUS) {
            await this.prisma.calendarConnection.update({
                where: { uuid },
                data: {
                    pending_connected_account_id: null,
                    ...(connection.status !== CalendarConnectionStatus.ACTIVE && { status: CalendarConnectionStatus.FAILED }),
                    last_error: account.status_reason ?? `Google authorisation ${account.status.toLowerCase()}`,
                },
            });
            throw new BadRequestException('Google did not authorise the connection. Please try again.');
        }

        let primary: { id: string; summary: string } | null = null;
        try {
            primary = await this.googleCalendar.getPrimaryCalendar(connected_account_id);
        } catch (error) {
            this.logger.warn(`Could not read primary calendar for ${uuid}: ${(error as Error).message}`);
        }

        const previous = connection.composio_connected_account_id;
        const updated = await this.prisma.calendarConnection.update({
            where: { uuid },
            data: {
                composio_connected_account_id: connected_account_id,
                pending_connected_account_id: null,
                status: CalendarConnectionStatus.ACTIVE,
                account_email: primary?.id ?? connection.account_email,
                // A different Google account means the old calendar id no longer applies.
                ...(previous !== connected_account_id && {
                    calendar_id: 'primary',
                    calendar_name: primary?.summary ?? null,
                }),
                last_error: null,
                connected_at: new Date(),
                ...(previous !== connected_account_id && {
                    sync_token: null,
                    watch_channel_id: null,
                    watch_resource_id: null,
                    watch_token: null,
                    watch_expires_at: null,
                }),
            },
            select: CONNECTION_SELECT,
        });
        if (previous && previous !== connected_account_id) await this.composio.deleteConnectedAccount(previous);
        return updated;
    }

    async listCalendars(actor: BookingActor, uuid: string) {
        const connection = await this.findViewable(actor, uuid);
        const accountId = this.requireActive(connection);
        try {
            return await this.googleCalendar.listCalendars(accountId);
        } catch (error) {
            await this.handleProviderError(connection.uuid, error);
            throw new BadRequestException(`Could not load calendars: ${(error as Error).message}`);
        }
    }

    /** The member's (or, for admins, any member's) connection, once it is active and ready to be read from. */
    async findForResync(actor: BookingActor, uuid: string) {
        const connection = await this.findOwnOrAdmin(actor, uuid);
        this.requireActive(connection);
        return connection;
    }

    async update(actor: BookingActor, uuid: string, dto: UpdateCalendarConnectionDto) {
        const connection = await this.findOwnOrAdmin(actor, uuid);
        let calendar_name: string | undefined;
        if (dto.calendar_id && dto.calendar_id !== connection.calendar_id) {
            const calendars = await this.listCalendars(actor, uuid);
            const calendar = calendars.find((c) => c.id === dto.calendar_id);
            if (!calendar) throw new BadRequestException('That calendar is not writable by this Google account');
            calendar_name = calendar.summary;
        }
        // The push channel and sync cursor belong to the old calendar.
        if (dto.calendar_id && dto.calendar_id !== connection.calendar_id) await this.resetWatch(connection);
        return this.prisma.calendarConnection.update({
            where: { uuid },
            data: {
                ...(dto.calendar_id !== undefined && { calendar_id: dto.calendar_id }),
                ...(calendar_name !== undefined && { calendar_name }),
                ...(dto.check_conflicts !== undefined && { check_conflicts: dto.check_conflicts }),
            },
            select: CONNECTION_SELECT,
        });
    }

    /** Revokes the Composio account. Existing bookings keep their records; their events stay in Google. */
    async disconnect(actor: BookingActor, uuid: string) {
        const connection = await this.findOwnOrAdmin(actor, uuid);
        const ids = [connection.composio_connected_account_id, connection.pending_connected_account_id].filter(Boolean) as string[];
        await this.resetWatch(connection);
        for (const id of ids) await this.composio.deleteConnectedAccount(id);
        return this.prisma.calendarConnection.update({
            where: { uuid },
            data: {
                status: CalendarConnectionStatus.DISCONNECTED,
                composio_connected_account_id: null,
                pending_connected_account_id: null,
                last_error: null,
            },
            select: CONNECTION_SELECT,
        });
    }

    /** Drops the Google push channel and sync cursor (calendar switched or account disconnected). */
    async resetWatch(connection: {
        uuid: string;
        composio_connected_account_id: string | null;
        watch_channel_id: string | null;
        watch_resource_id: string | null;
    }) {
        if (connection.composio_connected_account_id && connection.watch_channel_id && connection.watch_resource_id) {
            await this.googleCalendar
                .stopWatch(connection.composio_connected_account_id, connection.watch_channel_id, connection.watch_resource_id)
                .catch(() => undefined);
        }
        await this.prisma.calendarConnection.update({
            where: { uuid: connection.uuid },
            data: { sync_token: null, watch_channel_id: null, watch_resource_id: null, watch_token: null, watch_expires_at: null },
        });
    }

    /** The member's connection if it can be used for API calls right now. */
    async findUsable(organisation_uuid: string, user_uuid: string) {
        const connection = await this.prisma.calendarConnection.findUnique({
            where: {
                organisation_uuid_user_uuid_provider: { organisation_uuid, user_uuid, provider: CalendarProvider.GOOGLE },
            },
        });
        if (!connection?.composio_connected_account_id || connection.status !== CalendarConnectionStatus.ACTIVE) return null;
        return connection as typeof connection & { composio_connected_account_id: string };
    }

    /** Auth failures flip the connection to EXPIRED so the member is asked to reconnect. */
    async handleProviderError(connection_uuid: string, error: unknown) {
        if (error instanceof ComposioRequestError && error.requires_reconnect) {
            await this.prisma.calendarConnection.update({
                where: { uuid: connection_uuid },
                data: { status: CalendarConnectionStatus.EXPIRED, last_error: error.message },
            });
        }
    }

    private requireActive(connection: { status: CalendarConnectionStatus; composio_connected_account_id: string | null }) {
        if (connection.status !== CalendarConnectionStatus.ACTIVE || !connection.composio_connected_account_id) {
            throw new BadRequestException('This Google Calendar is not connected. Please reconnect it.');
        }
        return connection.composio_connected_account_id;
    }

    private async findOwn(actor: BookingActor, uuid: string) {
        const connection = await this.prisma.calendarConnection.findFirst({
            where: { uuid, organisation_uuid: actor.organisation_uuid },
        });
        if (!connection) throw new NotFoundException('Calendar connection not found');
        if (connection.user_uuid !== actor.uuid) throw new ForbiddenException('Only the member who connected can do this');
        return connection;
    }

    private async findOwnOrAdmin(actor: BookingActor, uuid: string) {
        const connection = await this.findViewable(actor, uuid);
        if (connection.user_uuid !== actor.uuid && !isOrganisationAdmin(actor)) {
            throw new ForbiddenException("Only admins can manage other members' calendars");
        }
        return connection;
    }

    private async findViewable(actor: BookingActor, uuid: string) {
        const connection = await this.prisma.calendarConnection.findFirst({
            where: { uuid, organisation_uuid: actor.organisation_uuid },
        });
        if (!connection || (connection.user_uuid !== actor.uuid && !isOrganisationAdmin(actor))) {
            throw new NotFoundException('Calendar connection not found');
        }
        return connection;
    }

    private appUrl(): string {
        return (this.configService.get<string>('APP_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');
    }
}
