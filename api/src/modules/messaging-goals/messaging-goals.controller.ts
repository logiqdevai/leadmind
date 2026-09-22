import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GoalPeriod } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { MessagingGoalsService } from './messaging-goals.service';
import { CreateMessagingGoalDto } from './dto/create-messaging-goal.dto';
import { UpdateMessagingGoalDto } from './dto/update-messaging-goal.dto';
import { BulkUpsertMessagingGoalsDto } from './dto/bulk-upsert-messaging-goals.dto';
import {
    AchievementsQuerySchema,
    AchievementsQueryType,
    LeaderboardQuerySchema,
    LeaderboardQueryType,
} from './dto/messaging-goals-query.schema';

@ApiTags('messaging-goals')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('messaging-goals')
export class MessagingGoalsController {
    constructor(private readonly messagingGoalsService: MessagingGoalsService) {}

    @Post()
    @ApiOperation({ summary: 'Create or upsert a messaging goal for a member' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    upsert(
        @CurrentUser('organisation_uuid') organisationUuid: string,
        @CurrentUser('uuid') userUuid: string,
        @Body() dto: CreateMessagingGoalDto,
    ) {
        return this.messagingGoalsService.upsert(organisationUuid, userUuid, dto);
    }

    @Post('bulk')
    @ApiOperation({ summary: 'Bulk upsert messaging goals for members' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    bulkUpsert(
        @CurrentUser('organisation_uuid') organisationUuid: string,
        @CurrentUser('uuid') userUuid: string,
        @Body() dto: BulkUpsertMessagingGoalsDto,
    ) {
        return this.messagingGoalsService.bulkUpsert(organisationUuid, userUuid, dto);
    }

    @Get('me')
    @ApiOperation({ summary: 'Get my active messaging goals with progress' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    listMine(
        @CurrentUser('organisation_uuid') organisationUuid: string,
        @CurrentUser('uuid') userUuid: string,
    ) {
        return this.messagingGoalsService.listMine(organisationUuid, userUuid);
    }

    @Get()
    @ApiOperation({ summary: 'List all active org messaging goals with progress' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    listAll(
        @CurrentUser('organisation_uuid') organisationUuid: string,
        @CurrentUser('uuid') userUuid: string,
    ) {
        return this.messagingGoalsService.listAll(organisationUuid, userUuid);
    }

    @Get('leaderboard')
    @ApiOperation({ summary: 'Messaging goals leaderboard for a period' })
    @ApiQuery({ name: 'period', enum: GoalPeriod, required: false, description: 'Defaults to DAY' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    leaderboard(
        @CurrentUser('organisation_uuid') organisationUuid: string,
        @CurrentUser('uuid') userUuid: string,
        @Query(new ZodValidationPipe(LeaderboardQuerySchema)) query: LeaderboardQueryType,
    ) {
        return this.messagingGoalsService.leaderboard(
            organisationUuid,
            userUuid,
            query.period ?? GoalPeriod.DAY,
        );
    }

    @Get('achievements')
    @ApiOperation({ summary: 'List my goal achievements' })
    @ApiQuery({ name: 'unseen', type: String, required: false, description: '"true" or "1" to filter to unseen achievements only' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    listAchievements(
        @CurrentUser('organisation_uuid') organisationUuid: string,
        @CurrentUser('uuid') userUuid: string,
        @Query(new ZodValidationPipe(AchievementsQuerySchema)) query: AchievementsQueryType,
    ) {
        return this.messagingGoalsService.listAchievements(
            organisationUuid,
            userUuid,
            query.unseen,
        );
    }

    @Post('achievements/:uuid/seen')
    @ApiOperation({ summary: 'Mark an achievement as seen' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Achievement not found' })
    markSeen(
        @CurrentUser('organisation_uuid') organisationUuid: string,
        @CurrentUser('uuid') userUuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.messagingGoalsService.markAchievementSeen(
            organisationUuid,
            userUuid,
            uuid,
        );
    }

    @Patch(':uuid')
    @ApiOperation({ summary: 'Update a messaging goal' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Messaging goal not found' })
    update(
        @CurrentUser('organisation_uuid') organisationUuid: string,
        @CurrentUser('uuid') userUuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateMessagingGoalDto,
    ) {
        return this.messagingGoalsService.update(organisationUuid, userUuid, uuid, dto);
    }

    @Delete(':uuid')
    @ApiOperation({ summary: 'Deactivate a messaging goal' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Messaging goal not found' })
    deactivate(
        @CurrentUser('organisation_uuid') organisationUuid: string,
        @CurrentUser('uuid') userUuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.messagingGoalsService.deactivate(organisationUuid, userUuid, uuid);
    }
}
