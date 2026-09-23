import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

/**
 * oidc-provider never deletes expired adapter rows itself (TTL is enforced
 * at read time, see PrismaOidcAdapter.toPayload) - something has to sweep
 * them or the table grows forever.
 */
@Injectable()
export class OAuthCleanupService {
  private readonly logger = new Logger(OAuthCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpired() {
    const { count } = await this.prisma.oAuthModel.deleteMany({
      where: { expires_at: { lt: new Date() } },
    });
    if (count > 0) {
      this.logger.log(`Purged ${count} expired oauth_models rows`);
    }
  }
}
