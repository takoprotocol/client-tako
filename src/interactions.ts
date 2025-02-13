import {
    composeContext,
    elizaLogger,
    generateMessageResponse,
    generateShouldRespond,
    IAgentRuntime,
    Memory,
    ModelClass,
    stringToUuid,
} from "@elizaos/core";
import { ClientBase } from "./base";
import { FCCastTako } from "./types/cast.ts";
import { buildConversationThread, removeQuotes } from "./utils.ts";
import { getContent, getUserAndRoomId } from "./utils/cast.ts";
import {
    takoMessageHandlerTemplate,
    takoShouldRespondTemplate,
} from "./utils/template.ts";

export class TakoInteractionClient {
    client: ClientBase;
    runtime: IAgentRuntime;

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
    }

    async start() {
        const handleTakoInteractionsLoop = () => {
            this.handleTakoInteractions("poll");
            const pollInterval = this.client.takoConfig.TAKO_POLL_INTERVAL;
            const randomMinutes =
                Math.floor(Math.random() * (pollInterval + 1)) + pollInterval;
            setTimeout(handleTakoInteractionsLoop, randomMinutes * 60 * 1000);
        };
        const handleTakoInteractionsChatLoop = () => {
            this.handleTakoInteractions("chat");
            const chatInterval = this.client.takoConfig.TAKO_CHAT_INTERVAL;
            const randomMinutes =
                Math.floor(Math.random() * (chatInterval + 1)) + chatInterval;
            setTimeout(
                handleTakoInteractionsChatLoop,
                randomMinutes * 60 * 1000
            );
        };
        handleTakoInteractionsLoop();
        handleTakoInteractionsChatLoop();
    }

    async handleTakoInteractions(type: "poll" | "chat") {
        elizaLogger.log("Checking Tako interactions");

        try {
            // Check for follow feed
            let uniqueFeed: FCCastTako[] = [];
            if (type === "poll") {
                const followingFeed = await this.client.fetchFeed(5);
                const targetUsersFeed = await this.client.fetchFeed(5, "fid");
                const targetCommunitiesFeed = await this.client.fetchFeed(
                    5,
                    "community"
                );
                uniqueFeed = [
                    ...followingFeed,
                    ...targetUsersFeed,
                    ...targetCommunitiesFeed,
                ];
            } else {
                const notificationFeed = await this.client.fetchFeed(
                    5,
                    "notification"
                );
                uniqueFeed = [...notificationFeed];
            }

            // Filter duplicate casts
            uniqueFeed = uniqueFeed.filter(
                (cast, index, self) =>
                    index === self.findIndex((t) => t.hash === cast.hash)
            );

            // Filter casts from the same user
            uniqueFeed = uniqueFeed.filter(
                (cast, index, self) =>
                    index ===
                    self.findIndex((t) => t.author.fid === cast.author.fid)
            );

            // Filter casts that mention the user
            if (!this.client.takoConfig.TAKO_CHAT_WITH_USER) {
                uniqueFeed = uniqueFeed.filter(
                    (cast) =>
                        !cast.mentioned_users
                            ?.map((u) => u.fid)
                            .includes(this.client.profile.fid)
                );
            }

            // Filter casts from the blacklisted users
            uniqueFeed = uniqueFeed.filter(
                (cast) =>
                    !this.client.takoConfig.TAKO_BLACKLIST_USERS.includes(
                        cast.author.fid
                    )
            );

            // Filter casts from the user
            uniqueFeed = uniqueFeed.filter(
                (cast) => cast.author.fid !== this.client.profile.fid
            );

            uniqueFeed = uniqueFeed.filter(
                (cast) =>
                    Number(cast.created_at) * 1000 >
                    this.client.takoConfig.TAKO_INITIAL_TIMESTAMP
            );

            elizaLogger.log("Completed checking casts:", uniqueFeed.length);

            // for each cast candidate, handle the cast
            for (const cast of uniqueFeed) {
                // Generate the castHash UUID the same way it's done in handleCast
                const castHash = stringToUuid(
                    cast.hash + "-" + this.runtime.agentId
                );

                // Check if we've already processed this cast
                const existingResponse =
                    await this.runtime.messageManager.getMemoryById(castHash);

                if (existingResponse) {
                    elizaLogger.log(
                        `Already responded to cast ${cast.hash}, skipping`
                    );
                    continue;
                }

                elizaLogger.log("New Cast found", cast.hash);

                const { roomId, userId } = await getUserAndRoomId(
                    cast,
                    this.client.profile,
                    this.runtime
                );

                // cache the thread
                await buildConversationThread(cast, this.client, 1);
                const thread = cast.ancestors;

                const message = {
                    content: getContent(cast, this.runtime),
                    agentId: this.runtime.agentId,
                    userId,
                    roomId,
                };

                await this.handleCast({
                    cast: cast,
                    message,
                    thread,
                });

                this.client.lastCheckedCastHash = cast.hash;
            }

            // Save the latest checked cast hash to the file
            await this.client.cacheLatestCheckedCashHash();

            elizaLogger.log("Finished checking Tako interactions");
        } catch (error) {
            elizaLogger.error("Error handling Tako interactions:", error);
        }
    }

    private async handleCast({
        cast,
        message,
        thread,
    }: {
        cast: FCCastTako;
        message: Memory;
        thread: FCCastTako[];
    }) {
        if (cast.author.fid === this.client.profile.fid) {
            return;
        }

        if (!message.content.text) {
            elizaLogger.log("Skipping Cast with no text", cast.hash);
            return { text: "", action: "IGNORE" };
        }

        elizaLogger.log("Processing Cast: ", cast.hash);
        const _plainTextCast = (cast: FCCastTako) => {
            return `Hash: ${cast.hash}
  From: ${cast.author.displayName} (@${cast.author.username})
  Text: ${cast.metadata.content}`;
        };
        const plainTextCurrentCast = _plainTextCast(cast);

        const plainTextConversation = thread
            .map(
                (cast) => `@${cast.author.username} (${new Date(
                    Number(cast.created_at) * 1000
                ).toLocaleString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    month: "short",
                    day: "numeric",
                })}):
        ${cast.metadata.content}`
            )
            .join("\n\n");
        elizaLogger.debug("Processing Conversation: ", plainTextConversation);

        const state = await this.runtime.composeState(message, {
            takoApiClient: this.client.takoApiClient,
            takoUserName: this.client.profile.username,
            plainTextCurrentCast,
            plainTextConversation,
        });

        const shouldRespondContext = composeContext({
            state,
            template:
                this.runtime.character.templates?.takoShouldRespondTemplate ||
                this.runtime.character?.templates?.shouldRespondTemplate ||
                takoShouldRespondTemplate(),
        });

        const shouldRespond = await generateShouldRespond({
            runtime: this.runtime,
            context: shouldRespondContext,
            modelClass: ModelClass.MEDIUM,
        });

        // Promise<"RESPOND" | "IGNORE" | "STOP" | null> {
        if (shouldRespond !== "RESPOND") {
            elizaLogger.log("Not responding to message");
            return { text: "Response Decision:", action: shouldRespond };
        }

        const context = composeContext({
            state,
            template:
                this.runtime.character.templates?.takoMessageHandlerTemplate ||
                this.runtime.character?.templates?.messageHandlerTemplate ||
                takoMessageHandlerTemplate,
        });

        const response = await generateMessageResponse({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.LARGE,
        });
        response.inReplyTo = stringToUuid(
            cast.hash + "-" + this.runtime.agentId
        );
        response.text = removeQuotes(response.text);

        await this.client.postCast({
            roomId: message.roomId,
            content: response,
            reply: {
                hash: cast.hash,
                fid: cast.author.fid,
            },
        });
    }
}
