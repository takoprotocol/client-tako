import { TakoConfig } from "../environment";
import { Community, FCCastTakoResponse } from "../types";
import { CommonResponse, CommonTakoListResponse } from "../types/api";
import { FCProfileTakoResponse } from "../types/profile";
import { formatTakoProfile, formatTakoPub } from "../utils/format";

enum EndpointEnum {
    fcProfile = "/v1/fc/profile",
    feedFollowing = "/v1/feed/follow",
    feed = "/v1/feed/cast",
    sendCast = "/v1/cast",
    sendReply = "/v1/cast/reply",
    sendQuote = "/v1/cast/quote",
    sendLike = "/v1/cast/like",
    notification = "/v1/notification",
    community = "/v1/community",
}

const BASE_URL = "https://open-api.dev.tako.so";

export type RequestConfig = {
    authenticated?: boolean;
    headers?: Record<string, string>;
} & Omit<RequestInit, "headers">;

export class TakoApiClient {
    baseUrl: string;
    takoConfig: TakoConfig;

    constructor(takoConfig: TakoConfig) {
        this.baseUrl = takoConfig.TAKO_API_URL || BASE_URL;
        this.takoConfig = takoConfig;
    }

    private async handleResponse<T>(
        response: Response
    ): Promise<CommonResponse<T>> {
        const data = await response.json();

        if (!response.ok) {
            return {
                data: null,
                status: "error",
                error_msg:
                    data?.message ||
                    data?.error ||
                    `API error: ${response.status} ${response.statusText}`,
                error_code: response.status,
            };
        }

        return data;
    }

    public async request<T>(
        endpoint: string,
        config: RequestInit & {
            maxRetries?: number;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            params?: Record<string, any>;
        } = {},
        baseUrl?: string
    ): Promise<CommonResponse<T>> {
        const {
            headers = {},
            maxRetries = this.takoConfig.TAKO_RETRY_LIMIT,
            ...options
        } = config;

        const defaultHeaders: Record<string, string> = {
            Accept: "application/json",
            "X-API-KEY": this.takoConfig.TAKO_API_KEY,
        };

        if (options.params) {
            endpoint += `?${new URLSearchParams(options.params).toString()}`;
        }

        const finalHeaders = {
            ...defaultHeaders,
            ...headers,
        };

        let attempt = 1;
        while (true) {
            const response = await fetch(
                `${baseUrl || this.baseUrl}${endpoint}`,
                {
                    ...options,
                    headers: finalHeaders,
                }
            );

            if (!response.ok && attempt < maxRetries) {
                attempt++;
                continue;
            }

            const result = await this.handleResponse<T>(response);

            return result;
        }
    }

    async getFCProfile(fid: number) {
        const response = await this.request<FCProfileTakoResponse>(
            EndpointEnum.fcProfile,
            {
                method: "GET",
                params: { fid },
            }
        );
        return formatTakoProfile(response.data);
    }

    async fetchFollowingFeed(limit: number) {
        if (!this.takoConfig.TAKO_TARGET_FOLLOWERS) {
            return [];
        }
        const response = await this.request<
            CommonTakoListResponse<FCCastTakoResponse>
        >(EndpointEnum.feedFollowing, {
            method: "GET",
            params: {
                limit,
            },
        });
        const formatted = response.data.items
            .filter((item) => !!item)
            .map((item) => formatTakoPub(item));
        return formatted;
    }

    async fetchFeed(
        limit: number,
        type: "fid" | "community",
        target: string[] | number[]
    ) {
        if (target.length === 0) {
            return [];
        }
        const response = await this.request<
            CommonTakoListResponse<FCCastTakoResponse>
        >(EndpointEnum.feed, {
            method: "GET",
            params: {
                limit,
                target_type: type,
                target_ids: target.join(","),
            },
        });
        return response.data.items.map((item) => formatTakoPub(item));
    }

    async fetchNotification(
        limit: number,
        scene: "comment_and_mention" = "comment_and_mention"
    ) {
        if (!this.takoConfig.TAKO_CHAT_WITH_USER) {
            return [];
        }
        const response = await this.request<
            CommonTakoListResponse<{
                cast?: FCCastTakoResponse | null;
            }>
        >(EndpointEnum.notification, {
            method: "GET",
            params: {
                limit,
                scene,
            },
        });
        return response.data.items
            .filter((item) => !!item.cast && !item.cast.is_deleted)
            .map((item) => formatTakoPub(item.cast));
    }

    async getCommunityInfo(community_id: string) {
        const response = await this.request<Community>(EndpointEnum.community, {
            method: "GET",
            params: {
                community_id,
            },
        });
        return response.data;
    }

    async sendCast(cast: {
        text: string;
        assetUrls: string[];
        quoteId?: string;
        quoteFid?: number;
        replyId?: string;
        replyFid?: number;
        mentions?: number[];
        mentionsPositions?: number[];
        communityId?: string;
        title?: string;
    }) {
        const {
            text,
            replyId,
            quoteId,
            mentions,
            mentionsPositions,
            communityId,
            title,
        } = cast;

        const requestData = {
            text: text === "" ? undefined : text,
            title: title === "" ? undefined : title,
            community_id: communityId,
            cast_hash: replyId || quoteId,
            mentions: mentions,
            mentions_positions: mentionsPositions,
        };

        const response = await this.request<{
            hash: string;
        }>(
            replyId
                ? EndpointEnum.sendReply
                : quoteId
                  ? EndpointEnum.sendQuote
                  : EndpointEnum.sendCast,
            {
                method: "POST",
                body: JSON.stringify(requestData),
            }
        );
        return response.data;
    }

    async sendLike(castHash: string) {
        const response = await this.request(EndpointEnum.sendLike, {
            method: "POST",
            body: JSON.stringify({
                cast_hash: castHash,
            }),
        });

        return response.status === "success";
    }
}
