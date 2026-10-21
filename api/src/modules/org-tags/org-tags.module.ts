import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { OrgTagsController } from './org-tags.controller';
import { OrgTagsService } from './org-tags.service';

@Module({
    imports: [PrismaModule],
    controllers: [OrgTagsController],
    providers: [OrgTagsService],
    exports: [OrgTagsService],
})
export class OrgTagsModule {}
