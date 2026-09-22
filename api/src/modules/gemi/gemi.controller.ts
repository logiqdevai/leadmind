import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { GemiService } from '@/integrations/gemi/gemi.service';

@ApiTags('gemi')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('gemi')
export class GemiController {
    constructor(private readonly gemiService: GemiService) {}

    @Get('prefectures')
    @ApiOperation({ summary: 'List Greek prefectures for filter selection' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    getPrefectures() {
        return this.gemiService.getPrefectures();
    }

    @Get('legal-types')
    @ApiOperation({ summary: 'List GEMI legal entity types for filter selection' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    getLegalTypes() {
        return this.gemiService.getLegalTypes();
    }

    @Get('statuses')
    @ApiOperation({ summary: 'List GEMI company statuses for filter selection' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    getStatuses() {
        return this.gemiService.getCompanyStatuses();
    }
}
