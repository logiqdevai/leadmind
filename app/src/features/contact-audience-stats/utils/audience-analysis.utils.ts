import type { ContactAudienceAnalysisContent } from "../interfaces/contact-audience-analysis.interface";

/** A pending or failed analysis stores an empty object instead of content. */
export function isAudienceAnalysisContent(
    value: ContactAudienceAnalysisContent | Record<string, never>,
): value is ContactAudienceAnalysisContent {
    return typeof value === "object" && value !== null && "summary" in value && typeof value.summary === "string";
}
