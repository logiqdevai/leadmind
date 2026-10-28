import { Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { BookingCalendarInboundService } from '../services/booking-calendar-inbound.service';

/** Google Calendar push notifications. Authenticated by the per-channel token we gave Google, not by a user. */
@ApiExcludeController()
@Controller('public/calendar')
export class CalendarWebhookController {
    constructor(private readonly inbound: BookingCalendarInboundService) {}

    @Post('google-webhook')
    @HttpCode(200)
    async google(
        @Headers('x-goog-channel-id') channel_id?: string,
        @Headers('x-goog-channel-token') token?: string,
        @Headers('x-goog-resource-state') resource_state?: string,
    ) {
        await this.inbound.handleNotification(channel_id, token, resource_state);
        return { ok: true };
    }
}
