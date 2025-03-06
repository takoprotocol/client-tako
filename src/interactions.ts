import {
    composeContext,
    Content,
    elizaLogger,
    generateMessageResponse,
    generateShouldRespond,
    generateWebSearch,
    HandlerCallback,
    IAgentRuntime,
    IImageDescriptionService,
    Memory,
    ModelClass,
    ServiceType,
    stringToUuid,
} from "@elizaos/core";
import { ClientBase } from "./base";
import { FCCastTako } from "./types/cast.ts";
import {
    buildConversationThread,
    generateRespondType,
    removeQuotes,
} from "./utils.ts";
import { getContent, getUserAndRoomId } from "./utils/cast.ts";
import {
    takoKeywordTemplate,
    takoMessageHandlerTemplate,
    takoRespondTypeTemplate,
    takoShouldRespondTemplate,
} from "./utils/template.ts";
import { generateWebSearchKeywords } from "./utils/generate.ts";

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
        const plainTextCurrentQuoteCast = cast.quote_cast
            ? _plainTextCast(cast.quote_cast)
            : "";

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

        const imageDescriptions: {
            title: string;
            description: string;
        }[] = [];
        for (const image of cast.metadata.images) {
            if (!image.url) {
                continue;
            }
            const description = await this.runtime
                .getService<IImageDescriptionService>(
                    ServiceType.IMAGE_DESCRIPTION
                )
                .describeImage(image.url);
            elizaLogger.debug("Processing Image Description: ", description);
            imageDescriptions.push(description);
        }
        let plainTextCurrentCastImageDescription: string;
        imageDescriptions.map((imageDescription, index) => {
            if (imageDescription.description.length > 0) {
                plainTextCurrentCastImageDescription = `${plainTextCurrentCastImageDescription}
ImageDescription(${index + 1}): ${imageDescription.title}-${imageDescription.description}`;
            }
        });

        let state = await this.runtime.composeState(message, {
            takoApiClient: this.client.takoApiClient,
            takoUserName: this.client.profile.username,
            plainTextCurrentCast,
            plainTextCurrentCastImageDescription,
            plainTextCurrentQuoteCast,
            plainTextConversation,
        });

        const shouldRespondContext = composeContext({
            state,
            template: takoShouldRespondTemplate(),
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

        const respondTypeContext = composeContext({
            state,
            template: takoRespondTypeTemplate(),
        });

        const respondType = await generateRespondType({
            runtime: this.runtime,
            context: respondTypeContext,
            modelClass: ModelClass.MEDIUM,
        });

        if (respondType === "REPLY" || respondType === "QUOTE") {
            const callback: HandlerCallback = async (response: Content) => {
                const memory = await this.client.postCast({
                    roomId: message.roomId,
                    content: response,
                    type: respondType,
                    targetCast: {
                        hash: cast.hash,
                        fid: cast.author.fid,
                    },
                });
                return [memory];
            };

            try {
                const apiKey = this.runtime.getSetting(
                    "TAVILY_API_KEY"
                ) as string;
                if (!!apiKey && apiKey !== "") {
                    const keywordContext = composeContext({
                        state,
                        template: takoKeywordTemplate,
                    });
                    const webSearchQuery = await generateWebSearchKeywords({
                        runtime: this.runtime,
                        context: keywordContext,
                        modelClass: ModelClass.SMALL,
                    });

                    elizaLogger.debug("Web search query:", webSearchQuery);

                    if (!!webSearchQuery && webSearchQuery !== "") {
                        const webSearch = await generateWebSearch(
                            webSearchQuery,
                            this.runtime
                        );
                        if (webSearch.answer) {
                            state = await this.runtime.composeState(message, {
                                takoApiClient: this.client.takoApiClient,
                                takoUserName: this.client.profile.username,
                                plainTextCurrentCast,
                                plainTextCurrentCastImageDescription,
                                plainTextCurrentQuoteCast,
                                plainTextConversation,
                                webSearchContext: `Summary: ${webSearch.answer}, Partial Content: ${webSearch.results.map((r) => r.content).join(", ")}`,
                            });
                        }
                    }
                }
            } catch {
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                null;
            }

            const context = composeContext({
                state,
                template: takoMessageHandlerTemplate,
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

            await callback(response);

            // TODO: process the response messages
            // for (const responseMessage of responseMessages) {
            //     if (
            //         responseMessage ===
            //         responseMessages[responseMessages.length - 1]
            //     ) {
            //         responseMessage.content.action = response.action;
            //     } else {
            //         responseMessage.content.action = "CONTINUE";
            //     }
            // }

            // await this.runtime.processActions(
            //     message,
            //     responseMessages,
            //     state,
            //     callback
            // );
        } else if (respondType === "LIKE") {
            await this.client.likeCast(cast.hash);
        }
    }
}
