import { type FC, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Card, Chip, Label, ListBox, Select } from "@heroui/react";
import { Check, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useOrganisations } from "@/features/organisations/hooks/use-organisations";
import { SignInForm } from "@/pages/auth/pages/sign-in/components/sign-in-form";
import {
    useAbortOAuthConsent,
    useConfirmOAuthConsent,
    useOAuthInteraction,
    useSubmitOAuthLogin,
} from "@/features/oauth-interaction/hooks/use-oauth-interaction";

function ErrorCard({ message }: { message: string }) {
    return (
        <Card className="w-full max-w-md mx-auto p-8">
            <p className="text-sm text-danger text-center">{message}</p>
        </Card>
    );
}

const OAuthAuthorizePage: FC = () => {
    const { uid = "" } = useParams<{ uid: string }>();
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
    const email = useAuthStore((s) => s.email);
    const currentOrgUuid = useAuthStore((s) => s.organisation_uuid);

    const { data: interaction, isLoading, isError, error } = useOAuthInteraction(uid, !!uid);
    const { data: organisations = [] } = useOrganisations(!!isLoggedIn);

    const submitLogin = useSubmitOAuthLogin(uid);
    const confirmConsent = useConfirmOAuthConsent(uid);
    const abortConsent = useAbortOAuthConsent(uid);

    // Defaults to the app's currently-active workspace until the user
    // explicitly picks a different one from the dropdown.
    const [selectedOrgUuidOverride, setSelectedOrgUuidOverride] = useState<string | null>(null);
    const selectedOrgUuid = selectedOrgUuidOverride ?? currentOrgUuid ?? null;

    const handleContinue = () => {
        if (!selectedOrgUuid) return;
        submitLogin.mutate(selectedOrgUuid, {
            onSuccess: (result) => {
                window.location.href = result.redirect_to;
            },
        });
    };

    const handleAllow = () => {
        confirmConsent.mutate(undefined, {
            onSuccess: (result) => {
                window.location.href = result.redirect_to;
            },
        });
    };

    const handleDeny = () => {
        abortConsent.mutate(undefined, {
            onSuccess: (result) => {
                window.location.href = result.redirect_to;
            },
        });
    };

    if (!uid) {
        return <ErrorCard message="Missing connection request." />;
    }

    if (isLoading) {
        return (
            <Card className="w-full max-w-md mx-auto p-8">
                <p className="text-sm text-muted text-center">Loading…</p>
            </Card>
        );
    }

    if (isError || !interaction) {
        return (
            <ErrorCard
                message={
                    (error as Error)?.message ||
                    "This connection request is invalid or has expired. Please try connecting again."
                }
            />
        );
    }

    if (interaction.prompt === "login") {
        if (!isLoggedIn) {
            return (
                <Card className="w-full max-w-md mx-auto p-8">
                    <div className="flex flex-col gap-1 text-left mb-6">
                        <p className="text-2xl font-semibold">Sign in to continue</p>
                        <p className="text-sm text-muted">
                            An application wants to connect to your Leadmind workspace. Sign in to
                            review and approve access.
                        </p>
                    </div>
                    <SignInForm />
                </Card>
            );
        }

        return (
            <Card className="w-full max-w-md mx-auto p-8 space-y-4">
                <div className="flex flex-col gap-1 text-left">
                    <p className="text-2xl font-semibold">Continue as {email}</p>
                    <p className="text-sm text-muted">
                        Choose which workspace this application should access.
                    </p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label>Workspace</Label>
                    <Select
                        aria-label="Workspace"
                        value={selectedOrgUuid ?? undefined}
                        onChange={(value) => setSelectedOrgUuidOverride(value ? String(value) : null)}
                    >
                        <Select.Trigger className="w-full">
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                {organisations.map((org) => (
                                    <ListBox.Item key={org.uuid} id={org.uuid} textValue={org.name}>
                                        {org.name}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                </div>

                <Button
                    variant="primary"
                    fullWidth
                    isDisabled={!selectedOrgUuid || submitLogin.isPending}
                    onPress={handleContinue}
                >
                    Continue
                </Button>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md mx-auto p-8 space-y-4">
            <div className="flex items-center gap-2.5">
                <ShieldCheck className="size-5 text-muted shrink-0" />
                <div>
                    <p className="text-lg font-semibold text-foreground">{interaction.client?.name}</p>
                    {interaction.client?.uri ? (
                        <a
                            href={interaction.client.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted hover:text-foreground"
                        >
                            {interaction.client.uri}
                        </a>
                    ) : null}
                </div>
            </div>

            <p className="text-sm text-muted">
                wants to access your{" "}
                <strong className="text-foreground">{interaction.organisationName ?? "workspace"}</strong>{" "}
                workspace:
            </p>

            <ul className="space-y-1.5">
                {(interaction.scopeDescriptions ?? []).map((description) => (
                    <li key={description} className="text-sm text-foreground flex items-start gap-2">
                        <Chip size="sm" variant="soft" color="success">
                            <Check className="size-3" />
                        </Chip>
                        {description}
                    </li>
                ))}
            </ul>

            <div className="flex gap-2">
                <Button
                    variant="secondary"
                    fullWidth
                    isDisabled={abortConsent.isPending}
                    onPress={handleDeny}
                >
                    Deny
                </Button>
                <Button
                    variant="primary"
                    fullWidth
                    isDisabled={confirmConsent.isPending}
                    onPress={handleAllow}
                >
                    Allow access
                </Button>
            </div>

            <p className="text-xs text-muted text-center">
                You can revoke this any time from Settings → Connected apps.
            </p>
        </Card>
    );
};

export default OAuthAuthorizePage;
