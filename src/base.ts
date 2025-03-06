import {
    Content,
    IAgentRuntime,
    IImageDescriptionService,
    Memory,
    UUID,
    elizaLogger,
    getEmbeddingZeroVector,
    stringToUuid,
} from "@elizaos/core";
import { EventEmitter } from "events";
import { TakoApiClient } from "./api/index.ts";
import { TakoConfig } from "./environment.ts";
import { Community, FCCastTako } from "./types/index.ts";
import { FCProfileTako } from "./types/profile.ts";
import { getContent, getUserAndRoomId } from "./utils/cast.ts";
import { wait } from "./utils.ts";
import { getCleanedContent } from "./utils/text.ts";

class RequestQueue {
    private queue: (() => Promise<void>)[] = [];
    private processing: boolean = false;

    async add<T>(request: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await request();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            this.processQueue();
        });
    }

    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        this.processing = true;

        while (this.queue.length > 0) {
            const request = this.queue.shift()!;
            try {
                await request();
            } catch (error) {
                console.error("Error processing request:", error);
                this.queue.unshift(request);
                await this.exponentialBackoff(this.queue.length);
            }
            await this.randomDelay();
        }

        this.processing = false;
    }

    private async exponentialBackoff(retryCount: number): Promise<void> {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    private async randomDelay(): Promise<void> {
        const delay = Math.floor(Math.random() * 2000) + 1500;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
}

export class ClientBase extends EventEmitter {
    takoApiClient: TakoApiClient;
    runtime: IAgentRuntime;
    takoConfig: TakoConfig;
    directions: string;
    lastCheckedCastHash: string | null = null;
    imageDescriptionService: IImageDescriptionService;
    temperature: number = 0.5;

    requestQueue: RequestQueue = new RequestQueue();

    profile: FCProfileTako | null;

    onReady() {
        throw new Error(
            "Not implemented in base class, please call from subclass"
        );
    }

    constructor(runtime: IAgentRuntime, takoConfig: TakoConfig) {
        super();
        this.runtime = runtime;
        this.takoConfig = takoConfig;

        this.takoApiClient = new TakoApiClient(this.takoConfig);

        this.directions =
            "- " +
            this.runtime.character.style.all.join("\n- ") +
            "- " +
            this.runtime.character.style.post.join();
    }

    async init() {
        const fid = this.takoConfig.TAKO_FID;
        const token = this.takoConfig.TAKO_API_KEY;

        if (!token || !fid) {
            throw new Error("Tako token or fid not configured");
        }

        // Initialize Tako profile
        this.profile = await this.fetchProfile(fid);

        if (this.profile) {
            elizaLogger.log("Tako user name:", this.profile.username);
            elizaLogger.log(
                "Tako user loaded:",
                JSON.stringify(this.profile, null, 4)
            );
        } else {
            throw new Error("Failed to load profile");
        }

        await this.populateTimeline();
    }

    // #region timeline
    private async populateTimeline() {
        elizaLogger.debug("populating timeline...");

        const followingFeed = await this.fetchFeed(20, "following");
        const fidFeed = await this.fetchFeed(20, "fid");
        const communityFeed = await this.fetchFeed(20, "community");
        const notificationFeed = await this.fetchFeed(20, "notification");

        const allFeeds = [
            ...followingFeed,
            ...fidFeed,
            ...communityFeed,
            ...notificationFeed,
        ];

        // Create a Set to store unique cast hashes
        const castHashesToCheck = new Set<string>();
        const roomIds = new Set<UUID>();

        // Add cast hashes to the Set
        for (const cast of allFeeds) {
            castHashesToCheck.add(cast.hash);
            roomIds.add(stringToUuid(cast.hash + "-" + this.runtime.agentId));
        }

        // Check the existing memories in the database
        const existingMemories =
            await this.runtime.messageManager.getMemoriesByRoomIds({
                roomIds: Array.from(roomIds),
            });

        // Create a Set to store the existing memory IDs
        const existingMemoryIds = new Set<UUID>(
            existingMemories.map((memory) => memory.id)
        );

        // Filter out the casts that already exist in the database
        const castToSave = allFeeds.filter(
            (cast) =>
                !existingMemoryIds.has(
                    stringToUuid(cast.hash + "-" + this.runtime.agentId)
                )
        );

        elizaLogger.debug({
            processingCasts: castToSave.map((cast) => cast.hash).join(","),
        });

        await this.runtime.ensureUserExists(
            this.runtime.agentId,
            this.profile.username,
            this.runtime.character.name,
            "tako"
        );

        // Save the new casts as memories
        for (const cast of castToSave) {
            elizaLogger.log("Saving Cast", cast.hash);

            const { roomId, userId } = await getUserAndRoomId(
                cast,
                this.profile,
                this.runtime
            );
            const content = getContent(cast, this.runtime);

            await this.runtime.messageManager.createMemory({
                id: stringToUuid(cast.hash + "-" + this.runtime.agentId),
                userId,
                content: content,
                agentId: this.runtime.agentId,
                roomId,
                embedding: getEmbeddingZeroVector(),
                createdAt: Number(cast.created_at) * 1000,
            });

            await this.cacheCast(cast);
        }

        // Cache
        await this.cacheFeed(allFeeds);
    }

    /**
     * Fetch feed for tako account, optionally only from followed accounts
     */
    async fetchFeed(
        limit: number,
        type: "following" | "fid" | "community" | "notification" = "following"
    ): Promise<FCCastTako[]> {
        let feed: FCCastTako[] = [];
        if (type === "fid" || type === "community") {
            const target =
                type === "fid"
                    ? this.takoConfig.TAKO_TARGET_USERS
                    : this.takoConfig.TAKO_TARGET_COMMUNITIES;
            feed = await this.takoApiClient.fetchFeed(limit, type, target);
        } else if (type === "following") {
            feed = await this.takoApiClient.fetchFollowingFeed(limit);
        } else if (type === "notification") {
            feed = await this.takoApiClient.fetchNotification(limit);
        }

        elizaLogger.debug(`fetching ${type} feed: ${feed.length}/(${limit})`);

        return feed;
    }

    async getCachedFeed(): Promise<FCCastTako[] | undefined> {
        return await this.runtime.cacheManager.get<FCCastTako[]>(
            `tako/${this.profile.fid}/timeline`
        );
    }

    async cacheFeed(timeline: FCCastTako[]) {
        await this.runtime.cacheManager.set(
            `tako/${this.profile.fid}/timeline`,
            timeline,
            { expires: Date.now() + 10 * 1000 }
        );
    }
    // #endregion

    // #region cast
    async cacheCast(cast: FCCastTako): Promise<void> {
        if (!cast) {
            console.warn("Cast is undefined, skipping cache");
            return;
        }

        this.runtime.cacheManager.set(`tako/casts/${cast.hash}`, cast);
    }

    async getCachedCast(castHash: string): Promise<FCCastTako | undefined> {
        const cached = await this.runtime.cacheManager.get<FCCastTako>(
            `tako/casts/${castHash}`
        );

        return cached;
    }

    async getCast(castHash: string): Promise<FCCastTako> {
        const cachedCast = await this.getCachedCast(castHash);

        if (cachedCast) {
            return cachedCast;
        }
    }
    // #endregion

    // #region last checked cast hash
    async loadLatestCheckedCastHash(): Promise<void> {
        const latestCheckedCastHash =
            await this.runtime.cacheManager.get<string>(
                `tako/${this.profile.fid}/latest_checked_cast_hash`
            );

        if (latestCheckedCastHash) {
            this.lastCheckedCastHash = latestCheckedCastHash;
        }
    }

    async cacheLatestCheckedCashHash() {
        if (this.lastCheckedCastHash) {
            await this.runtime.cacheManager.set(
                `tako/${this.profile.fid}/latest_checked_cast_hash`,
                this.lastCheckedCastHash
            );
        }
    }
    // #endregion

    // #region profile
    async fetchProfile(fid: number): Promise<FCProfileTako> {
        const cached = await this.getCachedProfile(fid);

        if (cached) return cached;

        try {
            const profile = await this.requestQueue.add(async () => {
                const profile = await this.takoApiClient.getFCProfile(fid);
                return profile;
            });

            this.cacheProfile(profile);

            return profile;
        } catch (error) {
            console.error("Error fetching Tako FCProfile:", error);

            return undefined;
        }
    }

    async getCachedProfile(fid: number) {
        return await this.runtime.cacheManager.get<FCProfileTako>(
            `tako/${fid}/profile`
        );
    }

    async cacheProfile(profile: FCProfileTako) {
        await this.runtime.cacheManager.set(
            `tako/${profile.fid}/profile`,
            profile
        );
    }
    // #endregion

    // #region community info
    async fetchCommunity(communityId: string): Promise<Community> {
        const cached = await this.getCachedCommunity(communityId);

        if (cached) return cached;

        try {
            const community = await this.requestQueue.add(async () => {
                const community =
                    await this.takoApiClient.getCommunityInfo(communityId);
                return community;
            });

            this.cacheCommunity(community);

            return community;
        } catch (error) {
            console.error("Error fetching Tako community info:", error);

            return undefined;
        }
    }

    async getCachedCommunity(communityId: string) {
        return await this.runtime.cacheManager.get<Community>(
            `tako/${communityId}/community`
        );
    }

    async cacheCommunity(community: Community) {
        await this.runtime.cacheManager.set(
            `tako/${community.community_id}/community`,
            community
        );
    }
    // #endregion

    async postCast({
        roomId,
        userId,
        content,
        type,
        targetCast,
        targetCommunity,
    }: {
        roomId: UUID;
        userId?: UUID;
        content: Content;
        type: "CAST" | "REPLY" | "QUOTE";
        targetCast?: {
            hash: string;
            fid: number;
        };
        targetCommunity?: string;
    }) {
        elizaLogger.log(`Posting new ${type}`);

        try {
            let sentCastHash: string | null = null;

            if (!content.text) {
                elizaLogger.error("Content text is required");
                return null;
            }

            const cleanedText = getCleanedContent(
                content.text,
                this.takoConfig.MAX_CAST_LENGTH
            );

            if (this.takoConfig.TAKO_DRY_RUN) {
                elizaLogger.info(
                    `Dry run: would have posted cast: ${cleanedText}`
                );
                return;
            }

            const targetData =
                type === "REPLY"
                    ? {
                          replyId: targetCast?.hash,
                          replyFid: targetCast?.fid,
                      }
                    : type === "QUOTE"
                      ? {
                            quoteId: targetCast?.hash,
                            quoteFid: targetCast?.fid,
                        }
                      : undefined;

            // sent cast
            const sentResult = await this.requestQueue.add(async () =>
                this.takoApiClient.sendCast({
                    text: cleanedText,
                    assetUrls: [],
                    ...targetData,
                    communityId: type === "REPLY" ? undefined : targetCommunity,
                })
            );

            if (sentResult.hash) {
                sentCastHash = sentResult.hash;
            } else {
                elizaLogger.error("Error new cast or reply:", sentResult);
                return null;
            }

            // create memory
            const memory: Memory = {
                id: stringToUuid(sentCastHash + "-" + this.runtime.agentId),
                agentId: this.runtime.agentId,
                userId: userId || this.runtime.agentId,
                roomId,
                content: content,
                embedding: getEmbeddingZeroVector(),
                createdAt: Date.now(),
            };

            await this.runtime.messageManager.createMemory(memory);

            await wait();

            return memory;
        } catch (error) {
            elizaLogger.error("Error new cast or reply:", error);
        }
    }

    async likeCast(castHash: string) {
        elizaLogger.log(`Liking cast: ${castHash}`);

        try {
            const result = await this.requestQueue.add(async () =>
                this.takoApiClient.sendLike(castHash)
            );

            await wait();

            return result;
        } catch (error) {
            elizaLogger.error("Error liking cast:", error);
            return false;
        }
    }
}
