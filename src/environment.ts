import { IAgentRuntime, parseBooleanFromText } from "@elizaos/core";
import { z, ZodError } from "zod";

export const DEFAULT_MAX_CAST_LENGTH = 768;

const takoFidSchema = z.number().int();
const takoCommunitySchema = z
    .string()
    .min(1, { message: "Community.IDRequired" })
    .max(20, { message: "Community.IDRules" });

/**
 * This schema defines all required/optional environment settings,
 */
export const takoEnvSchema = z.object({
    TAKO_DRY_RUN: z.boolean(),
    TAKO_START_DELAY: z.boolean(),
    TAKO_INITIAL_TIMESTAMP: z.number().int().default(0),

    TAKO_FID: z
        .number()
        .int()
        .min(1, { message: "TAKO_FID must be a positive integer" }),
    TAKO_API_URL: z.string(),
    TAKO_API_KEY: z.string(),

    TAKO_TARGET_FOLLOWERS: z.boolean().default(true),
    TAKO_TARGET_USERS: z.array(takoFidSchema).default([]),
    TAKO_TARGET_COMMUNITIES: z.array(takoCommunitySchema).default([]),
    TAKO_BLACKLIST_USERS: z.array(takoFidSchema).default([]),
    TAKO_CHAT_WITH_USER: z.boolean().default(true),
    TAKO_CHAT_INTERVAL: z.number().int().default(2),
    TAKO_POLL_INTERVAL: z.number().int().default(2),
    TAKO_NEW_CAST_INTERVAL: z.number().int().default(10),
    TAKO_PROACTIVE_COMMENTING: z.boolean().default(false),
    TAKO_NEW_CAST: z.boolean().default(false),
    TAKO_NEW_CAST_TO_COMMUNITY: z.array(takoCommunitySchema).default([]),

    TAKO_RETRY_LIMIT: z.number().int().default(2),
    MAX_CAST_LENGTH: z.number().int().default(DEFAULT_MAX_CAST_LENGTH),
});

export type TakoConfig = z.infer<typeof takoEnvSchema>;

/**
 * Helper to parse a comma-separated list of tako FIDs
 * (already present in your code).
 */
function parseTargetUsers(targetUsersStr?: string | null): number[] {
    if (!targetUsersStr?.trim()) {
        return [];
    }
    return targetUsersStr
        .split(",")
        .map((user) => user.trim())
        .map((user) => parseInt(user, 10))
        .filter(Boolean);
}

/**
 * Helper to parse a comma-separated list of tako communities
 */
function parseTargetCommunities(
    targetCommunitiesStr?: string | null
): string[] {
    if (!targetCommunitiesStr?.trim()) {
        return [];
    }
    return targetCommunitiesStr
        .split(",")
        .map((community) => community.trim())
        .filter(Boolean);
}

function safeParseInt(
    value: string | undefined | null,
    defaultValue: number
): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : Math.max(1, parsed);
}

/**
 * Validates or constructs a TakoConfig object using zod,
 * taking values from the IAgentRuntime or process.env as needed.
 */
// This also is organized to serve as a point of documentation for the client
// most of the inputs from the framework (env/character)

