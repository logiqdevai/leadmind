import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Composio } from '@composio/core';
import {
    COMPOSIO_RECONNECT_STATUSES,
    GOOGLE_CALENDAR_TOOLKIT,
    MANAGED_AUTH_CONFIG_NAME,
} from '../composio.constants';
import {
    ComposioConnectedAccount,
    ComposioConnectionRequest,
    ComposioProxyRequest,
    ComposioProxyResponse,
    ComposioRequestError,
} from '../interfaces/composio.interface';

/**
 * The only place that talks to the Composio SDK. Composio holds the OAuth tokens of each team
 * member's Google account; we keep only the connected-account id (see CalendarConnection).
 */
@Injectable()
export class ComposioService {
    private readonly logger = new Logger(ComposioService.name);
    private client: Composio | null = null;
    private authConfigIdPromise: Promise<string> | null = null;

    constructor(private readonly configService: ConfigService) {}

    /** Only the API key is required; the Google Calendar auth config is resolved (or created) on demand. */
    isConfigured(): boolean {
        return !!this.configService.get<string>('COMPOSIO_API_KEY');
    }

    /** Starts the hosted OAuth flow; the member is sent to `redirect_url` and comes back to `callback_url`. */
    async linkGoogleCalendar(composio_user_id: string, callback_url: string): Promise<ComposioConnectionRequest> {
        const authConfigId = await this.googleCalendarAuthConfigId();
        const request = await this.getClient().connectedAccounts.link(composio_user_id, authConfigId, {
            callbackUrl: callback_url,
            // A member reconnecting (expired token, different Google account) gets a fresh connected account.
            allowMultiple: true,
        });
        return { connected_account_id: request.id, redirect_url: request.redirectUrl ?? null };
    }

    async getConnectedAccount(connected_account_id: string): Promise<ComposioConnectedAccount> {
        const account = await this.getClient().connectedAccounts.get(connected_account_id);
        return {
            id: account.id,
            status: account.status,
            status_reason: account.statusReason ?? null,
            toolkit_slug: account.toolkit?.slug,
        };
    }

    async deleteConnectedAccount(connected_account_id: string): Promise<void> {
        try {
            await this.getClient().connectedAccounts.delete(connected_account_id);
        } catch (error) {
            // Already gone on Composio's side is fine - we're disconnecting anyway.
            this.logger.warn(`Composio delete ${connected_account_id} failed: ${(error as Error).message}`);
        }
    }

    /** Authenticated call to the toolkit's REST API (Google Calendar v3 base URL) as the connected account. */
    async proxy<T>(request: ComposioProxyRequest): Promise<ComposioProxyResponse<T>> {
        const parameters = Object.entries(request.query ?? {})
            .filter(([, value]) => value !== undefined)
            .map(([name, value]) => ({ in: 'query' as const, name, value: typeof value === 'boolean' ? String(value) : value! }));

        let response: { status?: number; data?: unknown };
        try {
            response = (await this.getClient().tools.proxyExecute({
                endpoint: request.endpoint,
                method: request.method,
                connectedAccountId: request.connected_account_id,
                ...(request.body !== undefined ? { body: request.body } : {}),
                ...(parameters.length ? { parameters } : {}),
            })) as { status?: number; data?: unknown };
        } catch (error) {
            const message = (error as Error).message ?? 'Composio request failed';
            throw new ComposioRequestError(message, null, this.looksLikeAuthFailure(message));
        }

        const status = response.status ?? 200;
        if (status >= 400) {
            const message = this.upstreamErrorMessage(response.data) ?? `Google Calendar responded with ${status}`;
            throw new ComposioRequestError(message, status, status === 401 || status === 403);
        }
        return { status, data: response.data as T };
    }

    requiresReconnect(status: string): boolean {
        return (COMPOSIO_RECONNECT_STATUSES as readonly string[]).includes(status);
    }

    private getClient(): Composio {
        if (!this.isConfigured()) {
            throw new ServiceUnavailableException('Google Calendar integration is not configured (Composio).');
        }
        if (!this.client) {
            this.client = new Composio({ apiKey: this.configService.get<string>('COMPOSIO_API_KEY') });
        }
        return this.client;
    }

    /**
     * The auth config every member's Google connection goes through (one per deployment, not per user).
     * Uses COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID when set; otherwise reuses the project's
     * Composio-managed Google Calendar auth config, creating it on first use.
     */
    private googleCalendarAuthConfigId(): Promise<string> {
        const configured = this.configService.get<string>('COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID');
        if (configured) return Promise.resolve(configured);

        this.authConfigIdPromise ??= this.findOrCreateManagedAuthConfig().catch((error) => {
            // Don't cache failures - the next connect attempt retries.
            this.authConfigIdPromise = null;
            throw error;
        });
        return this.authConfigIdPromise;
    }

    private async findOrCreateManagedAuthConfig(): Promise<string> {
        const client = this.getClient();
        const existing = await client.authConfigs.list({
            toolkit: GOOGLE_CALENDAR_TOOLKIT,
            isComposioManaged: true,
        });
        const reusable = existing.items.find((item) => item.status === 'ENABLED') ?? existing.items[0];
        if (reusable) return reusable.id;

        const created = await client.authConfigs.create(GOOGLE_CALENDAR_TOOLKIT, {
            type: 'use_composio_managed_auth',
            name: MANAGED_AUTH_CONFIG_NAME,
        });
        this.logger.log(`Created Composio-managed Google Calendar auth config ${created.id}`);
        return created.id;
    }

    private looksLikeAuthFailure(message: string): boolean {
        return /expired|revoked|inactive|not active|unauthori[sz]ed|invalid_grant/i.test(message);
    }

    private upstreamErrorMessage(data: unknown): string | null {
        const error = (data as { error?: { message?: string } | string } | undefined)?.error;
        if (!error) return null;
        return typeof error === 'string' ? error : error.message ?? null;
    }
}
