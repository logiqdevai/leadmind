import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OAuthInteractionService } from './interaction.service';
import { InteractionLoginDto } from './dto/interaction-login.dto';

/**
 * JSON API backing the frontend's `/oauth/authorize/:uid` page (see
 * OidcProviderService's `interactions.url`) - not server-rendered HTML, and
 * not part of the public API surface, so excluded from the OpenAPI document
 * and, consequently, the MCP tool set too.
 */
@ApiExcludeController()
@Controller('oauth/interaction')
export class OAuthInteractionController {
  constructor(private readonly interactions: OAuthInteractionService) {}

  @Get(':uid')
  getDetails(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('uid') uid: string,
  ) {
    return this.interactions.getDetails(req, res, uid);
  }

  @UseGuards(JwtGuard)
  @Post(':uid/login')
  login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('uid') uid: string,
    @Body() dto: InteractionLoginDto,
    @CurrentUser('uuid') userUuid: string,
  ) {
    return this.interactions.login(req, res, uid, dto, userUuid);
  }

  @Post(':uid/confirm')
  confirm(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('uid') uid: string,
  ) {
    return this.interactions.confirm(req, res, uid);
  }

  @Post(':uid/abort')
  abort(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('uid') uid: string,
  ) {
    return this.interactions.abort(req, res, uid);
  }
}
