import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
    ActivityAction,
    ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';
import { SequencesService } from './services/sequences.service';
import { SequenceEnrollmentService } from './services/sequence-enrollment.service';
import { CreateSequenceDto } from './dto/create-sequence.dto';
import { UpdateSequenceDto } from './dto/update-sequence.dto';
import { CreateSequenceStepDto } from './dto/create-sequence-step.dto';
import { UpdateSequenceStepDto } from './dto/update-sequence-step.dto';
import { ReorderSequenceStepsDto } from './dto/reorder-sequence-steps.dto';
import { EnrollContactDto } from './dto/enroll-contact.dto';
import { ListSequencesDto } from './dto/list-sequences.dto';

@ApiTags('sequences')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('sequences')
export class SequencesController {
    constructor(
        private readonly sequencesService: SequencesService,
        private readonly enrollmentService: SequenceEnrollmentService,
    ) {}

    @ActivityLog({
        entityType: ActivityEntityType.OUTREACH_SEQUENCE,
        action: ActivityAction.CREATED,
        includeBodyKeys: ['name'],
    })
    @Post()
    @ApiOperation({ summary: 'Create a draft outreach sequence' })
    create(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Body() dto: CreateSequenceDto,
    ) {
        return this.sequencesService.create(organisation_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List outreach sequences' })
    findAll(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Query() query: ListSequencesDto,
    ) {
        return this.sequencesService.findAll(organisation_uuid, query);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a sequence with its steps' })
    findOne(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
    ) {
        return this.sequencesService.findOne(organisation_uuid, uuid);
    }

    @ActivityLog({
        entityType: ActivityEntityType.OUTREACH_SEQUENCE,
        action: ActivityAction.UPDATED,
        entityUuidFrom: 'params.uuid',
    })
    @Put(':uuid')
    @ApiOperation({ summary: 'Update sequence name/description' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Body() dto: UpdateSequenceDto,
    ) {
        return this.sequencesService.update(organisation_uuid, uuid, dto);
    }

    @ActivityLog({
        entityType: ActivityEntityType.OUTREACH_SEQUENCE,
        action: ActivityAction.DELETED,
        entityUuidFrom: 'params.uuid',
    })
    @Delete(':uuid')
    @ApiOperation({
        summary: 'Delete a draft/archived sequence with no active enrollments',
    })
    remove(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
    ) {
        return this.sequencesService.remove(organisation_uuid, uuid);
    }

    @ActivityLog({
        entityType: ActivityEntityType.OUTREACH_SEQUENCE,
        action: ActivityAction.STARTED,
        entityUuidFrom: 'params.uuid',
    })
    @Post(':uuid/activate')
    @ApiOperation({
        summary: 'Activate a draft sequence so it can accept enrollments',
    })
    activate(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
    ) {
        return this.sequencesService.activate(organisation_uuid, uuid);
    }

    @ActivityLog({
        entityType: ActivityEntityType.OUTREACH_SEQUENCE,
        action: ActivityAction.CANCELLED,
        entityUuidFrom: 'params.uuid',
    })
    @Post(':uuid/archive')
    @ApiOperation({
        summary: 'Archive a sequence so it can no longer accept enrollments',
    })
    archive(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
    ) {
        return this.sequencesService.archive(organisation_uuid, uuid);
    }

    @ActivityLog({
        entityType: ActivityEntityType.OUTREACH_SEQUENCE,
        action: ActivityAction.UPDATED,
        entityUuidFrom: 'params.uuid',
    })
    @Post(':uuid/steps')
    @ApiOperation({ summary: 'Add a step to a sequence' })
    addStep(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Body() dto: CreateSequenceStepDto,
    ) {
        return this.sequencesService.addStep(organisation_uuid, uuid, dto);
    }

    @ActivityLog({
        entityType: ActivityEntityType.OUTREACH_SEQUENCE,
        action: ActivityAction.UPDATED,
        entityUuidFrom: 'params.uuid',
    })
    @Put(':uuid/steps/:step_uuid')
    @ApiOperation({ summary: 'Update a sequence step' })
    updateStep(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Param('step_uuid', ParseUUIDPipe) step_uuid: string,
        @Body() dto: UpdateSequenceStepDto,
    ) {
        return this.sequencesService.updateStep(
            organisation_uuid,
            uuid,
            step_uuid,
            dto,
        );
    }

    @ActivityLog({
        entityType: ActivityEntityType.OUTREACH_SEQUENCE,
        action: ActivityAction.UPDATED,
        entityUuidFrom: 'params.uuid',
    })
    @Delete(':uuid/steps/:step_uuid')
    @ApiOperation({
        summary: 'Delete a step (draft sequences only; disable it otherwise)',
    })
    removeStep(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Param('step_uuid', ParseUUIDPipe) step_uuid: string,
    ) {
        return this.sequencesService.removeStep(
            organisation_uuid,
            uuid,
            step_uuid,
        );
    }

    @ActivityLog({
        entityType: ActivityEntityType.OUTREACH_SEQUENCE,
        action: ActivityAction.REORDERED,
        entityUuidFrom: 'params.uuid',
    })
    @Post(':uuid/steps/reorder')
    @ApiOperation({ summary: 'Reorder sequence steps' })
    reorderSteps(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Body() dto: ReorderSequenceStepsDto,
    ) {
        return this.sequencesService.reorderSteps(organisation_uuid, uuid, dto);
    }

    @ActivityLog({
        entityType: ActivityEntityType.OUTREACH_SEQUENCE,
        action: ActivityAction.SEQUENCE_ASSIGNED,
        entityUuidFrom: 'params.uuid',
    })
    @Post(':uuid/enroll')
    @ApiOperation({
        summary:
            'Enroll a contact in a sequence and schedule its step messages',
    })
    @ApiResponse({ status: 201 })
    enroll(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Body() dto: EnrollContactDto,
    ) {
        return this.enrollmentService.enrollContact(
            organisation_uuid,
            uuid,
            dto.contact_uuid,
            user_uuid,
        );
    }

    @Get(':uuid/enrollments')
    @ApiOperation({ summary: "List a sequence's contact enrollments" })
    listEnrollments(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.enrollmentService.listEnrollments(
            organisation_uuid,
            uuid,
            page ? Number(page) : undefined,
            limit ? Number(limit) : undefined,
        );
    }

    @ActivityLog({
        entityType: ActivityEntityType.OUTREACH_SEQUENCE,
        action: ActivityAction.RUN_STOPPED,
        entityUuidFrom: 'params.enrollment_uuid',
    })
    @Post(':uuid/enrollments/:enrollment_uuid/cancel')
    @ApiOperation({
        summary:
            "Cancel a contact's active enrollment and its unsent step messages",
    })
    cancelEnrollment(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('enrollment_uuid', ParseUUIDPipe) enrollment_uuid: string,
    ) {
        return this.enrollmentService.cancelEnrollment(
            organisation_uuid,
            enrollment_uuid,
        );
    }
}
