import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ReminderStatus, ReminderType } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { NotificationsGateway } from '@/gateways/notifications.gateway';
import { REMINDER_TRIGGER_QUEUE } from '@/core/queues/queues.constants';
import { RemindersService } from '@/modules/reminders/reminders.service';
import { FollowUpDraftService } from '@/modules/reminders/services/follow-up-draft.service';

interface ReminderTriggerJobData {
    reminder_uuid: string;
}

@Processor(REMINDER_TRIGGER_QUEUE)
export class ReminderTriggerWorker extends WorkerHost {
    private readonly logger = new Logger(ReminderTriggerWorker.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly gateway: NotificationsGateway,
        private readonly remindersService: RemindersService,
        private readonly followUpDraftService: FollowUpDraftService,
    ) {
        super();
    }

    async process(job: Job<ReminderTriggerJobData>): Promise<void> {
        let reminder = await this.prisma.reminder.findUnique({
            where: { uuid: job.data.reminder_uuid },
            include: {
                contact: {
                    select: {
                        uuid: true,
                        name: true,
                        company: true,
                        email: true,
                    },
                },
            },
        });

        if (!reminder) {
            this.logger.warn(`Reminder ${job.data.reminder_uuid} not found — skipping`);
            return;
        }

        if (reminder.status !== ReminderStatus.PENDING) {
            this.logger.warn(`Reminder ${reminder.uuid} is ${reminder.status} — skipping`);
            return;
        }

        if (
            reminder.type === ReminderType.FOLLOW_UP &&
            !(reminder.metadata as { ai_draft?: unknown } | null)?.ai_draft
        ) {
            const draft = await this.followUpDraftService.draftFollowUp(
                reminder.organisation_uuid,
                reminder.contact_uuid,
            );
            if (draft) {
                const ai_draft = {
                    subject: draft.subject,
                    body: draft.body,
                    generated_at: new Date().toISOString(),
                };
                await this.remindersService.setFollowUpDraft(reminder.uuid, ai_draft);
                reminder = { ...reminder, metadata: { ai_draft } as typeof reminder.metadata };
            }
        }

        const members = await this.prisma.organisationMember.findMany({
            where: { organisation_uuid: reminder.organisation_uuid },
            select: { user_uuid: true },
        });

        for (const member of members) {
            this.gateway.emitToUser(member.user_uuid, 'reminder.triggered', reminder);
        }
        this.logger.log(`Reminder triggered: ${reminder.uuid} for organisation ${reminder.organisation_uuid}`);
    }
}
