import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { GatewaysModule } from '@/gateways/gateways.module';
import { MessagingGoalsController } from './messaging-goals.controller';
import { MessagingGoalsService } from './messaging-goals.service';

@Module({
    imports: [PrismaModule, GatewaysModule],
    controllers: [MessagingGoalsController],
    providers: [MessagingGoalsService],
    exports: [MessagingGoalsService],
})
export class MessagingGoalsModule {}
