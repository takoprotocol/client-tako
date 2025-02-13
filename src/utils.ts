import {
    elizaLogger,
    getEmbeddingZeroVector,
    stringToUuid,
} from "@elizaos/core";
import { ClientBase } from "./base";
import { FCCastTako } from "./types";
import { getContent, getUserAndRoomId } from "./utils/cast";

export const wait = (minTime: number = 1000, maxTime: number = 3000) => {
    const waitTime =
        Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    return new Promise((resolve) => setTimeout(resolve, waitTime));
};

export const removeQuotes = (str: string) =>
    str.replace(/^['"](.*)['"]$/, "$1");

export async function buildConversationThread(
    cast: FCCastTako,
    client: ClientBase,
    maxReplies: number = 10
): Promise<FCCastTako[]> {
    const thread: FCCastTako[] = [];
    const visited: Set<string> = new Set();

    async function processThread(currentCast: FCCastTako, depth: number = 0) {
        elizaLogger.debug("Processing cast:", {
            id: currentCast.hash,
            inReplyToStatusId: currentCast.parent_hash,
            depth: depth,
        });

        if (!currentCast) {
            elizaLogger.debug("No current cast found for thread building");
            return;
        }

        // Stop if we've reached our reply limit
        if (depth >= maxReplies) {
            elizaLogger.debug("Reached maximum reply depth", depth);
            return;
        }

        // Handle memory storage
        const memory = await client.runtime.messageManager.getMemoryById(
            stringToUuid(currentCast.hash + "-" + client.runtime.agentId)
        );
        if (!memory) {
            const { userId, roomId } = await getUserAndRoomId(
                currentCast,
                client.profile,
                client.runtime
            );

            await client.runtime.messageManager.createMemory({
                id: stringToUuid(
                    currentCast.hash + "-" + client.runtime.agentId
                ),
                agentId: client.runtime.agentId,
                content: getContent(currentCast, client.runtime),
                createdAt: Number(currentCast.created_at) * 1000,
                roomId,
                userId,
                embedding: getEmbeddingZeroVector(),
            });
        }

        if (visited.has(currentCast.hash)) {
            elizaLogger.debug("Already visited cast:", currentCast.hash);
            return;
        }

        visited.add(currentCast.hash);
        thread.unshift(currentCast);

        elizaLogger.debug("Current thread state:", {
            length: thread.length,
            currentDepth: depth,
            castHash: currentCast.hash,
        });

        // If there's a parent cast, fetch and process it
        if (currentCast.parent_cast) {
            elizaLogger.debug("Fetching parent cast:", currentCast.parent_hash);
            try {
                const parentCast = currentCast.parent_cast;

                if (parentCast) {
                    elizaLogger.debug("Found parent cast:", {
                        id: parentCast.hash,
                        text: parentCast.metadata?.content?.slice(0, 50),
                    });
                    await processThread(parentCast, depth + 1);
                } else {
                    elizaLogger.debug(
                        "No parent cast found for:",
                        parentCast.parent_hash
                    );
                }
            } catch (error) {
                elizaLogger.error("Error fetching parent cast:", {
                    castId: currentCast.parent_hash,
                    error,
                });
            }
        } else {
            elizaLogger.debug(
                "Reached end of reply chain at:",
                currentCast.hash
            );
        }
    }

    await processThread(cast, 0);

    elizaLogger.debug("Final thread built:", {
        totalCasts: thread.length,
        casts: thread.map((t) => ({
            id: t.hash,
            text: t.metadata?.content?.slice(0, 50),
        })),
    });

    return thread;
}
