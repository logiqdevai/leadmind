import { ForbiddenException } from '@nestjs/common';
import { OrganisationRole } from '@/generated/prisma';
import { OAuthConnectionsService } from './oauth-connections.service';

// The real provider pulls in oidc-provider (ESM-only), which Jest can't load here.
// These tests only exercise the authorization logic, so the provider is stubbed.
jest.mock('./oidc-provider.service', () => ({ OidcProviderService: class {} }));

describe('OAuthConnectionsService.createAccessToken', () => {
  const USER_UUID = 'user-1';
  const ORG_UUID = 'org-1';
  const dto = { expires_in: '30d' as const, scopes: ['mcp:read'] };

  const findUnique = jest.fn();
  const signPersonalAccessToken = jest.fn();
  const service = new OAuthConnectionsService(
    { organisationMember: { findUnique } } as any,
    { signPersonalAccessToken } as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    signPersonalAccessToken.mockResolvedValue({
      token: 'signed-token',
      expiresAt: new Date('2026-11-03T00:00:00.000Z'),
    });
  });

  it('rejects a caller who is not a member of the organisation', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.createAccessToken(USER_UUID, ORG_UUID, dto),
    ).rejects.toThrow(ForbiddenException);
    expect(signPersonalAccessToken).not.toHaveBeenCalled();
  });

  it('rejects a plain member even though the JWT could claim a higher role', async () => {
    findUnique.mockResolvedValue({ role: OrganisationRole.MEMBER });

    await expect(
      service.createAccessToken(USER_UUID, ORG_UUID, dto),
    ).rejects.toThrow(ForbiddenException);
    expect(signPersonalAccessToken).not.toHaveBeenCalled();
  });

  it('signs with the role from the membership table, not from the caller', async () => {
    findUnique.mockResolvedValue({ role: OrganisationRole.ADMIN });

    const result = await service.createAccessToken(USER_UUID, ORG_UUID, {
      expires_in: '90d',
      scopes: ['mcp:read', 'mcp:write'],
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        organisation_uuid_user_uuid: {
          organisation_uuid: ORG_UUID,
          user_uuid: USER_UUID,
        },
      },
    });
    expect(signPersonalAccessToken).toHaveBeenCalledWith({
      userUuid: USER_UUID,
      organisationUuid: ORG_UUID,
      organisationRole: OrganisationRole.ADMIN,
      scopes: ['mcp:read', 'mcp:write'],
      expiresIn: '90d',
    });
    expect(result).toEqual({
      token: 'signed-token',
      scope: 'mcp:read mcp:write',
      organisation_uuid: ORG_UUID,
      expires_at: '2026-11-03T00:00:00.000Z',
    });
  });

  it('returns a null expires_at for a token that never expires', async () => {
    findUnique.mockResolvedValue({ role: OrganisationRole.OWNER });
    signPersonalAccessToken.mockResolvedValue({
      token: 'forever',
      expiresAt: null,
    });

    const result = await service.createAccessToken(USER_UUID, ORG_UUID, {
      expires_in: 'never',
      scopes: ['mcp:read'],
    });

    expect(result.expires_at).toBeNull();
  });
});
