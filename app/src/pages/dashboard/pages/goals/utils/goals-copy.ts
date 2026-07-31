export const PERIOD_LABELS = {
    DAY: "Daily",
    WEEK: "Weekly",
    MONTH: "Monthly",
} as const;

export const ACHIEVEMENT_COPY: Record<
    string,
    { title: string; description: string }
> = {
    MILESTONE_25: {
        title: "Quarter way there",
        description: "Nice start — keep the momentum going.",
    },
    MILESTONE_50: {
        title: "Halfway there",
        description: "You're crushing it. Halfway to your goal.",
    },
    MILESTONE_75: {
        title: "Almost there",
        description: "Final stretch — finish strong.",
    },
    GOAL_COMPLETE: {
        title: "Goal crushed",
        description: "You hit your messaging target. Outstanding.",
    },
    PERSONAL_RECORD: {
        title: "New personal best",
        description: "You just set a new record for yourself.",
    },
    LEADERBOARD_FIRST: {
        title: "You're #1",
        description: "Top of the leaderboard. Own it.",
    },
};
