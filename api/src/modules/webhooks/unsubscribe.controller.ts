import {
    Controller,
    Get,
    Header,
    HttpCode,
    Param,
    Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UnsubscribeService } from './services/unsubscribe.service';

@ApiTags('webhooks')
@Controller('unsubscribe')
export class UnsubscribeController {
    constructor(private readonly unsubscribeService: UnsubscribeService) {}

    @Get(':token')
    @Header('Content-Type', 'text/html; charset=utf-8')
    @ApiOperation({ summary: 'Public unsubscribe page for email footer links' })
    async unsubscribeGet(@Param('token') token: string): Promise<string> {
        const result = await this.unsubscribeService.unsubscribeByToken(token);
        return renderUnsubscribeHtml(result.email ?? '');
    }

    @Post(':token')
    @HttpCode(200)
    @ApiOperation({ summary: 'One-click List-Unsubscribe POST' })
    async unsubscribePost(
        @Param('token') token: string,
    ): Promise<{ email: string | null; already: boolean }> {
        return this.unsubscribeService.unsubscribeByToken(token);
    }
}

function renderUnsubscribeHtml(email: string): string {
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;margin:0">
  <div style="max-width:480px;padding:40px;text-align:center;background:#fff;border:1px solid #eee;border-radius:12px">
    <h1 style="margin:0 0 12px;font-size:20px">You're unsubscribed</h1>
    <p style="margin:0;color:#666;font-size:14px">We won't send marketing emails to <strong>${escapeHtml(
        email,
    )}</strong> anymore.</p>
  </div>
</body></html>`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
