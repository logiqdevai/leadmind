import { Injectable } from '@nestjs/common';
import { BookingActorType, BookingEventType, Prisma } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

export interface BookingEventActor {
    type: BookingActorType;
    user_uuid?: string | null;
}

export const SYSTEM_ACTOR: BookingEventActor = { type: BookingActorType.SYSTEM };
export const INVITEE_ACTOR: BookingEventActor = { type: BookingActorType.INVITEE };
export const userActor = (user_uuid: string): BookingEventActor => ({ type: BookingActorType.USER, user_uuid });

/** Append-only booking history (who did what, when). */
@Injectable()
export class BookingEventsService {
    constructor(private readonly prisma: PrismaService) {}

    async record(
        booking: { uuid: string; organisation_uuid: string },
        type: BookingEventType,
        actor: BookingEventActor,
        summary?: string | null,
        metadata?: Record<string, unknown> | null,
        db: PrismaService | Prisma.TransactionClient = this.prisma,
    ) {
        await db.bookingEvent.create({
            data: {
                organisation_uuid: booking.organisation_uuid,
                booking_uuid: booking.uuid,
                type,
                actor_type: actor.type,
                actor_user_uuid: actor.user_uuid ?? null,
                summary: summary ?? null,
                metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
            },
        });
    }
}
