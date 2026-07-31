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
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { SenderProfilesService } from './sender-profiles.service';
import { CreateSenderProfileDto } from './dto/create-sender-profile.dto';
import { UpdateSenderProfileDto } from './dto/update-sender-profile.dto';

@ApiTags('sender-profiles')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('sender-profiles')
export class SenderProfilesController {
    constructor(private readonly senderProfilesService: SenderProfilesService) { }

    @Post()
    @ApiOperation({ summary: 'Create a sender profile for the current user' })
    @ApiResponse({ status: 201 })
    create(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Body() dto: CreateSenderProfileDto,
    ) {
        return this.senderProfilesService.create(organisation_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List sender profiles for the current user' })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string) {
        return this.senderProfilesService.findAll(organisation_uuid);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a sender profile by uuid' })
    @ApiResponse({ status: 404, description: 'Sender profile not found' })
    findOne(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.senderProfilesService.findOne(organisation_uuid, uuid);
    }

    @Put(':uuid')
    @ApiOperation({ summary: 'Update a sender profile' })
    @ApiResponse({ status: 404, description: 'Sender profile not found' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateSenderProfileDto,
    ) {
        return this.senderProfilesService.update(organisation_uuid, uuid, dto);
    }

    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete a sender profile' })
    @ApiResponse({ status: 404, description: 'Sender profile not found' })
    remove(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.senderProfilesService.remove(organisation_uuid, uuid);
    }
}
