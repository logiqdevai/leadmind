import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { EmailSendLimitsController } from './email-send-limits.controller';
import { EmailSendLimitsService } from './email-send-limits.service';

@Module({
    imports: [PrismaModule],
    controllers: [EmailSendLimitsController],
    providers: [EmailSendLimitsService],
    exports: [EmailSendLimitsService],
})
export class EmailSendLimitsModule {}
