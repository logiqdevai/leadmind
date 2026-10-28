import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BookingsController } from '@/modules/bookings/bookings.controller';
import { BookingPagesController } from '@/modules/bookings/controllers/booking-pages.controller';
import { AvailabilityController } from '@/modules/bookings/controllers/availability.controller';
import { CalendarConnectionsController } from '@/modules/bookings/controllers/calendar-connections.controller';
import { BookingInvitationsController } from '@/modules/bookings/controllers/booking-invitations.controller';
import { PublicBookingController } from '@/modules/bookings/controllers/public-booking.controller';
import { BookingLinksController } from '@/modules/booking-links/booking-links.controller';
import { RemindersController } from '@/modules/reminders/reminders.controller';
import { SCOPE_READ, SCOPE_WRITE } from '@/modules/oauth/oauth.constants';
import { OpenApiToolRegistryService } from './openapi-tool-registry.service';
import { McpToolDefinition } from './tool-definition.interface';

/**
 * Builds the OpenAPI document from the real controllers (services mocked) and runs it through the
 * tool registry, so the MCP surface of the booking and reminder features is checked, not assumed.
 */
describe('MCP tool catalogue for bookings and reminders', () => {
    let tools: McpToolDefinition[];
    const byName = (name: string) => tools.find((t) => t.name === name);
    const route = (method: string, path: string) => tools.find((t) => t.method === method && t.pathTemplate === path);

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [
                BookingsController,
                BookingPagesController,
                AvailabilityController,
                CalendarConnectionsController,
                BookingInvitationsController,
                PublicBookingController,
                BookingLinksController,
                RemindersController,
            ],
        })
            .useMocker(() => ({}))
            .compile();
        const app = moduleRef.createNestApplication();
        await app.init();

        const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('t').build());
        tools = new OpenApiToolRegistryService({ get: () => document } as never).getTools();
        await app.close();
    }, 120_000);

    it('exposes the booking management routes as tools', () => {
        for (const [method, path] of [
            ['get', '/bookings'],
            ['get', '/bookings/calendar'],
            ['get', '/bookings/stats'],
            ['get', '/bookings/export'],
            ['get', '/bookings/{uuid}'],
            ['post', '/bookings'],
            ['patch', '/bookings/{uuid}'],
            ['post', '/bookings/{uuid}/reschedule'],
            ['post', '/bookings/{uuid}/cancel'],
            ['post', '/bookings/{uuid}/status'],
            ['post', '/bookings/{uuid}/assign'],
            ['delete', '/bookings/{uuid}'],
            ['post', '/bookings/{uuid}/sync-calendar'],
            ['post', '/bookings/{uuid}/resend-confirmation'],
            ['get', '/booking-pages'],
            ['post', '/booking-pages'],
            ['patch', '/booking-pages/{uuid}'],
            ['get', '/booking-pages/{uuid}/slots'],
            ['get', '/booking-links'],
            ['post', '/booking-links'],
            ['post', '/booking-links/{uuid}/regenerate'],
            ['get', '/availability/schedule'],
            ['put', '/availability/schedule'],
            ['post', '/availability/blocks'],
            ['put', '/availability/overrides'],
            ['delete', '/availability/overrides/{uuid}'],
            ['post', '/availability/recurring-blocks'],
            ['post', '/booking-invitations'],
            ['get', '/booking-invitations'],
            ['post', '/booking-invitations/{uuid}/stop'],
            ['post', '/booking-invitations/{uuid}/resend'],
            ['get', '/booking-invite-settings'],
            ['patch', '/booking-invite-settings'],
            ['get', '/reminders'],
            ['get', '/reminders/stats'],
            ['get', '/reminders/{uuid}'],
            ['post', '/reminders'],
            ['put', '/reminders/{uuid}'],
            ['put', '/reminders/{uuid}/complete'],
            ['delete', '/reminders/{uuid}'],
            ['get', '/calendar-connections'],
            ['get', '/calendar-connections/{uuid}/calendars'],
            ['patch', '/calendar-connections/{uuid}'],
            ['delete', '/calendar-connections/{uuid}'],
        ] as const) {
            expect({ method, path, found: !!route(method, path) }).toEqual({ method, path, found: true });
        }
    });

    it('keeps tool names unique and uses read scope only for GET', () => {
        const names = tools.map((t) => t.name);
        expect(new Set(names).size).toBe(names.length);
        for (const tool of tools) expect(tool.scope).toBe(tool.method === 'get' ? SCOPE_READ : SCOPE_WRITE);
    });

    it('never exposes the unauthenticated visitor endpoints', () => {
        expect(tools.some((t) => t.pathTemplate.startsWith('/public'))).toBe(false);
    });

    it('never exposes the Google OAuth handshake, which is a browser redirect', () => {
        expect(route('post', '/calendar-connections/connect')).toBeUndefined();
        expect(route('post', '/calendar-connections/{uuid}/verify')).toBeUndefined();
    });

    it('lets a tool create a booking with the fields the API validates', () => {
        const create = route('post', '/bookings')!;
        const body = create.inputSchema.properties!.body as { properties: Record<string, unknown>; required?: string[] };
        expect(Object.keys(body.properties)).toEqual(
            expect.arrayContaining(['start_at', 'contact_uuid', 'booking_page_uuid', 'assigned_user_uuid', 'notify']),
        );
        expect(body.required).toContain('start_at');
    });

    it('lets a tool filter bookings and read slots, including unavailable ones', () => {
        expect(route('get', '/bookings')!.queryParams).toEqual(
            expect.arrayContaining(['from', 'to', 'status', 'assigned_user_uuid', 'booking_page_uuid', 'contact_uuid', 'search']),
        );
        expect(route('get', '/booking-pages/{uuid}/slots')!.queryParams).toEqual(
            expect.arrayContaining(['from', 'to', 'timezone', 'duration', 'include_unavailable']),
        );
    });

    it('lets a tool configure the new booking page settings', () => {
        const update = route('patch', '/booking-pages/{uuid}')!;
        const body = update.inputSchema.properties!.body as { properties: Record<string, unknown> };
        expect(Object.keys(body.properties)).toEqual(
            expect.arrayContaining([
                'unavailable_slots_mode',
                'create_team_reminder',
                'team_reminder_offset_minutes',
                'reminder_offsets_minutes',
                'members',
            ]),
        );
    });

    it('lets a tool assign reminders to members, and filter by who receives them', () => {
        const create = byName('reminders_create')!;
        const body = create.inputSchema.properties!.body as { properties: Record<string, { description?: string }> };
        expect(body.properties.assignee_user_uuids).toBeDefined();
        expect(body.properties.assignee_user_uuids.description).toMatch(/Omitted/);

        const update = route('put', '/reminders/{uuid}')!;
        expect((update.inputSchema.properties!.body as { properties: Record<string, unknown> }).properties).toHaveProperty(
            'assignee_user_uuids',
        );
        expect(route('get', '/reminders')!.queryParams).toContain('for_user_uuid');
    });

    it('lets a tool add a reminder to Google Calendar', () => {
        for (const tool of [byName('reminders_create')!, route('put', '/reminders/{uuid}')!]) {
            const body = tool.inputSchema.properties!.body as { properties: Record<string, unknown> };
            expect(body.properties).toHaveProperty('add_to_google_calendar');
        }
    });

    it('tells the agent about side effects and permissions, not only the one-line summary', () => {
        expect(route('post', '/reminders')!.description).toMatch(/^Create a reminder for a contact\n\n.*assignee_user_uuids/s);
        expect(route('delete', '/reminders/{uuid}')!.description).toMatch(/admin/);
        expect(route('post', '/bookings/{uuid}/resend-confirmation')!.description).toMatch(/email/);
        expect(route('post', '/bookings/{uuid}/sync-calendar')!.description).toMatch(/queued/);
        expect(route('get', '/bookings/export')!.description).toMatch(/CSV/);
        // An operation with no longer description keeps its summary unchanged.
        expect(route('get', '/reminders/stats')!.description).toBe(
            'Reminder statistics: pending, due today, overdue, completed this week',
        );
    });
});
