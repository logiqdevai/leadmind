import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { ContactsModule } from '@/modules/contacts/contacts.module';
import { AiIntegrationModule } from '@/integrations/ai/ai.module';
import { ContactAudienceStatsController } from './contact-audience-stats.controller';
import { ContactAudienceStatsService } from './contact-audience-stats.service';
import { ContactAudienceAnalysisService } from './contact-audience-analysis.service';

@Module({
    imports: [PrismaModule, ContactsModule, AiIntegrationModule],
    controllers: [ContactAudienceStatsController],
    providers: [ContactAudienceStatsService, ContactAudienceAnalysisService],
    exports: [ContactAudienceStatsService, ContactAudienceAnalysisService],
})
export class ContactAudienceStatsModule {}
