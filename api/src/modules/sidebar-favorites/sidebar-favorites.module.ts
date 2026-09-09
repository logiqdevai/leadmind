import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { SidebarFavoritesController } from './sidebar-favorites.controller';
import { SidebarFavoritesService } from './sidebar-favorites.service';

@Module({
    imports: [PrismaModule],
    controllers: [SidebarFavoritesController],
    providers: [SidebarFavoritesService],
    exports: [SidebarFavoritesService],
})
export class SidebarFavoritesModule { }
