import { Client, elizaLogger, IAgentRuntime } from "@elizaos/core";
import { ClientBase } from "./base.ts";
import { TakoConfig, validateTakoConfig } from "./environment.ts";
import { TakoInteractionClient } from "./interactions.ts";
import { TakoPostClient } from "./post.ts";
import { wait } from "./utils.ts";

/**
 * A manager that orchestrates all specialized Tako logic:
 * - client: base operations (login, timeline caching, etc.)
 * - post: autonomous posting logic
 * - interaction: handling mentions, replies
 */
class TakoManager {
    client: ClientBase;
    post: TakoPostClient;
    interaction: TakoInteractionClient;

    constructor(runtime: IAgentRuntime, takoConfig: TakoConfig) {
        // Pass takoConfig to the base client
        this.client = new ClientBase(runtime, takoConfig);

        // Posting logic
        this.post = new TakoPostClient(this.client, runtime);

        // Mentions and interactions
        this.interaction = new TakoInteractionClient(this.client, runtime);
    }
}

export const TakoClientInterface: Client = {
    async start(runtime: IAgentRuntime) {
        const takoConfig: TakoConfig = await validateTakoConfig(runtime);

        const startDelay = takoConfig.TAKO_START_DELAY || false;
        if (startDelay) {
            const randomSeconds = Math.floor(Math.random() * 1 * 60);
            elizaLogger.log(
                `Tako client starting with delay: ${randomSeconds}s`
            );
            await wait(randomSeconds * 1000);
        }

        elizaLogger.log("Tako client started");

        const manager = new TakoManager(runtime, takoConfig);

        await manager.client.init();

        if (takoConfig.TAKO_NEW_CAST) {
            await manager.post.start();
        }

        if (takoConfig.TAKO_PROACTIVE_COMMENTING) {
            await manager.interaction.start();
        }

        return manager;
    },

    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("Tako client does not support stopping yet");
    },
};

export default TakoClientInterface;
