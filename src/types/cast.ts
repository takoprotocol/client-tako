import { FCProfileTako, FCProfileTakoResponse } from ".";

export interface FCCastTakoResponse {
    hash: string;
    parent_hash?: string;
    parent_cast?: FCCastTakoResponse;
    quote_cast?: FCCastTakoResponse;
    ancestors?: FCCastTakoResponse[];
    created_at: number;

    text: string;

    author: FCProfileTakoResponse;
    mentions: number[];
    mentions_positions: number[];
    mentioned_users: FCProfileTakoResponse[];

    is_deleted?: boolean;
}

export interface FCCastTako {
    hash: string;
    parent_cast?: FCCastTako;
    parent_hash?: string;
    ancestors?: FCCastTako[];
    quote_cast?: FCCastTako;
    created_at?: string | number;

    metadata: {
        content: string;
    };

    author: FCProfileTako;
    mentioned_users: FCProfileTako[];
}
