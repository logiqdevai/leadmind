import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OpenAiBatchJobsService } from './openai-batch-jobs.service';
import { ListBatchJobsDto } from './dto/list-batch-jobs.dto';

@ApiTags('openai-batch-jobs')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('openai-batch-jobs')
export class OpenAiBatchJobsController {
  constructor(
    private readonly openAiBatchJobsService: OpenAiBatchJobsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List OpenAI batch jobs for the current organisation',
  })
  findAll(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Query() query: ListBatchJobsDto,
  ) {
    return this.openAiBatchJobsService.findAll(organisation_uuid, query);
  }
}
