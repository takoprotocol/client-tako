import {
    elizaLogger,
    generateText,
    getEmbeddingZeroVector,
    IAgentRuntime,
    ModelClass,
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

// TODO: Implement thread
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

export const parseRespondTypeFromText = (
    text: string
): "REPLY" | "LIKE" | "QUOTE" | null => {
    const match = text
        .split("\n")[0]
        .trim()
        .replace("[", "")
        .toUpperCase()
        .replace("]", "")
        .match(/^(REPLY|LIKE|QUOTE)$/i);
    return match
        ? (match[0].toUpperCase() as "REPLY" | "LIKE" | "QUOTE")
        : text.includes("REPLY")
          ? "REPLY"
          : text.includes("LIKE")
            ? "LIKE"
            : text.includes("QUOTE")
              ? "QUOTE"
              : null;
};

/**
 * Sends a message to the model to determine if it respond type to the given context.
 * @param opts - The options for the generateText request
 * @param opts.context The context to evaluate for response
 * @param opts.stop A list of strings to stop the generateText at
 * @param opts.model The model to use for generateText
 * @param opts.frequency_penalty The frequency penalty to apply (0.0 to 2.0)
 * @param opts.presence_penalty The presence penalty to apply (0.0 to 2.0)
 * @param opts.temperature The temperature to control randomness (0.0 to 2.0)
 * @param opts.serverUrl The URL of the API server
 * @param opts.max_context_length Maximum allowed context length in tokens
 * @param opts.max_response_length Maximum allowed response length in tokens
 * @returns Promise resolving to "REPLY", "LIKE", "QUOTE" or null
 */
export async function generateRespondType({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<"REPLY" | "LIKE" | "QUOTE" | null> {
    let retryDelay = 1000;
    while (true) {
        try {
            elizaLogger.debug(
                "Attempting to generate text with context:",
                context
            );
            const response = await generateText({
                runtime,
                context,
                modelClass,
            });

            elizaLogger.debug("Received response from generateText:", response);
            const parsedResponseType = parseRespondTypeFromText(
                response.trim()
            );
            if (parsedResponseType) {
                elizaLogger.debug("Parsed response type:", parsedResponseType);
                return parsedResponseType;
            } else {
                elizaLogger.debug("generateRespondType no response");
            }
        } catch (error) {
            elizaLogger.error("Error in generateRespondType:", error);
            if (
                error instanceof TypeError &&
                error.message.includes("queueTextCompletion")
            ) {
                elizaLogger.error(
                    "TypeError: Cannot read properties of null (reading 'queueTextCompletion')"
                );
            }
        }

        elizaLogger.log(`Retrying in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}

export const respondTypeFooter = `The available options are [REPLY], [LIKE], or [QUOTE]. Choose the most appropriate option.
If {{agentName}} unsure which option to choose, just select LIKE.
Your response must include one of the options.`;
