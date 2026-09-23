import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { OAuthInteractionService } from './interaction.service';
import { InteractionLoginDto } from './dto/interaction-login.dto';
import { InteractionSelectOrganisationDto } from './dto/interaction-select-organisation.dto';

/**
 * Server-rendered login/consent pages for the OAuth authorization code flow
 * (oidc-provider redirects the browser here - see
 * OidcProviderService's `interactions.url`). Excluded from the OpenAPI
 * document and from the MCP tool set: this is a browser UI, not an API a
 * tool-calling agent should invoke directly.
 */
@ApiExcludeController()
@Controller('oauth/interaction')
export class OAuthInteractionController {
  constructor(private readonly interactions: OAuthInteractionService) {}

  @Get(':uid')
  render(@Req() req: Request, @Res() res: Response) {
    return this.interactions.render(req, res);
  }

  @Post(':uid/login')
  login(
    @Req() req: Request,
    @Res() res: Response,
    @Param('uid') uid: string,
    @Body() dto: InteractionLoginDto,
  ) {
    return this.interactions.submitLogin(req, res, uid, dto);
  }

  @Post(':uid/select-organisation')
  selectOrganisation(
    @Req() req: Request,
    @Res() res: Response,
    @Param('uid') uid: string,
    @Body() dto: InteractionSelectOrganisationDto,
  ) {
    return this.interactions.submitOrganisationSelection(req, res, uid, dto);
  }

  @Post(':uid/confirm')
  confirm(@Req() req: Request, @Res() res: Response) {
    return this.interactions.confirmConsent(req, res);
  }

  @Post(':uid/abort')
  abort(@Req() req: Request, @Res() res: Response) {
    return this.interactions.abortConsent(req, res);
  }
}
