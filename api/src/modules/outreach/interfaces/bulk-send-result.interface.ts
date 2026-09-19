export interface BulkSendItemResult {
  uuid: string;
  ok: boolean;
  jobId?: string;
  error?: string;
}

export interface BulkSendResult {
  results: BulkSendItemResult[];
  succeeded: number;
  failed: number;
}
