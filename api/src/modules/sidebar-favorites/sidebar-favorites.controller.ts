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
import { SidebarFavoritesService } from './sidebar-favorites.service';
import { CreateSidebarFavoriteDto } from './dto/create-sidebar-favorite.dto';
import { ReorderSidebarFavoritesDto } from './dto/reorder-sidebar-favorites.dto';

@ApiTags('sidebar-favorites')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('sidebar-favorites')
export class SidebarFavoritesController {
    constructor(private readonly sidebarFavoritesService: SidebarFavoritesService) { }

    @Get()
    @ApiOperation({ summary: "List the current user's favorited sidebar links" })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    findAll(@CurrentUser('uuid') user_uuid: string) {
        return this.sidebarFavoritesService.findAll(user_uuid);
    }

    @Post()
    @ApiOperation({ summary: 'Favorite a sidebar link' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    create(
        @CurrentUser('uuid') user_uuid: string,
        @Body() dto: CreateSidebarFavoriteDto,
    ) {
        return this.sidebarFavoritesService.create(user_uuid, dto);
    }

    @Patch('reorder')
    @ApiOperation({ summary: 'Reorder favorited sidebar links' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    reorder(
        @CurrentUser('uuid') user_uuid: string,
        @Body() dto: ReorderSidebarFavoritesDto,
    ) {
        return this.sidebarFavoritesService.reorder(user_uuid, dto);
    }

    @Delete(':nav_key')
    @ApiOperation({ summary: 'Unfavorite a sidebar link' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    remove(
        @CurrentUser('uuid') user_uuid: string,
        @Param('nav_key') nav_key: string,
    ) {
        return this.sidebarFavoritesService.remove(user_uuid, decodeURIComponent(nav_key));
    }
}
