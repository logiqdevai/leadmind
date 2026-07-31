export interface User {
    id: string;
    uuid: string;
    email: string;
    phone: string | null;
    full_name: string | null;
    role: RoleType;
    created_at: string;
    updated_at: string;
}

export interface UserProfile {
    uuid: string;
    email: string;
    phone: string | null;
    full_name: string | null;
    role: string;
    created_at: string;
    updated_at: string;
}

export interface UpdateUserDto {
    full_name?: string;
    email?: string;
    phone?: string | null;
}

export interface ChangePasswordDto {
    current_password: string;
    new_password: string;
}

export interface LoggedInUser {
    user_uuid: string | null;
    email: string | null;
    phone?: string | null;
    role: RoleType | null;
    access_token: string | null;
    expires_in: number | null;
    avatar?: string | null;
    full_name?: string | null;
    isLoggedIn?: boolean | null;
    organisation_uuid?: string | null;
    organisation_role?: string | null;
    organisation_name?: string | null;
}

export const RoleTypes = {
    USER: "USER",
    ADMIN: "ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
    SUPPORT: "SUPPORT",
} as const;

export type RoleType = (typeof RoleTypes)[keyof typeof RoleTypes];
