import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { CreateJwtServiceModule } from '@/shared/utils/jwt/jwt.module';
import { MailModule } from '@/modules/internal/mail/mail.module';
import { OrganisationsController } from './organisations.controller';
import { OrganisationsService } from './organisations.service';

@Module({
    imports: [PrismaModule, CreateJwtServiceModule, MailModule],
    controllers: [OrganisationsController],
    providers: [OrganisationsService],
    exports: [OrganisationsService],
})
export class OrganisationsModule {}
