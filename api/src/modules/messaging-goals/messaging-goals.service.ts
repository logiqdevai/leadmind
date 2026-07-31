import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    GoalAchievementType,
    GoalPeriod,
    MsgStatus,
    OrganisationRole,
    Prisma,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { NotificationsGateway } from '@/gateways/notifications.gateway';
import { CreateMessagingGoalDto } from './dto/create-messaging-goal.dto';
import { UpdateMessagingGoalDto } from './dto/update-messaging-goal.dto';
import { BulkUpsertMessagingGoalsDto } from './dto/bulk-upsert-messaging-goals.dto';
import {
    getPeriodWindow,
    MILESTONE_THRESHOLDS,
    SENT_MESSAGE_STATUSES,
} from './utils/messaging-goals.utils';

const MANAGER_ROLES: OrganisationRole[] = [
    OrganisationRole.OWNER,
    OrganisationRole.ADMIN,
];

type GoalUser = {
    uuid: string;
    email: string;
    full_name: string | null;
};

type GoalWithProgress = {
    uuid: string;
    organisation_uuid: string;
    user_uuid: string;
    period: GoalPeriod;
    target_count: number;
    is_active: boolean;
    current_count: number;
    percent: number;
    period_key: string;
    starts_at: string;
    ends_at: string;
    user: GoalUser;
};

@Injectable()
export class MessagingGoalsService {
    private readonly logger = new Logger(MessagingGoalsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly gateway: NotificationsGateway,
    ) {}

    async upsert(
        organisationUuid: string,
        actorUserUuid: string,
        dto: CreateMessagingGoalDto,
    ) {
        await this.requireMembership(organisationUuid, actorUserUuid, MANAGER_ROLES);
        await this.assertMemberOfOrg(organisationUuid, dto.user_uuid);

        const goal = await this.prisma.messagingGoal.upsert({
            where: {
                organisation_uuid_user_uuid_period: {
                    organisation_uuid: organisationUuid,
                    user_uuid: dto.user_uuid,
                    period: dto.period,
                },
            },
            create: {
                organisation_uuid: organisationUuid,
                user_uuid: dto.user_uuid,
                period: dto.period,
                target_count: dto.target_count,
                is_active: true,
            },
            update: {
                target_count: dto.target_count,
                is_active: true,
            },
            include: {
                user: { select: { uuid: true, email: true, full_name: true } },
            },
        });

        return this.toGoalWithProgress(goal, await this.getOrgTimezone(organisationUuid));
    }

    async bulkUpsert(
        organisationUuid: string,
        actorUserUuid: string,
        dto: BulkUpsertMessagingGoalsDto,
    ) {
        await this.requireMembership(organisationUuid, actorUserUuid, MANAGER_ROLES);

        const userUuids = [...new Set(dto.goals.map((g) => g.user_uuid))];
        const members = await this.prisma.organisationMember.findMany({
            where: {
                organisation_uuid: organisationUuid,
                user_uuid: { in: userUuids },
            },
            select: { user_uuid: true },
        });
        const memberSet = new Set(members.map((m) => m.user_uuid));
        for (const uuid of userUuids) {
            if (!memberSet.has(uuid)) {
                throw new BadRequestException(`User ${uuid} is not a member of this organisation`);
            }
        }

        const timezone = await this.getOrgTimezone(organisationUuid);
        const results = await this.prisma.$transaction(
            dto.goals.map((item) =>
                this.prisma.messagingGoal.upsert({
                    where: {
                        organisation_uuid_user_uuid_period: {
                            organisation_uuid: organisationUuid,
                            user_uuid: item.user_uuid,
                            period: item.period,
                        },
                    },
                    create: {
                        organisation_uuid: organisationUuid,
                        user_uuid: item.user_uuid,
                        period: item.period,
                        target_count: item.target_count,
                        is_active: true,
                    },
                    update: {
                        target_count: item.target_count,
                        is_active: true,
                    },
                    include: {
                        user: { select: { uuid: true, email: true, full_name: true } },
                    },
                }),
            ),
        );

        return Promise.all(results.map((goal) => this.toGoalWithProgress(goal, timezone)));
    }

