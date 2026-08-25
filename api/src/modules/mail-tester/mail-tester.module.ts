import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { IntegrationsModule } from '@/modules/integrations/integrations.module';
import { ResendModule } from '@/integrations/notifications/resend/resend.module';
import { SmtpModule } from '@/integrations/notifications/smtp/smtp.module';
import { MailTesterClientModule } from '@/integrations/mail-tester/mail-tester-client.module';
import { AiIntegrationModule } from '@/integrations/ai/ai.module';
import { MailTesterController } from './mail-tester.controller';
import { MailTesterService } from './mail-tester.service';

@Module({
  imports: [
    PrismaModule,
    IntegrationsModule,
    MailTesterClientModule,
    ResendModule,
    SmtpModule,
    AiIntegrationModule,
  ],
  controllers: [MailTesterController],
  providers: [MailTesterService],
})
export class MailTesterModule {}
