export const MXTOOLBOX_BASE_URL = 'https://api.mxtoolbox.com/api/v1';
export const MXTOOLBOX_REQUEST_TIMEOUT_MS = 20_000;

/**
 * Prisma-safe (uppercase, underscore) command identifiers mapped to the lowercase command
 * strings the MxToolbox Lookup API expects (see api/docs/mxtoolbox_api_reference.md #4.5).
 * `ptr` (IP-only), `tcp` (requires a port argument) and the undocumented `arin` command are
 * intentionally left out - this integration only looks up domains.
 */
export const MXTOOLBOX_COMMANDS = {
  A: 'a',
  AAAA: 'aaaa',
  ASN: 'asn',
  BIMI: 'bimi',
  DKIM: 'dkim',
  DMARC: 'dmarc',
  DNS: 'dns',
  MTA_STS: 'mta-sts',
  MX: 'mx',
  SOA: 'soa',
  SPF: 'spf',
  TLSRPT: 'tlsrpt',
  TXT: 'txt',
  BLACKLIST: 'blacklist',
  HTTP: 'http',
  HTTPS: 'https',
  PING: 'ping',
  SMTP: 'smtp',
} as const;

export type MxToolboxCommand = keyof typeof MXTOOLBOX_COMMANDS;

/** Consumes `DnsRequests`; the rest of MXTOOLBOX_COMMANDS consumes `NetworkRequests`. */
export const MXTOOLBOX_DNS_COMMANDS: MxToolboxCommand[] = [
  'A',
  'AAAA',
  'ASN',
  'BIMI',
  'DKIM',
  'DMARC',
  'DNS',
  'MTA_STS',
  'MX',
  'SOA',
  'SPF',
  'TLSRPT',
  'TXT',
];

/** A sensible default bundle for a one-click "domain health" check. DKIM is only added when the caller supplies a selector. */
export const DEFAULT_DOMAIN_HEALTH_COMMANDS: MxToolboxCommand[] = [
  'DNS',
  'MX',
  'SPF',
  'DMARC',
  'BIMI',
  'MTA_STS',
  'TLSRPT',
  'BLACKLIST',
  'HTTPS',
];
