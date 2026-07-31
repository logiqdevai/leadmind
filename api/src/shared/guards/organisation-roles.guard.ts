import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganisationRole } from 'generated/prisma';
import { ORGANISATION_ROLES_KEY } from '../decorators/organisation-roles.decorator';

@Injectable()
export class OrganisationRolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<OrganisationRole[]>(
            ORGANISATION_ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user?.organisation_role) {
            return false;
        }

        if (user.organisation_role === OrganisationRole.OWNER) {
            return true;
        }

        return requiredRoles.includes(user.organisation_role);
    }
}
