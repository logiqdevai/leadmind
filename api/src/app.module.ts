import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MailModule } from './modules/internal/mail/mail.module';
import { SmsModule } from './modules/internal/sms/sms.module';
import { AiModule } from './modules/internal/ai/ai.module';
import { RedisModule } from './core/databases/redis/redis.module';
import { RedisCacheModule } from './modules/internal/redis-cache/redis-cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from './shared/config/env/env.module';
import { ApifyModule } from './integrations/apify/apify.module';
import { GemiModule } from './integrations/gemi/gemi.module';
import { ScrapioModule } from './integrations/scrapio/scrapio.module';
import { GemiModule as GemiApiModule } from './modules/gemi/gemi.module';
import { ElasticsearchModule } from './integrations/elasticsearch/elasticsearch.module';
import { QueuesModule } from './core/queues/queues.module';
import { BullBoardModule } from './core/queues/bull-board.module';
import { FiltersModule } from './modules/filters/filters.module';
import { ScoringInstructionsModule } from './modules/scoring-instructions/scoring-instructions.module';
import { LeadsModule } from './modules/leads/leads.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { SenderProfilesModule } from './modules/sender-profiles/sender-profiles.module';
import { OutreachModule } from './modules/outreach/outreach.module';
import { SearchModule } from './modules/search/search.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MarketingCampaignsModule } from './modules/marketing-campaigns/marketing-campaigns.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { WorkersModule } from './workers/workers.module';
import { AdminModule } from './modules/admin/admin.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { BulkJobsModule } from './modules/bulk-jobs/bulk-jobs.module';
import { FormsModule } from './modules/forms/forms.module';
import { ContactListsModule } from './modules/contact-lists/contact-lists.module';
import { SavedContactFiltersModule } from './modules/saved-contact-filters/saved-contact-filters.module';
import { ContactAudienceStatsModule } from './modules/contact-audience-stats/contact-audience-stats.module';
import { GatewaysModule } from './gateways/gateways.module';
import { AiUsageModule } from './modules/ai-usage/ai-usage.module';
import { ApifyUsageModule } from './modules/apify-usage/apify-usage.module';
import { MessageTemplatesModule } from './modules/message-templates/message-templates.module';
import { SequencesModule } from './modules/sequences/sequences.module';
import { OrganisationsModule } from './modules/organisations/organisations.module';
import { UsersModule } from './modules/users/users.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { MessagingGoalsModule } from './modules/messaging-goals/messaging-goals.module';
import { EmailSendLimitsModule } from './modules/email-send-limits/email-send-limits.module';
import { SendingPolicyModule } from './modules/sending-policy/sending-policy.module';
import { SendingCapacityModule } from './modules/sending-capacity/sending-capacity.module';
import { IntegrationSelectionModule } from './modules/integration-selection/integration-selection.module';
import { CampaignIntegrationsModule } from './modules/campaign-integrations/campaign-integrations.module';
import { MailTesterModule } from './modules/mail-tester/mail-tester.module';

@Module({
  imports: [
    ConfigModule,
    MailModule,
    OrganisationsModule,
    UsersModule,
    ActivityLogsModule,
    MessagingGoalsModule,
    EmailSendLimitsModule,
    SmsModule,
    AiModule,
    RedisModule,
    RedisCacheModule,
    // GraphQLModule,
    AuthModule,
    ApifyModule,
    GemiModule,
    GemiApiModule,
    ScrapioModule,
    ElasticsearchModule,
    QueuesModule,
    BullBoardModule,
    FiltersModule,
    ScoringInstructionsModule,
    LeadsModule,
    ContactsModule,
    SenderProfilesModule,
    OutreachModule,
    SearchModule,
    DashboardModule,
    MarketingCampaignsModule,
    WebhooksModule,
    WorkersModule,
    AdminModule,
    IntegrationsModule,
    RemindersModule,
    BulkJobsModule,
    FormsModule,
    ContactListsModule,
    SavedContactFiltersModule,
    ContactAudienceStatsModule,
    GatewaysModule,
    AiUsageModule,
    ApifyUsageModule,
    MessageTemplatesModule,
    SequencesModule,
    SendingPolicyModule,
    SendingCapacityModule,
    IntegrationSelectionModule,
    CampaignIntegrationsModule,
    MailTesterModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
