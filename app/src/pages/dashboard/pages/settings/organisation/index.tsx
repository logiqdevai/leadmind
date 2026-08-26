import { type FC, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { Button, Checkbox, Input, Label, ListBox, Modal, Select } from "@heroui/react";
import { useAuthStore } from "@/stores/auth";
import { Routes } from "@/routes/routes";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import { TimezoneOptions } from "@/config/constants/dropdowns/timezone.options";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import { IntegrationProviders } from "@/features/integrations/interfaces/integrations.interface";
import {
    useCreateInvitation,
    useCreateOrganisation,
    useCurrentOrganisation,
    useDeleteOrganisation,
    useOrganisationInvitations,
    useOrganisationMembers,
    useOrganisations,
    useRemoveMember,
    useResendInvitation,
    useRevokeInvitation,
    useUpdateMemberRole,
    useUpdateOrganisation,
} from "@/features/organisations/hooks/use-organisations";
import {
    OrganisationCopyCategoryLabels,
    OrganisationInviteRoles,
    OrganisationRoles,
    type OrganisationCopyCategory,
    type OrganisationRole,
} from "@/features/organisations/interfaces/organisation.interfaces";
import {
    createInvitationSchema,
    createOrganisationSchema,
    updateOrganisationSchema,
    type CreateInvitationFormData,
    type CreateOrganisationFormData,
    type UpdateOrganisationFormData,
} from "@/features/organisations/validation-schemas/organisation.schema";

const COPY_CATEGORY_ENTRIES = Object.entries(OrganisationCopyCategoryLabels) as [
    OrganisationCopyCategory,
    string,
][];

const SettingsOrganisationPage: FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const organisationUuid = useAuthStore((s) => s.organisation_uuid) ?? "";
    const organisationName = useAuthStore((s) => s.organisation_name);
    const currentUserUuid = useAuthStore((s) => s.user_uuid);
    const canEdit = useOrganisationPermission("org_settings");
    const canInvite = useOrganisationPermission("org_invite");
    const canManage = useOrganisationPermission("org_manage_members");
    const canDelete = useOrganisationPermission("org_delete");

    const { data: organisations = [] } = useOrganisations();
    const { data: currentOrganisation } = useCurrentOrganisation();
    const { data: integrations = [] } = useIntegrations();
    const resendDomains = useMemo(
        () =>
            integrations
                .find((p) => p.provider === IntegrationProviders.RESEND)
                ?.accounts?.flatMap((a) => a.domains) ?? [],
        [integrations],
    );
    const createOrganisation = useCreateOrganisation();
    const deleteOrganisation = useDeleteOrganisation();
    const updateOrganisation = useUpdateOrganisation(organisationUuid);
    const { data: members = [], isLoading: membersLoading } =
        useOrganisationMembers(organisationUuid);
    const { data: invitations = [] } = useOrganisationInvitations(
        canInvite ? organisationUuid : "",
    );
    const createInvitation = useCreateInvitation(organisationUuid);
    const resendInvitation = useResendInvitation(organisationUuid);
    const revokeInvitation = useRevokeInvitation(organisationUuid);
    const updateRole = useUpdateMemberRole(organisationUuid);
    const removeMember = useRemoveMember(organisationUuid);

    const [inviteOpen, setInviteOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [copyDataEnabled, setCopyDataEnabled] = useState(false);

    const canDeleteOrg = canDelete && organisations.length > 1;

    useEffect(() => {
        if (searchParams.get("create") !== "1") return;
        setCreateOpen(true);
        const next = new URLSearchParams(searchParams);
        next.delete("create");
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const settingsForm = useForm<UpdateOrganisationFormData>({
        resolver: zodResolver(updateOrganisationSchema),
        values: {
            name: currentOrganisation?.name ?? organisationName ?? "",
            timezone: currentOrganisation?.timezone ?? "UTC",
            reply_to_email: currentOrganisation?.reply_to_email ?? "",
        },
    });

    const timezoneValue = settingsForm.watch("timezone");
    const replyToValue = settingsForm.watch("reply_to_email");

    const createForm = useForm<CreateOrganisationFormData>({
        resolver: zodResolver(createOrganisationSchema),
        defaultValues: { name: "", source_organisation_uuid: "", copy_categories: [] },
    });

    const sourceOrganisationUuid = createForm.watch("source_organisation_uuid");
    const selectedCopyCategories = createForm.watch("copy_categories") ?? [];

    const inviteForm = useForm<CreateInvitationFormData>({
        resolver: zodResolver(createInvitationSchema),
        defaultValues: {
            email: "",
            role: OrganisationInviteRoles.MEMBER,
        },
    });

    const inviteRole = inviteForm.watch("role");

    const onSaveSettings = settingsForm.handleSubmit((data) => {
        if (!organisationUuid) return;
        updateOrganisation.mutate({
            name: data.name,
            timezone: data.timezone,
            reply_to_email: data.reply_to_email?.trim() || null,
        });
    });

    const onCreateOrganisation = createForm.handleSubmit((data) => {
        const shouldCopy =
            copyDataEnabled && !!data.source_organisation_uuid && (data.copy_categories?.length ?? 0) > 0;

        createOrganisation.mutate(
            {
                name: data.name,
                ...(shouldCopy
                    ? {
                          source_organisation_uuid: data.source_organisation_uuid,
                          copy_categories: data.copy_categories,
                      }
                    : {}),
            },
            {
                onSuccess: () => {
                    setCreateOpen(false);
                    setCopyDataEnabled(false);
                    createForm.reset();
                    navigate(Routes.dashboard.root);
                },
            },
        );
    });

    const onInvite = inviteForm.handleSubmit((data) => {
        createInvitation.mutate(data, {
            onSuccess: () => {
                setInviteOpen(false);
                inviteForm.reset();
            },
        });
    });

    const handleDeleteOrganisation = async () => {
        if (!organisationUuid || !canDeleteOrg) return;
        await deleteOrganisation.mutateAsync(organisationUuid);
        setDeleteOpen(false);
        navigate(Routes.dashboard.root);
    };

    return (
        <div className="space-y-8 max-w-2xl">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                    <Building2 className="size-5 text-muted shrink-0" />
                    <div>
                        <h1 className="text-lg font-semibold text-foreground leading-tight">
                            Organisation
                        </h1>
                        <p className="text-xs text-muted mt-0.5">
                            Workspace settings, members, and invitations
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onPress={() => setCreateOpen(true)}
                    >
                        <Plus className="size-3.5" />
                        New organisation
                    </Button>
                    {canInvite ? (
                        <Button
                            variant="primary"
                            size="sm"
                            onPress={() => setInviteOpen(true)}
                        >
                            <Plus className="size-3.5" />
                            Invite
                        </Button>
                    ) : null}
                </div>
            </div>

            <form onSubmit={onSaveSettings} className="space-y-3 max-w-lg">
                <h2 className="text-sm font-medium text-foreground">Settings</h2>
                <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input
                        {...settingsForm.register("name")}
                        disabled={!canEdit || updateOrganisation.isPending}
                        placeholder="Organisation name"
                        fullWidth
                    />
                    {settingsForm.formState.errors.name ? (
                        <p className="text-xs text-danger">
                            {settingsForm.formState.errors.name.message}
                        </p>
                    ) : null}
                </div>
                <div className="space-y-1.5">
                    <Label>Timezone</Label>
                    <Select
                        aria-label="Timezone"
                        value={timezoneValue}
                        onChange={(v) => {
                            if (!v) return;
                            settingsForm.setValue(
                                "timezone",
                                v as UpdateOrganisationFormData["timezone"],
                                { shouldDirty: true },
                            );
                        }}
                        isDisabled={!canEdit || updateOrganisation.isPending}
                    >
                        <Select.Trigger className="w-full">
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                {TimezoneOptions.map((option) => (
                                    <ListBox.Item
                                        key={option.value}
                                        id={option.value}
                                        textValue={option.label}
                                    >
                                        {option.label}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                    {settingsForm.formState.errors.timezone ? (
                        <p className="text-xs text-danger">
                            {settingsForm.formState.errors.timezone.message}
                        </p>
                    ) : null}
                </div>
                <div className="space-y-1.5">
                    <Label>Reply-to email</Label>
                    <Select
                        aria-label="Reply-to email"
                        value={replyToValue || undefined}
                        placeholder={
                            resendDomains.length === 0
                                ? "No Resend domains yet"
                                : "Select a Resend domain"
                        }
                        onChange={(v) =>
                            settingsForm.setValue("reply_to_email", (v as string) ?? "", {
                                shouldDirty: true,
                            })
                        }
                        isDisabled={!canEdit || updateOrganisation.isPending || resendDomains.length === 0}
                    >
                        <Select.Trigger className="w-full">
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                {resendDomains.map((domain) => (
                                    <ListBox.Item
                                        key={domain.uuid}
                                        id={domain.from_email}
                                        textValue={domain.from_email}
                                    >
                                        {domain.from_email}
                                        {domain.is_default ? " (default)" : ""}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                    <p className="text-xs text-muted">
                        Where contact replies get captured, across every sending
                        method.{" "}
                        {resendDomains.length === 0 ? (
                            <Link
                                to={Routes.dashboard.integrations}
                                className="font-medium text-primary hover:underline"
                            >
                                Add a Resend domain
                            </Link>
                        ) : null}
                    </p>
                    {settingsForm.formState.errors.reply_to_email ? (
                        <p className="text-xs text-danger">
                            {settingsForm.formState.errors.reply_to_email.message}
                        </p>
                    ) : null}
                </div>
                {canEdit ? (
                    <Button
                        type="submit"
                        variant="primary"
                        isDisabled={updateOrganisation.isPending}
                    >
                        Save changes
                    </Button>
                ) : (
                    <p className="text-xs text-muted">
                        Only owners and admins can edit organisation settings.
                    </p>
                )}
            </form>

            <div className="space-y-2">
                <h2 className="text-sm font-medium text-foreground">Members</h2>
                {membersLoading ? (
                    <p className="text-xs text-muted">Loading…</p>
                ) : (
                    <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                        {members.map((member) => (
                            <li
                                key={member.uuid}
                                className="flex items-center justify-between gap-3 px-3 py-2.5 bg-surface"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm text-foreground truncate">
                                        {member.email}
                                    </p>
                                    <p className="text-[11px] text-muted">{member.role}</p>
                                </div>
                                {canManage &&
                                member.role !== OrganisationRoles.OWNER &&
                                member.user_uuid !== currentUserUuid ? (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Select
                                            aria-label="Role"
                                            value={member.role}
                                            onChange={(v) => {
                                                if (!v || v === member.role) return;
                                                updateRole.mutate({
                                                    userUuid: member.user_uuid,
                                                    dto: { role: v as OrganisationRole },
                                                });
                                            }}
                                            className="w-28"
                                        >
                                            <Select.Trigger>
                                                <Select.Value />
                                                <Select.Indicator />
                                            </Select.Trigger>
                                            <Select.Popover>
                                                <ListBox>
                                                    <ListBox.Item
                                                        id={OrganisationRoles.ADMIN}
                                                        textValue="Admin"
                                                    >
                                                        Admin
                                                        <ListBox.ItemIndicator />
                                                    </ListBox.Item>
                                                    <ListBox.Item
                                                        id={OrganisationRoles.MEMBER}
                                                        textValue="Member"
                                                    >
                                                        Member
                                                        <ListBox.ItemIndicator />
                                                    </ListBox.Item>
                                                </ListBox>
                                            </Select.Popover>
                                        </Select>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onPress={() =>
                                                removeMember.mutate(member.user_uuid)
                                            }
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {canInvite ? (
                <div className="space-y-2">
                    <h2 className="text-sm font-medium text-foreground">
                        Pending invitations
                    </h2>
                    {invitations.length === 0 ? (
                        <p className="text-xs text-muted">No pending invitations</p>
                    ) : (
                        <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                            {invitations.map((invite) => (
                                <li
                                    key={invite.uuid}
                                    className="flex items-center justify-between gap-3 px-3 py-2.5 bg-surface"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm text-foreground truncate">
                                            {invite.email}
                                        </p>
                                        <p className="text-[11px] text-muted">
                                            {invite.role} · expires{" "}
                                            {new Date(invite.expires_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            isDisabled={
                                                resendInvitation.isPending ||
                                                revokeInvitation.isPending
                                            }
                                            onPress={() =>
                                                resendInvitation.mutate(invite.uuid)
                                            }
                                        >
                                            Resend
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            isDisabled={
                                                resendInvitation.isPending ||
                                                revokeInvitation.isPending
                                            }
                                            onPress={() =>
                                                revokeInvitation.mutate(invite.uuid)
                                            }
                                        >
                                            Revoke
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : null}

            {canDelete ? (
                <div className="space-y-3 rounded-xl border border-danger/30 p-4">
                    <div>
                        <h2 className="text-sm font-medium text-foreground">Danger zone</h2>
                        <p className="text-xs text-muted mt-1">
                            Permanently deletes this organisation and all of its CRM data.
                            You need at least one other organisation to continue.
                        </p>
                    </div>
                    <Button
                        variant="danger"
                        size="sm"
                        isDisabled={!canDeleteOrg || deleteOrganisation.isPending}
                        onPress={() => setDeleteOpen(true)}
                    >
                        Delete organisation
                    </Button>
                    {!canDeleteOrg ? (
                        <p className="text-xs text-muted">
                            Create or join another organisation before deleting this one.
                        </p>
                    ) : null}
                </div>
            ) : null}

            <ConfirmDialog
                isOpen={deleteOpen}
                onOpenChange={setDeleteOpen}
                title={`Delete "${organisationName ?? "this organisation"}"?`}
                description="This permanently deletes the organisation, members, contacts, campaigns, and related data. You will be switched to another organisation."
                confirmLabel="Delete organisation"
                cancelLabel="Cancel"
                variant="danger"
                isPending={deleteOrganisation.isPending}
                onConfirm={handleDeleteOrganisation}
            />

            <Modal.Backdrop isOpen={createOpen} onOpenChange={setCreateOpen}>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-md">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>Create organisation</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="space-y-4">
                            <p className="text-xs text-muted">
                                Starts a new empty workspace. You become the owner and can
                                switch between organisations anytime.
                            </p>
                            <form
                                id="create-org-form"
                                onSubmit={onCreateOrganisation}
                                className="space-y-3"
                            >
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="create-org-name">Name</Label>
                                    <Input
                                        id="create-org-name"
                                        {...createForm.register("name")}
                                        placeholder="Acme Inc"
                                        autoFocus
                                    />
                                    {createForm.formState.errors.name ? (
                                        <p className="text-xs text-danger">
                                            {createForm.formState.errors.name.message}
                                        </p>
                                    ) : null}
                                </div>

                                {organisations.length > 0 ? (
                                    <>
                                        <Checkbox
                                            isSelected={copyDataEnabled}
                                            onChange={(checked: boolean) => {
                                                setCopyDataEnabled(checked);
                                                if (!checked) {
                                                    createForm.setValue("source_organisation_uuid", "");
                                                    createForm.setValue("copy_categories", []);
                                                }
                                            }}
                                        >
                                            <Checkbox.Control>
                                                <Checkbox.Indicator />
                                            </Checkbox.Control>
                                            <span className="text-sm text-foreground">
                                                Copy data from another organisation
                                            </span>
                                        </Checkbox>

                                        {copyDataEnabled ? (
                                            <div className="space-y-3 rounded-lg border border-border p-3">
                                                <div className="flex flex-col gap-1.5">
                                                    <Label>Source organisation</Label>
                                                    <Select
                                                        aria-label="Source organisation"
                                                        value={sourceOrganisationUuid || undefined}
                                                        placeholder="Select an organisation"
                                                        onChange={(v) =>
                                                            createForm.setValue(
                                                                "source_organisation_uuid",
                                                                (v as string) ?? "",
                                                                { shouldValidate: true },
                                                            )
                                                        }
                                                    >
                                                        <Select.Trigger className="w-full">
                                                            <Select.Value />
                                                            <Select.Indicator />
                                                        </Select.Trigger>
                                                        <Select.Popover>
                                                            <ListBox>
                                                                {organisations.map((org) => (
                                                                    <ListBox.Item
                                                                        key={org.uuid}
                                                                        id={org.uuid}
                                                                        textValue={org.name}
                                                                    >
                                                                        {org.name}
                                                                        <ListBox.ItemIndicator />
                                                                    </ListBox.Item>
                                                                ))}
                                                            </ListBox>
                                                        </Select.Popover>
                                                    </Select>
                                                </div>

                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <Label>Data to copy</Label>
                                                        <button
                                                            type="button"
                                                            className="text-xs font-medium text-primary hover:underline"
                                                            onClick={() =>
                                                                createForm.setValue(
                                                                    "copy_categories",
                                                                    selectedCopyCategories.length ===
                                                                        COPY_CATEGORY_ENTRIES.length
                                                                        ? []
                                                                        : COPY_CATEGORY_ENTRIES.map(
                                                                              ([key]) => key,
                                                                          ),
                                                                )
                                                            }
                                                        >
                                                            {selectedCopyCategories.length ===
                                                            COPY_CATEGORY_ENTRIES.length
                                                                ? "Clear all"
                                                                : "Select all"}
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                                                        {COPY_CATEGORY_ENTRIES.map(([key, label]) => (
                                                            <Checkbox
                                                                key={key}
                                                                isSelected={selectedCopyCategories.includes(
                                                                    key,
                                                                )}
                                                                onChange={(checked: boolean) => {
                                                                    const next = checked
                                                                        ? [...selectedCopyCategories, key]
                                                                        : selectedCopyCategories.filter(
                                                                              (c) => c !== key,
                                                                          );
                                                                    createForm.setValue(
                                                                        "copy_categories",
                                                                        next,
                                                                    );
                                                                }}
                                                            >
                                                                <Checkbox.Control>
                                                                    <Checkbox.Indicator />
                                                                </Checkbox.Control>
                                                                <span className="text-xs text-foreground">
                                                                    {label}
                                                                </span>
                                                            </Checkbox>
                                                        ))}
                                                    </div>
                                                    {!sourceOrganisationUuid ? (
                                                        <p className="text-xs text-muted">
                                                            Select a source organisation to enable copying.
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ) : null}
                                    </>
                                ) : null}
                            </form>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button slot="close" variant="secondary">
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                form="create-org-form"
                                variant="primary"
                                isDisabled={
                                    createOrganisation.isPending ||
                                    (copyDataEnabled &&
                                        (!sourceOrganisationUuid || selectedCopyCategories.length === 0))
                                }
                            >
                                Create
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>

            <Modal.Backdrop isOpen={inviteOpen} onOpenChange={setInviteOpen}>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-md">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>Invite teammate</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="space-y-4">
                            <form id="invite-form" onSubmit={onInvite} className="space-y-3">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="invite-email">Email</Label>
                                    <Input
                                        id="invite-email"
                                        type="email"
                                        {...inviteForm.register("email")}
                                        placeholder="colleague@company.com"
                                    />
                                    {inviteForm.formState.errors.email ? (
                                        <p className="text-xs text-danger">
                                            {inviteForm.formState.errors.email.message}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label>Role</Label>
                                    <Select
                                        aria-label="Invite role"
                                        value={inviteRole}
                                        onChange={(v) => {
                                            if (!v) return;
                                            inviteForm.setValue(
                                                "role",
                                                v as CreateInvitationFormData["role"],
                                            );
                                        }}
                                    >
                                        <Select.Trigger>
                                            <Select.Value />
                                            <Select.Indicator />
                                        </Select.Trigger>
                                        <Select.Popover>
                                            <ListBox>
                                                <ListBox.Item
                                                    id={OrganisationInviteRoles.MEMBER}
                                                    textValue="Member"
                                                >
                                                    Member
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                                <ListBox.Item
                                                    id={OrganisationInviteRoles.ADMIN}
                                                    textValue="Admin"
                                                >
                                                    Admin
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                            </ListBox>
                                        </Select.Popover>
                                    </Select>
                                </div>
                            </form>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button slot="close" variant="secondary">
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                form="invite-form"
                                variant="primary"
                                isDisabled={createInvitation.isPending}
                            >
                                Send invite
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </div>
    );
};

export default SettingsOrganisationPage;