    async update(
        organisationUuid: string,
        actorUserUuid: string,
        uuid: string,
        dto: UpdateMessagingGoalDto,
    ) {
        await this.requireMembership(organisationUuid, actorUserUuid, MANAGER_ROLES);
        await this.findGoalOrThrow(organisationUuid, uuid);

        const goal = await this.prisma.messagingGoal.update({
            where: { uuid },
            data: {
                ...(dto.target_count !== undefined && { target_count: dto.target_count }),
                ...(dto.is_active !== undefined && { is_active: dto.is_active }),
            },
            include: {
                user: { select: { uuid: true, email: true, full_name: true } },
            },
        });

        return this.toGoalWithProgress(goal, await this.getOrgTimezone(organisationUuid));
    }

    async deactivate(organisationUuid: string, actorUserUuid: string, uuid: string) {
        await this.requireMembership(organisationUuid, actorUserUuid, MANAGER_ROLES);
        await this.findGoalOrThrow(organisationUuid, uuid);

        const goal = await this.prisma.messagingGoal.update({
            where: { uuid },
            data: { is_active: false },
            include: {
                user: { select: { uuid: true, email: true, full_name: true } },
            },
        });

        return this.toGoalWithProgress(goal, await this.getOrgTimezone(organisationUuid));
    }

    async listMine(organisationUuid: string, userUuid: string) {
        await this.requireMembership(organisationUuid, userUuid);
        const timezone = await this.getOrgTimezone(organisationUuid);
        const goals = await this.prisma.messagingGoal.findMany({
            where: {
                organisation_uuid: organisationUuid,
                user_uuid: userUuid,
                is_active: true,
            },
            include: {
                user: { select: { uuid: true, email: true, full_name: true } },
            },
            orderBy: { period: 'asc' },
        });
        return Promise.all(goals.map((goal) => this.toGoalWithProgress(goal, timezone)));
    }

    async listAll(organisationUuid: string, userUuid: string) {
        await this.requireMembership(organisationUuid, userUuid);
        const timezone = await this.getOrgTimezone(organisationUuid);
        const goals = await this.prisma.messagingGoal.findMany({
            where: {
                organisation_uuid: organisationUuid,
                is_active: true,
            },
            include: {
                user: { select: { uuid: true, email: true, full_name: true } },
            },
            orderBy: [{ user: { full_name: 'asc' } }, { period: 'asc' }],
        });
        return Promise.all(goals.map((goal) => this.toGoalWithProgress(goal, timezone)));
    }

    async leaderboard(
        organisationUuid: string,
        userUuid: string,
        period: GoalPeriod,
    ) {
        await this.requireMembership(organisationUuid, userUuid);
        const timezone = await this.getOrgTimezone(organisationUuid);
        const window = getPeriodWindow(period, timezone);

        const goals = await this.prisma.messagingGoal.findMany({
            where: {
                organisation_uuid: organisationUuid,
                period,
                is_active: true,
            },
            include: {
                user: { select: { uuid: true, email: true, full_name: true } },
            },
        });

        const rows = await Promise.all(
            goals.map(async (goal) => {
                const current_count = await this.countSentMessages(
                    organisationUuid,
                    goal.user_uuid,
                    window.starts_at,
                    window.ends_at,
                );
                const percent =
                    goal.target_count > 0
                        ? Math.min(100, Math.round((current_count / goal.target_count) * 100))
                        : 0;
                return {
                    user: goal.user,
                    goal_uuid: goal.uuid,
                    period: goal.period,
                    target_count: goal.target_count,
                    current_count,
                    percent,
                    period_key: window.period_key,
                    starts_at: window.starts_at.toISOString(),
                    ends_at: window.ends_at.toISOString(),
                };
            }),
        );

        rows.sort((a, b) => {
            if (b.percent !== a.percent) return b.percent - a.percent;
            if (b.current_count !== a.current_count) return b.current_count - a.current_count;
            return (a.user.full_name || a.user.email).localeCompare(
                b.user.full_name || b.user.email,
            );
        });

        return rows.map((row, index) => ({ ...row, rank: index + 1 }));
    }

