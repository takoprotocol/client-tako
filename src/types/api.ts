export type CommonResponse<T = unknown> = {
    data: T;
    error_code?: number;
    error_msg?: string;
    status: "success" | "error";
};

export interface CommonTakoListResponse<T = unknown> {
    items: T[];
    next_cursor?: string;
}
