import { Content, IAgentRuntime, stringToUuid } from "@elizaos/core";
import { FCCastTako, FCProfileTako } from "../types";

export async function getUserAndRoomId(
    cast: FCCastTako,
    agentProfile: FCProfileTako,
    runtime: IAgentRuntime
) {
    const roomId = stringToUuid(cast.hash + "-" + runtime.agentId);
    const userId =
        cast.author.fid === agentProfile.fid
            ? runtime.agentId
            : stringToUuid(cast.author.fid);

    if (cast.author.fid === agentProfile.fid) {
        await runtime.ensureConnection(
            userId,
            roomId,
            agentProfile.username,
            agentProfile.displayName,
            "tako"
        );
    } else {
        await runtime.ensureConnection(
            userId,
            roomId,
            cast.author.username,
            cast.author.displayName,
            "tako"
        );
    }

    return { roomId, userId };
}

export function getContent(cast: FCCastTako, runtime: IAgentRuntime): Content {
    return {
        text: cast.metadata.content,
        source: "tako",
        inReplyTo: cast.parent_hash
            ? stringToUuid(cast.parent_hash + "-" + runtime.agentId)
            : undefined,
    };
}
