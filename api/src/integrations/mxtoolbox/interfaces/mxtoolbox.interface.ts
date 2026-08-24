/**
 * Typed from the documented response schema (api/docs/mxtoolbox_api_reference.md #5.1).
 * MxToolbox does not publish a formal OpenAPI spec, so undocumented fields are tolerated
 * via the index signature.
 */
export interface MxToolboxCheckItem {
  ID?: number;
  Name?: string;
  Info?: string;
  Url?: string;
  [key: string]: unknown;
}

export interface MxToolboxLookupResult {
  UID?: string;
  Command?: string;
  CommandArgument?: string;
  TimeRecorded?: string;
  ReportingNameServer?: string;
  TimeToComplete?: string;
  IsEndpoint?: boolean;
  HasSubscriptions?: boolean;
  Failed?: MxToolboxCheckItem[];
  Warnings?: MxToolboxCheckItem[];
  Passed?: MxToolboxCheckItem[];
  Timeouts?: MxToolboxCheckItem[];
  [key: string]: unknown;
}

export interface MxToolboxUsage {
  DnsRequests: number;
  DnsMax: number;
  NetworkRequests: number;
  NetworkMax: number;
}
