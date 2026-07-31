
export interface SignInUser {
    email: string;
    password: string;
}

export interface SignUpUser {
    email: string;
    full_name: string;
    password: string;
    invite_token?: string;
}

