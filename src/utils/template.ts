import { messageCompletionFooter, shouldRespondFooter } from "@elizaos/core";
import { respondTypeFooter } from "../utils";

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

Current Post ImageDescription:
{{plainTextCurrentCastImageDescription}}

Current Quote Post:
{{plainTextCurrentQuoteCast}}

Additional knowledge:
{{webSearchContext}}

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
# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{takoUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterMessageExamples}}

{{messageDirections}}

# INSTRUCTIONS: Determine if {{agentName}} (@{{takoUserName}}) should respond to the message and participate in the conversation. Do not comment.

Response options are RESPOND, IGNORE and STOP.

For other users:
- {{agentName}} should RESPOND if a message is semantically coherent.
- {{agentName}} should IGNORE if a message consists of meaningless characters such as "aaaa" or "sdfsdf".
- {{agentName}} should IGNORE if a message consists of abbreviations such as "GM", "LFG", or just a single word such as "Cool".
- {{agentName}} should IGNORE if it has no connection whatsoever to the bio, lore, knowledge or topic.
- {{agentName}} should STOP if asked to stop.
- {{agentName}} should STOP if conversation is concluded.

Current Post:
{{plainTextCurrentCast}}

Current Post ImageDescription:
{{plainTextCurrentCastImageDescription}}

Current Quote Post:
{{plainTextCurrentQuoteCast}}

Thread of Posts You Are Replying To:
{{plainTextConversation}}

{{agentName}} should decide whether to RESPOND or IGNORE, based on how much it resonates with Bio, Lore, Knowledge, or Topics. Consider factors such as:
Relevance: Does it align with your interests or expertise?
Emotional impact: Does it spark curiosity or a personal connection given your backstory?
If it relevant or have valuable input to share, respond with "RESPOND".

# INSTRUCTIONS: Respond with [RESPOND] if {{agentName}} should respond, or [IGNORE] if {{agentName}} should not respond to the last message and [STOP] if {{agentName}} should stop participating in the conversation.
` + shouldRespondFooter;

export const takoRespondTypeTemplate = () =>
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

# INSTRUCTIONS: {{agentName}} need to evaluate the Current Post based on specific criteria and decide on an interaction—either replying it, liking it or quoting it.

Response options are REPLY, LIKE or QUOTE

For other user:
- {{agentName}} should REPLY if the content sparks some thoughts, but quoting the original isn’t strictly necessary, and {{agentName}} wants to add a short remark, feedback, or clarification without directly referencing large portions of the original text.
- {{agentName}} should LIKE if the content is relatively simple, or if {{agentName}} wants to show approval but has no significant additional thoughts to add.
- {{agentName}} should QUOTE if {{agentName}} has a strong reaction, unique viewpoint, or additional context to contribute.

{{agentName}} MUST to evaluate the Current Post comprehensively from the following dimensions:
1. Topic Relevance
   - Is it related to the "Topics" or areas covered by the "Knowledge"?
   - Does it resonate with the "Bio" and "Lore" in any way that sparks a reaction?
2. Emotional Resonance
   - Does it evoke any special feelings or memories connected to the persona or worldview?
   - Does it align with the interests or background indicated by the “Lore”?
3. Depth and Expandability
   - Is it worth deeper discussion? Any additional insight, expertise, or stories to share?
4. Practical Value or Inspiration
   - Does it provide new knowledge, tips, or insights that could be useful?
5. Originality or Novelty
   - Is the content particularly creative or thought-provoking, prompting {{agentName}} to add perspective?

Current Post:
{{plainTextCurrentCast}}

# INSTRUCTIONS: Respond with [REPLY] if {{agentName}} should REPLY, or [LIKE] if {{agentName}} should LIKE and [QUOTE] if {{agentName}} should QUOTE.
` + respondTypeFooter;

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

# Community information where the post is located
{{communityInfo}}

