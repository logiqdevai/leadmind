import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { SavedContactFiltersController } from './saved-contact-filters.controller';
import { SavedContactFiltersService } from './saved-contact-filters.service';

@Module({
    imports: [PrismaModule],
    controllers: [SavedContactFiltersController],
    providers: [SavedContactFiltersService],
    exports: [SavedContactFiltersService],
})
export class SavedContactFiltersModule { }
