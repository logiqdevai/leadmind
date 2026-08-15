import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
    ContactEmailScrapeCompletedEvent,
    ContactEmailScrapeJob,
    ContactEmailScrapeProgressEvent,
    ContactEmailScrapeStartedEvent,
} from "@/features/contacts/interfaces/contact-email-scrape.interface";

const STORE_KEY = "contact-email-scrape";

interface ContactEmailScrapeStore {
    jobs: Record<string, ContactEmailScrapeJob>;
    startJob: (event: ContactEmailScrapeStartedEvent) => void;
    updateProgress: (event: ContactEmailScrapeProgressEvent) => void;
    completeJob: (event: ContactEmailScrapeCompletedEvent) => void;
    dismissJob: (job_id: string) => void;
}

export const useContactEmailScrapeStore = create<ContactEmailScrapeStore>()(
    devtools(
        (set) => ({
            jobs: {},
            startJob: (event) => {
                set((state) => ({
                    jobs: {
                        ...state.jobs,
                        [event.job_id]: {
                            job_id: event.job_id,
                            queued: event.queued,
                            skipped: event.skipped,
                            completed: 0,
                            found: 0,
                            failed: 0,
                            not_found: 0,
                            started_at: Date.now(),
                        },
                    },
                }));
            },
            updateProgress: (event) => {
                set((state) => {
                    const existing = state.jobs[event.job_id];
                    if (!existing) return state;
                    return {
                        jobs: {
                            ...state.jobs,
                            [event.job_id]: {
                                ...existing,
                                completed: event.completed,
                                found: event.found,
                                failed: event.failed,
                                not_found: event.not_found,
                            },
                        },
                    };
                });
            },
            completeJob: (event) => {
                set((state) => {
                    const next = { ...state.jobs };
                    delete next[event.job_id];
                    return { jobs: next };
                });
            },
            dismissJob: (job_id) => {
                set((state) => {
                    const next = { ...state.jobs };
                    delete next[job_id];
                    return { jobs: next };
                });
            },
        }),
        { name: STORE_KEY },
    ),
);

export const getContactEmailScrapeStoreState = () => useContactEmailScrapeStore.getState();
