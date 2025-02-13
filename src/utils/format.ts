import { FCCastTako, FCCastTakoResponse } from "../types";
import { FCProfileTako, FCProfileTakoResponse } from "../types/profile";

export function formatTakoPub(pub: FCCastTakoResponse): FCCastTako {
    const formatCast = {
        hash: pub.hash,
        created_at: pub.created_at,
        parent_cast: pub.parent_cast && formatTakoPub(pub.parent_cast),
        parent_hash: pub.parent_hash,
        quote_cast: pub.quote_cast && formatTakoPub(pub.quote_cast),

        metadata: {
            content: pub.text,
        },

        author: formatTakoProfile(pub.author),
        mentioned_users: pub.mentioned_users?.map((item) =>
            formatTakoProfile(item)
        ),

        ancestors:
            pub.ancestors &&
            pub.ancestors.map((ancestor) => formatTakoPub(ancestor)),
    } satisfies FCCastTako;

    return formatCast;
}

export function formatTakoProfile(
    profile: FCProfileTakoResponse
): FCProfileTako {
    return {
        fid: Number(profile.fid),
        username: profile.username || "",
        displayName:
            profile.display_name === "" ? undefined : profile.display_name,
        bio: profile.bio || "",
        avatar: profile.pfp,
    } satisfies FCProfileTako;
}
