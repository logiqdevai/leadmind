import { type FC, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User } from "lucide-react";
import { Button, Input, Label, Spinner } from "@heroui/react";
import { useAuthStore } from "@/stores/auth";
import { useChangePassword, useGetMe, useUpdateMe } from "@/features/user/hooks/use-user";
import {
    changePasswordSchema,
    updateProfileSchema,
    type ChangePasswordFormData,
    type UpdateProfileFormData,
} from "@/features/user/validation-schemas/user.schema";

const SettingsAccountPage: FC = () => {
    const authEmail = useAuthStore((s) => s.email);
    const authFullName = useAuthStore((s) => s.full_name);
    const authPhone = useAuthStore((s) => s.phone);
    const updateUser = useAuthStore((s) => s.updateUser);
    const { data: profile, isLoading, isError } = useGetMe();
    const updateMe = useUpdateMe();
    const changePasswordMutation = useChangePassword();

    useEffect(() => {
        if (!profile) return;
        updateUser({
            email: profile.email,
            phone: profile.phone,
            full_name: profile.full_name ?? profile.email.split("@")[0],
        });
    }, [profile, updateUser]);

    const profileForm = useForm<UpdateProfileFormData>({
        resolver: zodResolver(updateProfileSchema),
        values: {
            full_name: profile?.full_name ?? authFullName ?? "",
            email: profile?.email ?? authEmail ?? "",
            phone: profile?.phone ?? authPhone ?? "",
        },
    });

    const passwordForm = useForm<ChangePasswordFormData>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: {
            current_password: "",
            new_password: "",
            confirm_password: "",
        },
    });

    const fullName = profileForm.watch("full_name");
    const email = profileForm.watch("email");
    const phone = profileForm.watch("phone");
    const currentPassword = passwordForm.watch("current_password");
    const newPassword = passwordForm.watch("new_password");
    const confirmPassword = passwordForm.watch("confirm_password");

    const onSaveProfile = profileForm.handleSubmit((data) => {
        updateMe.mutate({
            full_name: data.full_name,
            email: data.email,
            phone: data.phone?.trim() ? data.phone.trim() : null,
        });
    });

    const onChangePassword = passwordForm.handleSubmit((data) => {
        changePasswordMutation.mutate(
            {
                current_password: data.current_password,
                new_password: data.new_password,
            },
            {
                onSuccess: () => passwordForm.reset(),
            },
        );
    });

    if (isLoading && !authEmail) {
        return (
            <div className="flex items-center justify-center py-16">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-lg">
            <div className="flex items-center gap-2.5">
                <User className="size-5 text-muted shrink-0" />
                <div>
                    <h1 className="text-lg font-semibold text-foreground leading-tight">
                        Account
                    </h1>
                    <p className="text-xs text-muted mt-0.5">
                        Your name, email, phone, and password
                    </p>
                </div>
            </div>

            {isError ? (
                <p className="text-xs text-danger">
                    Could not refresh profile from server. Showing saved session data.
                </p>
            ) : null}

            <form onSubmit={onSaveProfile} className="space-y-3">
                <div className="space-y-1.5">
                    <Label>Full name</Label>
                    <Input
                        value={fullName}
                        onChange={(e) =>
                            profileForm.setValue("full_name", e.target.value, {
                                shouldDirty: true,
                                shouldValidate: true,
                            })
                        }
                        disabled={updateMe.isPending}
                        placeholder="Jane Doe"
                        fullWidth
                    />
                    {profileForm.formState.errors.full_name ? (
                        <p className="text-xs text-danger">
                            {profileForm.formState.errors.full_name.message}
                        </p>
                    ) : null}
                </div>

                <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input
                        type="email"
                        value={email}
                        onChange={(e) =>
                            profileForm.setValue("email", e.target.value, {
                                shouldDirty: true,
                                shouldValidate: true,
                            })
                        }
                        disabled={updateMe.isPending}
                        placeholder="you@example.com"
                        fullWidth
                    />
                    {profileForm.formState.errors.email ? (
                        <p className="text-xs text-danger">
                            {profileForm.formState.errors.email.message}
                        </p>
                    ) : null}
                </div>

                <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input
                        type="tel"
                        value={phone ?? ""}
                        onChange={(e) =>
                            profileForm.setValue("phone", e.target.value, {
                                shouldDirty: true,
                                shouldValidate: true,
                            })
                        }
                        disabled={updateMe.isPending}
                        placeholder="+30 690 000 0000"
                        fullWidth
                    />
                    {profileForm.formState.errors.phone ? (
                        <p className="text-xs text-danger">
                            {profileForm.formState.errors.phone.message}
                        </p>
                    ) : null}
                </div>

                <Button
                    type="submit"
                    variant="primary"
                    isDisabled={updateMe.isPending}
                >
                    Save profile
                </Button>
            </form>

            <div className="border-t border-border pt-6 space-y-3">
                <div>
                    <h2 className="text-sm font-semibold text-foreground">Password</h2>
                    <p className="text-xs text-muted mt-0.5">
                        Change your account password
                    </p>
                </div>

                <form onSubmit={onChangePassword} className="space-y-3">
                    <div className="space-y-1.5">
                        <Label>Current password</Label>
                        <Input
                            type="password"
                            value={currentPassword}
                            onChange={(e) =>
                                passwordForm.setValue("current_password", e.target.value, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                })
                            }
                            disabled={changePasswordMutation.isPending}
                            placeholder="Current password"
                            fullWidth
                        />
                        {passwordForm.formState.errors.current_password ? (
                            <p className="text-xs text-danger">
                                {passwordForm.formState.errors.current_password.message}
                            </p>
                        ) : null}
                    </div>

                    <div className="space-y-1.5">
                        <Label>New password</Label>
                        <Input
                            type="password"
                            value={newPassword}
                            onChange={(e) =>
                                passwordForm.setValue("new_password", e.target.value, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                })
                            }
                            disabled={changePasswordMutation.isPending}
                            placeholder="New password"
                            fullWidth
                        />
                        {passwordForm.formState.errors.new_password ? (
                            <p className="text-xs text-danger">
                                {passwordForm.formState.errors.new_password.message}
                            </p>
                        ) : null}
                    </div>

                    <div className="space-y-1.5">
                        <Label>Confirm new password</Label>
                        <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) =>
                                passwordForm.setValue("confirm_password", e.target.value, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                })
                            }
                            disabled={changePasswordMutation.isPending}
                            placeholder="Confirm new password"
                            fullWidth
                        />
                        {passwordForm.formState.errors.confirm_password ? (
                            <p className="text-xs text-danger">
                                {passwordForm.formState.errors.confirm_password.message}
                            </p>
                        ) : null}
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        isDisabled={changePasswordMutation.isPending}
                    >
                        Change password
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default SettingsAccountPage;