    async listAchievements(
        organisationUuid: string,
        userUuid: string,
        unseenOnly?: boolean,
    ) {
        await this.requireMembership(organisationUuid, userUuid);
        return this.prisma.goalAchievement.findMany({
            where: {
                organisation_uuid: organisationUuid,
                user_uuid: userUuid,
                ...(unseenOnly ? { seen_at: null } : {}),
            },
            include: {
                goal: {
                    select: {
                        uuid: true,
                        period: true,
                        target_count: true,
                    },
                },
            },
            orderBy: { created_at: 'desc' },
            take: 50,
        });
    }

    async markAchievementSeen(
        organisationUuid: string,
        userUuid: string,
        achievementUuid: string,
    ) {
        await this.requireMembership(organisationUuid, userUuid);
        const achievement = await this.prisma.goalAchievement.findFirst({
            where: {
                uuid: achievementUuid,
                organisation_uuid: organisationUuid,
                user_uuid: userUuid,
            },
        });
        if (!achievement) {
            throw new NotFoundException('Achievement not found');
        }
        if (achievement.seen_at) {
            return achievement;
        }
        return this.prisma.goalAchievement.update({
            where: { uuid: achievementUuid },
            data: { seen_at: new Date() },
        });
    }

    async onMessageSent(params: {
        organisation_uuid: string;
        user_uuid: string;
        sent_at?: Date;
    }): Promise<void> {
        const { organisation_uuid, user_uuid } = params;
        if (!user_uuid) return;

        try {
            const timezone = await this.getOrgTimezone(organisation_uuid);
            const goals = await this.prisma.messagingGoal.findMany({
                where: {
                    organisation_uuid,
                    user_uuid,
                    is_active: true,
                },
                include: {
                    user: { select: { uuid: true, email: true, full_name: true } },
                },
            });
            if (goals.length === 0) return;

            const at = params.sent_at ?? new Date();
            const newAchievements: Array<{
                uuid: string;
                type: GoalAchievementType;
                period_key: string;
                goal_uuid: string;
                payload: Prisma.JsonValue;
            }> = [];
            const progressUpdates: GoalWithProgress[] = [];

            for (const goal of goals) {
                const window = getPeriodWindow(goal.period, timezone, at);
                const current_count = await this.countSentMessages(
                    organisation_uuid,
                    user_uuid,
                    window.starts_at,
                    window.ends_at,
                );
                const percent =
                    goal.target_count > 0
                        ? Math.min(100, Math.round((current_count / goal.target_count) * 100))
                        : 0;

                const progress: GoalWithProgress = {
                    uuid: goal.uuid,
                    organisation_uuid: goal.organisation_uuid,
                    user_uuid: goal.user_uuid,
                    period: goal.period,
                    target_count: goal.target_count,
                    is_active: goal.is_active,
                    current_count,
                    percent,
                    period_key: window.period_key,
                    starts_at: window.starts_at.toISOString(),
                    ends_at: window.ends_at.toISOString(),
                    user: goal.user,
                };
                progressUpdates.push(progress);

                for (const milestone of MILESTONE_THRESHOLDS) {
                    if (percent >= milestone.percent) {
                        const created = await this.createAchievementIfNew({
                            organisation_uuid,
                            user_uuid,
                            goal_uuid: goal.uuid,
                            type: milestone.type,
                            period_key: window.period_key,
                            payload: { count: current_count, percent, target: goal.target_count },
                        });
                        if (created) newAchievements.push(created);
                    }
                }

                if (current_count >= goal.target_count) {
                    const created = await this.createAchievementIfNew({
                        organisation_uuid,
                        user_uuid,
                        goal_uuid: goal.uuid,
                        type: GoalAchievementType.GOAL_COMPLETE,
                        period_key: window.period_key,
                        payload: { count: current_count, percent, target: goal.target_count },
                    });
                    if (created) newAchievements.push(created);
                }

                const personalBest = await this.prisma.goalPersonalBest.findUnique({
                    where: {
                        organisation_uuid_user_uuid_period: {
                            organisation_uuid,
                            user_uuid,
                            period: goal.period,
                        },
                    },
                });
                const previousBest = personalBest?.best_count ?? 0;
                if (current_count > previousBest) {
                    await this.prisma.goalPersonalBest.upsert({
                        where: {
                            organisation_uuid_user_uuid_period: {
                                organisation_uuid,
                                user_uuid,
                                period: goal.period,
                            },
                        },
                        create: {
                            organisation_uuid,
                            user_uuid,
                            period: goal.period,
                            best_count: current_count,
                            achieved_at: at,
                        },
                        update: {
                            best_count: current_count,
                            achieved_at: at,
                        },
                    });
                    if (previousBest > 0) {
                        const created = await this.createAchievementIfNew({
                            organisation_uuid,
                            user_uuid,
                            goal_uuid: goal.uuid,
                            type: GoalAchievementType.PERSONAL_RECORD,
                            period_key: window.period_key,
                            payload: {
                                count: current_count,
                                previous_best: previousBest,
                            },
                        });
                        if (created) newAchievements.push(created);
                    }
                }

                const board = await this.leaderboardRanks(
                    organisation_uuid,
                    goal.period,
                    timezone,
                );
                const top = board[0];
                if (top && top.user_uuid === user_uuid && top.current_count > 0) {
                    const created = await this.createAchievementIfNew({
                        organisation_uuid,
                        user_uuid,
                        goal_uuid: goal.uuid,
                        type: GoalAchievementType.LEADERBOARD_FIRST,
                        period_key: window.period_key,
                        payload: {
                            count: current_count,
                            percent,
                            rank: 1,
                        },
                    });
                    if (created) newAchievements.push(created);
                }
            }

            this.gateway.emitToUser(user_uuid, 'goal.progress_updated', {
                goals: progressUpdates,
            });

            for (const achievement of newAchievements) {
                this.gateway.emitToUser(user_uuid, 'goal.achievement', {
                    achievement,
                    progress: progressUpdates.find((p) => p.uuid === achievement.goal_uuid),
                });
            }

            const memberUuids = await this.prisma.organisationMember.findMany({
                where: { organisation_uuid },
                select: { user_uuid: true },
            });
            for (const member of memberUuids) {
                if (member.user_uuid === user_uuid) continue;
                this.gateway.emitToUser(member.user_uuid, 'goal.leaderboard_updated', {
                    organisation_uuid,
                });
            }
        } catch (error) {
            this.logger.error(
                `Failed to process messaging goal progress for user=${user_uuid}`,
                error instanceof Error ? error.stack : undefined,
            );
        }
    }

