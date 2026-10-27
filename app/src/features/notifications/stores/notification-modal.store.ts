import { create } from "zustand";
import type { AppNotification } from "../interfaces/notification.interface";

interface NotificationModalStore {
    notification: AppNotification | null;
    open: (notification: AppNotification) => void;
    close: () => void;
}

/** Lets the bell menu, the notifications page and the popup toast all open the same detail modal. */
export const useNotificationModalStore = create<NotificationModalStore>((set) => ({
    notification: null,
    open: (notification) => set({ notification }),
    close: () => set({ notification: null }),
}));
