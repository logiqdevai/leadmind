import { type FC } from "react";
import { Button, Modal } from "@heroui/react";
import { CopyButton } from "@/components/ui/copy-button";
import type { CreatedAccessToken } from "@/features/oauth-connections/interfaces/oauth-connection.interfaces";

function formatExpiry(iso: string | null) {
    if (!iso) return "Never";
    return new Date(iso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

interface AccessTokenRevealModalProps {
    token: CreatedAccessToken | null;
    onClose: () => void;
}

export const AccessTokenRevealModal: FC<AccessTokenRevealModalProps> = ({ token, onClose }) => (
    <Modal.Backdrop
        isOpen={!!token}
        onOpenChange={(open) => {
            if (!open) onClose();
        }}
    >
        <Modal.Container>
            <Modal.Dialog className="sm:max-w-md">
                <Modal.Header>
                    <Modal.Heading>Access token created</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="space-y-3">
                    <div className="flex items-center gap-1.5">
                        <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface-secondary/40 p-3 font-mono text-sm break-all">
                            {token?.token}
                        </div>
                        <CopyButton value={token?.token ?? ""} label="Access token" />
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                        <dt className="text-muted">Expires</dt>
                        <dd className="text-foreground">{formatExpiry(token?.expires_at ?? null)}</dd>
                        <dt className="text-muted">Permissions</dt>
                        <dd className="text-foreground">{token?.scope.replace(/mcp:/g, "").split(" ").join(" + ")}</dd>
                    </dl>
                    <p className="text-xs text-danger">
                        Copy this token now. For security reasons, we can't show it to you again.
                        Send it as <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>.
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onPress={onClose}>
                        Done, I've copied it
                    </Button>
                </Modal.Footer>
            </Modal.Dialog>
        </Modal.Container>
    </Modal.Backdrop>
);
