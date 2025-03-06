import {
    composeContext,
    Content,
    elizaLogger,
    generateText,
    IAgentRuntime,
    ModelClass,
    stringToUuid,
} from "@elizaos/core";
import { ClientBase } from "./base.ts";
import { takoPostTemplate } from "./utils/template.ts";

export class TakoPostClient {
    client: ClientBase;
    runtime: IAgentRuntime;

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
    }

    async start() {
        const generateNewCastLoop = async (type: "init" | "next" = "next") => {
            const minMinutes = this.client.takoConfig.TAKO_NEW_CAST_INTERVAL;

            // randomMinutes is a random number between minMinutes and 2 * minMinutes
            const randomMinutes =
                Math.floor(Math.random() * (minMinutes + 1)) + minMinutes;
            const delay = randomMinutes * 60 * 1000;

            // eslint-disable-next-line no-empty
            if (type === "init") {
            } else {
                await this.generateNewCast();
            }

            setTimeout(() => {
                generateNewCastLoop(); // Set up next iteration
            }, delay);

            elizaLogger.log(`Next cast scheduled in ${randomMinutes} minutes`);
        };

        generateNewCastLoop("init");
        elizaLogger.log("Cast generation loop started");
    }

    /**
     * Generates and posts a new cast. If isDryRun is true, only logs what would have been posted.
     */
    private async generateNewCast() {
        elizaLogger.log("Generating new cast");

        try {
            const roomId = stringToUuid(
                "cast_generate_room-" + this.runtime.agentId
            );
            await this.runtime.ensureConnection(
                this.runtime.agentId,
                roomId,
                this.client.profile.username,
                this.runtime.character.name,
                "tako"
            );

            const topics = this.runtime.character.topics.join(", ");

            elizaLogger.log("Generate cast topics:\n", topics);

            // Random community
            const randomCommunityIndex = Math.floor(
                Math.random() *
                    this.client.takoConfig.TAKO_NEW_CAST_TO_COMMUNITY.length
            );
            const randomCommunity =
                this.client.takoConfig.TAKO_NEW_CAST_TO_COMMUNITY?.[
                    randomCommunityIndex
                ];

            elizaLogger.log("Generate cast community:", randomCommunity);

            const communityInfo =
                await this.client.fetchCommunity(randomCommunity);

            elizaLogger.log("Generate cast community info:", communityInfo);

            const state = await this.runtime.composeState(
                {
                    userId: this.runtime.agentId,
                    roomId: roomId,
                    agentId: this.runtime.agentId,
                    content: {
                        text: topics || "",
                        action: "CAST",
                    },
                },
                {
                    takoUserName: this.client.profile.username,
                    communityInfo: communityInfo
                        ? `Community name:${communityInfo?.name}
Community description: ${communityInfo?.description}`
                        : undefined,
                }
            );

            const context = composeContext({
                state,
                template: takoPostTemplate,
            });

            elizaLogger.debug("Generate cast prompt:", context);

            const newCastText = await generateText({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.SMALL,
            });
            elizaLogger.debug("Generate cast:", newCastText);

            const newCast: Content = {
                text: newCastText,
            };

            const memory = await this.client.postCast({
                roomId,
                content: newCast,
                type: "CAST",
                targetCommunity: randomCommunity,
            });

            if (memory) {
                await this.runtime.cacheManager.set(
                    `tako/${this.client.profile.fid}/lastPost`,
                    {
                        id: memory.id,
                        timestamp: Date.now(),
                    }
                );
            }
        } catch (error) {
            elizaLogger.error("Error generating new cast:", error);
        }
    }
}
