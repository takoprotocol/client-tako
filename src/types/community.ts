export interface Community {
    id: number;
    fid: number;
    community_id: string;
    name: string;
    parent_url: string;
    description?: string;
    image_url?: string;
    cover_url?: string;
    rule?: string[];
    created_at: number;
}
