import { Button, Modal } from "@heroui/react";
import { Trophy } from "lucide-react";
import type { GoalAchievementType } from "@/features/messaging-goals/interfaces/messaging-goals.interfaces";
import { ACHIEVEMENT_COPY } from "@/pages/dashboard/pages/goals/utils/goals-copy";

interface CelebrationModalProps {
    isOpen: boolean;
    type: GoalAchievementType | null;
    onClose: () => void;
}

export function CelebrationModal({ isOpen, type, onClose }: CelebrationModalProps) {
    const copy = type ? ACHIEVEMENT_COPY[type] : null;

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Modal.Container>
                <Modal.Dialog className="relative overflow-hidden max-w-md">
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        {Array.from({ length: 18 }).map((_, i) => (
                            <span
                                key={i}
                                className="absolute size-2 rounded-full animate-pulse"
                                style={{
                                    left: `${8 + ((i * 17) % 84)}%`,
                                    top: `${10 + ((i * 29) % 70)}%`,
                                    background:
                                        i % 3 === 0
                                            ? "var(--accent)"
                                            : i % 3 === 1
                                              ? "oklch(0.75 0.15 85)"
                                              : "oklch(0.7 0.14 145)",
                                    opacity: 0.35 + (i % 4) * 0.1,
                                    animationDelay: `${i * 40}ms`,
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
