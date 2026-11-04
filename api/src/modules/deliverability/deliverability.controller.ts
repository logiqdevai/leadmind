import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CreateDeliverabilityScheduleDto } from './dto/create-deliverability-schedule.dto';
import { UpdateDeliverabilityScheduleDto } from './dto/update-deliverability-schedule.dto';
import { DeliverabilitySchedulesService } from './services/deliverability-schedules.service';

@ApiTags('deliverability')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('deliverability')
export class DeliverabilityController {
  constructor(private readonly schedules: DeliverabilitySchedulesService) {}

  @Get('schedules')
  @ApiOperation({ summary: 'List deliverability schedules with their latest run and sending restriction' })
  list(@CurrentUser('organisation_uuid') organisation_uuid: string) {
    return this.schedules.list(organisation_uuid);
  }

  @Post('schedules')
  @ApiOperation({ summary: 'Create a recurring deliverability check' })
  @ApiResponse({ status: 201 })
  create(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Body() dto: CreateDeliverabilityScheduleDto,
  ) {
    return this.schedules.create(organisation_uuid, dto);
  }

  @Patch('schedules/:uuid')
  @ApiOperation({ summary: 'Update a schedule (cadence, checks, action mode, target)' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  update(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
    @Body() dto: UpdateDeliverabilityScheduleDto,
  ) {
    return this.schedules.update(organisation_uuid, uuid, dto);
  }

  @Delete('schedules/:uuid')
  @ApiOperation({ summary: 'Delete a schedule, its run history and any sending restriction it applied' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  remove(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.schedules.remove(organisation_uuid, uuid);
  }

  @Post('schedules/:uuid/run')
  @HttpCode(202)
  @ApiOperation({ summary: 'Queue a run now, outside the schedule' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  runNow(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.schedules.runNow(organisation_uuid, uuid);
  }

  @Get('schedules/:uuid/runs')
  @ApiOperation({ summary: 'Recent runs of a schedule, newest first' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  listRuns(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.schedules.listRuns(organisation_uuid, uuid);
  }

  @Delete('schedules/:uuid/restriction')
  @ApiOperation({ summary: 'Lift the sending restriction a schedule has applied' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  liftRestriction(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.schedules.liftRestriction(organisation_uuid, uuid);
  }

  @Post('runs/:uuid/apply-recommendation')
  @ApiOperation({ summary: "Apply a run's recommended daily send cap" })
  @ApiResponse({ status: 404, description: 'Run not found' })
  applyRecommendation(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.schedules.applyRecommendation(organisation_uuid, uuid);
  }
}
