import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ListThreadContactsDto } from './dto/list-thread-contacts.dto';
import { ThreadsService } from './threads.service';

@ApiTags('threads')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('threads')
export class ThreadsController {
    constructor(private readonly threadsService: ThreadsService) { }

    @Get()
    @ApiOperation({
        summary: 'List contacts who have send history, most recently active first (inbox view left pane)',
    })
    async listInboxContacts(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Query() dto: ListThreadContactsDto,
    ) {
        return this.threadsService.listInboxContacts(organisation_uuid, dto);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a thread and its full message timeline (outbound sends + inbound replies)' })
    async getThread(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        const detail = await this.threadsService.getThreadDetail(organisation_uuid, uuid);
        if (!detail) {
            throw new NotFoundException(`Thread ${uuid} not found`);
        }
        return detail;
    }
}
