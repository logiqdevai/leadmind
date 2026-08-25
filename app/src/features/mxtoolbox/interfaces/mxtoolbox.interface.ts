export const MxToolboxCommands = {
    A: "A",
    AAAA: "AAAA",
    ASN: "ASN",
    BIMI: "BIMI",
    DKIM: "DKIM",
    DMARC: "DMARC",
    DNS: "DNS",
    MTA_STS: "MTA_STS",
    MX: "MX",
    SOA: "SOA",
    SPF: "SPF",
    TLSRPT: "TLSRPT",
    TXT: "TXT",
    BLACKLIST: "BLACKLIST",
    HTTP: "HTTP",
    HTTPS: "HTTPS",
    PING: "PING",
    SMTP: "SMTP",
} as const;

export type MxToolboxCommand = keyof typeof MxToolboxCommands;

export const MXTOOLBOX_COMMAND_LABELS: Record<MxToolboxCommand, string> = {
    A: "A record",
    AAAA: "AAAA record",
    ASN: "ASN",
    BIMI: "BIMI",
    DKIM: "DKIM",
    DMARC: "DMARC",
    DNS: "DNS health",
    MTA_STS: "MTA-STS",
    MX: "MX records",
    SOA: "SOA",
    SPF: "SPF",
    TLSRPT: "TLSRPT",
    TXT: "TXT records",
    BLACKLIST: "Blacklist",
    HTTP: "HTTP",
    HTTPS: "HTTPS/TLS",
    PING: "Ping",
    SMTP: "SMTP banner",
};

export const DEFAULT_DOMAIN_HEALTH_COMMANDS: MxToolboxCommand[] = [
    "DNS",
    "MX",
    "SPF",
    "DMARC",
    "BIMI",
    "MTA_STS",
    "TLSRPT",
    "BLACKLIST",
    "HTTPS",
];

export const MxToolboxCheckStatuses = {
    PASSED: "PASSED",
    WARNING: "WARNING",
    FAILED: "FAILED",
} as const;

export type MxToolboxCheckStatus =
    (typeof MxToolboxCheckStatuses)[keyof typeof MxToolboxCheckStatuses];

export interface MxToolboxCheckItem {
    ID?: number;
    Name?: string;
    Info?: string;
    Url?: string;
    [key: string]: unknown;
}

export interface MxToolboxCommandResult {
    argument: string;
    ok: boolean;
    error?: string;
    timeRecorded?: string;
    reportingNameServer?: string;
    failed: MxToolboxCheckItem[];
    warnings: MxToolboxCheckItem[];
    passed: MxToolboxCheckItem[];
    timeouts: MxToolboxCheckItem[];
}

export type MxToolboxResults = Partial<
    Record<MxToolboxCommand, MxToolboxCommandResult>
>;

export interface MxToolboxAiAuditIssue {
    title: string;
    severity: "high" | "medium" | "low";
    fix: string;
}

export interface MxToolboxAiAudit {
    summary: string;
    issues: MxToolboxAiAuditIssue[];
}

export interface MxToolboxCheck {
    uuid: string;
    label: string | null;
    domain: string;
    commands: MxToolboxCommand[];
    status: MxToolboxCheckStatus;
    failed_count: number;
    warning_count: number;
    results: MxToolboxResults;
    ai_audit: MxToolboxAiAudit | null;
    ai_audit_generated_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateMxToolboxCheckPayload {
    domain: string;
    label?: string;
    dkim_selector?: string;
    commands?: MxToolboxCommand[];
}
