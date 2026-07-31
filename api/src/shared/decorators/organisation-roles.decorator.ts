import { SetMetadata } from '@nestjs/common';
import { OrganisationRole } from 'generated/prisma';

export const ORGANISATION_ROLES_KEY = 'organisation_roles';
export const OrganisationRoles = (...roles: OrganisationRole[]) =>
    SetMetadata(ORGANISATION_ROLES_KEY, roles);
