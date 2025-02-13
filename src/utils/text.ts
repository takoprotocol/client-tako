import { elizaLogger } from "@elizaos/core";

/**
 * Truncate text to fit within the Tako character limit, ensuring it ends at a complete sentence.
 */
function truncateToCompleteSentence(
    text: string,
    maxCastLength: number
): string {
    if (text.length <= maxCastLength) {
        return text;
    }

    // Attempt to truncate at the last period within the limit
    const lastPeriodIndex = text.lastIndexOf(".", maxCastLength - 1);
    if (lastPeriodIndex !== -1) {
        const truncatedAtPeriod = text.slice(0, lastPeriodIndex + 1).trim();
        if (truncatedAtPeriod.length > 0) {
            return truncatedAtPeriod;
        }
    }

    // If no period, truncate to the nearest whitespace within the limit
    const lastSpaceIndex = text.lastIndexOf(" ", maxCastLength - 1);
    if (lastSpaceIndex !== -1) {
        const truncatedAtSpace = text.slice(0, lastSpaceIndex).trim();
        if (truncatedAtSpace.length > 0) {
            return truncatedAtSpace + "...";
        }
    }

    // Fallback: Hard truncate and add ellipsis
    const hardTruncated = text.slice(0, maxCastLength - 3).trim();
    return hardTruncated + "...";
}

export function getCleanedContent(
    newCastContent: string,
    max_context_length?: number
) {
    // First attempt to clean content
    let cleanedContent = "";

    // Try parsing as JSON first
    try {
        const parsedResponse = JSON.parse(newCastContent);
        if (parsedResponse.text) {
            cleanedContent = parsedResponse.text;
        } else if (typeof parsedResponse === "string") {
            cleanedContent = parsedResponse;
        }
    } catch (error) {
        error.linted = true; // make linter happy since catch needs a variable
        // If not JSON, clean the raw content
        cleanedContent = newCastContent
            .replace(/^\s*{?\s*"text":\s*"|"\s*}?\s*$/g, "") // Remove JSON-like wrapper
            .replace(/^['"](.*)['"]$/g, "$1") // Remove quotes
            .replace(/\\"/g, '"') // Unescape quotes
            .replace(/\\n/g, "\n") // Unescape newlines, ensures double spaces
            .trim();
    }

    if (!cleanedContent) {
        elizaLogger.error("Failed to extract valid content from response:", {
            rawResponse: newCastContent,
            attempted: "JSON parsing",
        });
        return;
    }

    // Truncate the content to the maximum cast length specified in the environment settings, ensuring the truncation respects sentence boundaries.
    if (max_context_length) {
        cleanedContent = truncateToCompleteSentence(
            cleanedContent,
            max_context_length
        );
    }

    const removeQuotes = (str: string) => str.replace(/^['"](.*)['"]$/, "$1");

    const fixNewLines = (str: string) => str.replaceAll(/\\n/g, "\n\n"); //ensures double spaces

    // Final cleaning
    cleanedContent = removeQuotes(fixNewLines(cleanedContent));

    return cleanedContent;
}
