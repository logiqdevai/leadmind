import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
  ActivityAction,
  ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';
import { MailTesterService } from './mail-tester.service';
import { CreateMailTesterTestDto } from './dto/create-mail-tester-test.dto';

@ApiTags('mail-tester')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('mail-tester')
export class MailTesterController {
  constructor(private readonly mailTesterService: MailTesterService) {}

  @Get('tests')
  @ApiOperation({ summary: 'List recent Mail-Tester deliverability tests' })
  listTests(@CurrentUser('organisation_uuid') organisation_uuid: string) {
    return this.mailTesterService.listTests(organisation_uuid);
  }

  @ActivityLog({
    entityType: ActivityEntityType.INTEGRATION,
    action: ActivityAction.MAIL_TEST_STARTED,
    entityUuidFrom: 'result.uuid',
  })
  @Post('tests')
  @ApiOperation({
    summary: 'Send a deliverability test email and start tracking the result',
  })
  startTest(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Body() dto: CreateMailTesterTestDto,
  ) {
    return this.mailTesterService.startTest(organisation_uuid, dto);
  }

  @Post('tests/:uuid/refresh')
  @ApiOperation({ summary: 'Fetch the latest Mail-Tester result for a test' })
  @ApiResponse({ status: 404, description: 'Test not found' })
  refreshResult(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.mailTesterService.refreshResult(organisation_uuid, uuid);
  }

  @Post('tests/:uuid/ai-audit')
  @ApiOperation({
    summary:
      'Run an AI audit of a Mail-Tester result (overwrites the previous audit)',
  })
  @ApiResponse({ status: 404, description: 'Test not found' })
  runAiAudit(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.mailTesterService.runAiAudit(organisation_uuid, uuid);
  }
}
