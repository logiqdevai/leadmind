import { AlertDialog, Button } from "@heroui/react";
import { AlertTriangle } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";

interface ResendSequenceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  contactName?: string | null;
  sequenceName?: string | null;
  isPending?: boolean;
  onResend: (restartSequence: boolean) => void | Promise<void>;
}

/** Shown instead of an immediate resend when the failed message's sequence enrollment
 * was cancelled (by this same failure or a bounce) - lets the user resend without
 * restarting the sequence, or resend and pick the sequence back up for this contact. */
export function ResendSequenceDialog({
  isOpen,
  onOpenChange,
  contactName,
  sequenceName,
  isPending = false,
  onResend,
}: ResendSequenceDialogProps) {
  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-md">
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning">
              <AlertTriangle className="size-5" />
            </AlertDialog.Icon>
            <AlertDialog.Heading>Restart the sequence too?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <div className="text-sm text-muted">
              {sequenceName ? `"${sequenceName}"` : "This sequence"} was stopped for{" "}
              {contactName ?? "this contact"} when this email failed. You can resend just
              this email, or resend and restart the sequence so its remaining steps go
              out again.
            </div>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="secondary" isDisabled={isPending}>
              Cancel
            </Button>
            <ActionButtonWithPending
              variant="secondary"
              isDisabled={isPending}
              isPending={isPending}
              onPress={() => onResend(false)}
            >
              Just resend
            </ActionButtonWithPending>
            <ActionButtonWithPending
              variant="primary"
              isDisabled={isPending}
              isPending={isPending}
              onPress={() => onResend(true)}
            >
              Resend &amp; restart sequence
            </ActionButtonWithPending>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
