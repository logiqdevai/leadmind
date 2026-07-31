import { type FC } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Spinner } from "@heroui/react";
import { Routes } from "@/routes/routes";
import { useAuthStore } from "@/stores/auth";
import {
    useAcceptInvitation,
    useInvitationPreview,
} from "@/features/organisations/hooks/use-organisations";
import { SignUpForm } from "@/pages/auth/pages/sign-up/components/sign-up-form";

const InviteAcceptPage: FC = () => {
    const { token = "" } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
    const { data, isLoading, isError, error } = useInvitationPreview(token);
    const acceptInvitation = useAcceptInvitation();

    const handleAccept = () => {
        acceptInvitation.mutate(token, {
            onSuccess: () => navigate(Routes.dashboard.root),
        });
    };

    return (
        <Card className="w-full max-w-md mx-auto p-8">
            <div className="flex flex-col gap-1 text-left mb-6">
                <p className="text-2xl font-semibold">Organisation invite</p>
                <p className="text-sm text-muted">
                    {isLoggedIn
                        ? "Accept an invitation to join a workspace"
                        : "Create an account to join this workspace"}
                </p>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-8">
                    <Spinner />
                </div>
            ) : isError ? (
                <p className="text-sm text-danger">
                    {(error as Error)?.message || "Invalid invitation"}
                </p>
            ) : data ? (
                <div className="space-y-4">
                    <div className="rounded-xl border border-border p-4 space-y-1">
                        <p className="text-sm text-foreground font-medium">
                            {data.organisation_name}
                        </p>
                        <p className="text-xs text-muted">
                            Invited as {data.role} · {data.email}
                        </p>
                    </div>

                    {isLoggedIn ? (
                        <Button
                            variant="primary"
                            className="w-full"
                            isDisabled={acceptInvitation.isPending}
                            onPress={handleAccept}
                        >
                            Accept invitation
                        </Button>
                    ) : (
                        <div className="space-y-4">
                            <SignUpForm
                                defaultEmail={data.email}
                                lockEmail
                                inviteToken={token}
                            />
                            <p className="text-center text-sm text-muted">
                                Already have an account?{" "}
                                <Link
                                    to={`${Routes.auth.sign_in}?invite=${token}`}
                                    className="underline underline-offset-4 hover:opacity-80"
                                >
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    )}
                </div>
            ) : null}
        </Card>
    );
};

export default InviteAcceptPage;
