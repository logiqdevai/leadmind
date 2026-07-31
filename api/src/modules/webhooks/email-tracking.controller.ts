import {
    Controller,
    Get,
    Logger,
    NotFoundException,
    Param,
    Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { TRANSPARENT_GIF } from '@/shared/utils/email-tracking.util';
import { EmailTrackingService } from './services/email-tracking.service';

@ApiTags('tracking')
@Controller('t')
export class EmailTrackingController {
    private readonly logger = new Logger(EmailTrackingController.name);

    constructor(
        private readonly emailTrackingService: EmailTrackingService,
        private readonly configService: ConfigService,
    ) {}

    @Get('o/:token')
    @ApiOperation({ summary: 'SMTP email open tracking pixel' })
    async open(@Param('token') token: string, @Res() res: Response): Promise<void> {
        try {
            const secret = this.configService.get<string>('JWT_SECRET');
            if (secret) {
                const payload = this.emailTrackingService.parseToken(token, secret);
                if (payload?.t === 'o') {
                    await this.emailTrackingService.recordOpen(payload.m);
                }
            }
        } catch (error) {
            this.logger.warn(
                `Open pixel ingest failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        res.set({
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            Pragma: 'no-cache',
            Expires: '0',
        });
        res.status(200).send(TRANSPARENT_GIF);
    }

    @Get('c/:token')
    @ApiOperation({ summary: 'SMTP email click tracking redirect' })
    async click(@Param('token') token: string, @Res() res: Response): Promise<void> {
        const secret = this.configService.get<string>('JWT_SECRET');
        if (!secret) {
            throw new NotFoundException();
        }

        const payload = this.emailTrackingService.parseToken(token, secret);
        if (!payload || payload.t !== 'c') {
            throw new NotFoundException();
        }

        let destination: string | null = null;
        try {
            destination = await this.emailTrackingService.recordClick(payload.m, payload.u);
        } catch (error) {
            this.logger.warn(
                `Click tracking ingest failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            destination = payload.u;
        }

        if (!destination) {
            throw new NotFoundException();
        }

        res.redirect(302, destination);
    }
}
