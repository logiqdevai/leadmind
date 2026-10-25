import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { BookingLinksController } from './booking-links.controller';
import { BookingLinksService } from './booking-links.service';

/**
 * Kept separate from BookingsModule (Prisma only) so outreach rendering can resolve
 * per-contact `{{booking_link}}` URLs without a circular module dependency.
 */
@Module({
    imports: [PrismaModule],
    controllers: [BookingLinksController],
    providers: [BookingLinksService],
    exports: [BookingLinksService],
})
export class BookingLinksModule {}
