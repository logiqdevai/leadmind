import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { ScoringInstructionsService } from './scoring-instructions.service';
import { CreateScoringInstructionDto } from './dto/create-scoring-instruction.dto';
import { UpdateScoringInstructionDto } from './dto/update-scoring-instruction.dto';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
    ActivityAction,
    ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';

@ApiTags('scoring-instructions')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('scoring-instructions')
export class ScoringInstructionsController {
    constructor(private readonly scoringInstructionsService: ScoringInstructionsService) {}

    @ActivityLog({ entityType: ActivityEntityType.SCORING_INSTRUCTION, action: ActivityAction.CREATED })
    @Post()
    @ApiOperation({ summary: 'Create a scoring instruction' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    create(@CurrentUser('organisation_uuid') organisation_uuid: string, @Body() dto: CreateScoringInstructionDto) {
        return this.scoringInstructionsService.create(organisation_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List scoring instructions for the current user' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string) {
        return this.scoringInstructionsService.findAll(organisation_uuid);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a scoring instruction by uuid' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Scoring instruction not found' })
    findOne(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.scoringInstructionsService.findOne(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.SCORING_INSTRUCTION, action: ActivityAction.UPDATED, entityUuidFrom: 'params.uuid' })
    @Put(':uuid')
    @ApiOperation({ summary: 'Update a scoring instruction' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Scoring instruction not found' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateScoringInstructionDto,
    ) {
        return this.scoringInstructionsService.update(organisation_uuid, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.SCORING_INSTRUCTION, action: ActivityAction.DELETED, entityUuidFrom: 'params.uuid' })
    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete a scoring instruction' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Scoring instruction not found' })
    remove(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.scoringInstructionsService.remove(organisation_uuid, uuid);
    }
}
