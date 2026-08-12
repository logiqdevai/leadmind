import type { EmailProviderTarget } from "@/features/integrations/interfaces/integrations.interface";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface PreferredEmailProviderStore {
    target: EmailProviderTarget | null;
    setTarget: (target: EmailProviderTarget | null) => void;
}

const STORE_KEY = "preferred-email-provider";

export const usePreferredEmailProviderStore = create<PreferredEmailProviderStore>()(
    devtools(
        persist(
            (set) => ({
                target: null,
                setTarget: (target) => set({ target }),
            }),
            {
                name: STORE_KEY,
                partialize: (state) => ({ target: state.target }),
            },
        ),
    ),
);

export const getPreferredEmailProviderStoreState = () =>
    usePreferredEmailProviderStore.getState();
