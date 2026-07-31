import { type FC, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Plus } from "lucide-react";
import { Button, Input, Label, ListBox, Modal, Select } from "@heroui/react";
import { useAuthStore } from "@/stores/auth";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import {
    useCreateInvitation,
    useOrganisationInvitations,
    useOrganisationMembers,
    useRemoveMember,
    useRevokeInvitation,
    useUpdateMemberRole,
    useUpdateOrganisation,
} from "@/features/organisations/hooks/use-organisations";
import {
    OrganisationInviteRoles,
    OrganisationRoles,
    type OrganisationRole,
} from "@/features/organisations/interfaces/organisation.interfaces";
import {
    createInvitationSchema,
    updateOrganisationSchema,
    type CreateInvitationFormData,
    type UpdateOrganisationFormData,
} from "@/features/organisations/validation-schemas/organisation.schema";

const SettingsOrganisationPage: FC = () => {
    const organisationUuid = useAuthStore((s) => s.organisation_uuid) ?? "";
    const organisationName = useAuthStore((s) => s.organisation_name);
    const currentUserUuid = useAuthStore((s) => s.user_uuid);
    const canEdit = useOrganisationPermission("org_settings");
    const canInvite = useOrganisationPermission("org_invite");
    const canManage = useOrganisationPermission("org_manage_members");

    const updateOrganisation = useUpdateOrganisation(organisationUuid);
    const { data: members = [], isLoading: membersLoading } =
        useOrganisationMembers(organisationUuid);
    const { data: invitations = [] } = useOrganisationInvitations(
        canInvite ? organisationUuid : "",
    );
    const createInvitation = useCreateInvitation(organisationUuid);
    const revokeInvitation = useRevokeInvitation(organisationUuid);
    const updateRole = useUpdateMemberRole(organisationUuid);
    const removeMember = useRemoveMember(organisationUuid);

    const [inviteOpen, setInviteOpen] = useState(false);

    const settingsForm = useForm<UpdateOrganisationFormData>({
        resolver: zodResolver(updateOrganisationSchema),
        values: { name: organisationName ?? "" },
    });

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
        updateOrganisation.mutate(data);
    });

    const onInvite = inviteForm.handleSubmit((data) => {
        createInvitation.mutate(data, {
            onSuccess: () => {
                setInviteOpen(false);
                inviteForm.reset();
            },
        });
    });

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
                {canInvite ? (
                    <Button variant="primary" size="sm" onPress={() => setInviteOpen(true)}>
                        <Plus className="size-3.5" />
                        Invite
                    </Button>
                ) : null}
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
                                {canManage && member.role !== OrganisationRoles.OWNER ? (
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
                                        {member.user_uuid !== currentUserUuid ? (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onPress={() =>
                                                    removeMember.mutate(member.user_uuid)
                                                }
                                            >
                                                Remove
                                            </Button>
                                        ) : null}
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
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onPress={() => revokeInvitation.mutate(invite.uuid)}
                                    >
                                        Revoke
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : null}

            <Modal.Backdrop isOpen={inviteOpen} onOpenChange={setInviteOpen}>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-md">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>Invite teammate</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="p-6 space-y-4">
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
