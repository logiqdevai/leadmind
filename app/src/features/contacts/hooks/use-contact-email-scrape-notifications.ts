import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { contactListQueryKeys } from "@/features/contact-lists/hooks/use-contact-lists";
import { contactsQueryKeys } from "@/features/contacts/hooks/use-contacts";
import type {
    ContactEmailScrapeCompletedEvent,
    ContactEmailScrapeProgressEvent,
    ContactEmailScrapeStartedEvent,
} from "@/features/contacts/interfaces/contact-email-scrape.interface";
import { WEBSOCKET_EVENTS } from "@/features/websocket/interfaces/websocket-events.constants";
import { websocketSubscribe } from "@/features/websocket/services/websocket.service";
import { toast } from "@/hooks/use-toast";
import { useContactEmailScrapeStore } from "@/stores/contact-email-scrape";

export function useContactEmailScrapeNotifications() {
    const qc = useQueryClient();

    useEffect(() => {
        const invalidate = () => {
            qc.invalidateQueries({ queryKey: contactsQueryKeys.all });
            qc.invalidateQueries({ queryKey: contactListQueryKeys.all });
        };

        const onStarted = websocketSubscribe<ContactEmailScrapeStartedEvent>(
            WEBSOCKET_EVENTS.CONTACT_EMAIL_SCRAPE.STARTED,
            (event) => {
                if (!event?.job_id) return;
                useContactEmailScrapeStore.getState().startJob(event);
            },
        );

        const onProgress = websocketSubscribe<ContactEmailScrapeProgressEvent>(
            WEBSOCKET_EVENTS.CONTACT_EMAIL_SCRAPE.PROGRESS,
            (event) => {
                if (!event?.job_id) return;
                useContactEmailScrapeStore.getState().updateProgress(event);
                if (event.completed > 0 && event.completed % 3 === 0) {
                    invalidate();
                }
            },
        );

        const onCompleted = websocketSubscribe<ContactEmailScrapeCompletedEvent>(
            WEBSOCKET_EVENTS.CONTACT_EMAIL_SCRAPE.COMPLETED,
            (event) => {
                if (!event?.job_id) return;
                useContactEmailScrapeStore.getState().completeJob(event);
                invalidate();

                const parts = [
                    `${event.found} email${event.found === 1 ? "" : "s"} found`,
                ];
                if (event.not_found > 0) {
                    parts.push(`${event.not_found} not found`);
                }
                if (event.failed > 0) {
                    parts.push(`${event.failed} failed`);
                }

                toast({
                    title: "Website email lookup finished",
                    description: parts.join(" · "),
                    duration: 6000,
                    variant: event.found > 0 ? "success" : "default",
                });
            },
        );

        return () => {
            onStarted.unsubscribe();
            onProgress.unsubscribe();
            onCompleted.unsubscribe();
        };
    }, [qc]);
}
