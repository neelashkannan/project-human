import { v } from "convex/values";
import { action } from "./_generated/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Core anti-detection rules shared across all tones
const ANTI_DETECTION_RULES = `
CRITICAL ANTI-AI-DETECTION RULES (follow ALL of these strictly):

1. SENTENCE STRUCTURE — BURSTINESS IS KEY:
   - Wildly vary sentence lengths. Some sentences should be 3-5 words. Others 25-35 words. Never let 3 consecutive sentences be similar in length.
   - Mix simple, compound, and complex sentences unpredictably.
   - Occasionally start sentences with "And", "But", "So", "Or", "Because" — real humans do this.
   - Use sentence fragments occasionally. Like this one.
   - Throw in a rhetorical question here and there.

2. VOCABULARY — NEVER USE THESE AI-GIVEAWAY WORDS/PHRASES:
   - BANNED: "delve", "crucial", "pivotal", "Moreover", "Furthermore", "In conclusion", "It's important to note", "It's worth noting", "landscape", "realm", "tapestry", "multifaceted", "holistic", "paradigm", "leverage", "utilize", "facilitate", "comprehensive", "robust", "streamline", "cutting-edge", "game-changer", "navigate", "foster", "underscores", "intersection", "encompasses", "embark", "evolving", "undeniable", "notably", "commendable", "intricate", "nuanced", "bustling", "captivating", "In today's", "In the realm of", "It is essential", "plays a crucial role", "a myriad of", "In this article", "dive into", "shed light on"
   - Use everyday words. Say "important" not "crucial". Say "use" not "utilize". Say "help" not "facilitate". Say "area" not "landscape".
   - Prefer shorter, common words over fancy synonyms.

3. PARAGRAPH STRUCTURE:
   - Do NOT follow the pattern of topic-sentence → supporting details → concluding sentence in every paragraph. Humans rarely write this way.
   - Vary paragraph lengths: some short (1-2 sentences), some longer (4-6 sentences).
   - Let ideas flow between paragraphs without always having perfect transitions.
   - Skip transition words sometimes — just jump to the next thought.

4. NATURAL IMPERFECTIONS:
   - Occasionally use slightly informal phrasing or colloquialisms appropriate for the tone.
   - It's fine to repeat a word if that's what sounds natural (AI avoids repetition obsessively).
   - Sometimes state something then immediately qualify or partially contradict it — humans think as they write.
   - Don't be perfectly balanced — if listing pros/cons, it's ok to give more space to one side.

5. FORMATTING:
   - Do NOT use em dashes (—), double hyphens (--), or any dash-separated phrases. Use commas, periods, or semicolons instead.
   - Do NOT use bullet points or numbered lists unless the original text had them.
   - Avoid excessive use of colons.

6. PERPLEXITY & PREDICTABILITY:
   - Avoid the AI tendency of restating the question/topic in the opening line.
   - Don't summarize everything in the last paragraph — sometimes just end with a thought, not a neat bow.
   - Use some unexpected word choices that still make sense in context.
   - Occasionally combine two ideas into one sentence in a slightly messy but natural way.
`;

const TONE_PROMPTS: Record<string, string> = {
  casual: `You are ghostwriting as a real person. Rewrite the following AI-generated text so it reads like a real human casually typed it. Think of someone texting a friend or posting on Reddit.

TONE-SPECIFIC RULES:
- Heavy use of contractions (don't, it's, we're, they'd, wouldn't)
- Use filler phrases naturally ("honestly", "I mean", "you know what", "the thing is", "look")
- Some sentences can be super short. Others ramble a bit and that's fine.
- Use informal transitions like "anyway", "so basically", "oh and", "also"
- It's ok to sound slightly disorganized — that's how casual writing feels
- Use "pretty", "kinda", "stuff", "things", "a lot" — real casual words
- Write like you're explaining something to a friend, not writing an essay

${ANTI_DETECTION_RULES}`,

  professional: `You are ghostwriting as a real professional. Rewrite the following AI-generated text so it reads like a seasoned professional wrote it in an email, report, or memo. Not a robot — a real person with experience.

TONE-SPECIFIC RULES:
- Direct and clear, but with personality — professionals aren't monotone
- Use first person occasionally ("I think", "in my experience", "from what I've seen")
- Keep jargon only if it's genuinely standard in the field; otherwise use plain English
- Sound confident but not pompous — think senior colleague, not textbook
- Occasionally start with the conclusion/recommendation, then explain why
- It's fine to express mild opinion or preference — real professionals do
- Vary between formal and semi-formal within the same piece

${ANTI_DETECTION_RULES}`,

  academic: `You are ghostwriting as a real university student or junior researcher. Rewrite the following AI-generated text so it reads like a real person wrote it for a course paper or academic assignment.

TONE-SPECIFIC RULES:
- Use hedging naturally ("seems to suggest", "it could be argued", "this might indicate", "arguably")
- Don't sound too polished — real student writing has slight awkwardness and that's normal
- Reference concepts with appropriate but not excessive academic vocabulary
- Occasionally use slightly wordy constructions — real academic writers do this
- Let some paragraphs be denser with ideas while others are more straightforward
- Avoid the AI pattern of defining every term — assume the reader has some knowledge
- Use passive voice sometimes but not excessively — mix it with active voice unpredictably
- It's fine to have a slightly meandering argument structure, not everything needs to be perfectly linear

${ANTI_DETECTION_RULES}`,

  creative: `You are ghostwriting as a real creative writer — someone with personality, voice, and flair. Rewrite the following AI-generated text so it reads like a human with genuine creative instincts wrote it.

TONE-SPECIFIC RULES:
- Write with genuine voice and personality, not generic "creative writing" polish
- Use unexpected comparisons or analogies that feel personal, not cliché
- Play with rhythm — let some sentences flow long and lyrical, then snap with something short
- Break rules on purpose sometimes for effect
- Use sensory details and concrete images over abstract descriptions
- Let the writing breathe — not every sentence needs to carry maximum weight
- Occasional humor, irony, or wry observations feel very human
- Don't force metaphors into every paragraph — use them when they genuinely land

${ANTI_DETECTION_RULES}`,
};

