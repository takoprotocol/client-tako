import { messageCompletionFooter, shouldRespondFooter } from "@elizaos/core";

export const takoMessageHandlerTemplate =
    `
# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{takoUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterMessageExamples}}

{{messageDirections}}

# TASK: Generate a post/reply in the voice, style and perspective of {{agentName}} (@{{takoUserName}}) while using the thread of casts as additional context:
The content you generated should not contain any questions. Brief, concise statements only. The total character count must be a random number between 100 bytes and 400 bytes. No emojis or just a few. Use \\n (single spaces) between statements if there are multiple statements in your response.
Try to avoid repeatedly using words or phrases that appear in recent interactions.

Current Post:
{{plainTextCurrentCast}}

Thread of Posts You Are Replying To:
{{plainTextConversation}}

# INSTRUCTIONS: Generate a post in the voice, style and perspective of {{agentName}} (@{{takoUserName}}). You MUST include an action if the current post text includes a prompt that is similar to one of the available actions mentioned here:
{{actionNames}}
{{actions}}

Here is the current post text again. Remember to include an action if the current post text includes a prompt that asks for one of the available actions mentioned above (does not need to be exact)
{{plainTextCurrentCast}}
` + messageCompletionFooter;

export const takoShouldRespondTemplate = () =>
    `
# INSTRUCTIONS: Determine if {{agentName}} (@{{takoUserName}}) should respond to the message and participate in the conversation. Do not comment. Just respond with "true" or "false".

Response options are RESPOND, IGNORE and STOP.

For other users:
- {{agentName}} should RESPOND if a message is semantically coherent.
- {{agentName}} should IGNORE if a message consists of meaningless characters such as "aaaa" or "sdfsdf".
- {{agentName}} should IGNORE if a message consists of abbreviations such as "GM", "LFG", or just a single word such as "Cool".
- {{agentName}} should STOP if asked to stop
- {{agentName}} should STOP if conversation is concluded

Current Post:
{{plainTextCurrentCast}}

Thread of Posts You Are Replying To:
{{plainTextConversation}}

# INSTRUCTIONS: Respond with [RESPOND] if {{agentName}} should respond, or [IGNORE] if {{agentName}} should not respond to the last message and [STOP] if {{agentName}} should stop participating in the conversation.
` + shouldRespondFooter;

export const takoPostTemplate = `
# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{takoUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterPostExamples}}

{{postDirections}}

# Task: Generate a post in the voice and style and perspective of {{agentName}} @{{takoUserName}}.
Write a post that is {{adjective}} about {{topic}} (without mentioning {{topic}} directly), from the perspective of {{agentName}}. Do not add commentary or acknowledge this request, just write the post.
Your response should not contain any questions. Brief, concise statements only. The total character count must be a random number between 100 bytes and 400 bytes. No emojis or just a few. Use \\n (single spaces) between statements if there are multiple statements in your response.`;
