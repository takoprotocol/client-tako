import { FCProfileTako, FCProfileTakoResponse } from ".";

export type FCCastEmbedTako =
    | {
          url: string;
          ext:
              | {
                    type: "image";
                    height: number;
                    width: number;
                    url: string;
                }
              | {
                    type: "video";
                    thumbnail_url?: string;
                    height: number;
                    width: number;
                    url: string;
                }
              | {
                    type: "url";
                    description?: string;
                    title?: string;
                    image: string;
                    url: string;
                    use_large_image: boolean;
                }
              | {
                    type: "frame";
                    description?: string;
                    title?: string;
                }
              | {
                    type: "frame_v2";
                    description?: string;
                    title?: string;
                }
              | { type: "error" };
      }
    | {
          url: string;
      }
    | {
          cast_id: {
              fid: number;
              hash: string;
          };
      };

export type FCCastEmbedTakoWithExt = Extract<
    FCCastEmbedTako,
    { ext: { type: string } }
>;
export type FCCastEmbedTakoImage = Extract<
    NonNullable<FCCastEmbedTakoWithExt["ext"]>,
    { type: "image" }
>;
export type FCCastEmbedTakoVideo = Extract<
    NonNullable<FCCastEmbedTakoWithExt["ext"]>,
    { type: "video" }
>;
export type FCCastEmbedTakoUrl = Extract<
    NonNullable<FCCastEmbedTakoWithExt["ext"]>,
    { type: "url" }
>;
export type FCCastEmbedTakoFrame = Extract<
    NonNullable<FCCastEmbedTakoWithExt["ext"]>,
    { type: "frame" }
>;
export type FCCastEmbedTakoFrameV2 = Extract<
    NonNullable<FCCastEmbedTakoWithExt["ext"]>,
    { type: "frame_v2" }
>;

export interface FCCastTakoResponse {
    hash: string;
    parent_hash?: string;
    parent_cast?: FCCastTakoResponse;
    quote_cast?: FCCastTakoResponse;
    ancestors?: FCCastTakoResponse[];
    created_at: number;

    text: string;

    author: FCProfileTakoResponse;
    mentions: number[];
    mentions_positions: number[];
    mentioned_users: FCProfileTakoResponse[];

    is_deleted?: boolean;

    embeds?: FCCastEmbedTako[];
}

export interface FCCastTako {
    hash: string;
    parent_cast?: FCCastTako;
    parent_hash?: string;
    ancestors?: FCCastTako[];
    quote_cast?: FCCastTako;
    created_at?: string | number;

    metadata: {
        content: string;
        videos?: FCCastEmbedTakoVideo[];
        images?: FCCastEmbedTakoImage[];
        embeds?: FCCastEmbedTakoUrl[];
        frames?: FCCastEmbedTakoFrame[];
        frame_v2s?: FCCastEmbedTakoFrameV2[];
    };

    author: FCProfileTako;
    mentioned_users: FCProfileTako[];
}
