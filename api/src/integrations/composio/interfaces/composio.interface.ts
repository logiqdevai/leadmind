export interface ComposioConnectionRequest {
    connected_account_id: string;
    redirect_url: string | null;
}

export interface ComposioConnectedAccount {
    id: string;
    status: string;
    status_reason: string | null;
    toolkit_slug: string;
}

export interface ComposioProxyRequest {
    connected_account_id: string;
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined>;
}

export interface ComposioProxyResponse<T> {
    status: number;
    data: T;
}

/** Raised for upstream failures so callers can decide between retrying and asking the member to reconnect. */
export class ComposioRequestError extends Error {
    constructor(
        message: string,
        readonly status: number | null,
        /** True when the connection itself is unusable (revoked/expired auth). */
        readonly requires_reconnect: boolean,
    ) {
        super(message);
        this.name = 'ComposioRequestError';
    }
}
