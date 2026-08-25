/**
 * Mail-Tester's JSON API does not publish a formal schema (see
 * api/docs/mail_tester_json_api_reference.md) - these types are reverse-engineered from a real
 * response and kept loosely typed (index signatures) since undocumented fields can change.
 */
export interface MailTesterCheck {
  mark?: number;
  displayedMark?: number | string;
  title?: string;
  status?: string;
  statusClass?: 'failure' | 'warning' | 'neutral' | 'success' | string;
  description?: string;
  messages?: string;
  [key: string]: unknown;
}

export interface MailTesterSpamAssassinRule {
  code?: string;
  score?: number;
  status?: string;
  solution?: string;
  description?: string;
  [key: string]: unknown;
}

export interface MailTesterBlacklistEntry {
  dns?: string;
  url?: string;
  name?: string;
  mark?: number;
  hitMark?: number;
  statusCode?: number;
  details?: string;
  removal?: string;
  description?: string;
  [key: string]: unknown;
}

export interface MailTesterLinkUrl {
  baseUrl?: string;
  httpStatus?: string;
  statusCode?: string;
  [key: string]: unknown;
}

export interface MailTesterResult {
  status: boolean;
  title?: string;
  /** Total penalty (usually <= 0). Final score is typically `10 + mark`, already rendered in displayedMark. */
  mark?: number;
  /** Rendered as e.g. "6.5/10". */
  displayedMark?: string;
  commentedMark?: string;
  markClass?: string;
  mailboxId?: string;
  messageId?: string;
  access?: boolean;
  redirect?: boolean;
  account?: { nbtestsleft?: string; [key: string]: unknown };
  messageInfo?: {
    subject?: string;
    fromAddress?: string;
    dateReceived?: string;
    bounceAddress?: string;
    [key: string]: unknown;
  };
  spamAssassin?: MailTesterCheck & {
    score?: number;
    threshold?: number;
    rules?: Record<string, MailTesterSpamAssassinRule>;
  };
  signature?: MailTesterCheck & {
    subtests?: Record<string, MailTesterCheck>;
  };
  body?: MailTesterCheck & {
    subtests?: Record<string, MailTesterCheck>;
  };
  blacklists?: MailTesterCheck & {
    hits?: number;
    blacklists?: Record<string, MailTesterBlacklistEntry>;
  };
  links?: MailTesterCheck & {
    urls?: MailTesterLinkUrl[];
    brokenLinks?: number;
    notFound?: number;
    timeouts?: number;
    redirects?: number;
  };
  [key: string]: unknown;
}
