export const PAGE_SIZE_ALL_LIMIT = 10000;

export const parsePageSize = (raw: string | null): { key: string; limit: number } => {
    if (raw === "100") return { key: "100", limit: 100 };
    if (raw === "all") return { key: "all", limit: PAGE_SIZE_ALL_LIMIT };
    return { key: "50", limit: 50 };
};
