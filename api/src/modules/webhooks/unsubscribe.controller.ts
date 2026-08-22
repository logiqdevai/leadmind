import {
    Controller,
    Get,
    HttpCode,
    Param,
    Post,
    Req,
    Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { UnsubscribeService } from './services/unsubscribe.service';

@ApiTags('webhooks')
@Controller('unsubscribe')
export class UnsubscribeController {
    constructor(private readonly unsubscribeService: UnsubscribeService) {}

    @Get(':token')
    @ApiOperation({ summary: 'Public unsubscribe preview (does not unsubscribe until POST)' })
    async unsubscribeGet(
        @Param('token') token: string,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        const preview = await this.unsubscribeService.previewByToken(token);
        const accept = req.headers.accept ?? '';
        if (accept.includes('application/json')) {
            res.json(preview);
            return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(renderCardHtml(preview.email ?? '', preview.already, token));
    }

    @Post(':token/resubscribe')
    @HttpCode(200)
    @ApiOperation({ summary: 'Restore marketing email from unsubscribe token' })
    async resubscribePost(
        @Param('token') token: string,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        const result = await this.unsubscribeService.resubscribeByToken(token);
        if (wantsJson(req)) {
            res.json(result);
            return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(renderCardHtml(result.email ?? '', false, token));
    }

    @Post(':token')
    @HttpCode(200)
    @ApiOperation({ summary: 'Confirm unsubscribe' })
    async unsubscribePost(
        @Param('token') token: string,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        const result = await this.unsubscribeService.unsubscribeByToken(token);
        if (wantsJson(req)) {
            res.json({ ...result, already: true });
            return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(renderCardHtml(result.email ?? '', true, token));
    }
}

function wantsJson(req: Request): boolean {
    const accept = req.headers.accept ?? '';
    const jsonIdx = accept.indexOf('application/json');
    const htmlIdx = accept.indexOf('text/html');
    if (jsonIdx === -1) return htmlIdx === -1;
    if (htmlIdx === -1) return true;
    return jsonIdx < htmlIdx;
}

function renderCardHtml(email: string, unsubscribed: boolean, token: string): string {
    const safeEmail = escapeHtml(email);
    const safeToken = encodeURIComponent(token);
    const title = unsubscribed ? 'Unsubscribed' : 'Unsubscribe';
    const heading = unsubscribed ? 'You are unsubscribed' : 'Unsubscribe';
    const lead = unsubscribed
        ? `We will not send marketing email to <strong>${safeEmail}</strong>.`
        : `Stop marketing email to <strong>${safeEmail}</strong>?`;
    const action = unsubscribed
        ? `<form method="post" action="/unsubscribe/${safeToken}/resubscribe"><button type="submit">Subscribe again</button></form>`
        : `<form method="post" action="/unsubscribe/${safeToken}"><button type="submit">Unsubscribe</button></form>`;
    return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:#111c1b;color:#e8f2f0;font-family:system-ui,sans-serif}
.card{width:min(24rem,100%);padding:1.5rem 1.4rem 1.35rem;border:1px solid #2a3a38;border-radius:.75rem;background:#172422}
h1{margin:0 0 .55rem;font-size:1.15rem;font-weight:650}
p{margin:0 0 1.15rem;font-size:.9rem;line-height:1.5;color:#9bb3b0}
button{cursor:pointer;width:100%;border:0;border-radius:.5rem;min-height:2.5rem;font:600 .9rem/1 system-ui,sans-serif;color:#06201c;background:#5ee0d0}
</style></head>
<body><div class="card"><h1>${heading}</h1><p>${lead}</p>${action}</div></body></html>`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
