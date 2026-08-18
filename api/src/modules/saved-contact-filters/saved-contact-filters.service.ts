import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SavedContactFilter } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { CreateSavedContactFilterDto } from './dto/create-saved-contact-filter.dto';
import { UpdateSavedContactFilterDto } from './dto/update-saved-contact-filter.dto';

@Injectable()
export class SavedContactFiltersService {
    constructor(private readonly prisma: PrismaService) { }

    async create(
        organisation_uuid: string,
        dto: CreateSavedContactFilterDto,
    ): Promise<SavedContactFilter> {
        return this.prisma.savedContactFilter.create({
            data: {
                organisation_uuid,
                name: dto.name.trim(),
                filters: dto.filters as Prisma.InputJsonValue,
            },
        });
    }

    async findAll(organisation_uuid: string): Promise<SavedContactFilter[]> {
        return this.prisma.savedContactFilter.findMany({
            where: { organisation_uuid },
            orderBy: { updated_at: 'desc' },
        });
    }

    async findOne(organisation_uuid: string, uuid: string): Promise<SavedContactFilter> {
        return this.requireOwnedFilter(organisation_uuid, uuid);
    }

    async update(
        organisation_uuid: string,
        uuid: string,
        dto: UpdateSavedContactFilterDto,
    ): Promise<SavedContactFilter> {
        await this.requireOwnedFilter(organisation_uuid, uuid);

        const data: Prisma.SavedContactFilterUpdateInput = {};
        if (dto.name !== undefined) {
            data.name = dto.name.trim();
        }
        if (dto.filters !== undefined) {
            data.filters = dto.filters as Prisma.InputJsonValue;
        }

        return this.prisma.savedContactFilter.update({
            where: { uuid },
            data,
        });
    }

    async remove(organisation_uuid: string, uuid: string): Promise<{ uuid: string }> {
        await this.requireOwnedFilter(organisation_uuid, uuid);
        await this.prisma.savedContactFilter.delete({ where: { uuid } });
        return { uuid };
    }

    private async requireOwnedFilter(
        organisation_uuid: string,
        uuid: string,
    ): Promise<SavedContactFilter> {
        const record = await this.prisma.savedContactFilter.findFirst({
            where: { uuid, organisation_uuid },
        });
        if (!record) {
            throw new NotFoundException(`Saved contact filter ${uuid} not found`);
        }
        return record;
    }
}
