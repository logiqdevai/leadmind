import type { Adapter, AdapterPayload } from 'oidc-provider';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { Prisma } from '@/generated/prisma';

/**
 * Generic oidc-provider storage adapter backed by a single Prisma table
 * (OAuthModel). oidc-provider instantiates one adapter per model name
 * (Client, Grant, Session, AccessToken, RefreshToken, AuthorizationCode,
 * Interaction, DeviceCode, PushedAuthorizationRequest, ReplayDetection, ...)
 * via the AdapterFactory passed to `new Provider(issuer, { adapter })`; see
 * services/oidc-provider.service.ts.
 *
 * This mirrors the "one collection, `${model}:${id}` key" pattern used by
 * every community adapter (mongo/redis) linked from the oidc-provider docs -
 * it avoids a bespoke Prisma model per oidc-provider concept.
 */
export class PrismaOidcAdapter implements Adapter {
  constructor(
    private readonly name: string,
    private readonly prisma: PrismaService,
  ) {}

  async upsert(
    id: string,
    payload: AdapterPayload,
    expiresIn?: number,
  ): Promise<void> {
    const expires_at = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;
    const data = {
      payload: payload as unknown as Prisma.InputJsonValue,
      grant_id: (payload.grantId as string) ?? null,
      user_code: (payload.userCode as string) ?? null,
      uid: (payload.uid as string) ?? null,
      expires_at,
    };

    await this.prisma.oAuthModel.upsert({
      where: { model_name_key: { model_name: this.name, key: id } },
      create: { model_name: this.name, key: id, ...data },
      update: { ...data, consumed_at: null },
    });
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    const row = await this.prisma.oAuthModel.findUnique({
      where: { model_name_key: { model_name: this.name, key: id } },
    });
    return this.toPayload(row);
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const row = await this.prisma.oAuthModel.findFirst({
      where: { model_name: this.name, user_code: userCode },
    });
    return this.toPayload(row);
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const row = await this.prisma.oAuthModel.findFirst({
      where: { model_name: this.name, uid },
    });
    return this.toPayload(row);
  }

  async consume(id: string): Promise<void> {
    await this.prisma.oAuthModel.updateMany({
      where: { model_name: this.name, key: id },
      data: { consumed_at: new Date() },
    });
  }

  async destroy(id: string): Promise<void> {
    await this.prisma.oAuthModel.deleteMany({
      where: { model_name: this.name, key: id },
    });
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    await this.prisma.oAuthModel.deleteMany({
      where: { grant_id: grantId },
    });
  }

  private toPayload(
    row: {
      payload: Prisma.JsonValue;
      expires_at: Date | null;
      consumed_at: Date | null;
    } | null,
  ): AdapterPayload | undefined {
    if (!row) return undefined;
    if (row.expires_at && row.expires_at.getTime() < Date.now())
      return undefined;

    const payload = row.payload as unknown as AdapterPayload;
    if (!row.consumed_at) return payload;
    return {
      ...payload,
      consumed: Math.floor(row.consumed_at.getTime() / 1000),
    };
  }
}
