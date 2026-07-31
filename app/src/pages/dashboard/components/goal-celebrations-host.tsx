import { CelebrationModal } from "@/pages/dashboard/components/celebration-modal";
import { useGoalCelebrations } from "@/features/messaging-goals/hooks/use-goal-celebrations";

export function GoalCelebrationsHost() {
    const { celebrationOpen, celebrationType, closeCelebration } = useGoalCelebrations();
    return (
        <CelebrationModal
            isOpen={celebrationOpen}
            type={celebrationType}
            onClose={closeCelebration}
        />
    );
}
