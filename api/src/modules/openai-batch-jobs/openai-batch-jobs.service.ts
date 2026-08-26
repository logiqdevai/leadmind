import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ListBatchJobsDto } from './dto/list-batch-jobs.dto';

@Injectable()
export class OpenAiBatchJobsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organisation_uuid: string, dto: ListBatchJobsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      organisation_uuid,
      ...(dto.type ? { type: dto.type } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.openAiBatchJob.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          organisation: { select: { uuid: true, name: true } },
          user: { select: { uuid: true, email: true, full_name: true } },
        },
      }),
      this.prisma.openAiBatchJob.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
