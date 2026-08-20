import { Button, Modal } from "@heroui/react";
import { Trophy } from "lucide-react";
import type { GoalAchievementType } from "@/features/messaging-goals/interfaces/messaging-goals.interfaces";
import { ACHIEVEMENT_COPY } from "@/pages/dashboard/pages/goals/utils/goals-copy";

interface CelebrationModalProps {
    isOpen: boolean;
    type: GoalAchievementType | null;
    onClose: () => void;
}

const BUBBLE_COLORS = [
    "var(--accent)",
    "oklch(0.75 0.15 85)",
    "oklch(0.7 0.14 145)",
] as const;

const BUBBLES = Array.from({ length: 22 }, (_, i) => ({
    left: `${4 + ((i * 19) % 92)}%`,
    size: 6 + (i % 5) * 2,
    duration: `${3.4 + (i % 6) * 0.55}s`,
    delay: `${-((i * 0.37) % 4.8)}s`,
    opacity: 0.28 + (i % 5) * 0.08,
    sway: `${(i % 2 === 0 ? 1 : -1) * (8 + (i % 4) * 4)}px`,
    color: BUBBLE_COLORS[i % BUBBLE_COLORS.length],
}));

export function CelebrationModal({ isOpen, type, onClose }: CelebrationModalProps) {
    const copy = type ? ACHIEVEMENT_COPY[type] : null;

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Modal.Container>
                <Modal.Dialog className="relative overflow-hidden max-w-md">
                    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                        {BUBBLES.map((bubble, i) => (
                            <span
                                key={i}
                                className="celebration-bubble absolute rounded-full"
                                style={{
                                    left: bubble.left,
                                    width: bubble.size,
                                    height: bubble.size,
                                    background: bubble.color,
                                    animationDuration: bubble.duration,
                                    animationDelay: bubble.delay,
                                    ["--bubble-opacity" as string]: bubble.opacity,
                                    ["--bubble-sway" as string]: bubble.sway,
                                }}
                            />
                        ))}
                    </div>
                    <Modal.Header className="flex flex-col items-center gap-3 pt-8 pb-2 relative">
                        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-[0_0_40px_-8px_var(--accent)]">
                            <Trophy className="size-7" />
                        </span>
                        <Modal.Heading className="text-center text-xl font-semibold">
                            {copy?.title ?? "Nice work"}
                        </Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="relative text-center pb-2">
                        <p className="text-sm text-muted">
                            {copy?.description ?? "Keep the streak going."}
                        </p>
                    </Modal.Body>
                    <Modal.Footer className="relative justify-center pb-6">
                        <Button onPress={onClose}>Awesome</Button>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
