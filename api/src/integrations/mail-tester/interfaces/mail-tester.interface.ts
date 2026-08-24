/**
 * Mail-Tester's JSON API does not publish a full schema (see
 * api/docs/mail_tester_json_api_reference.md) - only the top-level categories and a handful of
 * field names are documented. Nested sections are kept loosely typed on purpose.
 */
export interface MailTesterRule {
  code?: string;
  score?: number;
  suggestion?: string;
  [key: string]: unknown;
}

export interface MailTesterCommonTest {
  title?: string;
  mark?: number;
  displayedMark?: number | string;
  status?: string;
  statusClass?: 'failure' | 'warning' | 'neutral' | 'success' | string;
  description?: string;
  messages?: string;
  [key: string]: unknown;
}

export interface MailTesterResult {
  status: boolean;
  title?: string;
  id?: string;
  score?: number;
  comment?: string;
  messageInfo?: {
    subject?: string;
    receptionDate?: string;
    bounceAddress?: string;
    [key: string]: unknown;
  };
  spamAssassin?: {
    rule?: MailTesterRule[];
    [key: string]: unknown;
  };
  signature?: {
    spf?: MailTesterCommonTest;
    senderId?: MailTesterCommonTest;
    dkim?: MailTesterCommonTest;
    rdns?: MailTesterCommonTest;
    [key: string]: unknown;
  };
  body?: Record<string, unknown>;
  blacklists?: unknown[];
  links?: unknown[];
  [key: string]: unknown;
}
