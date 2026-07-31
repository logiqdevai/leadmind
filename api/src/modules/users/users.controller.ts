import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get('me')
    @ApiOperation({ summary: 'Get the current user profile' })
    getMe(@CurrentUser('uuid') userUuid: string) {
        return this.usersService.getMe(userUuid);
    }

    @Patch('me')
    @ApiOperation({ summary: 'Update the current user profile' })
    updateMe(@CurrentUser('uuid') userUuid: string, @Body() dto: UpdateUserDto) {
        return this.usersService.updateMe(userUuid, dto);
    }

    @Patch('me/password')
    @ApiOperation({ summary: 'Change the current user password' })
    changePassword(@CurrentUser('uuid') userUuid: string, @Body() dto: ChangePasswordDto) {
        return this.usersService.changePassword(userUuid, dto);
    }
}
