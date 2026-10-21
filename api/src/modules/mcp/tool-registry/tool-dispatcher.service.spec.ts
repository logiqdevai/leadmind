import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { OrganisationRole } from '@/generated/prisma';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { isDeniedOperation } from './mcp-tools.config';
import { McpToolDefinition } from './tool-definition.interface';
import { ToolDispatcherService } from './tool-dispatcher.service';

jest.mock('axios');

const SECRET = 'test-secret';
const ORG = 'org-a';

const tool = (over: Partial<McpToolDefinition>): McpToolDefinition => ({
  name: 't',
  description: '',
  method: 'get',
  pathTemplate: '/contacts',
  pathParams: [],
  queryParams: [],
  hasBody: false,
  scope: 'mcp:read' as any,
  inputSchema: { type: 'object' },
  annotations: {},
  ...over,
});

describe('ToolDispatcherService', () => {
  const jwt = new JwtService({ secret: SECRET });
  const create = jest.fn().mockResolvedValue({});
  const service = new ToolDispatcherService(
    { get: (k: string) => (k === 'JWT_SECRET' ? SECRET : 3000) } as any,
    jwt,
    { mcpToolInvocationLog: { create } } as any,
  );
  const request = axios.request as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    request.mockResolvedValue({ status: 200, data: {} });
  });

  it.each([
    OrganisationRole.OWNER,
    OrganisationRole.ADMIN,
    OrganisationRole.MEMBER,
  ])('forwards the %s role in the internal token', async (role) => {
    await service.dispatch(tool({}), {}, {
      userUuid: 'u1',
      organisationUuid: ORG,
      organisationRole: role,
    });
    const token = request.mock.calls[0][0].headers.Authorization.slice(7);
    const claims = jwt.verify(token, { secret: SECRET });
    expect(claims).toMatchObject({
      organisation_uuid: ORG,
      organisation_role: role,
    });
  });

  it('refuses organisation-management calls for a different organisation', async () => {
    const result = await service.dispatch(
      tool({
        method: 'patch',
        pathTemplate: '/organisations/{uuid}',
        pathParams: ['uuid'],
      }),
      { uuid: 'org-b' },
      { userUuid: 'u1', organisationUuid: ORG, organisationRole: 'OWNER' },
    );
    expect(result.status).toBe(403);
    expect(request).not.toHaveBeenCalled();
  });

  it('allows organisation-management calls for the connected organisation', async () => {
    const result = await service.dispatch(
      tool({
        pathTemplate: '/organisations/{uuid}/members',
        pathParams: ['uuid'],
      }),
      { uuid: ORG },
      { userUuid: 'u1', organisationUuid: ORG, organisationRole: 'ADMIN' },
    );
    expect(result.status).toBe(200);
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('MCP operation denylist', () => {
  it.each([
    ['delete', '/users/me'],
    ['patch', '/users/me/password'],
    ['post', '/organisations'],
    ['delete', '/organisations/{uuid}'],
    ['post', '/organisations/{uuid}/switch'],
    ['post', '/organisations/invitations/{token}/accept'],
  ])('denies %s %s', (method, path) => {
    expect(isDeniedOperation(method, path)).toBe(true);
  });

  it('keeps ordinary operations on the same prefixes', () => {
    expect(isDeniedOperation('get', '/users/me')).toBe(false);
    expect(isDeniedOperation('get', '/organisations')).toBe(false);
    expect(isDeniedOperation('patch', '/organisations/{uuid}')).toBe(false);
  });
});

describe('OrganisationRolesGuard with MCP-forwarded roles', () => {
  class AdminOnly {
    @OrganisationRoles(OrganisationRole.ADMIN)
    handler() {}
    open() {}
  }
  const guard = new OrganisationRolesGuard(new Reflector());
  const ctx = (role: string, handler: () => void) =>
    ({
      getHandler: () => handler,
      getClass: () => AdminOnly,
      switchToHttp: () => ({
        getRequest: () => ({ user: { organisation_role: role } }),
      }),
    }) as unknown as ExecutionContext;
  const instance = new AdminOnly();

  it.each([
    [OrganisationRole.OWNER, true],
    [OrganisationRole.ADMIN, true],
    [OrganisationRole.MEMBER, false],
  ])('admin-only route for %s -> %s', (role, allowed) => {
    expect(guard.canActivate(ctx(role, instance.handler))).toBe(allowed);
  });

  it('lets every role through an unrestricted route', () => {
    for (const role of Object.values(OrganisationRole))
      expect(guard.canActivate(ctx(role, instance.open))).toBe(true);
  });
});
