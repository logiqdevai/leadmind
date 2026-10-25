import { Module } from '@nestjs/common';
import { ComposioService } from './services/composio.service';
import { GoogleCalendarService } from './services/google-calendar.service';

@Module({
    providers: [ComposioService, GoogleCalendarService],
    exports: [ComposioService, GoogleCalendarService],
})
export class ComposioModule {}
