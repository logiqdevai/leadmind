import {
    Body,
    Controller,
    Delete,
    Get,
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
import { SavedContactFiltersService } from './saved-contact-filters.service';
import { CreateSavedContactFilterDto } from './dto/create-saved-contact-filter.dto';
import { UpdateSavedContactFilterDto } from './dto/update-saved-contact-filter.dto';

@ApiTags('saved-contact-filters')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('saved-contact-filters')
export class SavedContactFiltersController {
    constructor(private readonly savedContactFiltersService: SavedContactFiltersService) { }

    @Post()
    @ApiOperation({ summary: 'Save a contact filter configuration' })
    @ApiResponse({ status: 201 })
    create(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Body() dto: CreateSavedContactFilterDto,
    ) {
        return this.savedContactFiltersService.create(organisation_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List saved contact filters' })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string) {
        return this.savedContactFiltersService.findAll(organisation_uuid);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a saved contact filter by uuid' })
    @ApiResponse({ status: 404, description: 'Saved contact filter not found' })
    findOne(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.savedContactFiltersService.findOne(organisation_uuid, uuid);
    }

    @Patch(':uuid')
    @ApiOperation({ summary: 'Update a saved contact filter' })
    @ApiResponse({ status: 404, description: 'Saved contact filter not found' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateSavedContactFilterDto,
    ) {
        return this.savedContactFiltersService.update(organisation_uuid, uuid, dto);
    }

    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete a saved contact filter' })
    @ApiResponse({ status: 404, description: 'Saved contact filter not found' })
    remove(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.savedContactFiltersService.remove(organisation_uuid, uuid);
    }
}
