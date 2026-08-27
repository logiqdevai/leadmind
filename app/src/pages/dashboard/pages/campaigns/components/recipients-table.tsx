import { Chip } from "@heroui/react";
import type { MarketingCampaignContact, CampaignContactStatuses } from "@/features/marketing-campaigns/interfaces/campaign.interface";
import { Channel } from "@/features/contacts/interfaces/contact.interface";

const STATUS_COLOR: Record<CampaignContactStatuses, "default" | "accent" | "success" | "warning" | "danger"> = {
  PENDING: "default",
  QUEUED: "default",
  SENT: "accent",
  FAILED: "danger",
  SKIPPED: "default",
  DELIVERED: "success",
  OPENED: "success",
  CLICKED: "success",
  REPLIED: "success",
  BOUNCED: "danger",
  UNSUBSCRIBED: "warning",
};

export function RecipientsTable({ rows }: { rows: MarketingCampaignContact[] }) {
  if (rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-8 text-center text-sm text-muted">No recipients yet.</div>;
  }
  const isSequence = rows.some((row) => row.step_order_index != null || row.scheduled_at !== undefined);
  return (
            <div className="overflow-x-hidden rounded-xl">
      <table className="w-full table-fixed text-sm">
        <thead className="bg-surface-secondary/40 text-muted">
          <tr>
            <th className="min-w-0 max-w-0 overflow-hidden px-3 py-2 text-left font-medium">Contact</th>
            <th className="hidden lg:table-cell px-3 py-2 text-left font-medium">Channel</th>
            {isSequence && <th className="hidden lg:table-cell px-3 py-2 text-left font-medium w-20">Step</th>}
            <th className="px-3 py-2 text-left font-medium w-28">Status</th>
            {isSequence && <th className="hidden lg:table-cell px-3 py-2 text-left font-medium">Scheduled</th>}
            <th className="hidden lg:table-cell px-3 py-2 text-left font-medium">Sent</th>
            <th className="hidden lg:table-cell px-3 py-2 text-left font-medium">Delivered</th>
            <th className="hidden lg:table-cell px-3 py-2 text-left font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.uuid} className="border-t border-border">
              <td className="min-w-0 max-w-0 overflow-hidden px-3 py-2 align-top">
                <div className="truncate font-medium text-foreground">{row.contact.name ?? "—"}</div>
                <div className="truncate text-xs text-muted">{row.channel === Channel.EMAIL ? row.contact.email : row.contact.phone}</div>
              </td>
              <td className="hidden lg:table-cell px-3 py-2 align-top text-foreground/90">{row.channel}</td>
              {isSequence && (
                <td className="hidden lg:table-cell px-3 py-2 align-top text-foreground/90">
                  {row.step_order_index != null ? `#${row.step_order_index + 1}` : "—"}
                </td>
              )}
              <td className="px-3 py-2 align-top">
                <Chip size="sm" variant="soft" color={STATUS_COLOR[row.status]}>
                  <Chip.Label>{row.status}</Chip.Label>
                </Chip>
              </td>
              {isSequence && (
                <td className="hidden lg:table-cell px-3 py-2 align-top text-xs text-muted">
                  {row.scheduled_at ? new Date(row.scheduled_at).toLocaleString() : "—"}
                </td>
              )}
              <td className="hidden lg:table-cell px-3 py-2 align-top text-xs text-muted">{row.sent_at ? new Date(row.sent_at).toLocaleString() : "—"}</td>
              <td className="hidden lg:table-cell px-3 py-2 align-top text-xs text-muted">{row.delivered_at ? new Date(row.delivered_at).toLocaleString() : "—"}</td>
              <td className="hidden lg:table-cell px-3 py-2 align-top text-xs text-muted truncate">{row.error_message ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
