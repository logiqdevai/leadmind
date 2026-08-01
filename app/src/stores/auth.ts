import type { LoggedInUser } from "@/features/user/interfaces/user.interface";
import { setPreferredOrganisationUuid } from "@/lib/preferred-organisation";
import { Routes } from "@/routes/routes";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface UserStore extends LoggedInUser {
    login(user: any): void;
    logout(): void;
    updateUser(user: any): void;
}

const initialValues: UserStore = {
    isLoggedIn: false,
    user_uuid: null,
    role: null,
    full_name: "",
    email: null,
    phone: null,
    access_token: null,
    expires_in: null,
    avatar: null,
    organisation_uuid: null,
    organisation_role: null,
    organisation_name: null,
    login: () => { },
    logout: () => { },
    updateUser: () => { },
};

const STORE_KEY = "auth";

export const useAuthStore = create<UserStore>()(
    devtools(
        persist(
            (set) => ({
                ...initialValues,
                login: (user: LoggedInUser) => {
                    set((state) => ({
                        ...state,
                        ...user,
                    }));
                    if (user.user_uuid && user.organisation_uuid) {
                        setPreferredOrganisationUuid(
                            user.user_uuid,
                            user.organisation_uuid,
                        );
                    }
                },
                logout: () => {
                    set(initialValues);
                    localStorage.removeItem(STORE_KEY);
                    window.location.href = Routes.auth.sign_in;
                },
                updateUser: async (user: Partial<LoggedInUser>) => {
                    set((state) => ({ ...state, ...user }));
                },
            }),
            {
                name: STORE_KEY,
            }
        )
    )
);

export const getAuthStoreState = () => useAuthStore.getState();