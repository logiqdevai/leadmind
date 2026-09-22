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
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
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
import { BulkEnrollContactsDto } from './dto/bulk-enroll-contacts.dto';
import { ListSequencesDto } from './dto/list-sequences.dto';
import { EmailProviderTarget } from '@/modules/integrations/interfaces/email-credentials.interface';

function toEmailProviderTarget(dto: {
    email_provider?: string;
    email_account?: string;
    email_domain_uuid?: string;
}): EmailProviderTarget | undefined {
    if (!dto.email_provider || !dto.email_account) return undefined;
    return {
        provider: dto.email_provider as EmailProviderTarget['provider'],
        account: dto.email_account.trim(),
        ...(dto.email_domain_uuid ? { domain_uuid: dto.email_domain_uuid } : {}),
    };
}

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
    @ApiResponse({ status: 201 })
    create(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Body() dto: CreateSequenceDto,
    ) {
        return this.sequencesService.create(organisation_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List outreach sequences' })
    @ApiResponse({ status: 200 })
    findAll(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Query() query: ListSequencesDto,
    ) {
        return this.sequencesService.findAll(organisation_uuid, query);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a sequence with its steps' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Sequence not found' })
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
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Sequence not found' })
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
    @UseGuards(OrganisationRolesGuard)
    @OrganisationRoles(OrganisationRole.ADMIN)
    @ApiOperation({
        summary: 'Delete a draft/archived sequence with no active enrollments',
    })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 403, description: 'Forbidden — organisation admin role required' })
    @ApiResponse({ status: 404, description: 'Sequence not found' })
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
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 404, description: 'Sequence not found' })
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
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 404, description: 'Sequence not found' })
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
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 404, description: 'Sequence not found' })
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
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Sequence or step not found' })
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
    @UseGuards(OrganisationRolesGuard)
    @OrganisationRoles(OrganisationRole.ADMIN)
    @ApiOperation({
        summary: 'Delete a step (draft sequences only; disable it otherwise)',
    })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 403, description: 'Forbidden — organisation admin role required' })
    @ApiResponse({ status: 404, description: 'Sequence or step not found' })
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
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 404, description: 'Sequence not found' })
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
    @ApiResponse({ status: 404, description: 'Sequence or contact not found' })
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
            undefined,
            dto.list_uuid,
            toEmailProviderTarget(dto),
        );
    }

    @ActivityLog({
        entityType: ActivityEntityType.OUTREACH_SEQUENCE,
        action: ActivityAction.SEQUENCE_ASSIGNED,
        entityUuidFrom: 'params.uuid',
    })
    @Post(':uuid/enroll-bulk')
    @ApiOperation({
        summary:
            'Enroll multiple contacts in a sequence and schedule their step messages',
    })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 404, description: 'Sequence not found' })
    enrollBulk(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Body() dto: BulkEnrollContactsDto,
    ) {
        return this.enrollmentService.bulkEnroll(
            organisation_uuid,
            uuid,
            dto.contact_uuids,
            undefined,
            user_uuid,
            dto.list_uuid,
            toEmailProviderTarget(dto),
        );
    }

    @Get(':uuid/enrollments')
    @ApiOperation({ summary: "List a sequence's contact enrollments" })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Sequence not found' })
    @ApiQuery({ name: 'page', type: Number, required: false })
    @ApiQuery({ name: 'limit', type: Number, required: false })
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
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 404, description: 'Enrollment not found' })
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