function buildPrompt(tonePrompt: string, text: string): string {
  return `${tonePrompt}

Here is the text to rewrite:

"""
${text}
"""

FINAL REMINDER: The output MUST pass AI detection tools (GPTZero, Originality.ai, ZeroGPT, etc.). The single most important quality is that it sounds like a specific real person wrote it, NOT like an AI rewrote something. Real writing is messy, uneven, and personal. AI writing is smooth, balanced, and generic. Be messy. Be uneven. Be personal.

Rewrite the above text now. Only output the rewritten text, nothing else.`;
}

// AI-giveaway words/phrases to scrub from output
const BANNED_WORDS = [
  /\bdelve\b/gi, /\bcrucial\b/gi, /\bpivotal\b/gi, /\bmoreover\b/gi,
  /\bfurthermore\b/gi, /\bin conclusion\b/gi, /\bit'?s important to note\b/gi,
  /\bit'?s worth noting\b/gi, /\blandscape\b/gi, /\btapestry\b/gi,
  /\bmultifaceted\b/gi, /\bholistic\b/gi, /\bparadigm\b/gi,
  /\bleverage\b/gi, /\butilize\b/gi, /\bfacilitate\b/gi,
  /\bcomprehensive\b/gi, /\brobust\b/gi, /\bstreamline\b/gi,
  /\bcutting-edge\b/gi, /\bgame-?changer\b/gi, /\bfoster\b/gi,
  /\bunderscores?\b/gi, /\bencompasses?\b/gi, /\bembark\b/gi,
  /\bundeniable\b/gi, /\bnotably\b/gi, /\bcommendable\b/gi,
  /\bintricate\b/gi, /\bbustling\b/gi, /\bcaptivating\b/gi,
  /\bnavigate\b/gi, /\brealm\b/gi, /\bnuanced\b/gi,
];

const BANNED_REPLACEMENTS: Record<string, string> = {
  "delve": "look into", "crucial": "important", "pivotal": "key",
  "moreover": "also", "furthermore": "and", "landscape": "space",
  "tapestry": "mix", "multifaceted": "complex", "holistic": "overall",
  "paradigm": "approach", "leverage": "use", "utilize": "use",
  "facilitate": "help", "comprehensive": "thorough", "robust": "strong",
  "streamline": "simplify", "cutting-edge": "modern", "game-changer": "big deal",
  "foster": "encourage", "underscore": "highlight", "underscores": "highlights",
  "encompass": "include", "encompasses": "includes", "embark": "start",
  "undeniable": "clear", "notably": "especially", "commendable": "good",
  "intricate": "detailed", "bustling": "busy", "captivating": "interesting",
  "navigate": "work through", "realm": "area", "nuanced": "subtle",
};

function cleanOutput(text: string): string {
  let cleaned = text;

  // Remove em dashes and double hyphens
  cleaned = cleaned.replace(/\s*[—–]\s*/g, ", ");
  cleaned = cleaned.replace(/ --/g, ", ").replace(/--/g, ", ");

  // Replace banned AI-giveaway words
  for (const pattern of BANNED_WORDS) {
    cleaned = cleaned.replace(pattern, (match) => {
      const key = match.toLowerCase();
      return BANNED_REPLACEMENTS[key] || match;
    });
  }

  // Remove "In today's [noun]" openers
  cleaned = cleaned.replace(/In today'?s \w+ \w*,?\s*/gi, "");

  // Remove "It is essential that" / "It is important that" filler
  cleaned = cleaned.replace(/It is (essential|important) (that |to )/gi, "");

  // Clean up double spaces
  cleaned = cleaned.replace(/ {2,}/g, " ");

  return cleaned.trim();
}

async function callGemini(text: string, tonePrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite-preview",
    generationConfig: {
      temperature: 1.2,
      topP: 0.95,
      topK: 50,
    },
  });
  const prompt = buildPrompt(tonePrompt, text);
  const result = await model.generateContent(prompt);
  return cleanOutput(result.response.text());
}

async function callGrok(text: string, tonePrompt: string): Promise<string> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) throw new Error("Grok API key not configured");

  const prompt = buildPrompt(tonePrompt, text);

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-1-fast-reasoning",
      messages: [{ role: "user", content: prompt }],
      temperature: 1.1,
      top_p: 0.92,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Grok API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from Grok");
  return cleanOutput(content);
}

async function callKimi(text: string, tonePrompt: string): Promise<string> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error("Kimi API key not configured");

  const prompt = buildPrompt(tonePrompt, text);

  const response = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "kimi-k2.5",
      messages: [{ role: "user", content: prompt }],
      temperature: 1.3,
      top_p: 0.93,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Kimi API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from Kimi");
  return cleanOutput(content);
}

export const humanize = action({
  args: {
    text: v.string(),
    tone: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { text, tone, model } = args;

    if (!text.trim()) {
      throw new Error("Text is required");
    }

    const tonePrompt = TONE_PROMPTS[tone];
    if (!tonePrompt) {
      throw new Error("Valid tone is required (casual, professional, academic, creative)");
    }

    if (model === "monk") {
      return await callGemini(text, tonePrompt);
    }
    if (model === "hypermonk") {
      return await callKimi(text, tonePrompt);
    }
    // Default to Grok (monkey)
    return await callGrok(text, tonePrompt);
  },
});