    private async leaderboardRanks(
        organisationUuid: string,
        period: GoalPeriod,
        timezone: string,
    ) {
        const window = getPeriodWindow(period, timezone);
        const goals = await this.prisma.messagingGoal.findMany({
            where: {
                organisation_uuid: organisationUuid,
                period,
                is_active: true,
            },
        });
        const rows = await Promise.all(
            goals.map(async (goal) => {
                const current_count = await this.countSentMessages(
                    organisationUuid,
                    goal.user_uuid,
                    window.starts_at,
                    window.ends_at,
                );
                const percent =
                    goal.target_count > 0
                        ? Math.min(100, Math.round((current_count / goal.target_count) * 100))
                        : 0;
                return {
                    user_uuid: goal.user_uuid,
                    current_count,
                    percent,
                };
            }),
        );
        rows.sort((a, b) => {
            if (b.percent !== a.percent) return b.percent - a.percent;
            return b.current_count - a.current_count;
        });
        return rows;
    }

    private async createAchievementIfNew(params: {
        organisation_uuid: string;
        user_uuid: string;
        goal_uuid: string;
        type: GoalAchievementType;
        period_key: string;
        payload: Prisma.InputJsonValue;
    }) {
        try {
            const achievement = await this.prisma.goalAchievement.create({
                data: {
                    organisation_uuid: params.organisation_uuid,
                    user_uuid: params.user_uuid,
                    goal_uuid: params.goal_uuid,
                    type: params.type,
                    period_key: params.period_key,
                    payload: params.payload,
                },
            });
            return {
                uuid: achievement.uuid,
                type: achievement.type,
                period_key: achievement.period_key,
                goal_uuid: achievement.goal_uuid,
                payload: achievement.payload,
            };
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                return null;
            }
            throw error;
        }
    }

    private async toGoalWithProgress(
        goal: {
            uuid: string;
            organisation_uuid: string;
            user_uuid: string;
            period: GoalPeriod;
            target_count: number;
            is_active: boolean;
            user: GoalUser;
        },
        timezone: string,
    ): Promise<GoalWithProgress> {
        const window = getPeriodWindow(goal.period, timezone);
        const current_count = await this.countSentMessages(
            goal.organisation_uuid,
            goal.user_uuid,
            window.starts_at,
            window.ends_at,
        );
        const percent =
            goal.target_count > 0
                ? Math.min(100, Math.round((current_count / goal.target_count) * 100))
                : 0;
        return {
            uuid: goal.uuid,
            organisation_uuid: goal.organisation_uuid,
            user_uuid: goal.user_uuid,
            period: goal.period,
            target_count: goal.target_count,
            is_active: goal.is_active,
            current_count,
            percent,
            period_key: window.period_key,
            starts_at: window.starts_at.toISOString(),
            ends_at: window.ends_at.toISOString(),
            user: goal.user,
        };
    }

    private async countSentMessages(
        organisationUuid: string,
        userUuid: string,
        startsAt: Date,
        endsAt: Date,
    ): Promise<number> {
        return this.prisma.outreachMessage.count({
            where: {
                organisation_uuid: organisationUuid,
                sent_by_user_uuid: userUuid,
                campaign_uuid: null,
                status: { in: [...SENT_MESSAGE_STATUSES] as MsgStatus[] },
                sent_at: {
                    gte: startsAt,
                    lte: endsAt,
                },
            },
        });
    }

    private async getOrgTimezone(organisationUuid: string): Promise<string> {
        const org = await this.prisma.organisation.findUnique({
            where: { uuid: organisationUuid },
            select: { timezone: true },
        });
        return org?.timezone || 'UTC';
    }

    private async findGoalOrThrow(organisationUuid: string, uuid: string) {
        const goal = await this.prisma.messagingGoal.findFirst({
            where: { uuid, organisation_uuid: organisationUuid },
        });
        if (!goal) {
            throw new NotFoundException('Messaging goal not found');
        }
        return goal;
    }

    private async assertMemberOfOrg(organisationUuid: string, userUuid: string) {
        const membership = await this.prisma.organisationMember.findUnique({
            where: {
                organisation_uuid_user_uuid: {
                    organisation_uuid: organisationUuid,
                    user_uuid: userUuid,
                },
            },
        });
        if (!membership) {
            throw new BadRequestException('Target user is not a member of this organisation');
        }
    }

    private async requireMembership(
        organisationUuid: string,
        userUuid: string,
        allowedRoles?: OrganisationRole[],
    ) {
        const membership = await this.prisma.organisationMember.findUnique({
            where: {
                organisation_uuid_user_uuid: {
                    organisation_uuid: organisationUuid,
                    user_uuid: userUuid,
                },
            },
        });
        if (!membership) {
            throw new ForbiddenException('You are not a member of this organisation');
        }
        if (allowedRoles && allowedRoles.length > 0) {
            if (membership.role === OrganisationRole.OWNER) {
                return membership;
            }
            if (!allowedRoles.includes(membership.role)) {
                throw new ForbiddenException('Insufficient organisation permissions');
            }
        }
        return membership;
    }
}