// we also do a lot of typing/parsing here
// so we can do it once and only once per character
export async function validateTakoConfig(
    runtime: IAgentRuntime
): Promise<TakoConfig> {
    try {
        const takoConfig: TakoConfig = {
            TAKO_DRY_RUN:
                parseBooleanFromText(
                    runtime.getSetting("TAKO_DRY_RUN") ||
                        process.env.TAKO_DRY_RUN
                ) ?? true, // parseBooleanFromText return null if "", map "" to false

            // bool
            TAKO_START_DELAY:
                parseBooleanFromText(
                    runtime.getSetting("TAKO_START_DELAY") ||
                        process.env.TAKO_START_DELAY
                ) ?? false,

            // int
            TAKO_INITIAL_TIMESTAMP: Date.now(),

            // int
            TAKO_FID: safeParseInt(
                runtime.getSetting("TAKO_FID") || process.env.TAKO_FID,
                0
            ),

            // string
            TAKO_API_URL:
                runtime.getSetting("TAKO_API_URL") || process.env.TAKO_API_URL,

            // string
            TAKO_API_KEY:
                runtime.getSetting("TAKO_API_KEY") || process.env.TAKO_API_KEY,

            // bool
            TAKO_TARGET_FOLLOWERS:
                parseBooleanFromText(
                    runtime.getSetting("TAKO_TARGET_FOLLOWERS") ||
                        process.env.TAKO_TARGET_FOLLOWERS
                ) ?? false,

            // comma separated int
            TAKO_TARGET_USERS: parseTargetUsers(
                runtime.getSetting("TAKO_TARGET_USERS") ||
                    process.env.TAKO_TARGET_USERS
            ),

            // comma separated string
            TAKO_TARGET_COMMUNITIES: parseTargetCommunities(
                runtime.getSetting("TAKO_TARGET_COMMUNITIES") ||
                    process.env.TAKO_TARGET_COMMUNITIES
            ),

            // comma separated int
            TAKO_BLACKLIST_USERS: parseTargetUsers(
                runtime.getSetting("TAKO_BLACKLIST_USERS") ||
                    process.env.TAKO_BLACKLIST_USERS
            ),

            // bool
            TAKO_CHAT_WITH_USER:
                parseBooleanFromText(
                    runtime.getSetting("TAKO_CHAT_WITH_USER") ||
                        process.env.TAKO_CHAT_WITH_USER
                ) ?? false,

            // int in minutes
            TAKO_CHAT_INTERVAL: safeParseInt(
                runtime.getSetting("TAKO_CHAT_INTERVAL") ||
                    process.env.TAKO_CHAT_INTERVAL,
                2 // 2 minutes
            ),

            // int in minutes
            TAKO_POLL_INTERVAL: safeParseInt(
                runtime.getSetting("TAKO_POLL_INTERVAL") ||
                    process.env.TAKO_POLL_INTERVAL,
                2 // 2 minutes
            ),

            // int in minutes
            // randomMinutes is a random number between minMinutes and 2 * minMinutes
            TAKO_NEW_CAST_INTERVAL: safeParseInt(
                runtime.getSetting("TAKO_NEW_CAST_INTERVAL") ||
                    process.env.TAKO_NEW_CAST_INTERVAL,
                240 // 240 minute
            ),

            // bool
            TAKO_PROACTIVE_COMMENTING:
                parseBooleanFromText(
                    runtime.getSetting("TAKO_PROACTIVE_COMMENTING") ||
                        process.env.TAKO_PROACTIVE_COMMENTING
                ) ?? false,

            // bool
            TAKO_NEW_CAST:
                parseBooleanFromText(
                    runtime.getSetting("TAKO_NEW_CAST") ||
                        process.env.TAKO_NEW_CAST
                ) ?? false,

            // comma separated string
            TAKO_NEW_CAST_TO_COMMUNITY: parseTargetCommunities(
                runtime.getSetting("TAKO_NEW_CAST_TO_COMMUNITY") ||
                    process.env.TAKO_NEW_CAST_TO_COMMUNITY
            ),

            // int
            TAKO_RETRY_LIMIT: safeParseInt(
                runtime.getSetting("TAKO_RETRY_LIMIT") ||
                    process.env.TAKO_RETRY_LIMIT,
                2
            ),

            // int
            MAX_CAST_LENGTH: safeParseInt(
                runtime.getSetting("MAX_CAST_LENGTH") ||
                    process.env.MAX_CAST_LENGTH,
                DEFAULT_MAX_CAST_LENGTH
            ),
        };

        return takoEnvSchema.parse(takoConfig);
    } catch (error) {
        if (error instanceof ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Tako configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
