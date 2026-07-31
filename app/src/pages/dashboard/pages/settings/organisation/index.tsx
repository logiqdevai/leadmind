import { type FC } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2 } from "lucide-react";
import { Button, Input, Label } from "@heroui/react";
import { useAuthStore } from "@/stores/auth";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import {
    useUpdateOrganisation,
} from "@/features/organisations/hooks/use-organisations";
import {
    updateOrganisationSchema,
    type UpdateOrganisationFormData,
} from "@/features/organisations/validation-schemas/organisation.schema";

const SettingsOrganisationPage: FC = () => {
    const organisationUuid = useAuthStore((s) => s.organisation_uuid);
    const organisationName = useAuthStore((s) => s.organisation_name);
    const canEdit = useOrganisationPermission("org_settings");
    const updateOrganisation = useUpdateOrganisation(organisationUuid ?? "");

    const form = useForm<UpdateOrganisationFormData>({
        resolver: zodResolver(updateOrganisationSchema),
        values: { name: organisationName ?? "" },
    });

    const onSubmit = form.handleSubmit((data) => {
        if (!organisationUuid) return;
        updateOrganisation.mutate(data);
    });

    return (
        <div className="space-y-4 max-w-lg">
            <div className="flex items-center gap-2.5">
                <Building2 className="size-5 text-muted shrink-0" />
                <div>
                    <h1 className="text-lg font-semibold text-foreground leading-tight">
                        Organisation
                    </h1>
                    <p className="text-xs text-muted mt-0.5">
                        Workspace name and settings
                    </p>
                </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input
                        {...form.register("name")}
                        disabled={!canEdit || updateOrganisation.isPending}
                        placeholder="Organisation name"
                        fullWidth
                    />
                    {form.formState.errors.name && (
                        <p className="text-xs text-danger">
                            {form.formState.errors.name.message}
                        </p>
                    )}
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
        </div>
    );
};

export default SettingsOrganisationPage;
