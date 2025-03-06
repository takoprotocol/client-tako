import {
    FCCastEmbedTakoFrame,
    FCCastEmbedTakoFrameV2,
    FCCastEmbedTakoImage,
    FCCastEmbedTakoUrl,
    FCCastEmbedTakoVideo,
    FCCastTako,
    FCCastTakoResponse,
} from "../types";
import { FCProfileTako, FCProfileTakoResponse } from "../types/profile";

export const PATTERN_URL = new RegExp(
    /(?:(?<=\s)|(?<=^)|(?<=。))((?:https?:\/\/)?(?:www\.)?[\w-]+(\.[\w-]+)+([\w.,@?^=%&:/~+#-[\]]*[\w@?^=%&/~+#-])?)/,
    "gi"
);
export function isImageUrl(url: string) {
    return (
        /\.(png|jpe?g|gif|svg|webp|gif|bmp)(\?.*)?$/.test(url) ||
        url.includes("takocdn.xyz/images") ||
        url.includes("imagedelivery.net") ||
        url.includes("image") ||
        url.includes("imgur") ||
        url.includes("media.tenor.com")
    );
}

export function formatFCCastTakoAssets(pub: FCCastTakoResponse) {
    const images: FCCastEmbedTakoImage[] = [];
    const videos: FCCastEmbedTakoVideo[] = [];
    const embeds: FCCastEmbedTakoUrl[] = [];
    const frames: FCCastEmbedTakoFrame[] = [];
    const frame_v2s: FCCastEmbedTakoFrameV2[] = [];
    if (!pub.embeds?.length)
        return {
            images,
            videos,
            embeds,
            frames,
            frame_v2s,
        };

    pub?.embeds?.forEach((item) => {
        if (!("url" in item)) return;
        const url = item?.url;
        if ("ext" in item && item.ext.type !== "error") {
            if (url && item.ext.type === "image") {
                images.push(item.ext);
            } else if (url && item.ext.type === "video") {
                videos.push(item.ext);
            } else if (url && item.ext.type === "url") {
                embeds.push(item.ext);
            } else if (url && item.ext.type === "frame") {
                frames.push(item.ext);
            } else if (url && item.ext.type === "frame_v2") {
                frame_v2s.push(item.ext);
            }
        } else {
            if (url && isImageUrl(url)) {
                images.push({
                    type: "image",
                    height: 0,
                    width: 0,
                    url,
                });
            }
        }
    });
    return {
        images,
        videos,
        embeds,
        frames,
        frame_v2s,
    };
}

export function formatTakoPub(pub: FCCastTakoResponse): FCCastTako {
    const formatCast = {
        hash: pub.hash,
        created_at: pub.created_at,
        parent_cast: pub.parent_cast && formatTakoPub(pub.parent_cast),
        parent_hash: pub.parent_hash,
        quote_cast: pub.quote_cast && formatTakoPub(pub.quote_cast),

        metadata: {
            content: pub.text,
            ...formatFCCastTakoAssets(pub),
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
