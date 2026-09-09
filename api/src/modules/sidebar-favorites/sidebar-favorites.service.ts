import { Injectable } from '@nestjs/common';
import { Prisma, SidebarFavorite } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { CreateSidebarFavoriteDto } from './dto/create-sidebar-favorite.dto';
import { ReorderSidebarFavoritesDto } from './dto/reorder-sidebar-favorites.dto';

@Injectable()
export class SidebarFavoritesService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(user_uuid: string): Promise<SidebarFavorite[]> {
        return this.prisma.sidebarFavorite.findMany({
            where: { user_uuid },
            orderBy: [{ order_index: 'asc' }, { id: 'asc' }],
        });
    }

    async create(
        user_uuid: string,
        dto: CreateSidebarFavoriteDto,
    ): Promise<SidebarFavorite> {
        const existing = await this.prisma.sidebarFavorite.findUnique({
            where: { user_uuid_nav_key: { user_uuid, nav_key: dto.nav_key } },
        });
        if (existing) {
            return existing;
        }

        // New favorites default to order_index 0 and sort after existing ones via
        // the `id` tiebreak in findAll - avoids a read-then-write race on "last
        // order_index" when two adds happen concurrently. reorder() below assigns
        // explicit sequential values once the user actually drags to reorder.
        try {
            return await this.prisma.sidebarFavorite.create({
                data: {
                    user_uuid,
                    nav_key: dto.nav_key,
                },
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                const raced = await this.prisma.sidebarFavorite.findUnique({
                    where: { user_uuid_nav_key: { user_uuid, nav_key: dto.nav_key } },
                });
                if (raced) {
                    return raced;
                }
            }
            throw error;
        }
    }

    async reorder(
        user_uuid: string,
        dto: ReorderSidebarFavoritesDto,
    ): Promise<SidebarFavorite[]> {
        await this.prisma.$transaction(
            dto.nav_keys.map((nav_key, order_index) =>
                this.prisma.sidebarFavorite.updateMany({
                    where: { user_uuid, nav_key },
                    data: { order_index },
                }),
            ),
        );
        return this.findAll(user_uuid);
    }

    async remove(user_uuid: string, nav_key: string): Promise<{ nav_key: string }> {
        await this.prisma.sidebarFavorite.deleteMany({
            where: { user_uuid, nav_key },
        });
        return { nav_key };
    }
}