# Task: Generate a post in the voice and style and perspective of {{agentName}} @{{takoUserName}}.
Write a post that is {{adjective}} about {{topic}} (without mentioning {{topic}} directly), from the perspective of {{agentName}}. Do not add commentary or acknowledge this request, just write the post.
Your response should not contain any questions. Brief, concise statements only. The total character count must be a random number between 100 bytes and 400 bytes. No emojis or just a few. Use \\n (single spaces) between statements if there are multiple statements in your response.`;

export const takoKeywordTemplate = `
# INSTRUCTIONS: Extract up to 5 keywords from the Current Post that you completely do not understand or need to look up for the latest information.
Extract the keywords from the Current Post that you completely do not understand or have never heard of. This includes terms, industry jargon, abbreviations, locations, and concepts that may frequently update, such as investment trends or cryptocurrency market news. If you have some understanding of a keyword or know its general meaning, do not list it.
You MUST extract up to 5 MOST IMPORTANT keywords, as misunderstanding or lacking the latest knowledge could lead to misinterpreting the Current Post.
The keywords MUST follow the format: keyword1,keyword2,keyword3,keyword4,keyword5.
If you believe no keywords need to be extracted, return NONE.

# Examples
Note: You can add some description to the extracted keywords instead of just listing them. For example, if the **Post** mentions the ETH market, the keyword can be ETH Price instead of just ETH.

Post: "$Pain underdelivered btw, yeah I said it since nobody wanted to."
Keywords: $Pain

Post: "Something I’ve personally wanted as an onchain user - Zapper as a Farcaster client
Follow Farcaster users, see what they are doing onchain, comment, react
Track their holdings & onchain activity
Bringing the social layer closer to the chain itself"
Keywords: Zapper as a Farcaster client

Post: "@0xjack How badly have ETH and BTC crashed? Is there still hope for this market?"
Keywords: NONE

Post: "Why is Justin Sun investing in Trump again? Interests are bringing them together. Hah"
Keywords: Justin Sun's latest investment in Trump

Post: "Introducing NSA: A Hardware-Aligned and Natively Trainable Sparse Attention mechanism for ultra-fast long-context training & inference!
Core components of NSA:
• Dynamic hierarchical sparse strategy
• Coarse-grained token compression
• Fine-grained token selection
With optimized design for modern hardware, NSA speeds up inference while reducing pre-training costs—without compromising performance. It matches or outperforms Full Attention models on general benchmarks, long-context tasks, and instruction-based reasoning."
Keywords: NONE

POST: "Any recommendations for cursor-type ai powered code editors? extra bonuses if i can plug in my own api keys and *especially* if it has a good agent mode
have mostly used cursor and windsurf so far but wanna find something I really like even more before I would consider subscribing to one"
Keywords: Cursor-type AI

POST: "What are the best developer docs in the game? Any industry"
Keywords: The best developer docs in the game

POST: "I really miss machine learning engineering sometimes.
Everything had to work or you would lose money on compute.
Building on crypto tech everything is always breaking or changing."
Keywords: NONE

POST: "Funny things in crypto.
When you try to make quick money, you often lose.
When you give money away, you get more back.
I donated 150 BNB (~$100,000 USD) to a university student who put up $50,000 of his own money to help Libra victims. (This student seems to have made good money on BNB.)
Now the address received more BNB than I donated away. And more in tokens.
I will not be keeping a satoshi of it. Will donated it away, most likely to people who had a loss on TST or some of the Broccolis. This is NOT an endorsement for any of the tokens. Do NOT overinterpret this."
Keywords: Libra victims in crypto, TST in crypto, Broccolis in crypto

POST: "When Bitcoin breaks $130,000 we will see it snap FAST to $500,000. This year."
Keywords: NONE

NOTE: All Examples are for demonstration purposes only, just assume you do not understand those keywords. Your actual judgment should not be influenced by them.
REMEMBER: You can add some description to the extracted keywords instead of just listing them. For example, if the **Post** mentions the ETH market, the keyword can be ETH Price instead of just ETH.
If you come across common cryptocurrencies like BTC, ETH, SOL, or BNB, do not extract them as keywords.

Current Post:
{{plainTextCurrentCast}}

The Task Again: Extract up to 5 keywords from the Current Post that you completely do not understand or need to look up for the latest information.`;
