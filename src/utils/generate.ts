import {
    elizaLogger,
    generateText,
    getModelSettings,
    IAgentRuntime,
    ModelClass,
    trimTokens,
} from "@elizaos/core";

/**
 * Send a message to the model for generateText.
 * @param opts - The options for the generateText request.
 * @param opts.context The context of the message to be completed.
 * @param opts.stop A list of strings to stop the generateText at.
 * @param opts.model The model to use for generateText.
 * @param opts.frequency_penalty The frequency penalty to apply to the generateText.
 * @param opts.presence_penalty The presence penalty to apply to the generateText.
 * @param opts.temperature The temperature to apply to the generateText.
 * @param opts.max_context_length The maximum length of the context to apply to the generateText.
 * @returns The completed message.
 */
export async function generateWebSearchKeywords({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<string> {
    const modelSettings = getModelSettings(runtime.modelProvider, modelClass);
    const max_context_length = modelSettings.maxInputTokens;

    context = await trimTokens(context, max_context_length, runtime);
    elizaLogger.debug("Context:", context);
    try {
        elizaLogger.log("Generating message response..");

        const response = await generateText({
            runtime,
            context,
            modelClass,
        });

        const text = response.split("\n")[0].replace("NONE", "").trim();

        return text;
    } catch (error) {
        elizaLogger.error("Error generating web search keywords:", error);
    }
}
