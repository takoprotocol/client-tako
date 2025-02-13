export interface FCProfileTakoResponse {
    fid: number;
    username: string;
    display_name: string;
    bio: string;
    pfp: string;
}

export interface FCProfileTako {
    fid: number;
    username: string;
    displayName?: string;
    bio?: string;
    avatar: string;
}
